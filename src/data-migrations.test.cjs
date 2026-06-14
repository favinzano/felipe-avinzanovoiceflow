const assert = require("assert");
const {
  ACCURACY_DEFAULT_MARKER,
  initializeProductionProfile,
  PRODUCTION_PROFILE_MARKER,
  upgradeAccuracyDefault
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

console.log("Data migrations: 13 checks passed.");
