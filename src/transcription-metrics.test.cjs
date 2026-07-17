const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
  createTranscriptionMetricsStore,
  percentile,
  sanitizeMetric,
  summarizeMetrics
} = require("./transcription-metrics.cjs");

async function run() {
  assert.equal(percentile([10, 30, 20], 0.5), 20);
  assert.equal(percentile([10, 20, 30, 40], 0.95), 40);
  assert.equal(percentile([], 0.5), null);

  const sanitized = sanitizeMetric({
    engine: "transformers-js",
    inferenceMs: 120,
    text: "must not persist",
    audio: [1, 2, 3],
    transcriptHash: "must not persist"
  });
  assert.equal(sanitized.engine, "transformers-js");
  assert.equal(sanitized.inferenceMs, 120);
  assert.equal("text" in sanitized, false);
  assert.equal("audio" in sanitized, false);
  assert.equal("transcriptHash" in sanitized, false);

  assert.deepEqual(summarizeMetrics([
    { success: true, audioMs: 3000, endToPasteMs: 100, inferenceMs: 80 },
    { success: true, audioMs: 8000, endToPasteMs: 200, inferenceMs: 160 },
    { success: false, audioMs: 4000, endToPasteMs: 999 }
  ]), {
    count: 3,
    successful: 2,
    failed: 1,
    endToPasteP50Ms: 100,
    endToPasteP95Ms: 200,
    inferenceP50Ms: 80,
    inferenceP95Ms: 160,
    byDuration: {
      "0-5s": { count: 2, endToPasteP50Ms: 100, endToPasteP95Ms: 100 },
      "5-10s": { count: 1, endToPasteP50Ms: 200, endToPasteP95Ms: 200 },
      "10-30s": { count: 0, endToPasteP50Ms: null, endToPasteP95Ms: null },
      ">30s": { count: 0, endToPasteP50Ms: null, endToPasteP95Ms: null }
    }
  });

  const root = await fs.mkdtemp(path.join(os.tmpdir(), "voiceflow-metrics-"));
  try {
    const store = createTranscriptionMetricsStore(root, { maximum: 2 });
    await Promise.all([
      store.append({ engine: "one", totalMs: 1 }),
      store.append({ engine: "two", totalMs: 2 }),
      store.append({ engine: "three", totalMs: 3, text: "private" })
    ]);
    const entries = await store.read();
    assert.deepEqual(entries.map((entry) => entry.engine), ["two", "three"]);
    assert.equal("text" in entries[1], false);
    await store.flush();
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }

  console.log("Transcription metrics: 12 checks passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
