const PRODUCTION_PROFILE_MARKER = "voice-production-profile-v1";
const ACCURACY_DEFAULT_MARKER = "voice-accuracy-default-v2";
const PERF_DEFAULT_MARKER = "voice-perf-default-v1";
const CPU_REVERT_MARKER = "voice-cpu-revert-v1";
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
  // Only nudges the transcription profile to the faster "balanced" model.
  // It intentionally no longer switches the inference backend to DirectML:
  // that experimental GPU path produced corrupt transcriptions, so CPU stays
  // the reliable default (the dml -> cpu correction lives in
  // revertExperimentalDmlDefault).
  const profileUntouched = !settings.whisperProfile || settings.whisperProfile === "accurate";
  if (!profileUntouched) return settings;
  return { ...settings, whisperProfile: "balanced" };
}

// One-time corrective migration. An earlier release defaulted the inference
// backend to experimental DirectML and force-migrated existing users onto it,
// which produced corrupt (garbled) transcriptions on affected GPUs. Move anyone
// still on "dml" back to the reliable CPU backend. DirectML stays available as
// an explicit opt-in under advanced settings; once this has run, a later manual
// dml choice is respected.
function revertExperimentalDmlDefault(storage, settings = {}) {
  if (storage.getItem(CPU_REVERT_MARKER)) return settings;
  storage.setItem(CPU_REVERT_MARKER, "initialized");
  if (settings.inferenceDevice === "dml") {
    return { ...settings, inferenceDevice: "cpu" };
  }
  return settings;
}

module.exports = {
  ACCURACY_DEFAULT_MARKER,
  clearMigratedLegacyStorage,
  CPU_REVERT_MARKER,
  initializeProductionProfile,
  PERF_DEFAULT_MARKER,
  PRODUCTION_PROFILE_MARKER,
  revertExperimentalDmlDefault,
  upgradeAccuracyDefault,
  upgradePerfDefault
};
