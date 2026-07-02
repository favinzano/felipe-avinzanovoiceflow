const fs = require("node:fs");
const { migrationMarkerPath } = require("./brand-migration.cjs");

function safeLstat(filePath, lstatSync) {
  try {
    return lstatSync(filePath);
  } catch {
    return null;
  }
}

function selectInitialUserDataPath({ targetPath, legacyPaths, lstatSync = fs.lstatSync }) {
  const target = safeLstat(targetPath, lstatSync);
  const safeTarget = !target || (target.isDirectory() && !target.isSymbolicLink());
  const marker = safeTarget ? safeLstat(migrationMarkerPath(targetPath), lstatSync) : null;
  if (marker?.isFile() && !marker.isSymbolicLink()) return targetPath;

  for (const legacyPath of legacyPaths) {
    const info = safeLstat(legacyPath, lstatSync);
    if (info?.isDirectory() && !info.isSymbolicLink()) return legacyPath;
  }
  return targetPath;
}

module.exports = { selectInitialUserDataPath };
