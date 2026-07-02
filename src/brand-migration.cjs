const { constants } = require("node:fs");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");
const path = require("node:path");

const MARKER_NAME = ".voiceflow-brand-migration-v1.json";
const MIGRATION_ENTRIES = ["voice-state.json", "app-preferences.json", "models", "Local Storage", "IndexedDB"];

// Threat model: links present or swapped during staging/revalidation are rejected. A truly
// adversarial same-user replacement in the final syscall gap cannot be prevented with Node's
// path-based filesystem APIs and is intentionally out of scope.

function migrationMarkerPath(targetPath) {
  return path.join(targetPath, MARKER_NAME);
}

function sameMigrationPath(left, right, platform = process.platform) {
  const resolvedLeft = path.resolve(left);
  const resolvedRight = path.resolve(right);
  return platform === "win32"
    ? resolvedLeft.toLowerCase() === resolvedRight.toLowerCase()
    : resolvedLeft === resolvedRight;
}

async function lstatIfExists(filePath, operations) {
  try {
    return await operations.lstat(filePath);
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}

function assertSafeEntry(info, filePath, expectedType) {
  if (info.isSymbolicLink()) throw new Error(`Migration refuses linked path: ${filePath}`);
  if (expectedType === "directory" && !info.isDirectory()) {
    throw new Error(`Migration expected a directory: ${filePath}`);
  }
  if (expectedType === "file" && !info.isFile()) {
    throw new Error(`Migration expected a regular file: ${filePath}`);
  }
}

async function regularFileExists(filePath, operations) {
  const info = await lstatIfExists(filePath, operations);
  if (!info) return false;
  assertSafeEntry(info, filePath, "file");
  return true;
}

async function ensureSafeDirectory(targetPath, directoryPath, operations) {
  const relative = path.relative(targetPath, directoryPath);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Migration destination escapes target: ${directoryPath}`);
  }
  const parts = relative ? relative.split(path.sep) : [];
  let current = targetPath;
  for (const part of [null, ...parts]) {
    if (part) current = path.join(current, part);
    let info = await lstatIfExists(current, operations);
    if (!info) {
      try {
        await operations.mkdir(current);
      } catch (error) {
        if (!error || error.code !== "EEXIST") throw error;
      }
      info = await operations.lstat(current);
    }
    assertSafeEntry(info, current, "directory");
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

async function readValidMarker(markerPath, operations) {
  const contents = await operations.readFile(markerPath, "utf8");
  let marker;
  try {
    marker = JSON.parse(contents);
  } catch (error) {
    throw new Error(`Brand migration marker is not valid JSON: ${markerPath}`, { cause: error });
  }
  if (!marker || typeof marker.sourcePath !== "string" || Number.isNaN(Date.parse(marker.completedAt))) {
    throw new Error(`Brand migration marker is invalid: ${markerPath}`);
  }
  return marker;
}

function toError(value) {
  if (value instanceof Error) return value;
  return new Error(typeof value === "string" ? value : `Migration failed: ${String(value)}`);
}

async function selectStateSource(sourcePath, operations) {
  const primary = path.join(sourcePath, "voice-state.json");
  const backup = path.join(sourcePath, "voice-state.json.backup");
  const primaryExists = await regularFileExists(primary, operations);
  const backupExists = await regularFileExists(backup, operations);
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
    copyFile: fs.copyFile,
    link: fs.link,
    lstat: fs.lstat,
    mkdir: fs.mkdir,
    readFile: fs.readFile,
    readdir: fs.readdir,
    rm: fs.rm,
    writeFile: fs.writeFile,
    now: () => new Date(),
    randomUUID: crypto.randomUUID,
    platform: process.platform,
    ...overrides
  };
}

async function migrateBrandData({ appDataPath, targetName, legacyNames, operations: overrides }) {
  const operations = createOperations(overrides);
  const targetPath = path.join(appDataPath, targetName);
  const markerPath = migrationMarkerPath(targetPath);
  let sourcePath;
  let tempSequence = 0;
  let invocationToken;
  let stagingPath;
  let stagingCreated = false;

  const validateStagingDirectory = async () => {
    assertSafeEntry(await operations.lstat(targetPath), targetPath, "directory");
    assertSafeEntry(await operations.lstat(stagingPath), stagingPath, "directory");
  };

  const ensureStagingDirectory = async () => {
    if (stagingCreated) {
      await validateStagingDirectory();
      return;
    }
    await ensureSafeDirectory(targetPath, targetPath, operations);
    stagingPath = path.join(targetPath, `.voiceflow-migration-${invocationToken}.staging`);
    await operations.mkdir(stagingPath);
    stagingCreated = true;
    await validateStagingDirectory();
  };

  const cleanupStagingDirectory = async () => {
    if (!stagingCreated) return;
    try {
      const targetInfo = await lstatIfExists(targetPath, operations);
      if (!targetInfo) return;
      assertSafeEntry(targetInfo, targetPath, "directory");
      const stagingInfo = await lstatIfExists(stagingPath, operations);
      if (!stagingInfo || stagingInfo.isSymbolicLink() || !stagingInfo.isDirectory()) return;
      await operations.rm(stagingPath, { force: true, recursive: true });
    } catch {
      // Best effort only; never follow a replaced target or staging link during cleanup.
    }
  };

  const atomicCopy = async (from, to) => {
    if (await regularFileExists(to, operations)) return;
    await ensureStagingDirectory();
    const tempPath = path.join(stagingPath, `${++tempSequence}.data.tmp`);
    await operations.copyFile(from, tempPath, constants.COPYFILE_EXCL);
    assertSafeEntry(await operations.lstat(tempPath), tempPath, "file");
    await validateStagingDirectory();
    await ensureSafeDirectory(targetPath, path.dirname(to), operations);
    try {
      await operations.link(tempPath, to);
    } catch (error) {
      if (!error || error.code !== "EEXIST") throw error;
      if (!(await regularFileExists(to, operations))) {
        throw new Error(`Migration destination conflict is not a regular file: ${to}`);
      }
    }
  };

  const copyTree = async (from, to) => {
    const info = await operations.lstat(from);
    if (info.isSymbolicLink()) throw new Error(`Migration refuses linked path: ${from}`);
    if (info.isFile()) {
      await atomicCopy(from, to);
      return;
    }
    if (!info.isDirectory()) throw new Error(`Migration refuses non-file entry: ${from}`);
    await ensureSafeDirectory(targetPath, to, operations);
    const entries = await operations.readdir(from, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      await copyTree(path.join(from, entry.name), path.join(to, entry.name));
    }
  };

  try {
    invocationToken = operations.randomUUID();
    const targetInfo = await lstatIfExists(targetPath, operations);
    if (targetInfo) assertSafeEntry(targetInfo, targetPath, "directory");
    if (await regularFileExists(markerPath, operations)) {
      await readValidMarker(markerPath, operations);
      return { status: "already-migrated", targetPath };
    }

    for (const legacyName of legacyNames) {
      const candidate = path.join(appDataPath, legacyName);
      if (sameMigrationPath(candidate, targetPath, operations.platform)) continue;
      const candidateInfo = await lstatIfExists(candidate, operations);
      if (candidateInfo) {
        assertSafeEntry(candidateInfo, candidate, "directory");
        sourcePath = candidate;
        break;
      }
    }
    if (!sourcePath) return { status: "not-needed", targetPath };

    const stateDestination = path.join(targetPath, "voice-state.json");
    if (!(await regularFileExists(stateDestination, operations))) {
      const stateSource = await selectStateSource(sourcePath, operations);
      if (stateSource) await atomicCopy(stateSource, stateDestination);
    }

    const preferencesSource = path.join(sourcePath, "app-preferences.json");
    const preferencesDestination = path.join(targetPath, "app-preferences.json");
    if (
      !(await regularFileExists(preferencesDestination, operations)) &&
      (await regularFileExists(preferencesSource, operations))
    ) {
      await assertValidJson(preferencesSource, operations, "App preferences");
      await atomicCopy(preferencesSource, preferencesDestination);
    }

    for (const entry of MIGRATION_ENTRIES.slice(2)) {
      const from = path.join(sourcePath, entry);
      if (await lstatIfExists(from, operations)) await copyTree(from, path.join(targetPath, entry));
    }

    await ensureStagingDirectory();
    const markerTemp = path.join(stagingPath, `${MARKER_NAME}.${++tempSequence}.tmp`);
    await operations.writeFile(
      markerTemp,
      JSON.stringify({ sourcePath, completedAt: new Date(operations.now()).toISOString() }, null, 2),
      { encoding: "utf8", flag: "wx" }
    );
    assertSafeEntry(await operations.lstat(markerTemp), markerTemp, "file");
    await validateStagingDirectory();
    await ensureSafeDirectory(targetPath, targetPath, operations);
    try {
      await operations.link(markerTemp, markerPath);
    } catch (error) {
      if (!error || error.code !== "EEXIST") throw error;
      if (!(await regularFileExists(markerPath, operations))) {
        throw new Error(`Brand migration marker disappeared during publication: ${markerPath}`);
      }
      await readValidMarker(markerPath, operations);
      await cleanupStagingDirectory();
      return { status: "already-migrated", targetPath };
    }
    await cleanupStagingDirectory();
    return { status: "migrated", sourcePath, targetPath };
  } catch (error) {
    await cleanupStagingDirectory();
    return { status: "fallback", sourcePath, targetPath, error: toError(error) };
  }
}

module.exports = {
  migrateBrandData,
  migrationMarkerPath,
  sameMigrationPath,
  selectStateSource
};
