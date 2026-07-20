# whisper.cpp CPU sidecar — verification spike

Research-only spike for adding a `whisper.cpp` CPU sidecar to VoiceFlow. No binaries or models
were downloaded or executed; all facts below were pulled from the GitHub Releases API and
HuggingFace LFS pointer files.

Sources:
- `gh api repos/ggml-org/whisper.cpp/releases/latest` and `.../releases?per_page=10`
  (note: `ggerganov/whisper.cpp` now redirects to org `ggml-org/whisper.cpp` — same repo, new
  owner slug; releases/README examined at ref matching the `v1.9.1` tag, 2026-06-19)
- `gh api repos/ggml-org/whisper.cpp/contents/.github/workflows/release.yml`
- `gh api repos/ggml-org/whisper.cpp/contents/examples/cli/README.md`
- `gh api repos/ggml-org/whisper.cpp/contents/examples/cli/cli.cpp`
- `gh api repos/ggml-org/whisper.cpp/contents/README.md`
- HuggingFace `ggerganov/whisper.cpp` LFS pointer files (`/raw/main/<file>`)

---

## 1. Binaries

Latest release inspected: **v1.9.1** (published 2026-06-19). Checked assets are stable across the
last several tags (v1.8.0 → v1.9.1); asset-name shape has not changed recently except the
xcframework version suffix.

| target | prebuilt? | asset name | download URL | notes |
|---|---|---|---|---|
| Windows x64 | **YES** | `whisper-bin-x64.zip` | `https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.1/whisper-bin-x64.zip` | 7,982,101 bytes, sha256 `7d8be46ecd31828e1eb7a2ecdd0d6b314feafd82163038ab6092594b0a063539`. CPU-only build. Built with `-DGGML_BACKEND_DL=ON -DGGML_CPU_ALL_VARIANTS=ON` (see release.yml) — **one zip contains multiple `ggml-cpu` backend variants (SSE4.2/AVX/AVX2/AVX512) and runtime-dispatches to the best one the CPU supports.** There is **no separate "legacy"/no-AVX package** to choose between — this is the only CPU zip and it self-selects. Zip contains a top-level `Release/` folder (built via `Compress-Archive -Path build/bin/Release`), so extraction code must expect `Release/whisper-cli.exe`, `Release/whisper.dll`, `Release/ggml*.dll`, `Release/SDL2.dll`, not a flat layout. |
| Windows Win32 (x86, 32-bit) | YES (irrelevant) | `whisper-bin-Win32.zip` | `.../v1.9.1/whisper-bin-Win32.zip` | 32-bit build; not needed for a 64-bit Electron app. Do not use by mistake. |
| Windows x64 (OpenBLAS) | YES (optional) | `whisper-blas-bin-x64.zip` | `.../v1.9.1/whisper-blas-bin-x64.zip` | 20,769,031 bytes. OpenBLAS-accelerated variant. Larger; not needed if plain CPU zip is fast enough. |
| Windows x64 (CUDA 11.8 / 12.4) | YES (optional, GPU) | `whisper-cublas-11.8.0-bin-x64.zip`, `whisper-cublas-12.4.0-bin-x64.zip` | `.../v1.9.1/whisper-cublas-*-bin-x64.zip` | 278.5 MB / 677.9 MB. Out of scope — this spike targets CPU only, and these require the matching CUDA runtime installed on the user's machine. |
| macOS arm64 | **NO** | — | — | The release workflow's only macOS job (`runs-on: macos-latest`) runs `./build-xcframework.sh` and uploads `whisper-v1.9.1-xcframework.zip` — an **Apple XCFramework** (a linkable Swift/Obj-C static framework for embedding in Xcode projects), **not a standalone CLI executable**. There is no `whisper-cli` binary published for macOS in any recent release. Must build from source via `cmake -B build && cmake --build build --config Release` (README's generic Quick Start works unmodified on macOS; Metal/Accelerate acceleration is enabled by default on Apple Silicon per README line 15, though the sidecar plan is CPU-focused). |
| macOS x64 (Intel) | **NO** | — | — | Same as above — no Intel Mac CLI binary either, only the same universal-ish xcframework artifact. |
| Linux x64 | **YES** | `whisper-bin-ubuntu-x64.tar.gz` | `https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.1/whisper-bin-ubuntu-x64.tar.gz` | 9,379,235 bytes, sha256 `f3bf3b4369a99b54665b0f19b88483b30de27f25963b0414235dea03198515c5`. Built on `ubuntu-22.04` with `GGML_BACKEND_DL=ON -DGGML_CPU_ALL_VARIANTS=ON` (same multi-variant runtime dispatch as Windows). Tar contains a top-level `whisper-bin-ubuntu-x64/` directory (via `tar --transform`), not a flat layout. Built against Ubuntu 22.04's glibc — may not run on older/other distros with an older glibc; verify on the actual target Linux distro before shipping. |
| Linux arm64 | **YES** | `whisper-bin-ubuntu-arm64.tar.gz` | `https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.1/whisper-bin-ubuntu-arm64.tar.gz` | 4,555,819 bytes, sha256 `e0b66cd551ff6f2a28fabe3c6e89691eea037bb76833493abb9a71ca788994b3`. Built on `ubuntu-22.04-arm` with `-DGGML_CPU_ARM_ARCH=armv8-a`, `GGML_NATIVE=OFF`. Same glibc-version caveat as x64. |

