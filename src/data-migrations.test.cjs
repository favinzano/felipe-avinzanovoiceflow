const assert = require("assert");
const {
  ACCURACY_DEFAULT_MARKER,
  clearMigratedLegacyStorage,
  CPU_REVERT_MARKER,
  initializeProductionProfile,
  PERF_DEFAULT_MARKER,
  PRODUCTION_PROFILE_MARKER,
  revertExperimentalDmlDefault,
  upgradeAccuracyDefault,
  upgradePerfDefault,
  upgradeWhisperCppDefault,
  WHISPERCPP_DEFAULT_MARKER
} = require("./data-migrations.cjs");

function createStorage(values = {}) {
  const data = new Map(Object.entries(values));
  return {
    getItem: (key) => data.get(key) || null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
    has: (key) => data.has(key)
  };
}

const development = createStorage({ "voice-history": "test" });
assert.equal(initializeProductionProfile(development, false), false);
assert.equal(development.has("voice-history"), true);

const firstProductionRun = createStorage({ "voice-history": "prerelease", "voice-settings": "keep" });
assert.equal(initializeProductionProfile(firstProductionRun, true), true);
assert.equal(firstProductionRun.has("voice-history"), true);
assert.equal(firstProductionRun.has("voice-settings"), true);
assert.equal(firstProductionRun.getItem(PRODUCTION_PROFILE_MARKER), "initialized");

firstProductionRun.setItem("voice-history", "real");
assert.equal(initializeProductionProfile(firstProductionRun, true), false);
assert.equal(firstProductionRun.getItem("voice-history"), "real");

const accuracyUpgrade = createStorage({ "voice-settings": JSON.stringify({ whisperProfile: "fast", language: "spanish" }) });
assert.equal(upgradeAccuracyDefault(accuracyUpgrade), true);
assert.equal(JSON.parse(accuracyUpgrade.getItem("voice-settings")).whisperProfile, "accurate");
assert.equal(JSON.parse(accuracyUpgrade.getItem("voice-settings")).language, "spanish");
assert.equal(accuracyUpgrade.getItem(ACCURACY_DEFAULT_MARKER), "initialized");
assert.equal(upgradeAccuracyDefault(accuracyUpgrade), false);

const preservedAccurate = createStorage({ "voice-settings": JSON.stringify({ whisperProfile: "accurate" }) });
upgradeAccuracyDefault(preservedAccurate);
assert.equal(JSON.parse(preservedAccurate.getItem("voice-settings")).whisperProfile, "accurate");

const legacyTransitionStorage = createStorage({ "voice-settings": "settings", "voice-history": "history", "voice-dictionary": "dictionary", "voice-microphone": "microphone" });
assert.deepEqual(clearMigratedLegacyStorage(legacyTransitionStorage, true), []);
for (const key of ["voice-settings", "voice-history", "voice-dictionary", "voice-microphone"]) assert.equal(legacyTransitionStorage.has(key), true);

const targetStorage = createStorage({ "voice-settings": "settings", "voice-history": "history", "voice-dictionary": "dictionary", "voice-microphone": "microphone" });
assert.deepEqual(clearMigratedLegacyStorage(targetStorage, false), ["voice-settings", "voice-history", "voice-dictionary", "voice-microphone"]);
for (const key of ["voice-settings", "voice-history", "voice-dictionary", "voice-microphone"]) assert.equal(targetStorage.has(key), false);

// upgradePerfDefault now only nudges the profile to "balanced"; it never
// switches the inference backend (DirectML was corrupting output).
const perfUntouched = createStorage({});
const migratedSettings = upgradePerfDefault(perfUntouched, { whisperProfile: "accurate", inferenceDevice: "cpu", language: "spanish" });
assert.equal(migratedSettings.whisperProfile, "balanced");
assert.equal(migratedSettings.inferenceDevice, "cpu");
assert.equal(migratedSettings.language, "spanish");
assert.equal(perfUntouched.getItem(PERF_DEFAULT_MARKER), "initialized");

const perfUntouchedNoKeys = createStorage({});
const migratedFromEmpty = upgradePerfDefault(perfUntouchedNoKeys, {});
assert.equal(migratedFromEmpty.whisperProfile, "balanced");
assert.equal(migratedFromEmpty.inferenceDevice, undefined);

