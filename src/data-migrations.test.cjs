const assert = require("assert");
const {
  ACCURACY_DEFAULT_MARKER,
  clearMigratedLegacyStorage,
  initializeProductionProfile,
  PERF_DEFAULT_MARKER,
  PRODUCTION_PROFILE_MARKER,
  upgradeAccuracyDefault,
  upgradePerfDefault
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

const perfUntouched = createStorage({});
const migratedSettings = upgradePerfDefault(perfUntouched, { whisperProfile: "accurate", inferenceDevice: "cpu", language: "spanish" });
assert.equal(migratedSettings.whisperProfile, "balanced");
assert.equal(migratedSettings.inferenceDevice, "dml");
assert.equal(migratedSettings.language, "spanish");
assert.equal(perfUntouched.getItem(PERF_DEFAULT_MARKER), "initialized");

const perfUntouchedNoKeys = createStorage({});
const migratedFromEmpty = upgradePerfDefault(perfUntouchedNoKeys, {});
assert.equal(migratedFromEmpty.whisperProfile, "balanced");
assert.equal(migratedFromEmpty.inferenceDevice, "dml");

const perfDeviceChanged = createStorage({});
const notMigratedDevice = upgradePerfDefault(perfDeviceChanged, { whisperProfile: "accurate", inferenceDevice: "dml" });
assert.equal(notMigratedDevice.inferenceDevice, "dml");
assert.equal(notMigratedDevice.whisperProfile, "accurate");

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

console.log("Data migrations: 28 checks passed.");
