# felipe avinzano VoiceFlow Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the complete Windows application and distribution surface to `felipe avinzano VoiceFlow`, apply the approved `Flow` wordmark treatment, and migrate all existing user data safely.

**Architecture:** Store brand metadata in one JSON document consumed by focused CommonJS helpers, Electron preload bridges, release scripts, and validation tests. Run an idempotent filesystem migration before any user state is read; preserve legacy directories and fall back to the selected legacy directory for the current session when migration fails. Keep unavoidable electron-builder metadata duplication in `package.json`, enforced by tests.

**Tech Stack:** Electron 39, Node.js CommonJS, esbuild, electron-builder/NSIS, PowerShell, .NET 8 single-file helper, HTML/CSS, Node `assert` tests.

---

## File structure and responsibilities

- Create `src/brand-config.json`: canonical product names, identifiers, repository, colors, artifact names, and legacy identities.
- Create `src/brand-config.cjs`: immutable loader plus helpers for URLs and artifact filenames.
- Create `src/brand-config.test.cjs`: consistency tests for `package.json`, fonts, and calculated names.
- Create `src/brand-migration.cjs`: legacy-directory discovery, conflict-safe copying, marker creation, and fallback selection.
- Create `src/brand-migration.test.cjs`: isolated filesystem tests for migration success and failure cases.
- Create `src/brand-surfaces.test.cjs`: static contract tests for native and browser branding surfaces.
- Create `scripts/verify-brand-references.cjs`: active-source audit with explicit historical exceptions.
- Modify `src/main.cjs`: consume the brand config, choose the data path, migrate before state access, rename native text, and report migration diagnostics.
- Modify `src/preload.cjs` and `src/overlay-preload.cjs`: expose frozen, read-only brand data.
- Modify `src/renderer.js` and `overlay.js`: populate brand targets from the preload bridge.
- Modify `index.html`, `overlay.html`, `styles.css`, and `overlay.css`: semantic wordmark markup and approved DM Serif/copper treatment.
- Rename `tools/NextStepAI.PasteHelper/` to `tools/FelipeAvinzano.VoiceFlow.PasteHelper/` and change the assembly name.
- Modify native/release scripts under `scripts/`: derive or validate new filenames and repository values.
- Rename `Iniciar NextStepAI Voice.bat` to `Iniciar felipe avinzano VoiceFlow.bat`.
- Modify active legal/product documentation; annotate historical release documents instead of rewriting historical artifact facts.

### Task 1: Establish a canonical brand contract

**Files:**
- Create: `src/brand-config.json`
- Create: `src/brand-config.cjs`
- Create: `src/brand-config.test.cjs`
- Modify: `package.json`

- [ ] **Step 1: Capture the dirty-worktree baseline**

Run:

```powershell
git status --short
git diff -- index.html overlay.html package.json scripts/release-1.1.0.ps1 src/main.cjs src/renderer.js styles.css
npm.cmd test
```

Expected: the pre-existing modified files remain unstaged; the existing test suite passes before rebrand edits. Save the diff output in the session notes and never overwrite unrelated hunks.

- [ ] **Step 2: Write the failing brand contract test**

Create `src/brand-config.test.cjs` with:

```js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const brand = require("./brand-config.cjs");
const packageJson = require("../package.json");

assert.equal(brand.displayName, "felipe avinzano VoiceFlow");
assert.equal(brand.baseName, "felipe avinzano Voice");
assert.equal(brand.suffix, "Flow");
assert.equal(brand.slug, "felipe-avinzanovoiceflow");
assert.equal(brand.appId, "com.felipeavinzano.voiceflow");
assert.equal(brand.repository.slug, "favinzano/felipe-avinzanovoiceflow");
assert.equal(brand.copper, "#B66D45");
assert.equal(packageJson.name, brand.slug);
assert.equal(packageJson.build.productName, brand.displayName);
assert.equal(packageJson.build.appId, brand.appId);
assert.equal(packageJson.build.publish[0].owner, brand.repository.owner);
assert.equal(packageJson.build.publish[0].repo, brand.repository.name);
assert.equal(packageJson.build.nsis.shortcutName, brand.displayName);
assert.ok(packageJson.build.files.includes("src/brand-config.json"));
assert.ok(packageJson.build.files.includes("assets/fonts/DMSerifDisplay-*.ttf"));
assert.ok(fs.existsSync(path.join(__dirname, "../assets/fonts/DMSerifDisplay-Regular.ttf")));
console.log("Brand config: 16 checks passed.");
```

- [ ] **Step 3: Run the test and confirm the missing module failure**

