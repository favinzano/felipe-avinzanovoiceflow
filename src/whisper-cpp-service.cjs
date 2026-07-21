const nodeFs = require("node:fs");
const nodePath = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { encodeWav16 } = require("./wav-encode.cjs");
const { parseWhisperJson } = require("./whisper-cpp-output.cjs");
const { ensureModel } = require("./ggml-model-manager.cjs");

function createWhisperCppService({
  binaryPath, modelsDir, tmpDir = os.tmpdir(),
  spawnImpl = spawn, fs = nodeFs, ensureModelImpl = ensureModel
} = {}) {
  function isAvailable() {
    try { return Boolean(binaryPath) && fs.existsSync(binaryPath); } catch { return false; }
  }

  async function transcribe(float32, language, profile) {
    if (!isAvailable()) throw new Error("whisper sidecar unavailable");
    const started = Date.now();
    const modelPath = await ensureModelImpl(profile.ggml, { modelsDir });
    const stamp = `${process.pid}-${started}`;
    const wavPath = nodePath.join(tmpDir, `vf-${stamp}.wav`);
    const jsonPath = `${wavPath}.json`;
    await fs.promises.writeFile(wavPath, encodeWav16(float32, 16000));
    const threads = String(Math.max(1, Math.min(8, os.cpus?.().length || 4)));
    const args = ["--model", modelPath, "--language", language || "auto",
      "--threads", threads, "--output-json", "--no-prints", "-f", wavPath];
    try {
      await new Promise((resolve, reject) => {
        const proc = spawnImpl(binaryPath, args);
        let stderr = "";
        proc.stderr?.on?.("data", (d) => { stderr += d; });
        proc.on("error", reject);
        proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`whisper exit ${code}: ${stderr}`)));
      });
      const json = await fs.promises.readFile(jsonPath, "utf8");
      const { text } = parseWhisperJson(json.toString());
      return { text, engine: "whisper-cpp", device: "cpu", ms: Date.now() - started };
    } finally {
      await fs.promises.unlink(wavPath).catch(() => {});
      await fs.promises.unlink(jsonPath).catch(() => {});
    }
  }

  return { transcribe, isAvailable };
}

module.exports = { createWhisperCppService };
