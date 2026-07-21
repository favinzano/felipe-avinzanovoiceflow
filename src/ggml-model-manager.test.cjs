const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { resolveModelUrl, sha256File, ensureModel } = require("./ggml-model-manager.cjs");

assert.equal(
  resolveModelUrl({ repo: "ggerganov/whisper.cpp", file: "ggml-base.bin" }),
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"
);

// in-memory fs stub
const files = new Map();
const fs = {
  promises: {
    async readFile(p) { if (!files.has(p)) throw Object.assign(new Error("nofile"), { code: "ENOENT" }); return files.get(p); },
    async writeFile(p, b) { files.set(p, Buffer.from(b)); },
    async rename(a, b) { files.set(b, files.get(a)); files.delete(a); },
    async access(p) { if (!files.has(p)) throw Object.assign(new Error("nofile"), { code: "ENOENT" }); },
    async mkdir() {}
  }
};
const body = Buffer.from("MODELBYTES");
const sha = crypto.createHash("sha256").update(body).digest("hex");
const fetchImpl = async () => ({ ok: true, arrayBuffer: async () => body });
const ggml = { repo: "r", file: "m.bin", sha256: sha };

(async () => {
  const path = await ensureModel(ggml, { modelsDir: "/models", fetchImpl, fs });
  assert.equal(path, "/models/m.bin");
  assert.ok(files.has("/models/m.bin"));
  // second call: cached, no fetch
  const again = await ensureModel(ggml, { modelsDir: "/models", fetchImpl: () => { throw new Error("should not fetch"); }, fs });
  assert.equal(again, "/models/m.bin");
  // hash mismatch
  files.clear();
  await assert.rejects(ensureModel({ ...ggml, sha256: "0".repeat(64) }, { modelsDir: "/models", fetchImpl, fs }), /model hash mismatch/);
  console.log("ggml-model-manager: 4 checks passed.");
})();
