const fs = require("node:fs/promises");
const path = require("node:path");

const MAX_TRANSCRIPTION_METRICS = 200;
const METRIC_FIELDS = Object.freeze([
  "at",
  "engine",
  "model",
  "device",
  "requestedDevice",
  "profile",
  "language",
  "audioMs",
  "captureFinalizeMs",
  "preprocessMs",
  "ipcMs",
  "modelWaitMs",
  "inferenceMs",
  "textFinalizeMs",
  "clipboardMs",
  "focusMs",
  "pasteMs",
  "historyMs",
  "endToPasteMs",
  "totalMs",
  "realtimeFactor",
  "memoryRssMb",
  "coldStart",
  "pasted",
  "success",
  "failureReason"
]);

function metricsPath(userDataPath) {
  return path.join(userDataPath, "transcription-metrics.json");
}

function sanitizeMetric(metric = {}) {
  const sanitized = {};
  for (const field of METRIC_FIELDS) {
    const value = metric[field];
    if (typeof value === "string" || typeof value === "boolean" || Number.isFinite(value)) {
      sanitized[field] = value;
    }
  }
  sanitized.at = typeof sanitized.at === "string" ? sanitized.at : new Date().toISOString();
  return sanitized;
}

function percentile(values, fraction) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const index = Math.max(0, Math.ceil(sorted.length * fraction) - 1);
  return sorted[Math.min(index, sorted.length - 1)];
}

function summarizeMetrics(entries = []) {
  const successful = entries.filter((entry) => entry.success !== false);
  const endToPaste = successful.map((entry) => entry.endToPasteMs).filter(Number.isFinite);
  const inference = successful.map((entry) => entry.inferenceMs).filter(Number.isFinite);
  const summary = {
    count: entries.length,
    successful: successful.length,
    failed: entries.length - successful.length,
    endToPasteP50Ms: percentile(endToPaste, 0.5),
    endToPasteP95Ms: percentile(endToPaste, 0.95),
    inferenceP50Ms: percentile(inference, 0.5),
    inferenceP95Ms: percentile(inference, 0.95)
  };
  const buckets = {
    "0-5s": entries.filter((entry) => entry.audioMs <= 5000),
    "5-10s": entries.filter((entry) => entry.audioMs > 5000 && entry.audioMs <= 10000),
    "10-30s": entries.filter((entry) => entry.audioMs > 10000 && entry.audioMs <= 30000),
    ">30s": entries.filter((entry) => entry.audioMs > 30000)
  };
  summary.byDuration = Object.fromEntries(Object.entries(buckets).map(([name, bucket]) => {
    const successfulBucket = bucket.filter((entry) => entry.success !== false);
    const latency = successfulBucket.map((entry) => entry.endToPasteMs).filter(Number.isFinite);
    return [name, {
      count: bucket.length,
      endToPasteP50Ms: percentile(latency, 0.5),
      endToPasteP95Ms: percentile(latency, 0.95)
    }];
  }));
  return summary;
}

function createTranscriptionMetricsStore(userDataPath, options = {}) {
  const filePath = options.filePath || metricsPath(userDataPath);
  const maximum = Number.isInteger(options.maximum) ? options.maximum : MAX_TRANSCRIPTION_METRICS;
  let writeQueue = Promise.resolve();

  async function read() {
    try {
      const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
      if (!Array.isArray(parsed)) return [];
      return parsed.slice(-maximum).map(sanitizeMetric);
    } catch (error) {
      if (error.code === "ENOENT" || error.name === "SyntaxError") return [];
      throw error;
    }
  }

  function append(metric) {
    const safeMetric = sanitizeMetric(metric);
    writeQueue = writeQueue.catch(() => {}).then(async () => {
      const entries = await read();
      entries.push(safeMetric);
      const retained = entries.slice(-maximum);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const temporary = `${filePath}.${process.pid}.tmp`;
      await fs.writeFile(temporary, JSON.stringify(retained, null, 2), "utf8");
      await fs.rename(temporary, filePath);
      return safeMetric;
    });
    return writeQueue;
  }

  async function summary() {
    return summarizeMetrics(await read());
  }

  function flush() {
    return writeQueue;
  }

  return { append, flush, read, summary, filePath };
}

module.exports = {
  MAX_TRANSCRIPTION_METRICS,
  METRIC_FIELDS,
  createTranscriptionMetricsStore,
  metricsPath,
  percentile,
  sanitizeMetric,
  summarizeMetrics
};