// A user already on DirectML still gets the profile nudge; the device is left
// untouched here (the dedicated revert migration handles dml -> cpu).
const perfDeviceDml = createStorage({});
const nudgedDmlUser = upgradePerfDefault(perfDeviceDml, { whisperProfile: "accurate", inferenceDevice: "dml" });
assert.equal(nudgedDmlUser.whisperProfile, "balanced");
assert.equal(nudgedDmlUser.inferenceDevice, "dml");

const perfProfileChanged = createStorage({});
const notMigratedProfile = upgradePerfDefault(perfProfileChanged, { whisperProfile: "fast", inferenceDevice: "cpu" });
assert.equal(notMigratedProfile.whisperProfile, "fast");
assert.equal(notMigratedProfile.inferenceDevice, "cpu");

const perfAlreadyMarked = createStorage({ [PERF_DEFAULT_MARKER]: "initialized" });
const notReapplied = upgradePerfDefault(perfAlreadyMarked, { whisperProfile: "accurate", inferenceDevice: "cpu" });
assert.equal(notReapplied.whisperProfile, "accurate");
assert.equal(notReapplied.inferenceDevice, "cpu");

const perfIdempotent = createStorage({});
const firstRun = upgradePerfDefault(perfIdempotent, { whisperProfile: "accurate", inferenceDevice: "cpu" });
assert.equal(firstRun.whisperProfile, "balanced");
const secondRunFreshObject = upgradePerfDefault(perfIdempotent, { whisperProfile: "accurate", inferenceDevice: "cpu" });
assert.equal(secondRunFreshObject.whisperProfile, "accurate");
assert.equal(secondRunFreshObject.inferenceDevice, "cpu");

// revertExperimentalDmlDefault: one-time dml -> cpu correction for users the
// earlier release force-migrated onto the corrupt DirectML backend.
const dmlUser = createStorage({});
const reverted = revertExperimentalDmlDefault(dmlUser, { inferenceDevice: "dml", whisperProfile: "balanced" });
assert.equal(reverted.inferenceDevice, "cpu");
assert.equal(reverted.whisperProfile, "balanced");
assert.equal(dmlUser.getItem(CPU_REVERT_MARKER), "initialized");

const cpuUser = createStorage({});
const cpuUntouched = revertExperimentalDmlDefault(cpuUser, { inferenceDevice: "cpu" });
assert.equal(cpuUntouched.inferenceDevice, "cpu");

// Idempotent: once marked, a later manual dml opt-in is respected.
const revertMarked = createStorage({ [CPU_REVERT_MARKER]: "initialized" });
const manualDmlKept = revertExperimentalDmlDefault(revertMarked, { inferenceDevice: "dml" });
assert.equal(manualDmlKept.inferenceDevice, "dml");

// upgradeWhisperCppDefault: one-time nudge onto whisper.cpp for users still on
// the old transformers-js default (or unset); a manual/already-migrated
// whisper-cpp choice is left alone, and the migration only runs once.
const wcTransformersUser = createStorage({});
const wcMigrated = upgradeWhisperCppDefault(wcTransformersUser, { transcriptionEngine: "transformers-js" });
assert.equal(wcMigrated.transcriptionEngine, "whisper-cpp");
assert.equal(wcTransformersUser.getItem(WHISPERCPP_DEFAULT_MARKER), "initialized");

const wcEmptySettings = createStorage({});
const wcFromEmpty = upgradeWhisperCppDefault(wcEmptySettings, {});
assert.equal(wcFromEmpty.transcriptionEngine, "whisper-cpp");

const wcAlreadyMarked = createStorage({ [WHISPERCPP_DEFAULT_MARKER]: "initialized" });
const wcNotReapplied = upgradeWhisperCppDefault(wcAlreadyMarked, { transcriptionEngine: "transformers-js" });
assert.equal(wcNotReapplied.transcriptionEngine, "transformers-js");

// Idempotent-safe: a user already on whisper-cpp with no marker yet stays on
// whisper-cpp and gets the marker set (no throw, no unexpected downgrade).
const wcAlreadyOnDefault = createStorage({});
const wcStaysOnDefault = upgradeWhisperCppDefault(wcAlreadyOnDefault, { transcriptionEngine: "whisper-cpp" });
assert.equal(wcStaysOnDefault.transcriptionEngine, "whisper-cpp");
assert.equal(wcAlreadyOnDefault.getItem(WHISPERCPP_DEFAULT_MARKER), "initialized");

console.log("Data migrations: 37 checks passed.");
