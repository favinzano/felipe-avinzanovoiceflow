const fs = require("node:fs");
const { migrationMarkerPath, parseValidMigrationMarker } = require("./brand-migration.cjs");

function lstatIfExists(filePath, lstatSync) {
  try {
    return lstatSync(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function assertSafeDirectory(info, targetPath) {
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error(`Brand target must be a safe directory: ${targetPath}`);
  }
}

function prepareBrandElectronPaths({ targetPath, legacyPaths, operations = fs }) {
  let target = lstatIfExists(targetPath, operations.lstatSync);
  if (!target) {
    operations.mkdirSync(targetPath, { recursive: true });
    target = operations.lstatSync(targetPath);
  }
  assertSafeDirectory(target, targetPath);

  const marker = lstatIfExists(migrationMarkerPath(targetPath), operations.lstatSync);
  if (marker?.isFile() && !marker.isSymbolicLink()) {
    const markerPath = migrationMarkerPath(targetPath);
    const contents = operations.readFileSync(markerPath, "utf8");
    try {
      parseValidMigrationMarker(contents, markerPath);
      return { userDataPath: targetPath, sessionDataPath: targetPath, existingLegacyDataPath: undefined };
    } catch {
      // Invalid marker contents are incomplete; a safe legacy session remains authoritative.
    }
  }

  for (const legacyPath of legacyPaths) {
    const info = lstatIfExists(legacyPath, operations.lstatSync);
    if (info?.isDirectory() && !info.isSymbolicLink()) {
      return { userDataPath: targetPath, sessionDataPath: legacyPath, existingLegacyDataPath: legacyPath };
    }
  }
  return { userDataPath: targetPath, sessionDataPath: targetPath, existingLegacyDataPath: undefined };
}

module.exports = { prepareBrandElectronPaths };
