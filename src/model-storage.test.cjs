const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
  clearModelCache,
  directorySize,
  ensureModelCache,
  getModelCacheDir
} = require("./model-storage.cjs");
const { isRetryableModelError, loadModelWithRetry } = require("./model-recovery.cjs");

async function run() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "voiceflow-model-test-"));
  const cacheDir = getModelCacheDir(root);
  assert.equal(cacheDir, path.join(root, "models"));
  assert.equal(await ensureModelCache(root, "fast"), cacheDir);
  await fs.writeFile(path.join(cacheDir, "test.bin"), Buffer.alloc(1024));
  assert.equal(await directorySize(cacheDir), 1024);
  assert.equal(await clearModelCache(root), cacheDir);
  assert.equal(await directorySize(cacheDir), 0);
  assert.equal(isRetryableModelError(new Error("temporary ONNX initialization failure")), true);
  assert.equal(isRetryableModelError(new Error("ENOSPC: no space left")), false);
  assert.equal(isRetryableModelError(new Error("HTTP 403 Forbidden")), false);
  let attempts = 0;
  const recovered = await loadModelWithRetry(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("temporary failure");
    return "ready";
  }, { maxAttempts: 2 });
  assert.deepEqual(recovered, { value: "ready", attempts: 2 });
  attempts = 0;
  await assert.rejects(loadModelWithRetry(async () => {
    attempts += 1;
    throw new Error("Espacio insuficiente");
  }, { maxAttempts: 2 }), /Espacio insuficiente/);
  assert.equal(attempts, 1);
  await fs.rm(root, { recursive: true, force: true });
  console.log("10 model storage and recovery cases passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
