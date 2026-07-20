# Transcription Acceleration (whisper.cpp sidecar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CPU whisper.cpp sidecar as the default transcription engine (Whisper Large v3 Turbo), with automatic fallback to the existing transformers.js engine, cutting latency from ~15–18 s toward ~3–8 s while staying 100 % local.

**Architecture:** Transcription stays in the main process. A new `transcription-engine.cjs` dispatcher chooses whisper.cpp (new `whisper-cpp-service.cjs`, which spawns a bundled per-platform `whisper-cli` binary) and falls back to `transcription-service.cjs` (unchanged) on failure. GGML models download on first use via a new `ggml-model-manager.cjs` and cache in `userData/models/ggml/`.

**Tech Stack:** Electron main process, Node `child_process`, whisper.cpp prebuilt CLI binaries, GGML models from HuggingFace `ggerganov/whisper.cpp`, existing `*.test.cjs` node test convention, electron-builder `extraResources`/`asarUnpack`.

## Global Constraints

- 100 % offline inference: no cloud transcription APIs, ever. Model download from HuggingFace is allowed once, then fully local (matches current ONNX behavior). — verbatim from CLAUDE.md
- CPU only in v1. No GPU/DirectML/Vulkan backend (DirectML was reverted in 1.1.13 for corrupt output).
- Keep the existing transformers.js path (`src/transcription-service.cjs`) untouched and working as the fallback.
- Preserve the current `transcribe` return contract consumed by the renderer: `{ text, device, ... }` plus history wiring.
- Node test convention: plain `*.test.cjs` using `node:assert/strict`, no framework; each prints a "…passed" line. Add each new test file to the `test` and `test:production` scripts in `package.json`.
- Never skip hooks or bypass the legal release gate. Releases follow the tag → CI flow (see `docs/superpowers/specs/2026-07-20-transcription-acceleration-design.md` and memory `release-flow`).

---

### Task 0: Verification spike — whisper.cpp binary + CLI contract (Windows first)

Purpose: replace assumptions with verified facts before building. **Output of this task fills exact values (binary name, flags, JSON schema, download URLs, SHA-256, sizes) into Tasks 4–8.** No production code ships from this task.

**Files:**
- Create: `docs/superpowers/notes/whisper-cpp-spike.md` (findings)

- [ ] **Step 1: Confirm prebuilt availability.** Check `https://github.com/ggerganov/whisper.cpp/releases` for prebuilt CLI binaries covering: Windows x64 (AVX2 and a no-AVX "legacy" variant), macOS arm64, macOS x64, Linux x64. Record download URLs + SHA-256 for each, or mark "must build from source (cmake)".
- [ ] **Step 2: Confirm the model URL + hash.** Resolve `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin`; record byte size + SHA-256. Repeat for `ggml-base.bin` and `ggml-large-v3-turbo-q8_0.bin`.
- [ ] **Step 3: Verify the CLI contract locally.** With a real 16 kHz mono WAV (`test-16k.wav`), run the Windows binary:

Run: `whisper-cli.exe --model ggml-large-v3-turbo-q5_0.bin --language es --output-json --no-prints -f test-16k.wav`
Expected: exit 0; a `test-16k.wav.json` produced. Record the actual JSON schema (segment array path to text), the exact flag names that worked (older builds use `-m/-l/-oj/-f`), and wall-clock time.

- [ ] **Step 4: Write findings** to `docs/superpowers/notes/whisper-cpp-spike.md`: table of {target → binary URL, sha256}, model {url, sha256, bytes} rows, the confirmed CLI arg list, and the JSON text-extraction path. Commit.

```bash
git add docs/superpowers/notes/whisper-cpp-spike.md
git commit -m "docs: whisper.cpp sidecar verification spike findings"
```

---

### Task 1: WAV encoder for 16 kHz mono Float32 → 16-bit PCM WAV

**Files:**
- Create: `src/wav-encode.cjs`
- Test: `src/wav-encode.test.cjs`