**CLI binary name:** the current executable name is **`whisper-cli`** (`whisper-cli.exe` on Windows),
confirmed by `examples/cli/README.md`'s help dump (`./build/bin/whisper-cli -h`) and by every
usage example in the top-level `README.md` (e.g. `./build/bin/whisper-cli -f samples/jfk.wav`).
The legacy name `main` (used pre-v1.7-ish) is gone from current docs/workflows — no reference to
`main.exe`/`./main` remains in the current README or CLI README.

### Biggest risk (binaries)

**No official prebuilt CLI binary for macOS (arm64 or x64).** Windows and Linux get a
zero-build-step download; macOS requires standing up our own build pipeline (cmake + Xcode
command line tools, likely a GitHub Actions macOS runner producing arm64 and x64 — or universal —
binaries), plus code-signing/notarization for the extracted `whisper-cli` executable before it can
ship inside a notarized Electron app. This is very likely the long pole for cross-platform release.

---

## 2. Models

Repo: `https://huggingface.co/ggerganov/whisper.cpp`. All three requested filenames exist as-is —
no renaming needed. Fetched each file's Git LFS pointer at
`https://huggingface.co/ggerganov/whisper.cpp/raw/main/<file>` (pointer contains `version`,
`oid sha256:<hash>`, `size <bytes>` lines).

| file | resolve URL | sha256 | bytes | approx size |
|---|---|---|---|---|
| `ggml-base.bin` | `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin` | `60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe` | 147,951,465 | ~141 MB |
| `ggml-large-v3-turbo-q5_0.bin` | `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin` | `394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2` | 574,041,195 | ~547 MiB / 574 MB |
| `ggml-large-v3-turbo-q8_0.bin` | `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q8_0.bin` | `317eb69c11673c9de1e1f0d459b253999804ec71ac4c23c17ecf5fbe24e259a1` | 874,188,075 | ~834 MiB / 874 MB |

For reference, the repo also has (not requested, but confirms naming family): `ggml-large-v3-turbo.bin`
(full-precision, ~1.62 GB) and `ggml-large-v3-turbo-encoder.mlmodelc.zip` (CoreML encoder, ~1.17 GB,
Apple-only, not applicable to a cross-platform CPU sidecar).

No risk flagged here — all three file names resolved on the first try, sizes are consistent with
expectations for a q5/q8 quantized "turbo" model.

---

## 3. CLI contract

