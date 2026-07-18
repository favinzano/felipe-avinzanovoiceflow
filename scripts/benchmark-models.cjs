const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { decodePcm16Wav, wordErrorRate } = require("../src/benchmark-utils.cjs");
const { percentile } = require("../src/transcription-metrics.cjs");
const { resampleAudio } = require("../src/audio-quality.cjs");
const { WHISPER_PROFILES } = require("../src/whisper-profiles.cjs");
const brand = require("../src/brand-config.cjs");

const execFileAsync = promisify(execFile);
const WARM_REPETITIONS = 3;

function commandArgs(profile, values) {
  return (profile.args || []).map((argument) => String(argument)
    .replaceAll("{audio}", values.audio)
    .replaceAll("{language}", values.language));
}

async function runCommandCandidate(profile, values) {
  const { stdout } = await execFileAsync(profile.command, commandArgs(profile, values), {
    cwd: profile.cwd ? path.resolve(profile.cwd) : undefined,
    timeout: profile.timeoutMs || 120000,
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024
  });
  if (!profile.outputField) return stdout.trim();
  const parsed = JSON.parse(stdout);
  const text = profile.outputField.split(".").reduce((value, key) => value?.[key], parsed);
  if (typeof text !== "string") throw new Error(`Command candidate did not return ${profile.outputField}.`);
  return text.trim();
}

async function run() {
  const manifestPath = path.resolve(process.argv[2] || "benchmarks/corpus/manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  if (!Array.isArray(manifest.cases) || !manifest.cases.length) throw new Error("The benchmark manifest has no cases.");
  const cacheDir = path.join(os.tmpdir(), `${brand.slug}-benchmark-models`);
  const { env, pipeline } = await import("@huggingface/transformers");
  env.cacheDir = cacheDir;
  env.allowLocalModels = true;
  env.allowRemoteModels = process.env.VOICEFLOW_BENCHMARK_ALLOW_DOWNLOADS === "1";

  const report = {
    generatedAt: new Date().toISOString(),
    manifest: manifestPath,
    remoteDownloadsEnabled: env.allowRemoteModels,
    repetitions: { cold: 1, warm: WARM_REPETITIONS },
    profiles: {}
  };
  const profiles = [...Object.values(WHISPER_PROFILES), ...(Array.isArray(manifest.candidates) ? manifest.candidates : [])];
  for (const profile of profiles) {
    const cases = [];
    let peakMemoryMb = 0;
    for (const testCase of manifest.cases) {
      const wavPath = path.resolve(path.dirname(manifestPath), testCase.audio);
      const wav = decodePcm16Wav(await fs.readFile(wavPath));
      const samples = resampleAudio(wav.samples, wav.sampleRate);
      const audioSeconds = samples.length / 16000;
      let transcriber;
      let modelLoadMs = 0;
      if (!profile.command) {
        const loadStartedAt = performance.now();
        transcriber = await pipeline("automatic-speech-recognition", profile.model, { device: profile.device || "cpu", dtype: profile.dtype });
        modelLoadMs = Math.round(performance.now() - loadStartedAt);
      }
      try {
        const repetitions = [];
        let hypothesis = "";
        for (let repetition = 0; repetition <= WARM_REPETITIONS; repetition += 1) {
          const startedAt = performance.now();
          if (profile.command) {
            hypothesis = await runCommandCandidate(profile, { audio: wavPath, language: testCase.language || "spanish" });
          } else {
            const output = await transcriber(samples, {
              ...(profile.modelType === "ctc" ? {} : { language: testCase.language || "spanish", task: "transcribe" }),
              chunk_length_s: 30,
              stride_length_s: 5,
              ...profile.generation
            });
            hypothesis = output.text.trim();
          }
          repetitions.push(Math.round(performance.now() - startedAt));
          peakMemoryMb = Math.max(peakMemoryMb, Math.round(process.memoryUsage().rss / 1024 / 1024));
        }
        const warmElapsedMs = repetitions.slice(1);
        cases.push({
          id: testCase.id,
          audioMs: Math.round(audioSeconds * 1000),
          hypothesis,
          reference: testCase.reference,
          modelLoadMs,
          coldElapsedMs: repetitions[0],
          warmElapsedMs,
          warmP50Ms: percentile(warmElapsedMs, 0.5),
          warmP95Ms: percentile(warmElapsedMs, 0.95),
          realtimeFactor: Number((percentile(warmElapsedMs, 0.5) / 1000 / audioSeconds).toFixed(3)),
          wer: Number(wordErrorRate(testCase.reference, hypothesis).toFixed(4))
        });
      } finally {
        await transcriber?.dispose?.();
      }
    }
    const allWarm = cases.flatMap((entry) => entry.warmElapsedMs);
    report.profiles[profile.id] = {
      engine: profile.command ? "external-command" : "transformers.js",
      model: profile.model,
      device: profile.device || "cpu",
      dtype: profile.dtype,
      averageWer: Number((cases.reduce((sum, item) => sum + item.wer, 0) / cases.length).toFixed(4)),
      warmP50Ms: percentile(allWarm, 0.5),
      warmP95Ms: percentile(allWarm, 0.95),
      peakMemoryMb,
      cases
    };
  }
  const reportPath = path.resolve(process.argv[3] || "benchmarks/results/latest.json");
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`Benchmark report: ${reportPath}`);
  for (const [id, profile] of Object.entries(report.profiles)) console.log(`${id}: WER=${profile.averageWer}, p50=${profile.warmP50Ms} ms, p95=${profile.warmP95Ms} ms`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