**Interfaces:**
- Produces: `encodeWav16(float32, sampleRate = 16000): Buffer` — a canonical 16-bit PCM mono WAV buffer.

- [ ] **Step 1: Write the failing test**

```js
const assert = require("node:assert/strict");
const { encodeWav16 } = require("./wav-encode.cjs");

const samples = Float32Array.from([0, 0.5, -0.5, 1, -1]);
const wav = encodeWav16(samples, 16000);

// RIFF/WAVE header checks
assert.equal(wav.toString("ascii", 0, 4), "RIFF");
assert.equal(wav.toString("ascii", 8, 12), "WAVE");
assert.equal(wav.readUInt16LE(20), 1, "PCM format");
assert.equal(wav.readUInt16LE(22), 1, "mono");
assert.equal(wav.readUInt32LE(24), 16000, "sample rate");
assert.equal(wav.readUInt16LE(34), 16, "16-bit");
// data chunk = 5 samples * 2 bytes
assert.equal(wav.readUInt32LE(40), 10);
assert.equal(wav.length, 44 + 10);
// clamping: 1 -> 32767, -1 -> -32768
assert.equal(wav.readInt16LE(44 + 6), 32767);
assert.equal(wav.readInt16LE(44 + 8), -32768);
console.log("wav-encode: 9 checks passed.");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node src/wav-encode.test.cjs`
Expected: FAIL — `Cannot find module './wav-encode.cjs'`.

- [ ] **Step 3: Write minimal implementation**

```js
function encodeWav16(float32, sampleRate = 16000) {
  const n = float32.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);            // PCM
  buf.writeUInt16LE(1, 22);            // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32);            // block align
  buf.writeUInt16LE(16, 34);           // bits per sample
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    let s = Math.max(-1, Math.min(1, float32[i]));
    s = s < 0 ? s * 32768 : s * 32767;
    buf.writeInt16LE(Math.round(s), 44 + i * 2);
  }
  return buf;
}

module.exports = { encodeWav16 };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node src/wav-encode.test.cjs`
Expected: PASS — "wav-encode: 9 checks passed."

- [ ] **Step 5: Add to test scripts and commit.** Append `&& node src/wav-encode.test.cjs` to `test` and `test:production` in `package.json`.

```bash
git add src/wav-encode.cjs src/wav-encode.test.cjs package.json
git commit -m "feat: add 16-bit WAV encoder for whisper.cpp sidecar input"
```

---

### Task 2: whisper.cpp JSON output parser

**Files:**
- Create: `src/whisper-cpp-output.cjs`
- Test: `src/whisper-cpp-output.test.cjs`

**Interfaces:**
- Produces: `parseWhisperJson(jsonText): { text: string }` — concatenates + trims segment texts; throws `Error("empty whisper output")` on no segments, `Error("invalid whisper json")` on parse failure.

> NOTE: the exact JSON path comes from Task 0 Step 3. The test below assumes the common whisper.cpp schema `{ transcription: [ { text }... ] }`. Adjust the path constant if the spike found a different schema.

- [ ] **Step 1: Write the failing test**

```js
const assert = require("node:assert/strict");
const { parseWhisperJson } = require("./whisper-cpp-output.cjs");

const ok = JSON.stringify({ transcription: [{ text: " Hola" }, { text: " mundo." }] });
assert.equal(parseWhisperJson(ok).text, "Hola mundo.");

assert.throws(() => parseWhisperJson(JSON.stringify({ transcription: [] })), /empty whisper output/);
assert.throws(() => parseWhisperJson("{not json"), /invalid whisper json/);
console.log("whisper-cpp-output: 3 checks passed.");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node src/whisper-cpp-output.test.cjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
function parseWhisperJson(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("invalid whisper json");
  }
  const segments = Array.isArray(parsed.transcription) ? parsed.transcription : [];
  const text = segments.map((s) => (s && typeof s.text === "string" ? s.text : "")).join("").trim();
  if (!text) throw new Error("empty whisper output");
  return { text };
}

module.exports = { parseWhisperJson };
```

