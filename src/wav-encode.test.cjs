const assert = require("node:assert/strict");
const { encodeWav16 } = require("./wav-encode.cjs");

const samples = Float32Array.from([0, 0.5, -0.5, 1, -1]);
const wav = encodeWav16(samples, 16000);

// RIFF/WAVE header checks
assert.equal(wav.toString("ascii", 0, 4), "RIFF");
assert.equal(wav.toString("ascii", 8, 12), "WAVE");
assert.equal(wav.readUInt16LE(20), 1, "PCM format");
assert.equal(wav.readUInt16LE(22), 1, "mono");
assert.equal(wav.readUInt32LE(24), 16000, "sample rate");
assert.equal(wav.readUInt16LE(34), 16, "16-bit");
// data chunk = 5 samples * 2 bytes
assert.equal(wav.readUInt32LE(40), 10);
assert.equal(wav.length, 44 + 10);
// clamping: 1 -> 32767, -1 -> -32768
assert.equal(wav.readInt16LE(44 + 6), 32767);
assert.equal(wav.readInt16LE(44 + 8), -32768);
console.log("wav-encode: 9 checks passed.");
