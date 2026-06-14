const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { decodePcm16Wav, wordErrorRate } = require("../src/benchmark-utils.cjs");
const { resampleAudio } = require("../src/audio-quality.cjs");
const { WHISPER_PROFILES } = require("../src/whisper-profiles.cjs");

async function run() {
  const manifestPath = path.resolve(process.argv[2] || "benchmarks/corpus/manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  if (!Array.isArray(manifest.cases) || !manifest.cases.length) throw new Error("The benchmark manifest has no cases.");
  const cacheDir = path.join(os.tmpdir(), "nextstepai-benchmark-models");
  const { env, pipeline } = await import("@huggingface/transformers");
  env.cacheDir = cacheDir;
  env.allowLocalModels = true;
  env.allowRemoteModels = true;

  const report = { generatedAt: new Date().toISOString(), manifest: manifestPath, profiles: {} };
  const profiles = [
    ...Object.values(WHISPER_PROFILES),
    ...(Array.isArray(manifest.candidates) ? manifest.candidates : [])
  ];
  for (const profile of profiles) {
    const transcriber = await pipeline("automatic-speech-recognition", profile.model, {
      device: "cpu",
      dtype: profile.dtype
    });
    try {
      const cases = [];
      for (const testCase of manifest.cases) {
        const wavPath = path.resolve(path.dirname(manifestPath), testCase.audio);
        const wav = decodePcm16Wav(await fs.readFile(wavPath));
        const samples = resampleAudio(wav.samples, wav.sampleRate);
        const startedAt = performance.now();
        const output = await transcriber(samples, {
          ...(profile.modelType === "ctc" ? {} : {
            language: testCase.language || "spanish",
            task: "transcribe"
          }),
          chunk_length_s: 30,
          stride_length_s: 5,
          ...profile.generation
        });
        const elapsedMs = Math.round(performance.now() - startedAt);
        const audioSeconds = samples.length / 16000;
        cases.push({
          id: testCase.id,
          hypothesis: output.text.trim(),
          reference: testCase.reference,
          realtimeFactor: Number((elapsedMs / 1000 / audioSeconds).toFixed(3)),
          elapsedMs,
          wer: Number(wordErrorRate(testCase.reference, output.text).toFixed(4))
        });
      }
      report.profiles[profile.id] = {
        model: profile.model,
        dtype: profile.dtype,
        averageWer: Number((cases.reduce((sum, item) => sum + item.wer, 0) / cases.length).toFixed(4)),
        averageRealtimeFactor: Number((cases.reduce((sum, item) => sum + item.realtimeFactor, 0) / cases.length).toFixed(3)),
        cases
      };
    } finally {
      await transcriber.dispose?.();
    }
  }
  const reportPath = path.resolve(process.argv[3] || "benchmarks/results/latest.json");
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`Benchmark report: ${reportPath}`);
  for (const [id, profile] of Object.entries(report.profiles)) {
    console.log(`${id}: WER=${profile.averageWer}, RTF=${profile.averageRealtimeFactor}`);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