- [ ] **Step 4: Run to verify pass.** Run: `node src/whisper-cpp-output.test.cjs` → PASS.
- [ ] **Step 5: Add to test scripts and commit.**

```bash
git add src/whisper-cpp-output.cjs src/whisper-cpp-output.test.cjs package.json
git commit -m "feat: add whisper.cpp JSON output parser"
```

---

### Task 3: GGML model descriptors on profiles

**Files:**
- Modify: `src/whisper-profiles.cjs`
- Test: `src/whisper-profiles.test.cjs` (existing — extend)

**Interfaces:**
- Produces: each profile gains `ggml: { repo, file, sha256, bytes }`. Values from Task 0 Step 2.

- [ ] **Step 1: Extend the existing test** — add assertions that each profile exposes a `ggml.file` ending in `.bin` and a non-empty `sha256`.

```js
for (const id of ["fast", "balanced", "accurate"]) {
  const p = WHISPER_PROFILES[id];
  assert.match(p.ggml.file, /\.bin$/, `${id} has a ggml file`);
  assert.ok(p.ggml.sha256 && p.ggml.sha256.length === 64, `${id} has a sha256`);
}
```

- [ ] **Step 2: Run to verify it fails.** Run: `node src/whisper-profiles.test.cjs` → FAIL (`ggml` undefined).
- [ ] **Step 3: Add the `ggml` field to each profile** in `src/whisper-profiles.cjs` (fill `sha256`/`bytes` from the spike):

```js
fast:     { …existing…, ggml: { repo: "ggerganov/whisper.cpp", file: "ggml-base.bin", sha256: "<spike>", bytes: 0 } },
balanced: { …existing…, ggml: { repo: "ggerganov/whisper.cpp", file: "ggml-large-v3-turbo-q5_0.bin", sha256: "<spike>", bytes: 0 } },
accurate: { …existing…, ggml: { repo: "ggerganov/whisper.cpp", file: "ggml-large-v3-turbo-q8_0.bin", sha256: "<spike>", bytes: 0 } },
```

- [ ] **Step 4: Run to verify pass.** Run: `node src/whisper-profiles.test.cjs` → PASS.
- [ ] **Step 5: Commit.**

```bash
git add src/whisper-profiles.cjs src/whisper-profiles.test.cjs
git commit -m "feat: map whisper profiles to GGML models"
```

---

### Task 4: GGML model manager (download + verify + cache)

**Files:**
- Create: `src/ggml-model-manager.cjs`
- Test: `src/ggml-model-manager.test.cjs`

**Interfaces:**
- Consumes: `encodeWav16` (no); profile `ggml` descriptor from Task 3.
- Produces: `resolveModelUrl(ggml): string`; `sha256File(path, fs=nodeFs): Promise<string>`; `ensureModel(ggml, { modelsDir, fetchImpl, fs }): Promise<string>` returning the cached model path — downloads to `<file>.part`, verifies SHA-256, atomic-renames; if the final file exists, returns immediately; on hash mismatch throws `Error("model hash mismatch")`.

- [ ] **Step 1: Write the failing tests** (URL resolution + hash verify with injected fs/fetch; no real network):

