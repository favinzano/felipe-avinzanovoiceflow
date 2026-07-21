const WHISPER_PROFILES = Object.freeze({
  fast: Object.freeze({
    id: "fast",
    label: "Rápido",
    shortLabel: "Whisper Base",
    model: "onnx-community/whisper-base",
    dtype: "q8",
    generation: Object.freeze({ num_beams: 1 }),
    ggml: Object.freeze({
      repo: "ggerganov/whisper.cpp",
      file: "ggml-base.bin",
      sha256: "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe",
      bytes: 147951465
    })
  }),
  balanced: Object.freeze({
    id: "balanced",
    label: "Balanceado",
    shortLabel: "Whisper Large v3 Turbo (rápido)",
    model: "onnx-community/whisper-large-v3-turbo",
    dtype: "q8",
    generation: Object.freeze({ num_beams: 1 }),
    ggml: Object.freeze({
      repo: "ggerganov/whisper.cpp",
      file: "ggml-large-v3-turbo-q5_0.bin",
      sha256: "394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2",
      bytes: 574041195
    })
  }),
  accurate: Object.freeze({
    id: "accurate",
    label: "Máxima precisión",
    shortLabel: "Whisper Large v3 Turbo",
    model: "onnx-community/whisper-large-v3-turbo",
    dtype: "q8",
    generation: Object.freeze({ num_beams: 3 }),
    ggml: Object.freeze({
      repo: "ggerganov/whisper.cpp",
      file: "ggml-large-v3-turbo-q8_0.bin",
      sha256: "317eb69c11673c9de1e1f0d459b253999804ec71ac4c23c17ecf5fbe24e259a1",
      bytes: 874188075
    })
  })
});

const DEFAULT_WHISPER_PROFILE = "balanced";

function resolveWhisperProfile(profileId) {
  return WHISPER_PROFILES[profileId] || WHISPER_PROFILES[DEFAULT_WHISPER_PROFILE];
}

module.exports = {
  DEFAULT_WHISPER_PROFILE,
  WHISPER_PROFILES,
  resolveWhisperProfile
};