Run: `node src/brand-config.test.cjs`

Expected: FAIL with `Cannot find module './brand-config.cjs'`.

- [ ] **Step 4: Add the canonical JSON and loader**

Create `src/brand-config.json` with:

```json
{
  "displayName": "felipe avinzano VoiceFlow",
  "baseName": "felipe avinzano Voice",
  "suffix": "Flow",
  "slug": "felipe-avinzanovoiceflow",
  "appId": "com.felipeavinzano.voiceflow",
  "copper": "#B66D45",
  "developmentName": "felipe avinzano VoiceFlow Development",
  "helperBaseName": "FelipeAvinzano.VoiceFlow.PasteHelper",
  "repository": {
    "owner": "favinzano",
    "name": "felipe-avinzanovoiceflow",
    "slug": "favinzano/felipe-avinzanovoiceflow",
    "url": "https://github.com/favinzano/felipe-avinzanovoiceflow"
  },
  "legacyDataNames": [
    "felipe avinzano Voice",
    "NextStepAI Voice",
    "felipe avinzano Voice Development",
    "NextStepAI Voice Development"
  ]
}
```

Create `src/brand-config.cjs` with:

```js
const raw = require("./brand-config.json");

const brand = Object.freeze({
  ...raw,
  repository: Object.freeze({ ...raw.repository }),
  legacyDataNames: Object.freeze([...raw.legacyDataNames]),
  issueUrl: `${raw.repository.url}/issues`,
  helperExecutable: `${raw.helperBaseName}.exe`,
  installerName(version, flavor) {
    const suffix = flavor ? `-${flavor}` : "";
    return `${raw.slug}-Setup-${version}${suffix}-x64.exe`;
  }
});

module.exports = brand;
```

- [ ] **Step 5: Align `package.json` and include the test in both suites**

Set these exact values in `package.json`:

```json
"name": "felipe-avinzanovoiceflow",
"description": "felipe avinzano VoiceFlow - dictado privado y local para Windows",
"build": {
  "appId": "com.felipeavinzano.voiceflow",
  "productName": "felipe avinzano VoiceFlow",
  "publish": [{
    "provider": "github",
    "owner": "favinzano",
    "repo": "felipe-avinzanovoiceflow",
    "releaseType": "release"
  }]
}
```

Keep all unrelated build fields, add `src/brand-config.test.cjs` to `test` and `test:production`, set `build.nsis.shortcutName` to `felipe avinzano VoiceFlow`, set `build.win.artifactName` to `felipe-avinzanovoiceflow-Setup-${version}-${arch}.${ext}`, and ensure `src/**/*` still packages the JSON.

- [ ] **Step 6: Run the brand test and package-lock normalization**

Run:

```powershell
npm.cmd install --package-lock-only --ignore-scripts
node src/brand-config.test.cjs
```

Expected: `Brand config: 16 checks passed.` and both top-level `package-lock.json` name fields equal `felipe-avinzanovoiceflow`.

- [ ] **Step 7: Commit the brand contract only**

```powershell
git add src/brand-config.json src/brand-config.cjs src/brand-config.test.cjs package.json package-lock.json
git commit -m "feat: define VoiceFlow brand contract"
```

### Task 2: Build the idempotent user-data migration

