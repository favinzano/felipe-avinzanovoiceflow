const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { cleanTranscription } = require("./text-cleanup.cjs");
const { createIsolatedModelCache, verifyModelDownloads, loadPipelineWithRetry, withFreshCacheRetry } = require("./model-smoke-utils.cjs");
const { resolveWhisperProfile } = require("./whisper-profiles.cjs");

async function attemptSmokeTest() {
  const cacheDir = await createIsolatedModelCache("voiceflow-transcription-smoke-");
  const { pipeline, env } = await import("@huggingface/transformers");
  env.cacheDir = cacheDir;
  env.allowLocalModels = true;
  env.allowRemoteModels = true;

  const profile = resolveWhisperProfile("fast");
  let transcriber;
  try {
    transcriber = await loadPipelineWithRetry(pipeline, "automatic-speech-recognition", profile.model, {
      device: "cpu",
      dtype: "fp32"
    });
    await verifyModelDownloads(cacheDir, profile.model);

    let seed = 123456789;
    const random = () => {
      seed = (1103515245 * seed + 12345) % 2147483648;
      return (seed / 2147483648) * 2 - 1;
    };

    const nonSpeechCases = [
      ["silence", new Float32Array(48000)],
      ["tone", Float32Array.from({ length: 48000 }, (_, index) => Math.sin(2 * Math.PI * 440 * index / 16000) * 0.03)],
      ["noise", Float32Array.from({ length: 48000 }, () => random() * 0.015)]
    ];

    for (const [name, samples] of nonSpeechCases) {
      const output = await transcriber(samples, {
        language: "spanish",
        task: "transcribe",
        chunk_length_s: 30,
        stride_length_s: 5
      });
      assert.equal(cleanTranscription(output.text), "", `${name}: ${output.text}`);
    }

    console.log(`${nonSpeechCases.length} real Whisper CPU/fp32 non-speech cases passed`);
  } finally {
    if (typeof transcriber?.dispose === "function") await transcriber.dispose();
    await fs.rm(cacheDir, { recursive: true, force: true });
  }
}

withFreshCacheRetry(attemptSmokeTest).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
