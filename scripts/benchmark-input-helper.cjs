const path = require("node:path");
const { execFile } = require("node:child_process");
const { createInputStrategy } = require("../src/input-helper.cjs");
const { percentile } = require("../src/transcription-metrics.cjs");

async function measure(strategy, repetitions) {
  const elapsed = [];
  for (let index = 0; index < repetitions; index += 1) {
    const startedAt = performance.now();
    await strategy.captureTarget();
    elapsed.push(Number((performance.now() - startedAt).toFixed(2)));
  }
  strategy.dispose?.();
  return { repetitions, p50Ms: percentile(elapsed, 0.5), p95Ms: percentile(elapsed, 0.95), elapsedMs: elapsed };
}

(async () => {
  if (process.platform !== "win32") throw new Error("Este benchmark sólo aplica a Windows.");
  const helperPath = path.resolve(process.argv[2] || "native/win32-x64/FelipeAvinzano.VoiceFlow.PasteHelper.exe");
  const persistent = createInputStrategy({ platform: "win32", helperPath });
  const oneShot = createInputStrategy({
    platform: "win32",
    helperPath,
    execFileImpl: (...args) => execFile(...args)
  });
  const report = {
    generatedAt: new Date().toISOString(),
    operation: "capture-target-only",
    persistent: await measure(persistent, 100),
    oneShot: await measure(oneShot, 20)
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
