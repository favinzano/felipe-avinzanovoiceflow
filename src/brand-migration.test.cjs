const assert = require("node:assert/strict");
const { constants } = require("node:fs");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { migrateBrandData, migrationMarkerPath, sameMigrationPath } = require("./brand-migration.cjs");

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

function barrier(parties) {
  let arrived = 0;
  let release;
  const ready = new Promise((resolve) => { release = resolve; });
  return async () => {
    arrived += 1;
    if (arrived === parties) release();
    await ready;
  };
}

async function run() {
  assert.equal(sameMigrationPath("/data/VoiceFlow", "/data/voiceflow", "win32"), true);
  assert.equal(sameMigrationPath("/data/VoiceFlow", "/data/voiceflow", "linux"), false);

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
    const destinationState = path.join(target, "voice-state.json");
    await json(path.join(source, "voice-state.json"), { history: ["legacy"] });
    await json(destinationState, { history: ["destination"] });
    const originalBytes = await fs.readFile(destinationState);

    const result = await migrateBrandData({ appDataPath, targetName: "VoiceFlow", legacyNames: ["Legacy"] });

    assert.equal(result.status, "migrated");
    assert.deepEqual(await fs.readFile(destinationState), originalBytes);
    assert.deepEqual(JSON.parse(await fs.readFile(destinationState)), { history: ["destination"] });
  });

  await sandbox(async (appDataPath) => {
    const source = path.join(appDataPath, "Legacy");
    const target = path.join(appDataPath, "VoiceFlow");
    const destinationState = path.join(target, "voice-state.json");
    await json(path.join(source, "voice-state.json"), { history: ["legacy"] });
    const result = await migrateBrandData({
      appDataPath,
      targetName: "VoiceFlow",
      legacyNames: ["Legacy"],
      operations: {
        link: async (tempPath, destinationPath) => {
          if (destinationPath === destinationState) {
            await json(destinationPath, { history: ["race winner"] });
          }
          return fs.link(tempPath, destinationPath);
        }
      }
    });

    assert.equal(result.status, "migrated");
    assert.deepEqual(JSON.parse(await fs.readFile(destinationState)), { history: ["race winner"] });
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

  await sandbox(async (appDataPath) => {
    const source = path.join(appDataPath, "Legacy");
    const target = path.join(appDataPath, "VoiceFlow");
    const outside = path.join(appDataPath, "outside");
    await json(path.join(source, "voice-state.json"), { valid: true });
    await fs.mkdir(path.join(source, "models"), { recursive: true });
    await fs.writeFile(path.join(source, "models", "new.bin"), "source-model");
    await fs.mkdir(target, { recursive: true });
    await fs.mkdir(outside, { recursive: true });
    try {
      await fs.symlink(outside, path.join(target, "models"), process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (error.code === "EPERM" || error.code === "EACCES") return;
      throw error;
    }

    const result = await migrateBrandData({ appDataPath, targetName: "VoiceFlow", legacyNames: ["Legacy"] });

    assert.equal(result.status, "fallback");
    assert.equal(await present(migrationMarkerPath(target)), false);
    assert.equal(await present(path.join(outside, "new.bin")), false);
    assert.equal(await fs.readFile(path.join(source, "models", "new.bin"), "utf8"), "source-model");
  });

  await sandbox(async (appDataPath) => {
    const target = path.join(appDataPath, "VoiceFlow");
    const outside = path.join(appDataPath, "outside-target");
    await fs.mkdir(outside, { recursive: true });
    await json(migrationMarkerPath(outside), {
      sourcePath: path.join(appDataPath, "Legacy"),
      completedAt: "2026-01-01T00:00:00.000Z"
    });
    const outsideMarker = await fs.readFile(migrationMarkerPath(outside));
    try {
      await fs.symlink(outside, target, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (error.code === "EPERM" || error.code === "EACCES") return;
      throw error;
    }

    const result = await migrateBrandData({ appDataPath, targetName: "VoiceFlow", legacyNames: ["Legacy"] });

    assert.equal(result.status, "fallback");
    assert.deepEqual(await fs.readFile(migrationMarkerPath(outside)), outsideMarker);
  });

  await sandbox(async (appDataPath) => {
    const source = path.join(appDataPath, "Legacy");
    const target = path.join(appDataPath, "VoiceFlow");
    const outsideFile = path.join(appDataPath, "outside-model.bin");
    await json(path.join(source, "voice-state.json"), { valid: true });
    await fs.mkdir(path.join(source, "models"), { recursive: true });
    await fs.writeFile(outsideFile, "outside-original");
    try {
      await fs.symlink(outsideFile, path.join(source, "models", "linked.bin"), "file");
    } catch (error) {
      if (error.code === "EPERM" || error.code === "EACCES") return;
      throw error;
    }

    const result = await migrateBrandData({ appDataPath, targetName: "VoiceFlow", legacyNames: ["Legacy"] });

    assert.equal(result.status, "fallback");
    assert.equal(await present(migrationMarkerPath(target)), false);
    assert.equal(await present(path.join(target, "models", "linked.bin")), false);
    assert.equal(await fs.readFile(outsideFile, "utf8"), "outside-original");
  });

  await sandbox(async (appDataPath) => {
    const source = path.join(appDataPath, "Legacy");
    const target = path.join(appDataPath, "VoiceFlow");
    await json(path.join(source, "voice-state.json"), { valid: true });
    try {
      await fs.symlink(
        path.join(appDataPath, "missing-models"),
        path.join(source, "models"),
        process.platform === "win32" ? "junction" : "dir"
      );
    } catch (error) {
      if (error.code === "EPERM" || error.code === "EACCES") return;
      throw error;
    }

    const result = await migrateBrandData({ appDataPath, targetName: "VoiceFlow", legacyNames: ["Legacy"] });

    assert.equal(result.status, "fallback");
    assert.equal(await present(migrationMarkerPath(target)), false);
  });

  await sandbox(async (appDataPath) => {
    const source = path.join(appDataPath, "Legacy");
    const target = path.join(appDataPath, "VoiceFlow");
    const special = path.join(source, "models", "special-entry");
    await json(path.join(source, "voice-state.json"), { valid: true });
    await fs.mkdir(path.dirname(special), { recursive: true });
    await fs.writeFile(special, "placeholder");
    const result = await migrateBrandData({
      appDataPath,
      targetName: "VoiceFlow",
      legacyNames: ["Legacy"],
      operations: {
        lstat: async (file) => file === special
          ? { isSymbolicLink: () => false, isDirectory: () => false, isFile: () => false }
          : fs.lstat(file)
      }
    });

    assert.equal(result.status, "fallback");
    assert.equal(await present(migrationMarkerPath(target)), false);
    assert.equal(await fs.readFile(special, "utf8"), "placeholder");
  });

  await sandbox(async (appDataPath) => {
    const source = path.join(appDataPath, "Legacy");
    const target = path.join(appDataPath, "VoiceFlow");
    await json(path.join(source, "voice-state.json"), { concurrent: true });
    const waitForBothMarkers = barrier(2);
    const markerTemps = [];
    const operations = {
      writeFile: async (file, ...args) => {
        await fs.writeFile(file, ...args);
        if (path.basename(file).startsWith(".voiceflow-brand-migration-v1.json.")) {
          markerTemps.push(file);
          await waitForBothMarkers();
        }
      }
    };

    const results = await Promise.all([
      migrateBrandData({ appDataPath, targetName: "VoiceFlow", legacyNames: ["Legacy"], operations }),
      migrateBrandData({ appDataPath, targetName: "VoiceFlow", legacyNames: ["Legacy"], operations })
    ]);

    assert.equal(results.some((result) => result.status === "migrated"), true);
    assert.equal(results.some((result) => result.status === "already-migrated"), true);
    assert.equal(results.every((result) => result.status === "migrated" || result.status === "already-migrated"), true);
    assert.equal(new Set(markerTemps).size, 2);
    const marker = JSON.parse(await fs.readFile(migrationMarkerPath(target), "utf8"));
    assert.equal(marker.sourcePath, source);
    const files = await fs.readdir(target, { recursive: true });
    assert.deepEqual(files.filter((file) => file.includes(".voiceflow-migration-")), []);
  });

  await sandbox(async (appDataPath) => {
    const source = path.join(appDataPath, "Legacy");
    const target = path.join(appDataPath, "VoiceFlow");
    const fixedTime = new Date("2026-01-02T03:04:05.000Z");
    const copiedTemps = [];
    let markerWriteOptions;
    await json(path.join(source, "voice-state.json"), { deterministic: true });

    const result = await migrateBrandData({
      appDataPath,
      targetName: "VoiceFlow",
      legacyNames: ["Legacy"],
      operations: {
        now: () => fixedTime,
        randomUUID: () => "fixed-token",
        copyFile: async (from, to, flags) => {
          copiedTemps.push({ to, flags });
          return fs.copyFile(from, to, flags);
        },
        writeFile: async (file, contents, options) => {
          if (file.includes(".voiceflow-brand-migration-v1.json.")) markerWriteOptions = options;
          return fs.writeFile(file, contents, options);
        }
      }
    });

    assert.equal(result.status, "migrated");
    const marker = JSON.parse(await fs.readFile(migrationMarkerPath(target), "utf8"));
    assert.equal(marker.completedAt, fixedTime.toISOString());
    assert.equal(copiedTemps.every(({ to }) => to.includes("fixed-token")), true);
    assert.equal(copiedTemps.every(({ flags }) => flags === constants.COPYFILE_EXCL), true);
    assert.equal(markerWriteOptions.flag, "wx");
  });

  await sandbox(async (appDataPath) => {
    const result = await migrateBrandData({
      appDataPath,
      targetName: "VoiceFlow",
      legacyNames: ["Legacy"],
      operations: { randomUUID: () => { throw "token factory failed"; } }
    });

    assert.equal(result.status, "fallback");
    assert.equal(result.error instanceof Error, true);
    assert.match(result.error.message, /token factory failed/);
  });

  await sandbox(async (appDataPath) => {
    await json(path.join(appDataPath, "Legacy", "voice-state.json"), { valid: true });
    const result = await migrateBrandData({
      appDataPath,
      targetName: "VoiceFlow",
      legacyNames: ["Legacy"],
      operations: { copyFile: async () => Promise.reject("copy rejected") }
    });

    assert.equal(result.status, "fallback");
    assert.equal(result.error instanceof Error, true);
    assert.match(result.error.message, /copy rejected/);
  });
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
