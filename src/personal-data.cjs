const fs = require("node:fs/promises");
const path = require("node:path");

const PERSONAL_DATA_FILES = Object.freeze([
  "app-preferences.json",
  "voice-state.json",
  "voice-state.json.backup",
  "transcriptions.db",
  "transcriptions.db-shm",
  "transcriptions.db-wal"
]);

function assertSafeUserDataPath(userDataPath) {
  if (typeof userDataPath !== "string" || !path.isAbsolute(userDataPath)) {
    throw new Error("The user data path must be absolute.");
  }
  const resolved = path.resolve(userDataPath);
  if (resolved === path.parse(resolved).root) throw new Error("Refusing to erase data from a filesystem root.");
  return resolved;
}

async function removablePersonalDataFiles(userDataPath) {
  const root = assertSafeUserDataPath(userDataPath);
  let entries = [];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const allowed = new Set(PERSONAL_DATA_FILES);
  for (const entry of entries) {
    if (entry.isFile() && /^voice-state\.json\.\d+\.tmp$/.test(entry.name)) allowed.add(entry.name);
  }
  return [...allowed].map((name) => path.join(root, name));
}

async function erasePersonalDataFiles(userDataPath) {
  const files = await removablePersonalDataFiles(userDataPath);
  const removed = [];
  for (const filePath of files) {
    try {
      await fs.unlink(filePath);
      removed.push(path.basename(filePath));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return removed;
}

module.exports = {
  PERSONAL_DATA_FILES,
  assertSafeUserDataPath,
  erasePersonalDataFiles,
  removablePersonalDataFiles
};