```js
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { resolveModelUrl, sha256File, ensureModel } = require("./ggml-model-manager.cjs");

assert.equal(
  resolveModelUrl({ repo: "ggerganov/whisper.cpp", file: "ggml-base.bin" }),
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"
);

// in-memory fs stub
const files = new Map();
const fs = {
  promises: {
    async readFile(p) { if (!files.has(p)) throw Object.assign(new Error("nofile"), { code: "ENOENT" }); return files.get(p); },
    async writeFile(p, b) { files.set(p, Buffer.from(b)); },
    async rename(a, b) { files.set(b, files.get(a)); files.delete(a); },
    async access(p) { if (!files.has(p)) throw Object.assign(new Error("nofile"), { code: "ENOENT" }); },
    async mkdir() {}
  }
};
const body = Buffer.from("MODELBYTES");
const sha = crypto.createHash("sha256").update(body).digest("hex");
const fetchImpl = async () => ({ ok: true, arrayBuffer: async () => body });
const ggml = { repo: "r", file: "m.bin", sha256: sha };

(async () => {
  const path = await ensureModel(ggml, { modelsDir: "/models", fetchImpl, fs });
  assert.equal(path, "/models/m.bin");
  assert.ok(files.has("/models/m.bin"));
  // second call: cached, no fetch
  const again = await ensureModel(ggml, { modelsDir: "/models", fetchImpl: () => { throw new Error("should not fetch"); }, fs });
  assert.equal(again, "/models/m.bin");
  // hash mismatch
  files.clear();
  await assert.rejects(ensureModel({ ...ggml, sha256: "0".repeat(64) }, { modelsDir: "/models", fetchImpl, fs }), /model hash mismatch/);
  console.log("ggml-model-manager: 4 checks passed.");
})();
```

- [ ] **Step 2: Run to verify it fails.** Run: `node src/ggml-model-manager.test.cjs` → FAIL (module not found).
- [ ] **Step 3: Write minimal implementation**

```js
const nodeFs = require("node:fs");
const nodePath = require("node:path");
const crypto = require("node:crypto");

function resolveModelUrl(ggml) {
  return `https://huggingface.co/${ggml.repo}/resolve/main/${ggml.file}`;
}

