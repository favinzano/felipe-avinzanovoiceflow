// Real end-to-end smoke test for the whisper.cpp sidecar: runs the actual
// staged whisper-cli binary on a known speech clip through the real service
// (encodeWav16 -> spawn -> parseWhisperJson) and asserts the transcription is
// correct. It SKIPS cleanly when the sidecar binary is not staged (e.g. a plain
// dev checkout), so it only exercises real inference where the binary exists
// (the release build stages it via scripts/fetch-whisper-binaries.cjs). The
// small ggml-base model is downloaded+cached on first run via ensureModel.

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { resolveWhisperProfile } = require("./whisper-profiles.cjs");
const { createWhisperCppService } = require("./whisper-cpp-service.cjs");

const root = path.join(__dirname, "..");
const key = `${process.platform}-${process.arch}`;
const binaryName = process.platform === "win32" ? "whisper-cli.exe" : "whisper-cli";
const binaryPath = path.join(root, "native", key, binaryName);
const wavPath = path.join(root, "test-assets", "smoke-16k.wav");

function decodeWav16(buf) {
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "data") {
      const n = Math.floor(size / 2);
      const f = new Float32Array(n);
      for (let i = 0; i < n; i++) f[i] = buf.readInt16LE(off + 8 + i * 2) / 32768;
      return f;
    }
    off += 8 + size + (size % 2);
  }
  throw new Error("no data chunk in smoke WAV");
}

(async () => {
  if (!fs.existsSync(binaryPath)) {
    console.log(`whisper-cpp smoke: skipped (no sidecar binary at native/${key}/${binaryName}).`);
    return;
  }
  const fast = resolveWhisperProfile("fast");
  const modelsDir = path.join(root, ".tmp", "whisper-smoke-models");
  fs.mkdirSync(modelsDir, { recursive: true });
  // Don't trigger a ~141MB model download from the general test suite: run real
  // inference only when the model is already cached, or when explicitly enabled
  // (WHISPER_SMOKE=1, which the release CI sets). Otherwise skip cleanly.
  const modelCached = fs.existsSync(path.join(modelsDir, fast.ggml.file));
  if (!modelCached && process.env.WHISPER_SMOKE !== "1") {
    console.log("whisper-cpp smoke: skipped (model not cached; set WHISPER_SMOKE=1 to download and run real inference).");
    return;
  }
  const float32 = decodeWav16(fs.readFileSync(wavPath));
  const service = createWhisperCppService({ binaryPath, modelsDir });
  assert.equal(service.isAvailable(), true, "sidecar binary reports available");
  const result = await service.transcribe(float32, "en", fast);
  assert.equal(result.engine, "whisper-cpp", "engine tag");
  assert.equal(result.device, "cpu", "device tag");
  assert.ok(result.text && /country/i.test(result.text), `expected 'country' in transcript, got: ${result.text}`);
  console.log(`whisper-cpp smoke: passed (${result.ms}ms) — "${result.text.slice(0, 70)}${result.text.length > 70 ? "…" : ""}"`);
})().catch((error) => {
  console.error("whisper-cpp smoke FAILED:", error);
  process.exit(1);
});
