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
assert.equal(resolveWhisperProfile("balanced").model, "onnx-community/whisper-large-v3-turbo");
assert.equal(resolveWhisperProfile("balanced").generation.num_beams, 1);
assert.equal(resolveWhisperProfile("balanced").dtype, "q8");
assert.equal(resolveWhisperProfile("accurate").model, "onnx-community/whisper-large-v3-turbo");
assert.equal(resolveWhisperProfile("accurate").generation.num_beams, 3);
assert.equal(resolveWhisperProfile("accurate").dtype, "q8");
assert.equal(resolveWhisperProfile("invalid"), WHISPER_PROFILES.balanced);
assert.equal(resolveWhisperProfile(undefined), WHISPER_PROFILES.balanced);

// GGML model descriptor assertions
for (const id of ["fast", "balanced", "accurate"]) {
  const p = WHISPER_PROFILES[id];
  assert.match(p.ggml.file, /\.bin$/, `${id} has a ggml file`);
  assert.ok(p.ggml.sha256 && p.ggml.sha256.length === 64, `${id} has a sha256`);
}

console.log("18 Whisper profile cases passed");
