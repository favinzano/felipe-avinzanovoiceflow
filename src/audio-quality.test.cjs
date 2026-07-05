const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
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

let WorkletProcessor;
class MockAudioWorkletProcessor {
  constructor() {
    this.messages = [];
    this.port = {
      onmessage: undefined,
      postMessage: (message) => this.messages.push(message)
    };
  }
}
const workletSource = fs.readFileSync(path.join(__dirname, "pcm-capture-worklet.js"), "utf8");
vm.runInNewContext(workletSource, {
  AudioWorkletProcessor: MockAudioWorkletProcessor,
  Float32Array,
  Float64Array,
  Math,
  Uint32Array,
  sampleRate: 16000,
  registerProcessor: (_name, processor) => { WorkletProcessor = processor; }
});
const worklet = new WorkletProcessor();
const segmentedSignal = new Float32Array(1600);
for (let index = 0; index < segmentedSignal.length; index += 1) {
  segmentedSignal[index] = Math.floor(index * 9 / segmentedSignal.length) / 10;
}
worklet.process([[segmentedSignal]]);
const levelMessage = worklet.messages.find((message) => message?.type === "level");
assert.equal(levelMessage.levels.length, 9);
assert.ok(levelMessage.levels[8] > levelMessage.levels[1]);
assert.ok(levelMessage.rms > 0);

console.log("Audio quality: 8 checks passed.");