**Files:**
- Create: `src/brand-migration.cjs`
- Create: `src/brand-migration.test.cjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing migration tests**

Create `src/brand-migration.test.cjs`. Use `fs.mkdtemp`, write `voice-state.json`, `app-preferences.json`, backups, and a small `models/model.onnx` fixture. Assert all of these contracts:

```js
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { migrateBrandData, migrationMarkerPath } = require("./brand-migration.cjs");

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value), "utf8");
}

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "voiceflow-brand-migration-"));
  const legacy = path.join(root, "felipe avinzano Voice");
  const target = path.join(root, "felipe avinzano VoiceFlow");
  await writeJson(path.join(legacy, "voice-state.json"), { schemaVersion: 1, history: [{ text: "kept" }] });
  await writeJson(path.join(legacy, "app-preferences.json"), { shortcutMode: "hold" });
  await fs.mkdir(path.join(legacy, "models"), { recursive: true });
  await fs.writeFile(path.join(legacy, "models", "model.onnx"), "model");
  await fs.mkdir(path.join(legacy, "Local Storage", "leveldb"), { recursive: true });
  await fs.writeFile(path.join(legacy, "Local Storage", "leveldb", "CURRENT"), "MANIFEST-000001");

  const first = await migrateBrandData({ appDataPath: root, targetName: "felipe avinzano VoiceFlow", legacyNames: ["felipe avinzano Voice"] });
  assert.equal(first.status, "migrated");
  assert.equal(first.sourcePath, legacy);
  assert.equal(JSON.parse(await fs.readFile(path.join(target, "voice-state.json"))).history[0].text, "kept");
  assert.equal(await fs.readFile(path.join(target, "models", "model.onnx"), "utf8"), "model");
  assert.equal(await fs.readFile(path.join(target, "Local Storage", "leveldb", "CURRENT"), "utf8"), "MANIFEST-000001");
  assert.ok(await fs.stat(migrationMarkerPath(target)));

  await writeJson(path.join(target, "app-preferences.json"), { shortcutMode: "toggle" });
  const second = await migrateBrandData({ appDataPath: root, targetName: "felipe avinzano VoiceFlow", legacyNames: ["felipe avinzano Voice"] });
  assert.equal(second.status, "already-migrated");
  assert.equal(JSON.parse(await fs.readFile(path.join(target, "app-preferences.json"))).shortcutMode, "toggle");
  assert.ok(await fs.stat(legacy));

  const corruptRoot = await fs.mkdtemp(path.join(os.tmpdir(), "voiceflow-brand-corrupt-"));
  const corruptLegacy = path.join(corruptRoot, "NextStepAI Voice");
  await fs.mkdir(corruptLegacy, { recursive: true });
  await fs.writeFile(path.join(corruptLegacy, "voice-state.json"), "{");
  await writeJson(path.join(corruptLegacy, "voice-state.json.backup"), { schemaVersion: 1, history: [{ text: "backup" }] });
  const recovered = await migrateBrandData({ appDataPath: corruptRoot, targetName: "felipe avinzano VoiceFlow", legacyNames: ["NextStepAI Voice"] });
  assert.equal(recovered.status, "migrated");
  assert.equal(JSON.parse(await fs.readFile(path.join(corruptRoot, "felipe avinzano VoiceFlow", "voice-state.json"))).history[0].text, "backup");

  console.log("Brand migration: 12 checks passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
```

- [ ] **Step 2: Run the migration test and confirm failure**

Run: `node src/brand-migration.test.cjs`

Expected: FAIL with `Cannot find module './brand-migration.cjs'`.

- [ ] **Step 3: Implement the migration boundary**

Create `src/brand-migration.cjs` exporting:

```js
const fs = require("node:fs/promises");
const path = require("node:path");

const MARKER = ".voiceflow-brand-migration-v1.json";
const STATE = "voice-state.json";
const BACKUP = "voice-state.json.backup";
const PREFERENCES = "app-preferences.json";
const STORAGE_DIRECTORIES = ["models", "Local Storage", "IndexedDB"];

const migrationMarkerPath = (targetPath) => path.join(targetPath, MARKER);

async function exists(file, operations = fs) {
  try { await operations.access(file); return true; } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function readValidJson(file, operations = fs) {
  return JSON.parse(await operations.readFile(file, "utf8"));
}

async function copyFileIfAbsentAtomic(source, destination, operations = fs) {
  if (await exists(destination, operations) || !(await exists(source, operations))) return false;
  const temporary = `${destination}.${process.pid}.tmp`;
  await operations.mkdir(path.dirname(destination), { recursive: true });
  await operations.copyFile(source, temporary);
  try { await operations.rename(temporary, destination); }
  catch (error) {
    await operations.rm(temporary, { force: true });
    if (error.code !== "EEXIST") throw error;
  }
  return true;
}

async function copyTreeMissing(source, destination, operations = fs) {
  if (!(await exists(source, operations))) return;
  await operations.mkdir(destination, { recursive: true });
  for (const entry of await operations.readdir(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) await copyTreeMissing(from, to, operations);
    else if (entry.isFile()) await copyFileIfAbsentAtomic(from, to, operations);
  }
}
```

Add the complete migration function:

```js
async function migrateBrandData({ appDataPath, targetName, legacyNames, operations = fs }) {
  const targetPath = path.join(appDataPath, targetName);
  if (await exists(migrationMarkerPath(targetPath), operations)) {
    return { status: "already-migrated", targetPath };
  }

  let sourcePath;
  for (const legacyName of legacyNames) {
    const candidate = path.join(appDataPath, legacyName);
    if (candidate !== targetPath && await exists(candidate, operations)) {
      sourcePath = candidate;
      break;
    }
  }
  if (!sourcePath) return { status: "not-needed", targetPath };

  try {
    await operations.mkdir(targetPath, { recursive: true });
    const destinationState = path.join(targetPath, STATE);
    if (!(await exists(destinationState, operations))) {
      const sourceState = path.join(sourcePath, STATE);
      const sourceBackup = path.join(sourcePath, BACKUP);
      let selectedState = sourceState;
      try { await readValidJson(sourceState, operations); }
      catch { await readValidJson(sourceBackup, operations); selectedState = sourceBackup; }
      await copyFileIfAbsentAtomic(selectedState, destinationState, operations);
    }

    const sourcePreferences = path.join(sourcePath, PREFERENCES);
    if (await exists(sourcePreferences, operations)) {
      await readValidJson(sourcePreferences, operations);
      await copyFileIfAbsentAtomic(sourcePreferences, path.join(targetPath, PREFERENCES), operations);
    }
    for (const directory of STORAGE_DIRECTORIES) {
      await copyTreeMissing(path.join(sourcePath, directory), path.join(targetPath, directory), operations);
    }

    const marker = migrationMarkerPath(targetPath);
    const temporaryMarker = `${marker}.${process.pid}.tmp`;
    await operations.writeFile(temporaryMarker, JSON.stringify({ sourcePath, completedAt: new Date().toISOString() }, null, 2), "utf8");
    await operations.rename(temporaryMarker, marker);
    return { status: "migrated", sourcePath, targetPath };
  } catch (error) {
    return { status: "fallback", sourcePath, targetPath, error };
  }
}

module.exports = { copyFileIfAbsentAtomic, migrateBrandData, migrationMarkerPath };
```

In the `catch` block, attempt `operations.rm` on the two known temporary state/marker paths with `{ force: true }` before returning `fallback`. Cleanup failures must be ignored so the original migration error remains available. The function never calls `rm` on a source path.

- [ ] **Step 4: Add conflict and interrupted-copy assertions**

Extend `src/brand-migration.test.cjs` to pre-create a destination state and assert it remains unchanged, then inject a `copyFile` function that throws and assert `status === "fallback"`, no marker exists, and the legacy directory remains readable. Accept an optional `operations = fs` dependency in `migrateBrandData` to make this deterministic.

- [ ] **Step 5: Run migration tests**

Run: `node src/brand-migration.test.cjs`

Expected: `Brand migration: 18 checks passed.`

- [ ] **Step 6: Add the migration test to `test` and `test:production`, then commit**

```powershell
npm.cmd test
git add src/brand-migration.cjs src/brand-migration.test.cjs package.json
git commit -m "feat: migrate legacy Voice data safely"
```

Expected: all tests pass and only the three listed files are committed.

### Task 3: Integrate brand and migration into Electron

**Files:**
- Modify: `src/main.cjs`
- Modify: `src/preload.cjs`
- Modify: `src/overlay-preload.cjs`
- Create: `src/brand-surfaces.test.cjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing static surface contracts**

Create `src/brand-surfaces.test.cjs` with assertions that `src/main.cjs` imports `brand-config.cjs` and `brand-migration.cjs`, calls `app.setName(brand.displayName)`, sets `brand.appId`, uses `brand.issueUrl`, and contains no active hard-coded `felipe avinzano Voice` or `com.nextstepai.voice` string. Also assert both preload files expose `brand`:

```js
const assert = require("node:assert/strict");
const fs = require("node:fs");

const main = fs.readFileSync("src/main.cjs", "utf8");
const preload = fs.readFileSync("src/preload.cjs", "utf8");
const overlayPreload = fs.readFileSync("src/overlay-preload.cjs", "utf8");
assert.match(main, /require\("\.\/brand-config\.cjs"\)/);
assert.match(main, /require\("\.\/brand-migration\.cjs"\)/);
assert.match(main, /app\.setName\(brand\.displayName\)/);
assert.match(main, /app\.setAppUserModelId\(brand\.appId\)/);
assert.match(main, /brand\.issueUrl/);
assert.doesNotMatch(main, /com\.nextstepai\.voice/);
assert.match(preload, /brand:/);
assert.match(overlayPreload, /brand:/);
console.log("Brand surfaces: 8 checks passed.");
```

- [ ] **Step 2: Run the test and confirm it fails on missing imports**

Run: `node src/brand-surfaces.test.cjs`

Expected: FAIL on the first `assert.match`.

- [ ] **Step 3: Select and migrate user data before acquiring the single-instance lock**

At the top of `src/main.cjs`, import `brand` and `migrateBrandData`. Set the production/development target names from the config before `app.whenReady()`. Because migration is asynchronous, add an initialization promise:

```js
const brand = require("./brand-config.cjs");
const { migrateBrandData } = require("./brand-migration.cjs");

app.setName(brand.displayName);
const appDataPath = app.getPath("appData");
const targetDataName = app.isPackaged ? brand.displayName : brand.developmentName;
const brandMigration = migrateBrandData({
  appDataPath,
  targetName: targetDataName,
  legacyNames: brand.legacyDataNames
});
app.setPath("userData", path.join(appDataPath, targetDataName));
if (process.platform === "win32") app.setAppUserModelId(brand.appId);
```

Await `brandMigration` as the first operation in `app.whenReady()`. If it returns `fallback`, set `userData` to `sourcePath` for this session before creating windows and show an error dialog after the main window exists. Store the result in `lastBrandMigration` for diagnostics. Never delete the legacy path.

- [ ] **Step 4: Replace native brand strings with config fields**

Use `brand.displayName` for tray tooltip/menu, window/dialog titles, close-button wording, diagnostics heading, and update messages. Use `brand.issueUrl` for support. Rename history exports to:

```js
defaultPath: `${brand.slug}-History-${new Date().toISOString().slice(0, 10)}.json`
```

Use `brand.helperExecutable` for both packaged and development helper paths. Add `brandMigration: { status, sourcePath }` to diagnostics without exposing state content.

- [ ] **Step 5: Expose immutable renderer-safe brand values**

In both preload files import the config and expose only:

```js
const rendererBrand = Object.freeze({
  displayName: brand.displayName,
  baseName: brand.baseName,
  suffix: brand.suffix,
  copper: brand.copper
});
```

Add `brand: rendererBrand` to `voiceAPI` and `overlayAPI`; do not expose repository credentials, filesystem paths, or arbitrary config mutation.

- [ ] **Step 6: Run syntax and surface tests**

Run:

```powershell
node --check src/main.cjs
node --check src/preload.cjs
node --check src/overlay-preload.cjs
node src/brand-surfaces.test.cjs
```

Expected: all syntax checks exit 0 and `Brand surfaces: 8 checks passed.`

- [ ] **Step 7: Add the surface test to both suites and commit**

```powershell
npm.cmd test
git add src/main.cjs src/preload.cjs src/overlay-preload.cjs src/brand-surfaces.test.cjs package.json
git commit -m "feat: apply VoiceFlow identity in Electron"
```

### Task 4: Apply the approved visual wordmark everywhere

**Files:**
- Modify: `index.html`
- Modify: `overlay.html`
- Modify: `styles.css`
- Modify: `overlay.css`
- Modify: `src/renderer.js`
- Modify: `overlay.js`
- Modify: `src/brand-surfaces.test.cjs`

- [ ] **Step 1: Extend the failing surface test for browser markup**

Assert `index.html` and `overlay.html` contain `[data-brand-base]` and `[data-brand-suffix]`, that both CSS files define the suffix with DM Serif Display, weight 400, and copper, and that renderer scripts read their respective preload brand objects. Run the test and expect failure on the first missing data attribute.

- [ ] **Step 2: Replace repeated wordmarks with semantic targets**

Use this exact structure in the titlebar, sidebar and overlay:

```html
<span class="wordmark"><span data-brand-base>felipe avinzano Voice</span><span class="brand-flow" data-brand-suffix>Flow</span></span>
```

For block layouts, retain their current wrappers but put `data-brand-base` and `data-brand-suffix` on separate inline spans. Replace active explanatory copy with `felipe avinzano VoiceFlow`. Set both HTML `<title>` elements to the complete new name as a non-JavaScript fallback.

- [ ] **Step 3: Apply the approved typography and color**

In both CSS files ensure DM Serif Display has an `@font-face`, then add:

```css
.brand-flow {
  color: var(--copper);
  font-family: "DM Serif Display", serif;
  font-size: 1.08em;
  font-weight: 400;
  letter-spacing: -.035em;
}
```

Define `--copper: #b66d45` in the overlay root and remove the old blue styling from the wordmark suffix. Preserve unrelated responsive/layout rules in the user's existing CSS changes.

- [ ] **Step 4: Populate every runtime brand target**

Add a small `applyBrand(brand)` function to `src/renderer.js` and `overlay.js`:

```js
function applyBrand(brand) {
  document.title = brand.displayName;
  document.querySelectorAll("[data-brand-base]").forEach((node) => { node.textContent = brand.baseName; });
  document.querySelectorAll("[data-brand-suffix]").forEach((node) => { node.textContent = brand.suffix; });
}
```

Call it once with `window.voiceAPI.brand` or `window.overlayAPI.brand` before binding interactive handlers. Update demo strings in `src/renderer.js` to the complete new product name.

- [ ] **Step 5: Verify browser build and static contract**

Run:

```powershell
npm.cmd run build
node src/brand-surfaces.test.cjs
```

Expected: esbuild succeeds and all surface checks pass.

- [ ] **Step 6: Launch and visually inspect both surfaces**

Run: `npm.cmd run dev`

Verify titlebar, sidebar, About screen and floating overlay on both light and dark backgrounds. Expected: only `Flow` uses DM Serif Display 400 and `#B66D45`; no layout clips at the minimum 900×640 window size.

- [ ] **Step 7: Commit visual surfaces**

```powershell
git add index.html overlay.html styles.css overlay.css src/renderer.js overlay.js src/brand-surfaces.test.cjs dist/renderer.js
git commit -m "feat: style the VoiceFlow wordmark"
```

If `dist/renderer.js` is ignored or intentionally not versioned, omit it after confirming `git check-ignore dist/renderer.js` reports the repository rule.

### Task 5: Rename the native paste helper and local launcher

**Files:**
- Rename: `tools/NextStepAI.PasteHelper/` → `tools/FelipeAvinzano.VoiceFlow.PasteHelper/`
- Modify: `tools/FelipeAvinzano.VoiceFlow.PasteHelper/FelipeAvinzano.VoiceFlow.PasteHelper.csproj`
- Modify: `scripts/build-native.ps1`
- Modify: `scripts/compress-natives.cjs`
- Rename: `Iniciar NextStepAI Voice.bat` → `Iniciar felipe avinzano VoiceFlow.bat`
- Modify: `src/brand-surfaces.test.cjs`

- [ ] **Step 1: Add failing native-name assertions**

Assert the new project path exists, the old path does not, `AssemblyName` equals `FelipeAvinzano.VoiceFlow.PasteHelper`, and build/compression scripts reference `brand.helperExecutable` or the exact new helper name. Run the test; expect failure because the old project still exists.

- [ ] **Step 2: Rename the helper directory and project file with Git**

Run:

```powershell
git mv 'tools/NextStepAI.PasteHelper' 'tools/FelipeAvinzano.VoiceFlow.PasteHelper'
git mv 'tools/FelipeAvinzano.VoiceFlow.PasteHelper/NextStepAI.PasteHelper.csproj' 'tools/FelipeAvinzano.VoiceFlow.PasteHelper/FelipeAvinzano.VoiceFlow.PasteHelper.csproj'
```

Do not include generated `bin/` or `obj/` files in the commit.

- [ ] **Step 3: Change the assembly and build paths**

Set:

```xml
<AssemblyName>FelipeAvinzano.VoiceFlow.PasteHelper</AssemblyName>
```

Update `scripts/build-native.ps1` to resolve the new `.csproj` and output executable. Update `scripts/compress-natives.cjs` to select `FelipeAvinzano.VoiceFlow.PasteHelper.exe`.

- [ ] **Step 4: Rename and rewrite the launcher**

Use `git mv` for the batch file. Change its title and user-facing messages to `felipe avinzano VoiceFlow`; preserve its existing dependency-install and launch behavior.

- [ ] **Step 5: Build and verify the helper**

Run:

```powershell
npm.cmd run build:native
Test-Path 'native/win32-x64/FelipeAvinzano.VoiceFlow.PasteHelper.exe'
node src/brand-surfaces.test.cjs
```

Expected: native build exits 0, `Test-Path` prints `True`, and surface tests pass.

- [ ] **Step 6: Commit native renames**

```powershell
git add tools/FelipeAvinzano.VoiceFlow.PasteHelper scripts/build-native.ps1 scripts/compress-natives.cjs 'Iniciar felipe avinzano VoiceFlow.bat' src/brand-surfaces.test.cjs
git add -u tools/NextStepAI.PasteHelper 'Iniciar NextStepAI Voice.bat'
git commit -m "refactor: rename the VoiceFlow paste helper"
```

### Task 6: Align packaging, release, signing, and installer verification

**Files:**
- Modify: `package.json`
- Modify: `scripts/verify-release.cjs`
- Modify: `scripts/verify-packaged-models.cjs`
- Modify: `scripts/release-signed.ps1`
- Modify: `scripts/verify-signature.ps1`
- Modify: `scripts/test-installer.ps1`
- Modify: `scripts/test-tray.ps1`
- Modify: `scripts/release-1.1.0.ps1`
- Modify: `scripts/generate-release-notes.cjs`
- Modify: `scripts/verify-acceptance.cjs` if its checks contain a legacy name

- [ ] **Step 1: Extend failing artifact-name tests**

In `src/brand-config.test.cjs`, assert:

```js
assert.equal(brand.installerName("1.1.1"), "felipe-avinzanovoiceflow-Setup-1.1.1-x64.exe");
assert.equal(brand.installerName("1.1.1", "AVX2"), "felipe-avinzanovoiceflow-Setup-1.1.1-AVX2-x64.exe");
assert.equal(packageJson.build.extraResources[0].filter[0], brand.helperExecutable);
```

Run the test and expect the helper filter assertion to fail.

- [ ] **Step 2: Update electron-builder resources and release verification**

Set `extraResources[0].filter` to `FelipeAvinzano.VoiceFlow.PasteHelper.exe`. In Node release scripts import `../src/brand-config.cjs` and calculate installer, unpacked executable and helper names with `brand.displayName`, `brand.helperExecutable`, and `brand.installerName(...)`.

- [ ] **Step 3: Update PowerShell release scripts with one brand object**

At the top of each PowerShell script that needs names, load:

```powershell
$Brand = Get-Content -LiteralPath (Join-Path $PSScriptRoot '..\src\brand-config.json') -Raw | ConvertFrom-Json
$ProductName = $Brand.displayName
$HelperExecutable = "$($Brand.helperBaseName).exe"
$Repository = $Brand.repository.slug
```

Replace hard-coded application, installer, helper, repository and AppData paths with these variables. Preserve legacy installer names only in explicit checks for historical version 1.0.0.

- [ ] **Step 4: Update release-note generation**

Import the brand config in `scripts/generate-release-notes.cjs`; use `brand.displayName` in headings and prose and `brand.repository.slug` for links. Do not rewrite already published historical artifact names in `RELEASE_NOTES_1.0.0.md`.

- [ ] **Step 5: Run script syntax and focused tests**

Run:

```powershell
node --check scripts/verify-release.cjs
node --check scripts/verify-packaged-models.cjs
node --check scripts/generate-release-notes.cjs
node src/brand-config.test.cjs
npm.cmd run release:dir
```

Expected: all checks pass and `release/win-unpacked/felipe avinzano VoiceFlow.exe` plus the renamed helper exist.

- [ ] **Step 6: Verify the unpacked package contract**

Run: `npm.cmd run release:verify`

Expected: it may report the missing NSIS installer after a directory-only build, but every unpacked executable/helper/ASAR assertion before that point uses the new names. Then run `npm.cmd run release:win` when producing the full acceptance build and expect `Release verified: felipe-avinzanovoiceflow-Setup-<version>-x64.exe`.

- [ ] **Step 7: Commit release pipeline changes**

```powershell
git add package.json scripts/verify-release.cjs scripts/verify-packaged-models.cjs scripts/release-signed.ps1 scripts/verify-signature.ps1 scripts/test-installer.ps1 scripts/test-tray.ps1 scripts/release-1.1.0.ps1 scripts/generate-release-notes.cjs scripts/verify-acceptance.cjs src/brand-config.test.cjs
git commit -m "build: rename VoiceFlow release artifacts"
```

### Task 7: Update active documentation and enforce historical exceptions

**Files:**
- Create: `scripts/verify-brand-references.cjs`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `PRIVACY.md`
- Modify: `TERMS.md`
- Modify: `LICENSE.md`
- Modify: `THIRD_PARTY_NOTICES.md`
- Modify: `CHANGELOG.md`
- Modify: `PRODUCTION_READINESS.md`
- Modify: `docs/*.md`
- Modify: `RELEASE_NOTES_1.0.0.md`
- Modify: `release-notes-draft.md`

- [ ] **Step 1: Write the failing legacy-reference audit**

Create `scripts/verify-brand-references.cjs` to recursively inspect tracked text files while excluding `.git`, `node_modules`, `dist`, `release`, `.superpowers`, binary extensions, and generated `bin/obj`. Flag `NextStepAI Voice`, `nextstepai-voice`, `com.nextstepai.voice`, and `NextStepAI.PasteHelper` unless the match appears in:

```js
const historicalAllowlist = new Set([
  "RELEASE_NOTES_1.0.0.md",
  "docs/CERTIFICATION_REPORT_1.0.0.md",
  "docs/UPDATE_AND_ROLLBACK.md",
  "CHANGELOG.md"
]);
```

Require each allowlisted document containing a legacy term to also contain `Identidad anterior: NextStepAI Voice`. Print each unexpected `path:line:text` and exit 1; otherwise print `Brand references verified.`

- [ ] **Step 2: Run the audit and capture current failures**

Run: `node scripts/verify-brand-references.cjs`

Expected: FAIL with active references in README, privacy/terms, scripts or source files not yet converted.

- [ ] **Step 3: Update active documents**

Change current product headings and prose to `felipe avinzano VoiceFlow`, current installers to `felipe-avinzanovoiceflow-Setup-<version>-x64.exe`, the repository to `favinzano/felipe-avinzanovoiceflow`, and the local launcher filename to `Iniciar felipe avinzano VoiceFlow.bat`. Keep legal meaning unchanged.

- [ ] **Step 4: Annotate historical documents without falsifying artifacts**

Add this exact note near the top of each allowlisted file that retains a legacy release fact:

```markdown
> Identidad anterior: NextStepAI Voice. Los nombres conservados en este documento corresponden a artefactos publicados antes del cambio a felipe avinzano VoiceFlow.
```

Do not alter checksums, version numbers, old installer filenames, or old paths that users need to identify a historical build.

- [ ] **Step 5: Wire the audit into both test suites and run it**

Add `node scripts/verify-brand-references.cjs` to `test` and `test:production` after brand tests.

Run:

```powershell
node scripts/verify-brand-references.cjs
npm.cmd test
```

Expected: `Brand references verified.` and the complete suite passes.

- [ ] **Step 6: Commit documentation and audit changes**

```powershell
git add scripts/verify-brand-references.cjs package.json README.md PRIVACY.md TERMS.md LICENSE.md THIRD_PARTY_NOTICES.md CHANGELOG.md PRODUCTION_READINESS.md docs RELEASE_NOTES_1.0.0.md release-notes-draft.md
git commit -m "docs: adopt the VoiceFlow product identity"
```

### Task 8: Final migration, packaging, and visual acceptance

**Files:**
- Modify only files required by failures discovered in this task.

- [ ] **Step 1: Run the complete test suite from a clean build output**

Run:

```powershell
npm.cmd test
npm.cmd run test:production
```

Expected: both commands exit 0, including brand configuration, migration, surface and reference-audit tests.

- [ ] **Step 2: Exercise migration against disposable AppData fixtures**

Run the migration test three consecutive times:

```powershell
node src/brand-migration.test.cjs
node src/brand-migration.test.cjs
node src/brand-migration.test.cjs
```

Expected: `Brand migration: 18 checks passed.` every time, with no temporary-file leakage reported.

- [ ] **Step 3: Build the production directory and verify packaged models**

Run:

```powershell
npm.cmd run release:dir
npm.cmd run release:test-models
```

Expected: the unpacked application launches its model smoke test successfully and reports the new executable name.

- [ ] **Step 4: Inspect the packaged resources**

Verify:

```powershell
Test-Path 'release/win-unpacked/felipe avinzano VoiceFlow.exe'
Test-Path 'release/win-unpacked/resources/native/win32-x64/FelipeAvinzano.VoiceFlow.PasteHelper.exe'
npx asar list 'release/win-unpacked/resources/app.asar' | Select-String 'brand-config.json|DMSerifDisplay-Regular.ttf'
```

Expected: both `Test-Path` commands print `True`, and ASAR lists both required resources.

- [ ] **Step 5: Perform manual UI acceptance**

Launch `release/win-unpacked/felipe avinzano VoiceFlow.exe --allow-test-instance`. Confirm:

- titlebar, sidebar, About, guide demos and overlay show the complete name;
- only `Flow` uses DM Serif Display 400 and copper `#B66D45`;
- tray, native dialogs and taskbar show the plain-text complete name;
- an existing legacy fixture retains history, dictionary, preferences and model files;
- relaunch does not repeat or overwrite migration;
- diagnostics report migration status without transcription content.

- [ ] **Step 6: Run the full Windows installer build and verification**

Run:

```powershell
npm.cmd run release:win
npm.cmd run release:verify
```

Expected: the installer is `felipe-avinzanovoiceflow-Setup-1.1.1-x64.exe`, release verification succeeds, and the SHA-256 sidecar uses the same basename.

- [ ] **Step 7: Review the final diff and commit only verified corrections**

Run:

```powershell
git status --short
git diff --check
git diff --stat
```

If verification required corrections, stage only those named files and commit:

```powershell
git commit -m "test: complete VoiceFlow rebrand acceptance"
```

If there are no corrections, do not create an empty commit. Confirm the user's unrelated pre-existing changes and `.superpowers/` visual-companion files remain uncommitted.
