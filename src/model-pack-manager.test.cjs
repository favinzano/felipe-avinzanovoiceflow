const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createModelPackManager, safeRelativePath, validateManifest } = require("./model-pack-manager.cjs");

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "voiceflow-pack-test-"));
  const source = path.join(root, "source");
  await fs.mkdir(source);
  const bytes = Buffer.from("offline model bytes");
  await fs.writeFile(path.join(source, "model.onnx"), bytes);
  const manifest = {
    schemaVersion: 1,
    id: "parakeet-es-int8",
    version: "1.0.0",
    engine: "sherpa-onnx",
    languages: ["es"],
    license: "CC-BY-4.0",
    minAppVersion: "1.1.0",
    files: [{ path: "model.onnx", size: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") }]
  };
  await fs.writeFile(path.join(source, "manifest.json"), JSON.stringify(manifest));

  assert.equal(safeRelativePath("models/model.onnx"), true);
  assert.equal(safeRelativePath("../model.onnx"), false);
  assert.throws(() => validateManifest({ ...manifest, minAppVersion: "9.0.0" }, "1.1.9"), /requiere/);

  const manager = createModelPackManager(path.join(root, "user-data"), "1.1.9");
  const installed = await manager.install(source);
  assert.equal(installed.id, manifest.id);
  assert.equal(installed.totalBytes, bytes.length);
  assert.equal((await manager.list())[0].engine, "sherpa-onnx");
  await assert.rejects(manager.install(source), /ya está instalada/);

  await fs.writeFile(path.join(source, "model.onnx"), "tampered");
  await assert.rejects(manager.verify(source), /Tamaño|SHA-256/);
  await fs.rm(root, { recursive: true, force: true });
  console.log("model-pack-manager tests passed (8 checks)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
