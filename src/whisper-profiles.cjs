const WHISPER_PROFILES = Object.freeze({
  fast: Object.freeze({
    id: "fast",
    label: "Rápido",
    shortLabel: "Whisper Base",
    model: "onnx-community/whisper-base",
    dtype: "q8",
    generation: Object.freeze({ num_beams: 1 })
  }),
  accurate: Object.freeze({
    id: "accurate",
    label: "Máxima precisión",
    shortLabel: "Whisper Large v3 Turbo",
    model: "onnx-community/whisper-large-v3-turbo",
    dtype: "q8",
    generation: Object.freeze({ num_beams: 3 })
  })
});

const DEFAULT_WHISPER_PROFILE = "accurate";

function resolveWhisperProfile(profileId) {
  return WHISPER_PROFILES[profileId] || WHISPER_PROFILES[DEFAULT_WHISPER_PROFILE];
}

module.exports = {
  DEFAULT_WHISPER_PROFILE,
  WHISPER_PROFILES,
  resolveWhisperProfile
};
