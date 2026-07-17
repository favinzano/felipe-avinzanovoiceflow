const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
  assertSafeUserDataPath,
  erasePersonalDataFiles
} = require("./personal-data.cjs");

async function run() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "voiceflow-personal-data-"));
  const personal = [
    "app-preferences.json",
    "voice-state.json",
    "voice-state.json.backup",
    "voice-state.json.123.tmp",
    "transcriptions.db",
    "transcriptions.db-wal"
  ];
  for (const name of personal) await fs.writeFile(path.join(root, name), "private", "utf8");
  await fs.mkdir(path.join(root, "models"));
  await fs.writeFile(path.join(root, "models", "model.onnx"), "model", "utf8");
  await fs.writeFile(path.join(root, "brand-migration.json"), "keep", "utf8");

  const removed = await erasePersonalDataFiles(root);
  assert.deepEqual(removed.sort(), personal.sort());
  await assert.rejects(fs.access(path.join(root, "voice-state.json")));
  assert.equal(await fs.readFile(path.join(root, "models", "model.onnx"), "utf8"), "model");
  assert.equal(await fs.readFile(path.join(root, "brand-migration.json"), "utf8"), "keep");
  assert.throws(() => assertSafeUserDataPath("relative"));
  assert.throws(() => assertSafeUserDataPath(path.parse(root).root));

  await fs.rm(root, { recursive: true, force: true });
  console.log("Personal data erasure: 6 checks passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
