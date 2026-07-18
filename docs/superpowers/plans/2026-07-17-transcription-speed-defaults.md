# Transcription Speed Defaults Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the capture-transcription-paste flow feel fast out of the box by fixing two slow defaults (CPU-only inference, 3-beam decoding on the largest model) and safely upgrading existing users who never touched those settings.

**Architecture:** Add a new `balanced` Whisper profile (same `large-v3-turbo` model as today's `accurate` default, but `num_beams: 1`), flip the shipped defaults to `dml` + `balanced`, and add a one-time, marker-gated migration (same pattern as the existing `upgradeAccuracyDefault`) that upgrades already-installed users who are still on the untouched old defaults.

**Tech Stack:** Plain Node.js CommonJS modules (`.cjs`), esbuild-bundled Vanilla JS renderer, `node:assert/strict`-based test files (no test framework) wired into `npm test` via `package.json`.

## Global Constraints

- 100% offline — no new network calls, no cloud APIs (CLAUDE.md rule 1).
- `npm test` must pass before any change is considered done (CLAUDE.md rule 2).
- Use immutable update patterns — return new objects instead of mutating `settings` in place.
- Follow the existing test style exactly: `assert`/`assert/strict` + a final `console.log("... checks passed")` line, no test framework. Every `.test.cjs` file touched here is already wired into `npm test` (`package.json:15`) — do not edit `package.json`.
- Follow the existing migration pattern in `src/data-migrations.cjs`: a module-level marker constant, a function that checks the marker first, applies the change once, and is safe to call on every launch.
- Do not touch `tools/FelipeAvinzano.VoiceFlow.PasteHelper/Program.cs` or any paste-timing logic — out of scope per the approved design.

---

### Task 1: Add the `balanced` Whisper profile and make it the default

**Files:**
- Modify: `src/whisper-profiles.cjs`
- Test: `src/whisper-profiles.test.cjs`

**Interfaces:**
- Produces: `WHISPER_PROFILES.balanced` (`{ id: "balanced", model: "onnx-community/whisper-large-v3-turbo", dtype: "q8", generation: { num_beams: 1 } }`), `DEFAULT_WHISPER_PROFILE === "balanced"`. `resolveWhisperProfile(profileId)` keeps its existing signature and return shape — later tasks call it unchanged.

- [ ] **Step 1: Write the failing test**

Replace the full contents of `src/whisper-profiles.test.cjs` with:

```javascript
const assert = require("node:assert/strict");
const {
  DEFAULT_WHISPER_PROFILE,
  WHISPER_PROFILES,
  resolveWhisperProfile
} = require("./whisper-profiles.cjs");

assert.equal(DEFAULT_WHISPER_PROFILE, "balanced");
assert.equal(resolveWhisperProfile("fast").model, "onnx-community/whisper-base");
assert.equal(resolveWhisperProfile("fast").generation.num_beams, 1);
assert.equal(resolveWhisperProfile("fast").dtype, "q8");
assert.equal(resolveWhisperProfile("balanced").model, "onnx-community/whisper-large-v3-turbo");
assert.equal(resolveWhisperProfile("balanced").generation.num_beams, 1);
assert.equal(resolveWhisperProfile("balanced").dtype, "q8");
assert.equal(resolveWhisperProfile("accurate").model, "onnx-community/whisper-large-v3-turbo");
assert.equal(resolveWhisperProfile("accurate").generation.num_beams, 3);
assert.equal(resolveWhisperProfile("accurate").dtype, "q8");
assert.equal(resolveWhisperProfile("invalid"), WHISPER_PROFILES.balanced);
assert.equal(resolveWhisperProfile(undefined), WHISPER_PROFILES.balanced);

console.log("12 Whisper profile cases passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node src/whisper-profiles.test.cjs`
Expected: `AssertionError` on the first assertion (`DEFAULT_WHISPER_PROFILE` is still `"accurate"`).

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `src/whisper-profiles.cjs` with:

```javascript
const WHISPER_PROFILES = Object.freeze({
  fast: Object.freeze({
    id: "fast",
    label: "Rápido",
    shortLabel: "Whisper Base",
    model: "onnx-community/whisper-base",
    dtype: "q8",
    generation: Object.freeze({ num_beams: 1 })
  }),
  balanced: Object.freeze({
    id: "balanced",
    label: "Balanceado",
    shortLabel: "Whisper Large v3 Turbo (rápido)",
    model: "onnx-community/whisper-large-v3-turbo",
    dtype: "q8",
    generation: Object.freeze({ num_beams: 1 })
  }),
  accurate: Object.freeze({
    id: "accurate",
    label: "Máxima precisión",
    shortLabel: "Whisper Large v3 Turbo",
    model: "onnx-community/whisper-large-v3-turbo",
    dtype: "q8",
    generation: Object.freeze({ num_beams: 3 })
  })
});

const DEFAULT_WHISPER_PROFILE = "balanced";

function resolveWhisperProfile(profileId) {
  return WHISPER_PROFILES[profileId] || WHISPER_PROFILES[DEFAULT_WHISPER_PROFILE];
}

module.exports = {
  DEFAULT_WHISPER_PROFILE,
  WHISPER_PROFILES,
  resolveWhisperProfile
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node src/whisper-profiles.test.cjs`
Expected: `12 Whisper profile cases passed` printed, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/whisper-profiles.cjs src/whisper-profiles.test.cjs
git commit -m "feat: add balanced Whisper profile and make it the default"
```

---

### Task 2: Add the one-time settings migration for existing users

**Files:**
- Modify: `src/data-migrations.cjs`
- Test: `src/data-migrations.test.cjs`

**Interfaces:**
- Consumes: nothing from Task 1 (pure data migration, works on plain settings objects with string keys `whisperProfile`/`inferenceDevice`).
- Produces: `PERF_DEFAULT_MARKER` (string constant `"voice-perf-default-v1"`), `upgradePerfDefault(storage, settings)` — `storage` is any object with `getItem(key): string|null` and `setItem(key, value)`; `settings` is a plain object. Returns a settings object (new object if migrated, the same reference if not). Task 3 calls this with `localStorage` as `storage` and `persisted.settings` as `settings`.

- [ ] **Step 1: Write the failing test**

Replace the full contents of `src/data-migrations.test.cjs` with:

```javascript
const assert = require("assert");
const {
  ACCURACY_DEFAULT_MARKER,
  clearMigratedLegacyStorage,
  initializeProductionProfile,
  PERF_DEFAULT_MARKER,
  PRODUCTION_PROFILE_MARKER,
  upgradeAccuracyDefault,
  upgradePerfDefault
} = require("./data-migrations.cjs");

function createStorage(values = {}) {
  const data = new Map(Object.entries(values));
  return {
    getItem: (key) => data.get(key) || null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
    has: (key) => data.has(key)
  };
}

const development = createStorage({ "voice-history": "test" });
assert.equal(initializeProductionProfile(development, false), false);
assert.equal(development.has("voice-history"), true);

const firstProductionRun = createStorage({ "voice-history": "prerelease", "voice-settings": "keep" });
assert.equal(initializeProductionProfile(firstProductionRun, true), true);
assert.equal(firstProductionRun.has("voice-history"), true);
assert.equal(firstProductionRun.has("voice-settings"), true);
assert.equal(firstProductionRun.getItem(PRODUCTION_PROFILE_MARKER), "initialized");

firstProductionRun.setItem("voice-history", "real");
assert.equal(initializeProductionProfile(firstProductionRun, true), false);
assert.equal(firstProductionRun.getItem("voice-history"), "real");

const accuracyUpgrade = createStorage({ "voice-settings": JSON.stringify({ whisperProfile: "fast", language: "spanish" }) });
assert.equal(upgradeAccuracyDefault(accuracyUpgrade), true);
assert.equal(JSON.parse(accuracyUpgrade.getItem("voice-settings")).whisperProfile, "accurate");
assert.equal(JSON.parse(accuracyUpgrade.getItem("voice-settings")).language, "spanish");
assert.equal(accuracyUpgrade.getItem(ACCURACY_DEFAULT_MARKER), "initialized");
assert.equal(upgradeAccuracyDefault(accuracyUpgrade), false);

const preservedAccurate = createStorage({ "voice-settings": JSON.stringify({ whisperProfile: "accurate" }) });
upgradeAccuracyDefault(preservedAccurate);
assert.equal(JSON.parse(preservedAccurate.getItem("voice-settings")).whisperProfile, "accurate");

const legacyTransitionStorage = createStorage({ "voice-settings": "settings", "voice-history": "history", "voice-dictionary": "dictionary", "voice-microphone": "microphone" });
assert.deepEqual(clearMigratedLegacyStorage(legacyTransitionStorage, true), []);
for (const key of ["voice-settings", "voice-history", "voice-dictionary", "voice-microphone"]) assert.equal(legacyTransitionStorage.has(key), true);

const targetStorage = createStorage({ "voice-settings": "settings", "voice-history": "history", "voice-dictionary": "dictionary", "voice-microphone": "microphone" });
assert.deepEqual(clearMigratedLegacyStorage(targetStorage, false), ["voice-settings", "voice-history", "voice-dictionary", "voice-microphone"]);
for (const key of ["voice-settings", "voice-history", "voice-dictionary", "voice-microphone"]) assert.equal(targetStorage.has(key), false);

const perfUntouched = createStorage({});
const migratedSettings = upgradePerfDefault(perfUntouched, { whisperProfile: "accurate", inferenceDevice: "cpu", language: "spanish" });
assert.equal(migratedSettings.whisperProfile, "balanced");
assert.equal(migratedSettings.inferenceDevice, "dml");
assert.equal(migratedSettings.language, "spanish");
assert.equal(perfUntouched.getItem(PERF_DEFAULT_MARKER), "initialized");

const perfUntouchedNoKeys = createStorage({});
const migratedFromEmpty = upgradePerfDefault(perfUntouchedNoKeys, {});
assert.equal(migratedFromEmpty.whisperProfile, "balanced");
assert.equal(migratedFromEmpty.inferenceDevice, "dml");

const perfDeviceChanged = createStorage({});
const notMigratedDevice = upgradePerfDefault(perfDeviceChanged, { whisperProfile: "accurate", inferenceDevice: "dml" });
assert.equal(notMigratedDevice.inferenceDevice, "dml");
assert.equal(notMigratedDevice.whisperProfile, "accurate");

const perfProfileChanged = createStorage({});
const notMigratedProfile = upgradePerfDefault(perfProfileChanged, { whisperProfile: "fast", inferenceDevice: "cpu" });
assert.equal(notMigratedProfile.whisperProfile, "fast");
assert.equal(notMigratedProfile.inferenceDevice, "cpu");

const perfAlreadyMarked = createStorage({ [PERF_DEFAULT_MARKER]: "initialized" });
const notReapplied = upgradePerfDefault(perfAlreadyMarked, { whisperProfile: "accurate", inferenceDevice: "cpu" });
assert.equal(notReapplied.whisperProfile, "accurate");
assert.equal(notReapplied.inferenceDevice, "cpu");

const perfIdempotent = createStorage({});
const firstRun = upgradePerfDefault(perfIdempotent, { whisperProfile: "accurate", inferenceDevice: "cpu" });
assert.equal(firstRun.whisperProfile, "balanced");
const secondRunFreshObject = upgradePerfDefault(perfIdempotent, { whisperProfile: "accurate", inferenceDevice: "cpu" });
assert.equal(secondRunFreshObject.whisperProfile, "accurate");
assert.equal(secondRunFreshObject.inferenceDevice, "cpu");

console.log("Data migrations: 28 checks passed.");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node src/data-migrations.test.cjs`
Expected: `TypeError: upgradePerfDefault is not a function` (destructured as `undefined` since it doesn't exist yet in `data-migrations.cjs`).

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `src/data-migrations.cjs` with:

```javascript
const PRODUCTION_PROFILE_MARKER = "voice-production-profile-v1";
const ACCURACY_DEFAULT_MARKER = "voice-accuracy-default-v2";
const PERF_DEFAULT_MARKER = "voice-perf-default-v1";
const LEGACY_STORAGE_KEYS = Object.freeze(["voice-settings", "voice-history", "voice-dictionary", "voice-microphone"]);

function clearMigratedLegacyStorage(storage, preserveLegacyStorage) {
  if (preserveLegacyStorage) return [];
  for (const key of LEGACY_STORAGE_KEYS) storage.removeItem(key);
  return [...LEGACY_STORAGE_KEYS];
}

function initializeProductionProfile(storage, isPackaged) {
  if (!isPackaged || storage.getItem(PRODUCTION_PROFILE_MARKER)) return false;
  storage.setItem(PRODUCTION_PROFILE_MARKER, "initialized");
  return true;
}

function upgradeAccuracyDefault(storage) {
  if (storage.getItem(ACCURACY_DEFAULT_MARKER)) return false;
  let settings;
  try {
    settings = JSON.parse(storage.getItem("voice-settings") || "{}");
  } catch {
    settings = {};
  }
  if (!settings.whisperProfile || settings.whisperProfile === "fast") {
    settings.whisperProfile = "accurate";
    storage.setItem("voice-settings", JSON.stringify(settings));
  }
  storage.setItem(ACCURACY_DEFAULT_MARKER, "initialized");
  return true;
}

// Operates on the persisted-state settings object directly (not a localStorage JSON
// string like upgradeAccuracyDefault) because settings now live in voice-state.json;
// the marker itself still lives in localStorage for consistency with the other migrations.
function upgradePerfDefault(storage, settings = {}) {
  if (storage.getItem(PERF_DEFAULT_MARKER)) return settings;
  storage.setItem(PERF_DEFAULT_MARKER, "initialized");
  const deviceUntouched = !settings.inferenceDevice || settings.inferenceDevice === "cpu";
  const profileUntouched = !settings.whisperProfile || settings.whisperProfile === "accurate";
  if (!deviceUntouched || !profileUntouched) return settings;
  return { ...settings, inferenceDevice: "dml", whisperProfile: "balanced" };
}

module.exports = {
  ACCURACY_DEFAULT_MARKER,
  clearMigratedLegacyStorage,
  initializeProductionProfile,
  PERF_DEFAULT_MARKER,
  PRODUCTION_PROFILE_MARKER,
  upgradeAccuracyDefault,
  upgradePerfDefault
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node src/data-migrations.test.cjs`
Expected: `Data migrations: 28 checks passed.` printed, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/data-migrations.cjs src/data-migrations.test.cjs
git commit -m "feat: add one-time migration to dml+balanced defaults for existing users"
```

---

### Task 3: Wire the new defaults and migration into the renderer, add the UI option

**Files:**
- Modify: `index.html:115`
- Modify: `src/renderer.js:7` (import), `src/renderer.js:120-135` (defaults), `src/renderer.js:1148-1166` (`initializeApp`)

**Interfaces:**
- Consumes: `WHISPER_PROFILES`/`resolveWhisperProfile` from Task 1 (already imported at `renderer.js:6`, unchanged), `upgradePerfDefault` from Task 2 (`src/data-migrations.cjs`).
- Produces: nothing new consumed by later tasks — this is the integration point.

- [ ] **Step 1: Add the `balanced` option to the settings UI**

In `index.html`, find line 115 (the `whisperProfile` select) and replace it with:

```html
              <label class="setting-row"><span><strong>Calidad de transcripción</strong><small>Máxima precisión usa PCM sin compresión, Whisper Large v3 Turbo y beam search.</small></span><select id="whisperProfile"><option value="fast">Rápido · Whisper Base Q8</option><option value="balanced">Balanceado · Whisper Large v3 Turbo Q8 (1 beam)</option><option value="accurate">Máxima precisión · Whisper Large v3 Turbo Q8</option></select></label>
```

- [ ] **Step 2: Import `upgradePerfDefault` in the renderer**

In `src/renderer.js`, replace line 7:

```javascript
const { clearMigratedLegacyStorage, initializeProductionProfile, upgradeAccuracyDefault } = require("./data-migrations.cjs");
```

with:

```javascript
const { clearMigratedLegacyStorage, initializeProductionProfile, upgradeAccuracyDefault, upgradePerfDefault } = require("./data-migrations.cjs");
```

- [ ] **Step 3: Flip the shipped defaults**

In `src/renderer.js`, inside the `defaults` object (around line 120), change:

```javascript
  whisperProfile: "accurate",
  inferenceDevice: "cpu",
```

to:

```javascript
  whisperProfile: "balanced",
  inferenceDevice: "dml",
```

Leave every other key in `defaults` unchanged.

- [ ] **Step 4: Wire the migration into `initializeApp()`**

In `src/renderer.js`, replace the `initializeApp` function (around line 1148) with:

```javascript
async function initializeApp() {
  await ensureLegalAcceptance();
  await voiceAPI.migrateLegacyState(legacyState);
  const persisted = await voiceAPI.getState();
  const migratedSettings = upgradePerfDefault(localStorage, persisted.settings);
  const perfDefaultsApplied = migratedSettings !== persisted.settings;
  persisted.settings = migratedSettings;
  settings = { ...defaults, ...persisted.settings };
  applyPlatformCapabilities();
  dictionary = persisted.dictionary;
  persistedMicrophone = persisted.microphone;
  clearMigratedLegacyStorage(localStorage, voiceAPI.runtime.preserveLegacyStorage);
  await voiceAPI.transcriptions.migrateLegacy(persisted.history);

  await hydrateSettings();
  await refreshHistory();
  renderDictionary();
  await updateMicrophones();
  const modifier = voiceAPI.runtime.platform === "darwin" ? "Cmd" : "Ctrl";
  setStatus("idle", `Haz clic o usa ${modifier} + Shift + Espacio.`);
  document.documentElement.dataset.voiceflowInitialized = "true";
  if (perfDefaultsApplied) {
    persistState();
    showToast("Activamos aceleración por GPU y un modo balanceado de velocidad. Puedes cambiarlo en Configuración.");
  }
}
```

Note: `normalizePlatformSettings` (called inside `applyPlatformCapabilities()`, `renderer.js:248`) already clamps `inferenceDevice` back to `"cpu"` on non-Windows platforms — no platform branching needed here.

- [ ] **Step 5: Verify the bundle builds**

Run: `npm run build`
Expected: exits 0, writes `dist/renderer.js` with no esbuild errors.

- [ ] **Step 6: Manual smoke check**

Run: `npm start`
Expected: app launches; open Configuración → modo avanzado, confirm "Calidad de transcripción" shows "Balanceado · Whisper Large v3 Turbo Q8 (1 beam)" selected and "Aceleración de inferencia" shows "DirectML · experimental" selected on a fresh profile (no prior `voice-state.json`). Do one test dictation and confirm text is still pasted correctly.

- [ ] **Step 7: Commit**

```bash
git add index.html src/renderer.js
git commit -m "feat: default to dml+balanced and migrate existing users on launch"
```

---

### Task 4: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: exits 0. This runs the build plus every `.test.cjs` file including the two modified in Tasks 1–2, and syntax-checks `src/main.cjs`/`src/preload.cjs`/etc. via `node --check`.

- [ ] **Step 2: Note follow-up (not part of this plan)**

The design spec calls for validating `balanced+dml` against the documented performance gates (p50 ≤1.5s, p95 ≤3s, WER ≤110%) using `npm run benchmark:models`. That requires a private corpus (`benchmarks/corpus/manifest.json`) that does not exist in the repo yet — creating it is a separate, manual task (recording/curating 20-30 WAV files) and is intentionally not part of this implementation plan. Flag this to the user as the recommended next step after this plan lands.
