# Transcription Acceleration — whisper.cpp sidecar (design)

- **Date:** 2026-07-20
- **Status:** Approved (owner delegated remaining choices)
- **Author:** Felipe Avinzano + Claude
- **Related:** `../plans/` (implementation plan, next), memory `transcription-perf-context`

## Goal

Cut local transcription latency from ~15–18 s toward ~3–8 s (hardware-dependent) **while staying 100 % local** (CLAUDE.md: zero cloud APIs, absolute privacy), by adding a **whisper.cpp** engine that runs Whisper Large v3 Turbo natively instead of transformers.js + onnxruntime-node.

## Non-goals

- Cloud transcription (Groq/OpenAI/etc.) — explicitly out (violates the offline mandate). Aztec Voice is fast because it uses Groq cloud; we are not copying that.
- GPU acceleration in v1. Design leaves room for a Vulkan/CUDA backend later, but v1 ships **CPU-only** (lesson from the reverted DirectML default in 1.1.13).
- Rewriting the app in Rust/Tauri.

## Confirmed decisions

| Decision | Choice |
|---|---|
| Engine | whisper.cpp (native), Whisper Large v3 Turbo |
| Integration | **Sidecar**: bundled per-platform binary invoked via `child_process` (mirrors the native paste-helper pattern) |
| Compute backend | **CPU only** in v1 (AVX2 + multithread); GPU deferred |
| Coexistence | whisper.cpp is the **default** engine; transformers.js/onnxruntime remains as an **automatic fallback** |
| Models | GGML `.bin`, **downloaded on first use + cached** (mirrors current ONNX UX); not bundled in the installer |
| Default model | `ggml-large-v3-turbo-q5_0` (balanced); `fast → ggml-base`, `accurate → ggml-large-v3-turbo-q8_0` |

## Architecture

Transcription already runs in the **main process** (`src/transcription-service.cjs`, wired in `src/main.cjs` via `createTranscriptionService`, exposed to the renderer through `voiceAPI.transcribe` over IPC). We keep that boundary.

### Engine dispatcher (new)

Introduce `src/transcription-engine.cjs` — a thin dispatcher that owns engine selection and fallback:

```
transcribe(audio, language, profileId, opts)
  → if engine == "whisper-cpp" and sidecar is available:
        try whisperCppService.transcribe(...)
        on spawn/exec failure → log, mark engine unavailable, fall through
  → fallback: transcriptionService.transcribe(...)   // existing transformers.js path, untouched
  returns { text, engine, device, ms, modelLoadMs }
```

- The dispatcher preserves the current return contract so the renderer and history are unchanged.
- Fallback is per-session sticky: once the sidecar fails to launch, stay on transformers.js until restart (avoid repeated spawn attempts).

### New module: `src/whisper-cpp-service.cjs` (main process)

Single responsibility: run the whisper.cpp sidecar for one transcription.

- **Binary resolution:** locate the platform binary under `process.resourcesPath/native/<platform>-<arch>/` in production (unpacked via `extraResources`), or a repo-local path in dev. Name e.g. `whisper-cli(.exe)`.
- **Input:** the app already yields 16 kHz mono PCM (`Float32Array`). Write a temporary 16-bit WAV to the OS temp dir (or app temp) — whisper-cli reads a WAV file.
- **Invocation:** `whisper-cli --model <ggmlPath> --language <lang|auto> --output-json --no-prints -f <tempWav>` (threads = min(logicalCores, 8)). No network flags; fully offline.
- **Output:** parse the emitted JSON (`<tempWav>.json`), concatenate segment texts, trim; delete temp files in a `finally`.
- **Errors:** non-zero exit / missing binary / parse failure → throw a typed error the dispatcher catches for fallback.
- **Concurrency:** serialize (one transcription at a time) — matches current single-session recorder UX.

### Models (`src/whisper-profiles.cjs` extension)

Add a `ggml` descriptor per profile:

```js
balanced: { …, ggml: { repo: "ggerganov/whisper.cpp", file: "ggml-large-v3-turbo-q5_0.bin", sha256: "…", bytes: … } }
```

- **Downloader** (`src/ggml-model-manager.cjs`, new): resolve `https://huggingface.co/<repo>/resolve/main/<file>`, stream to `userData/models/ggml/<file>.part`, verify SHA-256, atomic rename. Progress events reuse the existing model-download taskbar/status plumbing. Offline → surface the existing "install/repair models" flow.
- Never fall back to a remote model at inference time (consistent with the offline hardening already in the ONNX path).

## Settings & migration

- `index.html`: add `whisper-cpp` to the `#transcriptionEngine` select; label transformers.js as "compatibilidad / respaldo".
- `renderer.js` defaults: `transcriptionEngine: "whisper-cpp"`.
- New one-time migration `upgradeWhisperCppDefault(storage, settings)` (new marker `voice-whispercpp-default-v1`): set `transcriptionEngine: "whisper-cpp"` for users still on the transformers-js default. The automatic fallback protects machines where the sidecar can't run. Follows the existing `data-migrations.cjs` marker pattern; unit-tested.

## Build & CI / packaging

- **Binary sourcing:** download official prebuilt whisper.cpp release binaries (from `ggerganov/whisper.cpp` releases) per target in CI, verify SHA-256, stage under `native/<platform>-<arch>/`. If a target has no usable prebuilt, that target either builds from source (cmake) in CI or ships without the sidecar and relies on the transformers.js fallback (logged, not silent).
- **Packaging:** extend `package.json` `build` — add the whisper binaries to `extraResources` (per-platform `from/to/filter`, like the paste helper) and, if needed, `asarUnpack`. Update `scripts/build-native.ps1` / `scripts/compress-natives.cjs` to stage them.
- **Signing:** the new binaries are third-party; note in `PRODUCTION_READINESS.md` (unsigned, consistent with current owner-override posture).

## Testing

Following the repo's `*.test.cjs` convention, with the binary mocked (no real inference in unit tests):

- `whisper-cpp-service.test.cjs`: WAV encoding of a known PCM buffer; arg construction; JSON-output parsing (multi-segment, empty, malformed); temp-file cleanup on success and on throw.
- `transcription-engine.test.cjs`: dispatch to whisper-cpp when available; fallback to transformers.js on spawn failure; sticky-fallback; return-contract shape.
- `ggml-model-manager.test.cjs`: URL resolution; SHA-256 verify pass/fail; atomic rename; offline handling.
- `data-migrations.test.cjs`: `upgradeWhisperCppDefault` sets the engine once, idempotent, respects a manual choice.
- **Release smoke** (like `transcription-smoke.test.cjs`): in release CI, run the real sidecar on a tiny bundled WAV and assert non-empty coherent text — this is the real end-to-end guard.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Prebuilt binary missing for a target | Build-from-source in CI or ship fallback-only for that target (logged) |
| GGML model size (~1.6 GB) surprises users | Reuse existing download UX + progress + "repair models"; clear first-run messaging |
| New binary flagged by AV/SmartScreen (unsigned) | Document; same posture as current release; revisit with signing |
| whisper.cpp output quality vs ONNX | Release smoke test + owner A/B before making it default GA |
| Temp WAV I/O overhead | Small vs inference cost; write to fast temp; consider stdin piping if the chosen binary supports it |

## Future (out of scope, noted)

- GPU backend (Vulkan cross-vendor) as an **opt-in** with output validation and CPU fallback.
- Streaming/partial results.
- stdin piping to avoid temp WAV.
