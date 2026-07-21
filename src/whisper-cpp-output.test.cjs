const assert = require("node:assert/strict");
const { parseWhisperJson } = require("./whisper-cpp-output.cjs");

const ok = JSON.stringify({ transcription: [{ text: " Hola" }, { text: " mundo." }] });
assert.equal(parseWhisperJson(ok).text, "Hola mundo.");

assert.throws(() => parseWhisperJson(JSON.stringify({ transcription: [] })), /empty whisper output/);
assert.throws(() => parseWhisperJson("{not json"), /invalid whisper json/);
console.log("whisper-cpp-output: 3 checks passed.");
