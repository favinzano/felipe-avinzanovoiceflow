const PRODUCTION_PROFILE_MARKER = "voice-production-profile-v1";
const ACCURACY_DEFAULT_MARKER = "voice-accuracy-default-v2";
const PERF_DEFAULT_MARKER = "voice-perf-default-v1";
const LEGACY_STORAGE_KEYS = Object.freeze(["voice-settings", "voice-history", "voice-dictionary", "voice-microphone"]);

function clearMigratedLegacyStorage(storage, preserveLegacyStorage) {
  if (preserveLegacyStorage) return [];
  for (const key of LEGACY_STORAGE_KEYS) storage.removeItem(key);
  return [...LEGACY_STORAGE_KEYS];
}

function initializeProductionProfile(storage, isPackaged) {
  if (!isPackaged || storage.getItem(PRODUCTION_PROFILE_MARKER)) return false;
  storage.setItem(PRODUCTION_PROFILE_MARKER, "initialized");
  return true;
}

function upgradeAccuracyDefault(storage) {
  if (storage.getItem(ACCURACY_DEFAULT_MARKER)) return false;
  let settings;
  try {
    settings = JSON.parse(storage.getItem("voice-settings") || "{}");
  } catch {
    settings = {};
  }
  if (!settings.whisperProfile || settings.whisperProfile === "fast") {
    settings.whisperProfile = "accurate";
    storage.setItem("voice-settings", JSON.stringify(settings));
  }
  storage.setItem(ACCURACY_DEFAULT_MARKER, "initialized");
  return true;
}

// Operates on the persisted-state settings object directly (not a localStorage JSON
// string like upgradeAccuracyDefault) because settings now live in voice-state.json;
// the marker itself still lives in localStorage for consistency with the other migrations.
function upgradePerfDefault(storage, settings = {}) {
  if (storage.getItem(PERF_DEFAULT_MARKER)) return settings;
  storage.setItem(PERF_DEFAULT_MARKER, "initialized");
  const deviceUntouched = !settings.inferenceDevice || settings.inferenceDevice === "cpu";
  const profileUntouched = !settings.whisperProfile || settings.whisperProfile === "accurate";
  if (!deviceUntouched || !profileUntouched) return settings;
  return { ...settings, inferenceDevice: "dml", whisperProfile: "balanced" };
}

module.exports = {
  ACCURACY_DEFAULT_MARKER,
  clearMigratedLegacyStorage,
  initializeProductionProfile,
  PERF_DEFAULT_MARKER,
  PRODUCTION_PROFILE_MARKER,
  upgradeAccuracyDefault,
  upgradePerfDefault
};
