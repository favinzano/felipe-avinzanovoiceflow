const assert = require("node:assert/strict");
const path = require("node:path");
const sessionPaths = require("./brand-session-path.cjs");

const { prepareBrandElectronPaths } = sessionPaths;
assert.equal(typeof prepareBrandElectronPaths, "function", "brand Electron path preparation must exist");

const directory = Object.freeze({ isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false });
const regularFile = Object.freeze({ isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false });
const symbolicLink = Object.freeze({ isDirectory: () => false, isFile: () => false, isSymbolicLink: () => true });
const nonDirectory = Object.freeze({ isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false });

function missingError() {
  return Object.assign(new Error("missing"), { code: "ENOENT" });
}

function deniedError() {
  return Object.assign(new Error("denied"), { code: "EACCES" });
}

function fakeOperations(initialEntries = [], initialContents = []) {
  const entries = new Map(initialEntries);
  const contents = new Map(initialContents);
  const mkdirCalls = [];
  return {
    entries,
    mkdirCalls,
    lstatSync(filePath) {
      if (entries.has(filePath)) return entries.get(filePath);
      throw missingError();
    },
    readFileSync(filePath, encoding) {
      assert.equal(encoding, "utf8");
      if (contents.has(filePath)) return contents.get(filePath);
      throw missingError();
    },
    mkdirSync(filePath, options) {
      mkdirCalls.push([filePath, options]);
      entries.set(filePath, directory);
    }
  };
}

const targetPath = path.join("app-data", "VoiceFlow");
const legacyPath = path.join("app-data", "NextStepAI Voice");
const markerPath = path.join(targetPath, ".voiceflow-brand-migration-v1.json");

{
  const operations = fakeOperations();
  const result = prepareBrandElectronPaths({ targetPath, legacyPaths: [], operations });
  assert.deepEqual(result, {
    userDataPath: targetPath,
    sessionDataPath: targetPath,
    existingLegacyDataPath: undefined
  });
  assert.deepEqual(operations.mkdirCalls, [[targetPath, { recursive: true }]], "fresh target is created recursively");
}

{
  const operations = fakeOperations([[targetPath, directory], [legacyPath, directory]]);
  const result = prepareBrandElectronPaths({ targetPath, legacyPaths: [legacyPath], operations });
  assert.equal(result.userDataPath, targetPath, "single-instance userData identity stays on target");
  assert.equal(result.sessionDataPath, legacyPath, "unmigrated Chromium session reads legacy storage");
  assert.equal(result.existingLegacyDataPath, legacyPath);
}

{
  const validMarker = JSON.stringify({ sourcePath: legacyPath, completedAt: "2026-07-02T12:00:00.000Z" });
  const operations = fakeOperations(
    [[targetPath, directory], [legacyPath, directory], [markerPath, regularFile]],
    [[markerPath, validMarker]]
  );
  const result = prepareBrandElectronPaths({ targetPath, legacyPaths: [legacyPath], operations });
  assert.equal(result.userDataPath, targetPath, "marker does not change singleton identity");
  assert.equal(result.sessionDataPath, targetPath, "marker moves the next Chromium session to target");
}

for (const [description, markerContents] of [
  ["malformed JSON", "{not-json"],
  ["invalid schema", JSON.stringify({ sourcePath: legacyPath, completedAt: "not-a-date" })]
]) {
  const operations = fakeOperations(
    [[targetPath, directory], [legacyPath, directory], [markerPath, regularFile]],
    [[markerPath, markerContents]]
  );
  const result = prepareBrandElectronPaths({ targetPath, legacyPaths: [legacyPath], operations });
  assert.equal(result.sessionDataPath, legacyPath, `${description} marker remains on legacy sessionData`);
  assert.equal(result.existingLegacyDataPath, legacyPath, `${description} marker retains fallback source`);
}

{
  const operations = fakeOperations([[targetPath, directory], [legacyPath, directory], [markerPath, regularFile]]);
  operations.readFileSync = () => { throw deniedError(); };
  assert.throws(
    () => prepareBrandElectronPaths({ targetPath, legacyPaths: [legacyPath], operations }),
    (error) => error.code === "EACCES",
    "unexpected marker read failure aborts bootstrap"
  );
}

for (const [description, unsafeTarget] of [
  ["symbolic link", symbolicLink],
  ["non-directory", nonDirectory]
]) {
  const operations = fakeOperations([[targetPath, unsafeTarget]]);
  assert.throws(
    () => prepareBrandElectronPaths({ targetPath, legacyPaths: [], operations }),
    /safe directory/,
    `${description} target aborts even without legacy data`
  );
}

assert.throws(
  () => prepareBrandElectronPaths({
    targetPath,
    legacyPaths: [],
    operations: { lstatSync: () => { throw deniedError(); }, mkdirSync: () => assert.fail("mkdir must not run") }
  }),
  (error) => error.code === "EACCES",
  "unexpected target lstat failure propagates"
);

assert.throws(
  () => prepareBrandElectronPaths({
    targetPath,
    legacyPaths: [],
    operations: { lstatSync: () => { throw missingError(); }, mkdirSync: () => { throw deniedError(); } }
  }),
  (error) => error.code === "EACCES",
  "target creation failure propagates"
);

{
  let checks = 0;
  assert.throws(
    () => prepareBrandElectronPaths({
      targetPath,
      legacyPaths: [],
      operations: {
        lstatSync() {
          checks += 1;
          if (checks === 1) throw missingError();
          return symbolicLink;
        },
        mkdirSync() {}
      }
    }),
    /safe directory/,
    "newly created target is lstat-verified"
  );
}

{
  let inspected = false;
  const operations = fakeOperations([[targetPath, directory]]);
  const originalLstat = operations.lstatSync;
  operations.lstatSync = (filePath) => {
    if (filePath === legacyPath) {
      inspected = true;
      throw deniedError();
    }
    return originalLstat(filePath);
  };
  assert.throws(
    () => prepareBrandElectronPaths({ targetPath, legacyPaths: [legacyPath], operations }),
    (error) => error.code === "EACCES"
  );
  assert.equal(inspected, true, "legacy permission errors do not fail open");
}

console.log("brand session path tests passed");
