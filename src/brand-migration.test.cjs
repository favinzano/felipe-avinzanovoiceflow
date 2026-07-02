const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { migrateBrandData, migrationMarkerPath } = require("./brand-migration.cjs");

async function sandbox(fn) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "brand-migration-"));
  try { await fn(root); } finally { await fs.rm(root, { recursive: true, force: true }); }
}
async function json(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value));
}
async function present(file) {
  try { await fs.access(file); return true; } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
async function legacy(source) {
  await json(path.join(source, "voice-state.json"), { history: [{ text: "old words" }] });
  await json(path.join(source, "app-preferences.json"), { launchAtLogin: true });
  for (const [relative, contents] of [
    ["models/model.bin", "model"],
    ["Local Storage/leveldb/000003.log", "local"],
    ["IndexedDB/voice.leveldb/000004.log", "indexed"]
  ]) {
    const file = path.join(source, relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, contents);
  }
}

async function run() {
  await sandbox(async (appDataPath) => {
    const sourcePath = path.join(appDataPath, "Legacy");
    const targetPath = path.join(appDataPath, "VoiceFlow");
    await legacy(sourcePath);
    const first = await migrateBrandData({ appDataPath, targetName: "VoiceFlow", legacyNames: ["Legacy"] });
    assert.deepEqual({ ...first, sourcePath: undefined }, { status: "migrated", targetPath, sourcePath: undefined });
    assert.equal(first.sourcePath, sourcePath);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(targetPath, "voice-state.json"))), { history: [{ text: "old words" }] });
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(targetPath, "app-preferences.json"))), { launchAtLogin: true });
    assert.equal(await fs.readFile(path.join(targetPath, "models/model.bin"), "utf8"), "model");
    assert.equal(await fs.readFile(path.join(targetPath, "Local Storage/leveldb/000003.log"), "utf8"), "local");
    assert.equal(await fs.readFile(path.join(targetPath, "IndexedDB/voice.leveldb/000004.log"), "utf8"), "indexed");
    const marker = JSON.parse(await fs.readFile(migrationMarkerPath(targetPath), "utf8"));
    assert.equal(marker.sourcePath, sourcePath);
    assert.equal(Number.isNaN(Date.parse(marker.completedAt)), false);
    assert.deepEqual(
      await migrateBrandData({ appDataPath, targetName: "VoiceFlow", legacyNames: ["Legacy"] }),
      { status: "already-migrated", targetPath }
    );
    assert.equal(await present(sourcePath), true);
  });

  await sandbox(async (appDataPath) => {
    const source = path.join(appDataPath, "Legacy");
    const target = path.join(appDataPath, "VoiceFlow");
    await legacy(source);
    await fs.mkdir(path.join(target, "models"), { recursive: true });
    await fs.writeFile(path.join(target, "models/model.bin"), "keep-me");
    assert.equal((await migrateBrandData({ appDataPath, targetName: "VoiceFlow", legacyNames: ["Legacy"] })).status, "migrated");
    assert.equal(await fs.readFile(path.join(target, "models/model.bin"), "utf8"), "keep-me");
    assert.equal(await fs.readFile(path.join(source, "models/model.bin"), "utf8"), "model");
  });

  await sandbox(async (appDataPath) => {
    const source = path.join(appDataPath, "Legacy");
    const target = path.join(appDataPath, "VoiceFlow");
    await fs.mkdir(source);
    await fs.writeFile(path.join(source, "voice-state.json"), "bad");
    await json(path.join(source, "voice-state.json.backup"), { history: ["recovered"] });
    assert.equal((await migrateBrandData({ appDataPath, targetName: "VoiceFlow", legacyNames: ["Legacy"] })).status, "migrated");
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(target, "voice-state.json"))), { history: ["recovered"] });
    assert.equal(await fs.readFile(path.join(source, "voice-state.json"), "utf8"), "bad");
  });

  await sandbox(async (appDataPath) => {
    const source = path.join(appDataPath, "Legacy");
    const target = path.join(appDataPath, "VoiceFlow");
    await fs.mkdir(source);
    await fs.writeFile(path.join(source, "voice-state.json"), "bad");
    await fs.writeFile(path.join(source, "voice-state.json.backup"), "also bad");
    const result = await migrateBrandData({ appDataPath, targetName: "VoiceFlow", legacyNames: ["Legacy"] });
    assert.equal(result.status, "fallback");
    assert.equal(result.sourcePath, source);
    assert.equal(result.targetPath, target);
    assert.equal(result.error instanceof Error, true);
    assert.equal(await present(migrationMarkerPath(target)), false);
  });

  await sandbox(async (appDataPath) => {
    const source = path.join(appDataPath, "Legacy");
    const target = path.join(appDataPath, "VoiceFlow");
    await legacy(source);
    let copies = 0;
    const failed = await migrateBrandData({
      appDataPath, targetName: "VoiceFlow", legacyNames: ["Legacy"],
      operations: { copyFile: async (...args) => (++copies === 2 ? Promise.reject(new Error("injected")) : fs.copyFile(...args)) }
    });
    assert.equal(failed.status, "fallback");
    assert.match(failed.error.message, /injected/);
    assert.equal(await present(migrationMarkerPath(target)), false);
    assert.equal(await present(source), true);
    const rerun = await migrateBrandData({ appDataPath, targetName: "VoiceFlow", legacyNames: ["Legacy"] });
    assert.equal(rerun.status, "migrated");
    assert.equal(await fs.readFile(path.join(target, "models/model.bin"), "utf8"), "model");
    assert.equal(await present(migrationMarkerPath(target)), true);
  });

  await sandbox(async (appDataPath) => {
    await json(path.join(appDataPath, "First/voice-state.json"), { chosen: "first" });
    await json(path.join(appDataPath, "Second/voice-state.json"), { chosen: "second" });
    const result = await migrateBrandData({ appDataPath, targetName: "VoiceFlow", legacyNames: ["Missing", "First", "Second", "VoiceFlow"] });
    assert.equal(result.sourcePath, path.join(appDataPath, "First"));
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(appDataPath, "VoiceFlow/voice-state.json"))), { chosen: "first" });
  });

  await sandbox(async (appDataPath) => {
    const targetPath = path.join(appDataPath, "VoiceFlow");
    assert.deepEqual(
      await migrateBrandData({ appDataPath, targetName: "VoiceFlow", legacyNames: ["Missing", "VoiceFlow"] }),
      { status: "not-needed", targetPath }
    );
    assert.equal(await present(targetPath), false);
  });

  await sandbox(async (appDataPath) => {
    const source = path.join(appDataPath, "Legacy");
    const target = path.join(appDataPath, "VoiceFlow");
    await json(path.join(source, "voice-state.json"), { valid: true });
    await fs.writeFile(path.join(source, "app-preferences.json"), "bad preferences");
    const result = await migrateBrandData({ appDataPath, targetName: "VoiceFlow", legacyNames: ["Legacy"] });
    assert.equal(result.status, "fallback");
    assert.equal(await present(migrationMarkerPath(target)), false);
  });
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
