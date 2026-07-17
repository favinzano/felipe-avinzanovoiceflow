const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { PassThrough, Writable } = require("node:stream");
const { createFrameDecoder, createNativeTranscriptionHost, encodeFrame } = require("./native-transcription-host.cjs");

const audio = new Float32Array([0.25, -0.5]);
const frame = encodeFrame({ command: "pushAudio", sessionId: "one" }, audio);
const decoded = [];
const decode = createFrameDecoder((message, binary) => decoded.push({ message, binary }));
decode(frame.subarray(0, 3));
decode(frame.subarray(3, 11));
decode(frame.subarray(11));
assert.equal(decoded.length, 1);
assert.equal(decoded[0].message.sessionId, "one");
assert.deepEqual([decoded[0].binary.readFloatLE(0), decoded[0].binary.readFloatLE(4)], [...audio]);

(async () => {
  let spawns = 0;
  const spawnImpl = () => {
    spawns += 1;
    const child = new EventEmitter();
    child.killed = false;
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    const requestDecoder = createFrameDecoder((message, binary) => {
      const result = message.command === "pushAudio" ? { bytes: binary.length } : { command: message.command };
      child.stdout.write(encodeFrame({ requestId: message.requestId, ok: true, result }));
    });
    child.stdin = new Writable({ write(chunk, _encoding, callback) { requestDecoder(chunk); callback(); } });
    child.kill = () => { child.killed = true; };
    return child;
  };
  const host = createNativeTranscriptionHost("host.exe", { spawnImpl, timeoutMs: 1000 });
  assert.deepEqual(await host.prepare({ model: "local" }), { command: "prepare" });
  assert.deepEqual(await host.pushAudio("session", audio), { bytes: audio.byteLength });
  assert.equal(spawns, 1);
  assert.equal(host.localHealth().running, true);
  await host.dispose();
  console.log("Native transcription host: 8 checks passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
