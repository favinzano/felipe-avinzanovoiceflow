const assert = require("node:assert/strict");
const { createTranscriptionEngine } = require("./transcription-engine.cjs");

const fallback = { transcribe: async () => ({ text: "fb", engine: "transformers-js", device: "cpu" }) };

(async () => {
  // whisper available and works
  let calls = 0;
  const okWhisper = { isAvailable: () => true, transcribe: async () => { calls++; return { text: "wc", engine: "whisper-cpp", device: "cpu" }; } };
  const e1 = createTranscriptionEngine({ whisperCpp: okWhisper, fallback });
  assert.equal((await e1.transcribe(new Float32Array(1), "es", {})).text, "wc");

  // whisper throws -> fallback, and stays on fallback (sticky)
  const badWhisper = { isAvailable: () => true, transcribe: async () => { throw new Error("boom"); } };
  const e2 = createTranscriptionEngine({ whisperCpp: badWhisper, fallback });
  assert.equal((await e2.transcribe(new Float32Array(1), "es", {})).engine, "transformers-js");
  let probed = 0;
  const badWhisper2 = { isAvailable: () => { probed++; return true; }, transcribe: async () => { throw new Error("boom"); } };
  const e3 = createTranscriptionEngine({ whisperCpp: badWhisper2, fallback });
  await e3.transcribe(new Float32Array(1), "es", {});
  await e3.transcribe(new Float32Array(1), "es", {}); // second call must not re-try whisper
  assert.equal(probed, 1, "sticky fallback: whisper probed once");

  // whisper unavailable -> fallback immediately
  const e4 = createTranscriptionEngine({ whisperCpp: { isAvailable: () => false, transcribe: async () => { throw new Error("x"); } }, fallback });
  assert.equal((await e4.transcribe(new Float32Array(1), "es", {})).engine, "transformers-js");
  console.log("transcription-engine: 4 checks passed.");
})();