Full flag reference (from `examples/cli/README.md`, which embeds the literal `whisper-cli -h`
output):

```
usage: ./build/bin/whisper-cli [options] file0 file1 ...
supported audio formats: flac, mp3, ogg, wav

  -t N,      --threads N         [4      ] number of threads to use during computation
  -l LANG,   --language LANG     [en     ] spoken language ('auto' for auto-detect)
  -m FNAME,  --model FNAME       [models/ggml-base.en.bin] model path
  -f FNAME,  --file FNAME        [       ] input audio file path
  -oj,       --output-json       [false  ] output result in a JSON file
  -ojf,      --output-json-full  [false  ] include more information in the JSON file
  -of FNAME, --output-file FNAME [       ] output file path (without file extension)
  -np,       --no-prints         [false  ] do not print anything other than the results
  -pp,       --print-progress    [false  ] print progress
  -nt,       --no-timestamps     [false  ] do not print timestamps
  -ng,       --no-gpu            [false  ] disable GPU
```//(subset of the full options list relevant to our use; full list captured verbatim from source, see below)
```

Recommended arg list for our use (CPU sidecar, JSON output, quiet, single WAV file):

```
whisper-cli -m <model_path> -f <input.wav> -l <language|auto> -t <thread_count> -np -oj -nt
```

- `-m <path>` — model path (required; no default that matches our packaging).
- `-f <path>` — input WAV file (16-bit WAV; README explicitly warns "the whisper-cli example
  currently runs only with 16-bit WAV files, so make sure to convert your input before running
  the tool").
- `-l <lang>` — language code, or `auto` to auto-detect (default is hardcoded `en` if omitted).
- `-t N` — thread count (default is `min(4, hardware_concurrency())` per `examples/common.h`,
  so pass explicitly rather than relying on the default if we want to control CPU usage).
- `-np` / `--no-prints` — suppresses all console output except the results; use this to keep the
  sidecar's stdout/stderr clean for the Electron main process to parse.
- `-oj` / `--output-json` — writes the sidecar JSON file described below. (`-ojf`/
  `--output-json-full` adds a large `tokens` array per segment with per-token timestamps/logprobs —
  **do not use this by default**, it inflates the JSON considerably and isn't needed for a plain
  transcript.)
- `-nt` / `--no-timestamps` only affects the human-readable stdout printer, not the JSON file
  (the JSON always includes `timestamps`/`offsets` per segment regardless of this flag) — safe to
  combine with `-np`/`-oj` if we want the JSON but no console timestamp noise.
- `--no-gpu` (`-ng`) is available if we ever need to force CPU on a machine with Metal/CUDA/Vulkan
  built in, though a CPU-only build makes this moot.

### Sidecar JSON filename rule

Confirmed by reading `fout_factory` in `examples/cli/cli.cpp` (lines ~1116–1162):

```cpp
fout_factory (const std::string & fname_out_, const std::string & fname_inp, whisper_params & params) :
        fname_out{!fname_out_.empty() ? fname_out_ : fname_inp},
        basename_length{fname_out.size()},
        ...
