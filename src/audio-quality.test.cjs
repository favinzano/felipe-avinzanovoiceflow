const assert = require("node:assert/strict");
const { resampleAudio, trimEdgeSilence } = require("./audio-quality.cjs");

const source = Float32Array.from({ length: 48000 }, (_, index) => Math.sin(2 * Math.PI * 440 * index / 48000));
const resampled = resampleAudio(source, 48000, 16000);
assert.equal(resampled.length, 16000);
assert.ok(Math.max(...resampled) > 0.95);

const speech = new Float32Array(32000);
speech.fill(0.1, 8000, 24000);
const trimmed = trimEdgeSilence(speech, 16000);
assert.ok(trimmed.length >= 23500 && trimmed.length <= 24500);
assert.ok(trimmed.some((sample) => sample > 0.09));

const silence = new Float32Array(16000);
assert.equal(trimEdgeSilence(silence).length, silence.length);

console.log("Audio quality: 5 checks passed.");
