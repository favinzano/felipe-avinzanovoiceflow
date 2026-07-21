const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createWhisperCppService } = require("./whisper-cpp-service.cjs");

function fakeFs(initial = {}) {
  const files = new Map(Object.entries(initial));
  return {
    _files: files,
    existsSync: (p) => files.has(p),
    promises: {
      writeFile: async (p, b) => void files.set(p, Buffer.from(b)),
      readFile: async (p) => { if (!files.has(p)) throw new Error("nofile"); return files.get(p); },
      unlink: async (p) => void files.delete(p),
      mkdir: async () => {},
      access: async (p) => { if (!files.has(p)) throw Object.assign(new Error("x"), { code: "ENOENT" }); }
    }
  };
}

(async () => {
  const fs = fakeFs({ "/bin/whisper-cli": Buffer.from("x"), "/models/m.bin": Buffer.from("model") });
  const spawnImpl = (bin, args) => {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter(); proc.stderr = new EventEmitter();
    // find the -f wav path, write its .json, then exit 0
    const wav = args[args.indexOf("-f") + 1] ?? args[args.length - 1];
    fs._files.set(`${wav}.json`, Buffer.from(JSON.stringify({ transcription: [{ text: " ok" }] })));
    queueMicrotask(() => proc.emit("close", 0));
    return proc;
  };
  const svc = createWhisperCppService({
    binaryPath: "/bin/whisper-cli", modelsDir: "/models", tmpDir: "/tmp",
    spawnImpl, fs, ensureModelImpl: async () => "/models/m.bin"
  });
  assert.equal(svc.isAvailable(), true);
  const out = await svc.transcribe(Float32Array.from([0, 0.1, -0.1]), "es", { id: "balanced", ggml: { file: "m.bin" } });
  assert.equal(out.text, "ok");
  assert.equal(out.engine, "whisper-cpp");
  assert.equal(out.device, "cpu");
  // temp wav + json cleaned up
  assert.equal([...fs._files.keys()].some((k) => k.endsWith(".wav") || k.endsWith(".json")), false);

  // missing binary -> unavailable
  const svc2 = createWhisperCppService({ binaryPath: "/bin/none", modelsDir: "/models", tmpDir: "/tmp", spawnImpl, fs, ensureModelImpl: async () => "/models/m.bin" });
  assert.equal(svc2.isAvailable(), false);
  await assert.rejects(svc2.transcribe(Float32Array.from([0]), "es", { id: "balanced", ggml: { file: "m.bin" } }), /unavailable/);
  console.log("whisper-cpp-service: 6 checks passed.");
})();