async function sha256File(path, fs = nodeFs) {
  const buf = await fs.promises.readFile(path);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function ensureModel(ggml, { modelsDir, fetchImpl = fetch, fs = nodeFs } = {}) {
  const finalPath = nodePath.join(modelsDir, ggml.file);
  try {
    await fs.promises.access(finalPath);
    return finalPath;
  } catch { /* not cached */ }
  await fs.promises.mkdir(modelsDir, { recursive: true });
  const partPath = `${finalPath}.part`;
  const res = await fetchImpl(resolveModelUrl(ggml));
  if (!res.ok) throw new Error(`model download failed: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(partPath, bytes);
  const got = crypto.createHash("sha256").update(bytes).digest("hex");
  if (ggml.sha256 && got !== ggml.sha256) throw new Error("model hash mismatch");
  await fs.promises.rename(partPath, finalPath);
  return finalPath;
}

module.exports = { resolveModelUrl, sha256File, ensureModel };
```

- [ ] **Step 4: Run to verify pass.** Run: `node src/ggml-model-manager.test.cjs` → PASS.
- [ ] **Step 5: Add to test scripts and commit.**

```bash
git add src/ggml-model-manager.cjs src/ggml-model-manager.test.cjs package.json
git commit -m "feat: add GGML model download/verify/cache manager"
```

---

### Task 5: whisper.cpp sidecar service

**Files:**
- Create: `src/whisper-cpp-service.cjs`
- Test: `src/whisper-cpp-service.test.cjs`

**Interfaces:**
- Consumes: `encodeWav16` (Task 1), `parseWhisperJson` (Task 2), `ensureModel` (Task 4).
- Produces: `createWhisperCppService({ binaryPath, modelsDir, spawnImpl, fs, tmpDir })` → `{ transcribe(float32, language, profile): Promise<{ text, engine: "whisper-cpp", device: "cpu", ms }>, isAvailable(): boolean }`. `transcribe` writes a temp WAV, spawns the binary, reads+parses the JSON sidecar file, and deletes temp files in a `finally`. Throws `Error("whisper sidecar unavailable")` if the binary is missing, or a wrapped error on non-zero exit.

- [ ] **Step 1: Write the failing test** (injected `spawnImpl` + `fs`; no real binary). Simulate the binary writing `<wav>.json`:

```js
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createWhisperCppService } = require("./whisper-cpp-service.cjs");

function fakeFs(initial = {}) {
  const files = new Map(Object.entries(initial));
  return {
    _files: files,
    existsSync: (p) => files.has(p),
    promises: {
      writeFile: async (p, b) => void files.set(p, Buffer.from(b)),
      readFile: async (p) => { if (!files.has(p)) throw new Error("nofile"); return files.get(p); },
      unlink: async (p) => void files.delete(p),
      mkdir: async () => {},
      access: async (p) => { if (!files.has(p)) throw Object.assign(new Error("x"), { code: "ENOENT" }); }
    }
  };
}

(async () => {
  const fs = fakeFs({ "/bin/whisper-cli": Buffer.from("x"), "/models/m.bin": Buffer.from("model") });
  const spawnImpl = (bin, args) => {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter(); proc.stderr = new EventEmitter();
    // find the -f wav path, write its .json, then exit 0
    const wav = args[args.indexOf("-f") + 1] ?? args[args.length - 1];
    fs._files.set(`${wav}.json`, Buffer.from(JSON.stringify({ transcription: [{ text: " ok" }] })));
    queueMicrotask(() => proc.emit("close", 0));
    return proc;
  };
  const svc = createWhisperCppService({
    binaryPath: "/bin/whisper-cli", modelsDir: "/models", tmpDir: "/tmp",
    spawnImpl, fs, ensureModelImpl: async () => "/models/m.bin"
  });
  assert.equal(svc.isAvailable(), true);
  const out = await svc.transcribe(Float32Array.from([0, 0.1, -0.1]), "es", { id: "balanced", ggml: { file: "m.bin" } });
  assert.equal(out.text, "ok");
  assert.equal(out.engine, "whisper-cpp");
  assert.equal(out.device, "cpu");
  // temp wav + json cleaned up
  assert.equal([...fs._files.keys()].some((k) => k.endsWith(".wav") || k.endsWith(".json")), false);

  // missing binary -> unavailable
  const svc2 = createWhisperCppService({ binaryPath: "/bin/none", modelsDir: "/models", tmpDir: "/tmp", spawnImpl, fs, ensureModelImpl: async () => "/models/m.bin" });
  assert.equal(svc2.isAvailable(), false);
  await assert.rejects(svc2.transcribe(Float32Array.from([0]), "es", { id: "balanced", ggml: { file: "m.bin" } }), /unavailable/);
  console.log("whisper-cpp-service: 6 checks passed.");
})();
```

- [ ] **Step 2: Run to verify it fails.** Run: `node src/whisper-cpp-service.test.cjs` → FAIL (module not found).
- [ ] **Step 3: Write minimal implementation** (flag names per Task 0 spike; `--output-json` writes `<wav>.json`):

```js
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
```

- [ ] **Step 4: Run to verify pass.** Run: `node src/whisper-cpp-service.test.cjs` → PASS.
- [ ] **Step 5: Add to test scripts and commit.**

```bash
git add src/whisper-cpp-service.cjs src/whisper-cpp-service.test.cjs package.json
git commit -m "feat: add whisper.cpp sidecar transcription service"
```

---

### Task 6: Engine dispatcher with fallback

**Files:**
- Create: `src/transcription-engine.cjs`
- Test: `src/transcription-engine.test.cjs`

**Interfaces:**
- Consumes: a whisper.cpp service (Task 5) and the existing transformers.js service (`transcription-service.cjs`) — both injected.
- Produces: `createTranscriptionEngine({ whisperCpp, fallback, preferWhisperCpp = true })` → `{ transcribe(float32, language, profile): Promise<result> }`. If `preferWhisperCpp` and `whisperCpp.isAvailable()`: try it; on any throw, log, set a sticky `fallbackForced` flag, and use `fallback`. Otherwise use `fallback`. Result always carries `engine`.

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run to verify it fails.** Run: `node src/transcription-engine.test.cjs` → FAIL (module not found).
- [ ] **Step 3: Write minimal implementation**

```js
function createTranscriptionEngine({ whisperCpp, fallback, preferWhisperCpp = true, logger = console } = {}) {
  let fallbackForced = false;
  async function transcribe(float32, language, profile) {
    if (preferWhisperCpp && !fallbackForced && whisperCpp && whisperCpp.isAvailable()) {
      try {
        return await whisperCpp.transcribe(float32, language, profile);
      } catch (error) {
        fallbackForced = true;
        logger.warn?.("whisper.cpp failed; falling back to transformers.js for this session:", error);
      }
    }
    return fallback.transcribe(float32, language, profile);
  }
  return { transcribe };
}

module.exports = { createTranscriptionEngine };
```

- [ ] **Step 4: Run to verify pass.** Run: `node src/transcription-engine.test.cjs` → PASS.
- [ ] **Step 5: Add to test scripts and commit.**

```bash
git add src/transcription-engine.cjs src/transcription-engine.test.cjs package.json
git commit -m "feat: add transcription engine dispatcher with sticky fallback"
```

---

### Task 7: Wire dispatcher into main + resolve binary path

**Files:**
- Modify: `src/main.cjs` (where `createTranscriptionService` is constructed and the transcribe IPC handler lives, around the existing `transcriptionService` usage near lines 35 / 841)

**Interfaces:**
- Consumes: `createWhisperCppService` (Task 5), `createTranscriptionEngine` (Task 6), existing `transcriptionService`.
- Produces: the IPC `transcribe` handler now calls the engine dispatcher instead of `transcriptionService.transcribe` directly.

- [ ] **Step 1: Add binary-path resolution** near the top of `src/main.cjs` (dev vs packaged):

```js
const whisperBinaryName = process.platform === "win32" ? "whisper-cli.exe" : "whisper-cli";
const whisperBinaryPath = app.isPackaged
  ? path.join(process.resourcesPath, "native", `${process.platform}-${process.arch}`, whisperBinaryName)
  : path.join(__dirname, "..", "native", `${process.platform}-${process.arch}`, whisperBinaryName);
const ggmlModelsDir = path.join(activeUserDataPath, "models", "ggml");
```

- [ ] **Step 2: Construct the engine** where `transcriptionService` is created:

```js
const { createWhisperCppService } = require("./whisper-cpp-service.cjs");
const { createTranscriptionEngine } = require("./transcription-engine.cjs");
const whisperCpp = createWhisperCppService({ binaryPath: whisperBinaryPath, modelsDir: ggmlModelsDir });
const transcriptionEngine = createTranscriptionEngine({ whisperCpp, fallback: transcriptionService });
```

- [ ] **Step 3: Route the IPC handler** — replace `transcriptionService.transcribe(audio, language, profile.id, device)` in the transcribe handler with `transcriptionEngine.transcribe(audio, language, profile)`. Keep the profile object (it now needs `ggml`); resolve it via `resolveWhisperProfile`.
- [ ] **Step 4: Run the full suite.** Run: `npm test` → all pass (existing brand/main checks + new modules). Verify `src/main.cjs` still passes `node --check`.
- [ ] **Step 5: Commit.**

```bash
git add src/main.cjs
git commit -m "feat: route transcription through whisper.cpp engine with fallback in main"
```

---

### Task 8: Settings default + one-time migration

**Files:**
- Modify: `index.html` (`#transcriptionEngine` select), `src/renderer.js` (default), `src/data-migrations.cjs`
- Test: `src/data-migrations.test.cjs`

**Interfaces:**
- Produces: `upgradeWhisperCppDefault(storage, settings)` with marker `voice-whispercpp-default-v1` — sets `transcriptionEngine: "whisper-cpp"` when the user is on the old `transformers-js` default (or unset); idempotent; respects a manual non-default choice.

- [ ] **Step 1: Write failing migration tests** (mirroring the existing `revertExperimentalDmlDefault` tests):

```js
const wcFresh = createStorage({});
const wc = upgradeWhisperCppDefault(wcFresh, { transcriptionEngine: "transformers-js" });
assert.equal(wc.transcriptionEngine, "whisper-cpp");
assert.equal(wcFresh.getItem(WHISPERCPP_DEFAULT_MARKER), "initialized");

const wcMarked = createStorage({ [WHISPERCPP_DEFAULT_MARKER]: "initialized" });
assert.equal(upgradeWhisperCppDefault(wcMarked, { transcriptionEngine: "transformers-js" }).transcriptionEngine, "transformers-js");
```

- [ ] **Step 2: Run to verify it fails.** Run: `node src/data-migrations.test.cjs` → FAIL (not exported).
- [ ] **Step 3: Implement** `upgradeWhisperCppDefault` + `WHISPERCPP_DEFAULT_MARKER` in `src/data-migrations.cjs` and export both; update the "N checks passed" count.
- [ ] **Step 4: Wire it** in `src/renderer.js` `initializeApp` alongside the existing migrations, set default `transcriptionEngine: "whisper-cpp"`, and add `<option value="whisper-cpp">whisper.cpp · local (rápido)</option>` (default) to `#transcriptionEngine` in `index.html`, relabel the transformers-js option as "compatibilidad".
- [ ] **Step 5: Run suite + commit.** Run: `npm test` → PASS.

```bash
git add index.html src/renderer.js src/data-migrations.cjs src/data-migrations.test.cjs
git commit -m "feat: default transcription engine to whisper.cpp with migration"
```

---

### Task 9: Build/packaging — stage binaries + extraResources

**Files:**
- Modify: `package.json` (`build.win.extraResources`, `build.mac`, `build.linux`, `asarUnpack`), `scripts/build-native.ps1`, `scripts/compress-natives.cjs`, `.github/workflows/release.yml`
- Create: `scripts/fetch-whisper-binaries.cjs` (downloads + SHA-verifies prebuilt binaries into `native/<platform>-<arch>/`, using the spike's URL/hash table)
- Test: none (integration via release smoke, Task 10)

> **Spike-applied facts (see `docs/superpowers/notes/whisper-cpp-spike.md`):** release repo is `ggml-org/whisper.cpp` (v1.9.1). Windows: `whisper-bin-x64.zip` (sha256 `7d8be46e…3539`) — one CPU zip runtime-dispatches SSE/AVX/AVX2/AVX512, so **no legacy/AVX2 split**; it extracts a nested `Release/` dir containing `whisper-cli.exe` **plus `whisper.dll`, `ggml*.dll`, `SDL2.dll`** — all must ship together. Linux x64 `whisper-bin-ubuntu-x64.tar.gz` (sha256 `f3bf3b43…15c5`) and arm64 tarball, nested dir. **macOS: NO prebuilt CLI — only an XCFramework.** For v1, **do not ship a macOS whisper binary**: macOS falls through to the transformers.js fallback (Task 6 `isAvailable()` returns false). A macOS cmake build + notarization pipeline is a documented follow-up, not part of this plan.

- [ ] **Step 1:** Write `scripts/fetch-whisper-binaries.cjs` using the spike's URL/SHA table; for the current runner OS/arch it downloads the release archive, verifies SHA-256 (fail hard on mismatch), extracts, and stages the **entire** binary set (exe + all DLLs on Windows / the binary on Linux) flat into `native/<platform>-<arch>/`. On macOS it is a no-op (logs "macOS: no prebuilt whisper-cli, using transformers.js fallback").
- [ ] **Step 2:** Add per-platform `extraResources` entries (mirror the existing `native/win32-x64` paste-helper entry) so the whisper binary set ships unpacked (Windows filter must include `whisper-cli.exe` and the `*.dll` files); add to `asarUnpack` if required. No macOS entry in v1.
- [ ] **Step 3:** In `.github/workflows/release.yml`, add a `node scripts/fetch-whisper-binaries.cjs` step before `electron-builder` in each platform build job. Update `scripts/build-native.ps1` (Windows) to also fetch/stage the whisper binary.
- [ ] **Step 4:** Note in `PRODUCTION_READINESS.md` that a third-party unsigned whisper.cpp binary now ships (same posture as the paste helper).
- [ ] **Step 5: Commit.**

```bash
git add package.json scripts/fetch-whisper-binaries.cjs scripts/build-native.ps1 scripts/compress-natives.cjs .github/workflows/release.yml PRODUCTION_READINESS.md
git commit -m "build: stage and package whisper.cpp sidecar binaries per platform"
```

---

### Task 10: Release smoke test (real sidecar)

**Files:**
- Create: `src/whisper-cpp-smoke.test.cjs`, `test-assets/smoke-16k.wav` (a short real 16 kHz WAV)
- Modify: `package.json` (add to `test:production` only, guarded to run when the binary + a small model are present)

**Interfaces:**
- Consumes: the real staged binary + a small model (`ggml-base`), the real `createWhisperCppService`.

- [ ] **Step 1:** Add `src/whisper-cpp-smoke.test.cjs`: if `whisperBinaryPath` and a small model exist, decode `test-assets/smoke-16k.wav` to Float32, run `createWhisperCppService(...).transcribe(...)`, assert the result text is non-empty and matches an expected substring; else `console.log("whisper-cpp smoke: skipped (no binary/model)")` and exit 0.
- [ ] **Step 2:** Add it to `test:production`. In `release.yml`, ensure the smoke runs after `fetch-whisper-binaries` and a `ggml-base` download.
- [ ] **Step 3: Run locally** (after Task 0 gave you a real binary + model) to confirm real transcription works and is faster than the transformers.js path.
- [ ] **Step 4: Commit.**

```bash
git add src/whisper-cpp-smoke.test.cjs test-assets/smoke-16k.wav package.json .github/workflows/release.yml
git commit -m "test: add whisper.cpp release smoke test"
```

---

### Task 11: Release 1.2.0

**Files:** `package.json`, `package-lock.json`, `CHANGELOG.md`, `README.md`, `PRODUCTION_READINESS.md`, `docs/legal-release-approval.json`

- [ ] **Step 1:** Bump version to `1.2.0` (minor — new engine) in `package.json` + both `package-lock.json` root version fields.
- [ ] **Step 2:** Add a `## [1.2.0]` CHANGELOG entry (whisper.cpp default engine, faster local transcription, transformers.js fallback). Sync the "versión actual" line + download-table filenames in `README.md` and `PRODUCTION_READINESS.md` to `1.2.0` (required by `verify-brand-references.test.cjs`).
- [ ] **Step 3:** Run `npm run test:production` → PASS.
- [ ] **Step 4:** **STOP — owner action required.** Renew `docs/legal-release-approval.json` (`appVersion`/`scopeVersion` → `1.2.0`, new `authorizedAt`) only with explicit owner authorization; verify with `node scripts/verify-legal-release-gate.cjs`.
- [ ] **Step 5:** Commit, push `main`, tag `v1.2.0`, push tag; watch `release.yml` to green (legal gate → builds → publish). See memory `release-flow`.

---

## Self-Review

- **Spec coverage:** engine dispatcher (T6/T7), sidecar (T5), model handling (T3/T4), settings+migration (T8), build/CI/packaging (T9), testing (T1–T6 unit + T10 smoke), risks (spike T0, fallback T6). All spec sections mapped. ✅
- **Placeholder scan:** the only intentional `<spike>` fills (binary URLs, SHA-256, exact CLI flags, JSON path) are explicitly produced by Task 0 before dependent tasks run — not hidden TODOs. Model `bytes` default 0 is non-blocking metadata.
- **Type consistency:** `encodeWav16`, `parseWhisperJson`, `ensureModel`, `createWhisperCppService`/`isAvailable`/`transcribe`, `createTranscriptionEngine`, `upgradeWhisperCppDefault`/`WHISPERCPP_DEFAULT_MARKER` — names consistent across producing and consuming tasks. Result shape `{ text, engine, device, ms }` uniform.
