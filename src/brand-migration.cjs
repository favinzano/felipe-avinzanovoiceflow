const fs = require("node:fs/promises");
const path = require("node:path");

const MARKER_NAME = ".voiceflow-brand-migration-v1.json";
const MIGRATION_ENTRIES = ["voice-state.json", "app-preferences.json", "models", "Local Storage", "IndexedDB"];

function migrationMarkerPath(targetPath) {
  return path.join(targetPath, MARKER_NAME);
}

async function pathExists(filePath, operations) {
  try {
    await operations.access(filePath);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function assertValidJson(filePath, operations, description) {
  const contents = await operations.readFile(filePath, "utf8");
  try {
    JSON.parse(contents);
  } catch (error) {
    throw new Error(`${description} is not valid JSON: ${filePath}`, { cause: error });
  }
}

async function selectStateSource(sourcePath, operations) {
  const primary = path.join(sourcePath, "voice-state.json");
  const backup = path.join(sourcePath, "voice-state.json.backup");
  const primaryExists = await pathExists(primary, operations);
  const backupExists = await pathExists(backup, operations);
  if (!primaryExists && !backupExists) return null;

  if (primaryExists) {
    try {
      await assertValidJson(primary, operations, "Voice state");
      return primary;
    } catch (primaryError) {
      if (!backupExists) throw primaryError;
    }
  }

  await assertValidJson(backup, operations, "Voice state backup");
  return backup;
}

function createOperations(overrides = {}) {
  return {
    access: fs.access,
    copyFile: fs.copyFile,
    mkdir: fs.mkdir,
    readFile: fs.readFile,
    readdir: fs.readdir,
    rename: fs.rename,
    rm: fs.rm,
    stat: fs.stat,
    writeFile: fs.writeFile,
    ...overrides
  };
}

async function migrateBrandData({ appDataPath, targetName, legacyNames, operations: overrides }) {
  const operations = createOperations(overrides);
  const targetPath = path.join(appDataPath, targetName);
  const markerPath = migrationMarkerPath(targetPath);
  const tempPaths = new Set();
  let sourcePath;
  let tempSequence = 0;

  const cleanupTemp = async (tempPath) => {
    tempPaths.delete(tempPath);
    try {
      await operations.rm(tempPath, { force: true, recursive: true });
    } catch {
      // Best effort: a later migration uses a distinct temporary name.
    }
  };

  const atomicCopy = async (from, to) => {
    if (await pathExists(to, operations)) return;
    await operations.mkdir(path.dirname(to), { recursive: true });
    const tempPath = `${to}.voiceflow-migration-${process.pid}-${++tempSequence}.tmp`;
    tempPaths.add(tempPath);
    await cleanupTemp(tempPath);
    tempPaths.add(tempPath);
    try {
      await operations.copyFile(from, tempPath);
      if (await pathExists(to, operations)) {
        await cleanupTemp(tempPath);
        return;
      }
      await operations.rename(tempPath, to);
      tempPaths.delete(tempPath);
    } catch (error) {
      await cleanupTemp(tempPath);
      throw error;
    }
  };

  const copyTree = async (from, to) => {
    const info = await operations.stat(from);
    if (!info.isDirectory()) {
      await atomicCopy(from, to);
      return;
    }
    await operations.mkdir(to, { recursive: true });
    const entries = await operations.readdir(from, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      await copyTree(path.join(from, entry.name), path.join(to, entry.name));
    }
  };

  try {
    if (await pathExists(markerPath, operations)) {
      return { status: "already-migrated", targetPath };
    }

    const normalizedTarget = path.resolve(targetPath).toLowerCase();
    for (const legacyName of legacyNames) {
      const candidate = path.join(appDataPath, legacyName);
      if (path.resolve(candidate).toLowerCase() === normalizedTarget) continue;
      if (await pathExists(candidate, operations)) {
        sourcePath = candidate;
        break;
      }
    }
    if (!sourcePath) return { status: "not-needed", targetPath };

    const stateDestination = path.join(targetPath, "voice-state.json");
    if (!(await pathExists(stateDestination, operations))) {
      const stateSource = await selectStateSource(sourcePath, operations);
      if (stateSource) await atomicCopy(stateSource, stateDestination);
    }

    const preferencesSource = path.join(sourcePath, "app-preferences.json");
    const preferencesDestination = path.join(targetPath, "app-preferences.json");
    if (
      !(await pathExists(preferencesDestination, operations)) &&
      (await pathExists(preferencesSource, operations))
    ) {
      await assertValidJson(preferencesSource, operations, "App preferences");
      await atomicCopy(preferencesSource, preferencesDestination);
    }

    for (const entry of MIGRATION_ENTRIES.slice(2)) {
      const from = path.join(sourcePath, entry);
      if (await pathExists(from, operations)) await copyTree(from, path.join(targetPath, entry));
    }

    await operations.mkdir(targetPath, { recursive: true });
    const markerTemp = `${markerPath}.voiceflow-migration-${process.pid}-${++tempSequence}.tmp`;
    tempPaths.add(markerTemp);
    await cleanupTemp(markerTemp);
    tempPaths.add(markerTemp);
    await operations.writeFile(
      markerTemp,
      JSON.stringify({ sourcePath, completedAt: new Date().toISOString() }, null, 2),
      "utf8"
    );
    await operations.rename(markerTemp, markerPath);
    tempPaths.delete(markerTemp);
    return { status: "migrated", sourcePath, targetPath };
  } catch (error) {
    await Promise.all([...tempPaths].map(cleanupTemp));
    return { status: "fallback", sourcePath, targetPath, error };
  }
}

module.exports = {
  migrateBrandData,
  migrationMarkerPath,
  selectStateSource
};
