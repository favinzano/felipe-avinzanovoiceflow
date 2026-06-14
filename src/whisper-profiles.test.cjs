const assert = require("node:assert/strict");
const {
  DEFAULT_WHISPER_PROFILE,
  WHISPER_PROFILES,
  resolveWhisperProfile
} = require("./whisper-profiles.cjs");

assert.equal(DEFAULT_WHISPER_PROFILE, "accurate");
assert.equal(resolveWhisperProfile("fast").model, "onnx-community/whisper-base");
assert.equal(resolveWhisperProfile("accurate").model, "onnx-community/whisper-large-v3-turbo");
assert.equal(resolveWhisperProfile("invalid"), WHISPER_PROFILES.accurate);
assert.equal(resolveWhisperProfile(undefined), WHISPER_PROFILES.accurate);
assert.equal(resolveWhisperProfile("fast").dtype, "q8");
assert.equal(resolveWhisperProfile("accurate").dtype, "q8");
assert.equal(resolveWhisperProfile("accurate").generation.num_beams, 3);

console.log("8 Whisper profile cases passed");
