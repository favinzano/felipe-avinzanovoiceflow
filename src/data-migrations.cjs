const PRODUCTION_PROFILE_MARKER = "voice-production-profile-v1";
const ACCURACY_DEFAULT_MARKER = "voice-accuracy-default-v2";

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

module.exports = {
  ACCURACY_DEFAULT_MARKER,
  initializeProductionProfile,
  PRODUCTION_PROFILE_MARKER,
  upgradeAccuracyDefault
};
