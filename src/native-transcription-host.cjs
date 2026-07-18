const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

const MAX_HEADER_BYTES = 1024 * 1024;
const MAX_BINARY_BYTES = 64 * 1024 * 1024;

function encodeFrame(message, binary) {
  const header = Buffer.from(JSON.stringify(message), "utf8");
  const payload = binary ? Buffer.from(binary.buffer || binary, binary.byteOffset || 0, binary.byteLength) : Buffer.alloc(0);
  if (header.length > MAX_HEADER_BYTES || payload.length > MAX_BINARY_BYTES) throw new Error("Native host frame exceeds its limit.");
  const frame = Buffer.allocUnsafe(8 + header.length + payload.length);
  frame.writeUInt32LE(header.length, 0);
  frame.writeUInt32LE(payload.length, 4);
  header.copy(frame, 8);
  payload.copy(frame, 8 + header.length);
  return frame;
}

function createFrameDecoder(onFrame) {
  let buffer = Buffer.alloc(0);
  return function push(chunk) {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 8) {
      const headerLength = buffer.readUInt32LE(0);
      const binaryLength = buffer.readUInt32LE(4);
      if (headerLength > MAX_HEADER_BYTES || binaryLength > MAX_BINARY_BYTES) throw new Error("Native host sent an oversized frame.");
      const frameLength = 8 + headerLength + binaryLength;
      if (buffer.length < frameLength) return;
      const message = JSON.parse(buffer.subarray(8, 8 + headerLength).toString("utf8"));
      const binary = buffer.subarray(8 + headerLength, frameLength);
      buffer = buffer.subarray(frameLength);
      onFrame(message, binary);
    }
  };
}

function createNativeTranscriptionHost(executablePath, options = {}) {
  const spawnImpl = options.spawnImpl || spawn;
  const timeoutMs = options.timeoutMs || 120000;
  let child;
  let generation = 0;
  const pending = new Map();

  function failPending(error) {
    for (const request of pending.values()) {
      clearTimeout(request.timeout);
      request.reject(error);
    }
    pending.clear();
  }

  function ensureHost() {
    if (child && !child.killed) return child;
    const started = spawnImpl(executablePath, ["serve"], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    child = started;
    generation += 1;
    const decode = createFrameDecoder((message) => {
      const request = pending.get(message.requestId);
      if (!request) return;
      pending.delete(message.requestId);
      clearTimeout(request.timeout);
      if (message.ok === false) request.reject(new Error(message.error || "native_host_error"));
      else request.resolve(message.result ?? message);
    });
    started.stdout.on("data", decode);
    const failed = (error) => {
      if (child === started) child = undefined;
      failPending(error instanceof Error ? error : new Error("native_host_exited"));
    };
    started.once("error", failed);
    started.once("exit", (code) => failed(new Error(`native_host_exited_${code}`)));
    return started;
  }

  function request(command, data = {}, binary) {
    return new Promise((resolve, reject) => {
      let process;
      try {
        process = ensureHost();
      } catch (error) {
        reject(error);
        return;
      }
      const requestId = crypto.randomUUID();
      const request = { resolve, reject };
      request.timeout = setTimeout(() => {
        pending.delete(requestId);
        if (child === process) {
          child = undefined;
          process.kill();
        }
        reject(new Error("native_host_timeout"));
      }, timeoutMs);
      pending.set(requestId, request);
      process.stdin.write(encodeFrame({ requestId, command, ...data }, binary), (error) => {
        if (!error) return;
        pending.delete(requestId);
        clearTimeout(request.timeout);
        reject(error);
      });
    });
  }

  return {
    prepare: (configuration) => request("prepare", { configuration }),
    start: (configuration) => request("start", { configuration }),
    pushAudio: (sessionId, audio) => request("pushAudio", { sessionId, format: "f32le" }, audio),
    finish: (sessionId) => request("finish", { sessionId }),
    cancel: (sessionId) => request("cancel", { sessionId }),
    health: () => request("health"),
    async dispose() {
      const running = child;
      child = undefined;
      failPending(new Error("native_host_disposed"));
      if (running && !running.killed) {
        running.stdin.write(encodeFrame({ command: "dispose" }));
        running.kill();
      }
    },
    localHealth: () => ({ running: Boolean(child && !child.killed), generation, pending: pending.size })
  };
}

module.exports = { MAX_BINARY_BYTES, MAX_HEADER_BYTES, createFrameDecoder, createNativeTranscriptionHost, encodeFrame };