bool open(const char * ext, const char * function) {
    ...
    fname_out.resize(basename_length);
    fname_out += ext;
    fout = std::ofstream{fname_out};
```

- If `-of/--output-file` is **not** passed, `fname_out` starts as the full input path **including
  its extension** (e.g. `audio.wav`), and `open(".json", ...)` simply appends `.json` to that —
  i.e. the sidecar is written to **`<input_file_path>.json`** (e.g. `audio.wav` → `audio.wav.json`),
  not `audio.json`. The original extension is **not** stripped.
- If `-of custom_name` **is** passed, the sidecar becomes `custom_name.json` (basename_length is the
  length of the `-of` value, so `.json` is appended to whatever was given there — pass a path
  without an extension).
- This is called from `output_func(output_json, ".json", params.output_jsn, pcmf32s)` at line 1337
  of `cli.cpp`.

**Recommendation:** always pass `-of <path-without-extension>` explicitly (e.g. a temp file path we
control) rather than relying on the default `<input>.wav.json` naming, so the sidecar app doesn't
have to special-case the double-extension.

### JSON schema and text-extraction path

Confirmed by reading `output_json()` in `cli.cpp` (lines ~624–815). Top-level shape (default, i.e.
**without** `-ojf`):

```json
{
  "systeminfo": "...",
  "model": { "type": "...", "multilingual": true, "vocab": 0, "audio": {...}, "text": {...}, "mels": 0, "ftype": 0 },
  "params": { "model": "<path>", "language": "<lang>", "translate": false },
  "result": { "language": "<detected-lang>" },
  "transcription": [
    {
      "timestamps": { "from": "00:00:00,000", "to": "00:00:02,000" },
      "offsets": { "from": 0, "to": 2000 },
      "text": "segment text here"
    },
    ...
  ]
}
```

Source (`cli.cpp`, `output_json`):

```cpp
start_arr("transcription");
    const int n_segments = whisper_full_n_segments(ctx);
    for (int i = 0; i < n_segments; ++i) {
        const char * text = whisper_full_get_segment_text(ctx, i);
        ...
        start_obj(nullptr);
            times_o(t0, t1, false);
            value_s("text", text, !params.diarize && !params.tinydiarize && !full);
            if (full) { /* adds a "tokens" array with per-token id/p/t_dtw when -ojf is used */ }
            if (params.diarize && pcmf32s.size() == 2) { value_s("speaker", ...); }
        end_obj(...)
```

**Confirmed text-extraction path: `parsed.transcription[i].text`** — matches the assumed
`{transcription:[{text}]}` shape exactly (this was **not** a risk; schema is as expected). Note
`offsets.from`/`offsets.to` are already in **milliseconds** (`t0 * 10`, where whisper's internal
`t0`/`t1` are in centiseconds — `times_o()` at line ~704 does `value_i("from", t0 * 10, ...)`), so
no further unit conversion is needed when reading `offsets`.

If diarization (`-di`) or tinydiarize (`-tdrz`) flags are ever turned on, each segment object gains
an extra `"speaker"` field appended after `text` — the `transcription[i].text` path is unaffected
either way, so this is safe to ignore for a first cut that doesn't need speaker labels.

---

## Summary of risks

1. **No macOS prebuilt CLI binary (arm64 or x64)** — biggest risk. Only an XCFramework (a linkable
   Apple framework) is published for macOS; the actual `whisper-cli` executable must be built from
   source (cmake) for both macOS architectures ourselves, likely in CI, plus signed/notarized before
   bundling in the Electron app. Windows and Linux both have ready-made CPU zips/tarballs with
   sha256 digests from the GitHub Releases API.
2. Windows/Linux CPU zips use `GGML_CPU_ALL_VARIANTS` runtime dispatch — good news, no need to pick
   between an AVX2 build and a "legacy"/no-AVX build ourselves; one download self-selects the best
   instruction set at runtime.
3. Windows zip and Linux tarball both have a **nested top-level directory** in the archive
   (`Release/...` for Windows, `whisper-bin-ubuntu-{arch}/...` for Linux) rather than a flat file
   list — extraction code must account for this.
4. Linux binaries are built on `ubuntu-22.04`/`ubuntu-22.04-arm`; glibc-version compatibility with
   older target distros is unverified and should be checked before relying on the prebuilt binary
   there.
5. Always pass `-of <path-without-extension>` explicitly for the JSON sidecar — the default
   filename rule appends `.json` to the **full** input filename (`audio.wav` → `audio.wav.json`,
   not `audio.json`), which is easy to get wrong if unhandled.
6. Avoid `-ojf`/`--output-json-full` unless per-token timestamps are actually needed — it adds a
   `tokens` array per segment and meaningfully bloats the JSON without changing the
   `transcription[i].text` path we care about.
