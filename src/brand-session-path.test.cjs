const assert = require("node:assert/strict");
const path = require("node:path");

let selectInitialUserDataPath;
try {
  ({ selectInitialUserDataPath } = require("./brand-session-path.cjs"));
} catch {
  // The first RED run intentionally reaches the assertion below before the helper exists.
}

assert.equal(typeof selectInitialUserDataPath, "function", "brand session path selector must exist");

const directory = Object.freeze({ isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false });
const regularFile = Object.freeze({ isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false });
const symbolicLink = Object.freeze({ isDirectory: () => false, isFile: () => false, isSymbolicLink: () => true });

function fakeLstat(entries) {
  return (filePath) => {
    if (entries.has(filePath)) return entries.get(filePath);
    const error = new Error("missing");
    error.code = "ENOENT";
    throw error;
  };
}

const targetPath = path.join("app-data", "VoiceFlow");
const legacyPath = path.join("app-data", "NextStepAI Voice");
const markerPath = path.join(targetPath, ".voiceflow-brand-migration-v1.json");

assert.equal(
  selectInitialUserDataPath({ targetPath, legacyPaths: [legacyPath], lstatSync: fakeLstat(new Map([[legacyPath, directory]])) }),
  legacyPath,
  "legacy data without a migration marker owns the first Chromium session"
);
assert.equal(
  selectInitialUserDataPath({ targetPath, legacyPaths: [legacyPath], lstatSync: fakeLstat(new Map([[targetPath, directory], [legacyPath, directory], [markerPath, regularFile]])) }),
  targetPath,
  "a regular migration marker binds Chromium to the target"
);
assert.equal(
  selectInitialUserDataPath({ targetPath, legacyPaths: [legacyPath], lstatSync: fakeLstat(new Map()) }),
  targetPath,
  "missing legacy data binds Chromium to the target"
);
assert.equal(
  selectInitialUserDataPath({ targetPath, legacyPaths: [legacyPath], lstatSync: fakeLstat(new Map([[legacyPath, symbolicLink]])) }),
  targetPath,
  "linked legacy paths are never selected"
);
assert.equal(
  selectInitialUserDataPath({ targetPath, legacyPaths: [legacyPath], lstatSync: fakeLstat(new Map([[legacyPath, directory], [markerPath, symbolicLink]])) }),
  legacyPath,
  "a linked marker is not treated as migration completion"
);
assert.equal(
  selectInitialUserDataPath({
    targetPath,
    legacyPaths: [legacyPath],
    lstatSync: fakeLstat(new Map([[targetPath, symbolicLink], [legacyPath, directory], [markerPath, regularFile]]))
  }),
  legacyPath,
  "a linked target is not traversed to inspect its marker"
);

console.log("brand session path tests passed");
