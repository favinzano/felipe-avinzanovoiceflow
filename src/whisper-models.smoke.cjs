const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { cleanTranscription } = require("./text-cleanup.cjs");
const { createIsolatedModelCache, verifyModelDownloads, loadPipelineWithRetry, withFreshCacheRetry } = require("./model-smoke-utils.cjs");
const { WHISPER_PROFILES } = require("./whisper-profiles.cjs");

// Each attempt gets its own fresh cache directory so a transient failure
// (e.g. an antivirus-truncated download) can't persist into the retry.
async function testProfile(profile) {
  const cacheDir = await createIsolatedModelCache();
  console.log(`${profile.shortLabel}: usando directorio de caché aislado ${cacheDir}`);
  const { pipeline, env } = await import("@huggingface/transformers");
  env.cacheDir = cacheDir;
  env.allowLocalModels = true;
  env.allowRemoteModels = true;
  console.log(`${profile.shortLabel}: env.cacheDir confirmado en ${env.cacheDir}`);

  let transcriber;
  try {
    transcriber = await loadPipelineWithRetry(pipeline, "automatic-speech-recognition", profile.model, {
      device: "cpu",
      dtype: "fp32"
    });
    await verifyModelDownloads(cacheDir, profile.model);

    const output = await transcriber(new Float32Array(32000), {
      language: "spanish",
      task: "transcribe",
      chunk_length_s: 30,
      stride_length_s: 5,
      ...profile.generation
    });
    assert.equal(typeof output.text, "string", `${profile.shortLabel} returned an invalid transcription result`);
    const cleaned = cleanTranscription(output.text);
    assert.ok(cleaned.length <= 80, `${profile.shortLabel} produced an uncontrolled non-speech output: ${output.text}`);
    console.log(
      `${profile.shortLabel} loaded on CPU/fp32 with production generation settings`
      + (cleaned ? `; bounded non-speech output observed: ${JSON.stringify(cleaned)}` : "")
    );
  } finally {
    if (typeof transcriber?.dispose === "function") await transcriber.dispose();
    await fs.rm(cacheDir, { recursive: true, force: true });
  }
}

async function run() {
  for (const profile of Object.values(WHISPER_PROFILES)) {
    await withFreshCacheRetry(() => testProfile(profile));
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
