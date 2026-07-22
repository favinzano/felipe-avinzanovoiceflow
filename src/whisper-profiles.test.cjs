const assert = require("node:assert/strict");
const {
  DEFAULT_WHISPER_PROFILE,
  WHISPER_PROFILES,
  resolveWhisperProfile
} = require("./whisper-profiles.cjs");

assert.equal(DEFAULT_WHISPER_PROFILE, "balanced");
assert.equal(resolveWhisperProfile("fast").model, "onnx-community/whisper-base");
assert.equal(resolveWhisperProfile("fast").generation.num_beams, 1);
assert.equal(resolveWhisperProfile("fast").dtype, "q8");
assert.equal(resolveWhisperProfile("balanced").model, "onnx-community/whisper-small");
assert.equal(resolveWhisperProfile("balanced").generation.num_beams, 1);
assert.equal(resolveWhisperProfile("balanced").dtype, "q8");
assert.equal(resolveWhisperProfile("accurate").model, "onnx-community/whisper-large-v3-turbo");
assert.equal(resolveWhisperProfile("accurate").generation.num_beams, 3);
assert.equal(resolveWhisperProfile("accurate").dtype, "q8");
assert.equal(resolveWhisperProfile("invalid"), WHISPER_PROFILES.balanced);
assert.equal(resolveWhisperProfile(undefined), WHISPER_PROFILES.balanced);

console.log("12 Whisper profile cases passed");
