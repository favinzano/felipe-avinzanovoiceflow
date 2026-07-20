const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const brand = require("./brand-config.cjs");
const packageJson = require("../package.json");
const main = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");
const inputHelper = fs.readFileSync(path.join(__dirname, "input-helper.cjs"), "utf8");
const preload = fs.readFileSync(path.join(__dirname, "preload.cjs"), "utf8");
const overlayPreload = fs.readFileSync(path.join(__dirname, "overlay-preload.cjs"), "utf8");
const renderer = fs.readFileSync(path.join(__dirname, "renderer.js"), "utf8");
const overlayRenderer = fs.readFileSync(path.join(__dirname, "..", "overlay.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const overlayHtml = fs.readFileSync(path.join(__dirname, "..", "overlay.html"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
const overlayStyles = fs.readFileSync(path.join(__dirname, "..", "overlay.css"), "utf8");
const projectRoot = path.join(__dirname, "..");
const helperProjectDirectory = path.join(projectRoot, "tools", "FelipeAvinzano.VoiceFlow.PasteHelper");
const helperProjectPath = path.join(helperProjectDirectory, "FelipeAvinzano.VoiceFlow.PasteHelper.csproj");
const legacyHelperProjectDirectory = path.join(projectRoot, "tools", "NextStepAI.PasteHelper");
const launcherPath = path.join(projectRoot, "Iniciar felipe avinzano VoiceFlow.bat");
const legacyLauncherPath = path.join(projectRoot, "Iniciar NextStepAI Voice.bat");

function assertRendererBrand(source, surface) {
  assert.doesNotMatch(source, /require\(["']\.\/brand-config(?:\.cjs|\.json)["']\)/, `${surface} remains compatible with Electron's sandboxed preload`);
  assert.match(source, /Object\.freeze\(\{[\s\S]*displayName:\s*readEncodedArgument\(["']--voiceflow-brand-display-name=["']\)[\s\S]*baseName:\s*readEncodedArgument\(["']--voiceflow-brand-base-name=["']\)[\s\S]*suffix:\s*readEncodedArgument\(["']--voiceflow-brand-suffix=["']\)[\s\S]*copper:\s*readEncodedArgument\(["']--voiceflow-brand-copper=["']\)[\s\S]*\}\)/, `${surface} reads renderer-safe brand fields from appended arguments`);
  assert.match(source, /brand:\s*rendererBrand/, `${surface} exposes rendererBrand`);
}

assert.match(main, /require\(["']\.\/brand-config\.cjs["']\)/, "main imports the canonical brand");
assert.match(main, /require\(["']\.\/brand-migration\.cjs["']\)/, "main imports brand migration");
assert.match(main, /require\(["']\.\/brand-session-path\.cjs["']\)/, "main imports deterministic session selection");
assert.match(main, /app\.setName\(brand\.displayName\)/, "native app name uses brand.displayName");
assert.match(main, /app\.setAppUserModelId\(brand\.appId\)/, "Windows identity uses brand.appId");
assert.match(main, /shell\.openExternal\(brand\.issueUrl\)/, "support opens the canonical issue URL");
assert.doesNotMatch(main, /com\.nextstepai\.voice/i, "legacy app ID is inactive");
assert.match(main, /const migrationPromise\s*=\s*isolatedPaths\s*\?\s*Promise\.resolve/, "all isolated test modes bypass migration before readiness");
assert.match(main, /:\s*hasSingleInstanceLock\s*\?\s*migrateBrandData\(/, "the normal owning instance starts migration before readiness");
assert.match(main, /app\.whenReady\(\)\.then\(async \(\) => \{\s*brandMigration\s*=\s*await migrationPromise;/, "migration is the first readiness bootstrap step");
assert.match(main, /app\.whenReady\(\)[\s\S]*\}\)\.catch\(\(\) => \{[\s\S]*app\.exit\(1\)/, "unexpected bootstrap rejection is handled");
assert.match(main, /app\.on\(["']second-instance["'],[\s\S]*if \(!bootstrapComplete\)[\s\S]*pendingShowMainWindow\s*=\s*true/, "a second instance cannot create a window before migration bootstrap");
assert.match(main, /activeUserDataPath/, "one explicit active data path is retained");
assert.doesNotMatch(main, /app\.getPath\(["']userData["']\)/, "state consumers do not bypass activeUserDataPath");
assert.match(main, /const fsSync\s*=\s*require\(["']node:fs["']\)/, "hold-mode helper has a synchronous filesystem binding");
assert.match(main, /fsSync\.existsSync\(helper\)/, "hold-mode helper existence check uses the bound filesystem");
assert.match(main, /app\.setPath\(["']userData["'],\s*targetUserDataPath\)/, "single-instance identity always uses target userData");
assert.match(main, /app\.setPath\(["']sessionData["'],\s*initialSessionDataPath\)/, "Chromium receives isolated or normal pre-ready sessionData");
assert.equal((main.match(/app\.setPath\(["'](?:userData|sessionData)["']/g) || []).length, 2, "Electron data paths are never rebound after startup");
assert.ok(main.indexOf('app.setPath("userData", targetUserDataPath)') < main.indexOf("app.requestSingleInstanceLock()"), "stable userData identity is set before the singleton lock");
assert.match(main, /tray\.setToolTip\(brand\.displayName\)/, "tray tooltip uses the display name");
assert.match(main, /title:\s*brand\.displayName/, "native window title uses the display name");
assert.match(main, /`\$\{brand\.slug\}-History-\$\{new Date\(\)\.toISOString\(\)\.slice\(0, 10\)\}\.json`/, "history export uses the branded slug");
assert.match(inputHelper, /["']native["'],\s*["']win32-x64["'],\s*helperExecutableName/, "native helper path shape is resolved in the input-helper module");
assert.match(main, /helperExecutableName:\s*brand\.helperExecutable/, "native helper path is wired to the brand contract");
assert.match(main, /brandMigration:\s*safeBrandMigrationDiagnostics\(\)/, "diagnostics expose a sanitized migration summary");
assert.match(main, /const preserveLegacyStorage\s*=\s*!isolatedPaths\s*&&\s*Boolean\(/, "only a real first legacy transition preserves Chromium storage");
assert.match(main, /additionalArguments:\s*\[[\s\S]{0,180}`--voiceflow-preserve-legacy-storage=\$\{preserveLegacyStorage\s*\?\s*['"]1['"]\s*:\s*['"]0['"]\}`[\s\S]{0,30}\]/, "main window passes the transition flag through an appended renderer argument");
assert.match(main, /function rendererBrandArguments\(\)/, "main creates sandbox-safe brand arguments");
assert.ok((main.match(/rendererBrandArguments\(\)/g) || []).length >= 4, "main, overlay, and bridge self-test windows receive sandbox-safe brand arguments");
assert.match(preload, /filter\(\(value\) => value\.startsWith\(["']--voiceflow-preserve-legacy-storage=["']\)\)\.at\(-1\)/, "main preload uses the final appended transition argument");
assert.match(preload, /preserveLegacyStorage:\s*preserveLegacyStorageArgument\s*===\s*["']--voiceflow-preserve-legacy-storage=1["']/, "main preload exposes the narrow transition boolean");
assert.doesNotMatch(overlayPreload, /preserveLegacyStorage/, "overlay preload remains outside the migration storage contract");
assert.match(renderer, /clearMigratedLegacyStorage\(localStorage,\s*voiceAPI\.runtime\.preserveLegacyStorage\)/, "renderer delegates rollback-safe cleanup to the tested helper");
assert.doesNotMatch(renderer, /localStorage\.removeItem\(["']voice-(?:settings|history|dictionary|microphone)["']\)/, "renderer never removes migration keys directly");

const elementBindingsBlock = renderer.match(/const elements = \{([\s\S]*?)\n\};/);
assert.ok(elementBindingsBlock, "main renderer declares its DOM element bindings");
const elementBindings = new Map(
  [...elementBindingsBlock[1].matchAll(/^\s*([A-Za-z]\w*):\s*\$\(["']#([^"']+)["']\)/gm)]
    .map((match) => [match[1], match[2]])
);
const referencedElementKeys = [...new Set([...renderer.matchAll(/\belements\.([A-Za-z]\w*)/g)].map((match) => match[1]))].sort();
assert.deepEqual(
  referencedElementKeys.filter((key) => !elementBindings.has(key)),
  [],
  "every main-renderer elements.* reference has a declared DOM binding"
);
for (const [key, id] of elementBindings) {
  assert.match(indexHtml, new RegExp(`id=["']${id}["']`), `${key} binds an element that exists in index.html`);
}

assertRendererBrand(preload, "main preload");
assertRendererBrand(overlayPreload, "overlay preload");

function assertVisualWordmark(html, className, surface) {
  const wordmark = new RegExp(`class=["']${className}["'][^>]*data-brand-label[^>]*>[\\s\\S]{0,320}?data-brand-base[^>]*>felipe avinzano Voice<[\\s\\S]{0,160}?class=["'][^"']*brand-flow[^"']*["'][^>]*data-brand-suffix[^>]*>Flow<`);
  assert.match(html, wordmark, `${surface} has its own labeled base and Flow suffix targets`);
}

function assertBrandCss(css, surface) {
  assert.match(css, /@font-face\s*\{[^}]*font-family:\s*["']?DM Serif Display["']?[^}]*font-weight:\s*400[^}]*\}/, `${surface} loads DM Serif Display at its native weight`);
  assert.match(css, /--copper:\s*#b87333/i, `${surface} defines the approved copper token`);
  assert.match(css, /\.brand-flow\s*\{[^}]*font-family:\s*["']DM Serif Display["']\s*,\s*serif[^}]*font-weight:\s*400[^}]*color:\s*var\(--copper\)[^}]*\}/, `${surface} styles only the Flow suffix in copper DM Serif`);
  const dmSerifName = String.raw`(?:["']DM\s+Serif\s+Display["']|DM\s+Serif\s+Display)`;
  const dmSerifDeclaration = new RegExp(
    String.raw`(?:^|;)\s*(?:font-family\s*:\s*[^;]*${dmSerifName}|font\s*:\s*[^;]*${dmSerifName})`,
    'i'
  );
  const dmSerifRules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((match) => dmSerifDeclaration.test(match[2]))
    .map((match) => match[1].trim());
  assert.equal(dmSerifRules.filter((selector) => selector === '.brand-flow').length, 1, `${surface} styles one Flow suffix with DM Serif Display`);
  assert.ok(dmSerifRules.every((selector) => selector === '@font-face' || selector === '.brand-flow' || selector === '.hero-emphasis'), `${surface} reserves DM Serif Display for the approved Flow and hero accents`);
}

assert.match(
  indexHtml,
  /class=["']wordmark["'][^>]*data-brand-label[^>]*aria-label=["']felipe avinzano VoiceFlow["'][^>]*>felipe avinzano</,
  "titlebar wordmark shows only the owner name, labeled with the full brand name"
);
assert.doesNotMatch(
  indexHtml,
  /class=["']wordmark["'][^>]*>[\s\S]{0,200}?data-brand-base/,
  "titlebar wordmark no longer renders the dynamic base/suffix split"
);
assert.match(
  indexHtml,
  /class=["']brand-lockup home-brand["'][^>]*aria-label=["']VoiceFlow["'][\s\S]{0,200}?<svg class=["']brand-symbol["'][\s\S]{0,800}?class=["']brand-wordmark__voice["']>Voice<[\s\S]{0,120}?class=["'][^"']*brand-flow[^"']*["'][^>]*data-brand-suffix[^>]*>Flow</,
  "homepage lockup reads only VoiceFlow (SVG isotype + sans Voice + dynamic serif Flow suffix), labeled VoiceFlow"
);
assert.doesNotMatch(
  indexHtml,
  /class=["']brand-lockup home-brand["'][\s\S]{0,400}?felipe avinzano/,
  "homepage lockup never reintroduces the felipe avinzano fallback"
);
assertVisualWordmark(indexHtml, "footer-wordmark", "sidebar footer wordmark");
assert.match(indexHtml, /class=["']footer-wordmark["'][^>]*data-brand-label-suffix-template=["'], versión \{version\}["']/, "footer wordmark composes its accessible label suffix from the runtime version, not a hardcoded one");
assert.match(indexHtml, /class=["']footer-wordmark["'][^>]*>[\s\S]{0,320}?data-app-version><\/span>/, "footer wordmark renders the runtime version instead of a hardcoded one");
assertVisualWordmark(indexHtml, "about-wordmark", "about wordmark");
assert.match(indexHtml, /<dt>Versión<\/dt><dd data-app-version><\/dd>/, "about panel renders the runtime version instead of a hardcoded one");
assert.doesNotMatch(indexHtml, /\b1\.1\.\d+\b/, "index.html never hardcodes a version number that will drift from package.json");
assert.match(overlayHtml, /class=["']brand-lockup overlay-brand["'][^>]*aria-label=["']VoiceFlow["'][\s\S]{0,200}?<svg class=["']brand-symbol["'][\s\S]{0,800}?class=["']brand-wordmark__voice["']>Voice<[\s\S]{0,120}?class=["'][^"']*brand-flow[^"']*["'][^>]*data-brand-suffix[^>]*>Flow</, "overlay lockup reads only VoiceFlow (SVG isotype + sans Voice + dynamic serif Flow suffix), labeled VoiceFlow");
assert.doesNotMatch(overlayHtml, /data-brand-base[^>]*>felipe avinzano/, "overlay lockup no longer renders the felipe avinzano base");
assert.match(indexHtml, /<title>felipe avinzano VoiceFlow<\/title>/, "main HTML has a complete fallback title");
assert.match(overlayHtml, /<title>felipe avinzano VoiceFlow<\/title>/, "overlay HTML has a complete fallback title");
assert.match(overlayHtml, /<canvas class=["']signal["'][^>]*id=["']signal["'][^>]*><\/canvas>/, "overlay HTML renders the live waveform canvas");
assert.doesNotMatch(overlayHtml, /<div class=["']signal["']/, "overlay HTML no longer renders the retired bar markup");
assert.doesNotMatch(overlayRenderer, /Math\.random/, "overlay waveform never substitutes random decorative motion for microphone levels");
assert.doesNotMatch(overlayRenderer, /navigator\.mediaDevices\.getUserMedia/, "overlay never opens its own microphone capture");
assert.match(overlayRenderer, /import\(["']\.\/src\/audio-visualizer\.js["']\)/, "overlay lazily loads the shared frequency-bar drawing module");
assert.match(overlayRenderer, /overlayAPI\.onAudioData\(/, "overlay renders frequency data forwarded from the main window over IPC");
assert.match(overlayRenderer, /state\.status === ["']recording["'][\s\S]{0,60}else[\s\S]{0,20}clearVisualizer/, "overlay clears its canvas whenever it is not actively recording");
assert.match(renderer, /onFrequencyData:\s*\(frequencyData\)\s*=>\s*voiceAPI\.sendAudioData\(frequencyData\)/, "main renderer forwards live frequency data to the overlay over IPC");
assert.doesNotMatch(indexHtml, /NextStepAI Voice/, "active main-window copy no longer uses the legacy product name");
assertBrandCss(styles, "main stylesheet");
assertBrandCss(overlayStyles, "overlay stylesheet");
assert.match(styles, /\.hero-emphasis\s*\{[^}]*font-family:\s*["']DM Serif Display["']\s*,\s*serif/, "approved hero accent retains DM Serif Display");

for (const [source, surface] of [[renderer, "main renderer"], [overlayRenderer, "overlay renderer"]]) {
  assert.match(source, /document\.title\s*=\s*brand\.displayName/, `${surface} applies the complete title`);
  assert.match(source, /querySelectorAll\(["']\[data-brand-base\]["']\)[\s\S]*brand\.baseName/, `${surface} applies the base name`);
  assert.match(source, /querySelectorAll\(["']\[data-brand-suffix\]["']\)[\s\S]*brand\.suffix/, `${surface} applies the suffix independently`);
  assert.match(source, /querySelectorAll\(["']\[data-brand-label\]["']\)[\s\S]*setAttribute\(["']aria-label["']/, `${surface} updates accessible labels`);
}

// The overlay bubble never displays a version, so its applyBrand keeps the
// simpler, single-argument, static-suffix contract.
assert.match(overlayRenderer, /function applyBrand\(brand\)/, "overlay renderer defines applyBrand");
assert.match(overlayRenderer, /getAttribute\(["']data-brand-label-suffix["']\)\s*\|\|\s*["']["'][\s\S]*`\$\{brand\.displayName\}\$\{labelSuffix\}`/, "overlay renderer composes optional accessible label suffixes");
assert.match(overlayRenderer, /^\s*applyBrand\(brand\);\s*$/m, "overlay renderer invokes applyBrand before interaction");

// The main renderer additionally renders the live app version everywhere the
// UI shows one, instead of a value baked into the HTML at release time (the
// root cause of the version display drifting from the actual running app).
assert.match(renderer, /function applyBrand\(brand,\s*appVersion\)/, "main renderer's applyBrand accepts the runtime app version");
assert.match(renderer, /querySelectorAll\(["']\[data-app-version\]["']\)[\s\S]*appVersion/, "main renderer applies the runtime version to every version placeholder");
assert.match(renderer, /getAttribute\(["']data-brand-label-suffix-template["']\)\s*\|\|\s*["']["'][\s\S]*replace\(["']\{version\}["'],\s*appVersion\)[\s\S]*`\$\{brand\.displayName\}\$\{labelSuffix\}`/, "main renderer composes accessible label suffixes from a version template, not a hardcoded string");
assert.match(renderer, /^\s*applyBrand\(brand,\s*voiceAPI\.appVersion\);\s*$/m, "main renderer invokes applyBrand with the runtime app version before interaction");
assert.match(renderer, /appVersion:\s*["'][^"']+["']/, "browser preview fallback exposes a placeholder app version");
assert.match(preload, /appVersion\s*=\s*readEncodedArgument\(["']--voiceflow-app-version=["']\)/, "main preload reads the runtime app version from an appended argument");
assert.match(preload, /appVersion,/, "main preload exposes appVersion to the renderer");
assert.doesNotMatch(overlayPreload, /appVersion/, "overlay preload remains outside the version display contract");
assert.match(main, /`--voiceflow-app-version=\$\{encodeURIComponent\(app\.getVersion\(\)\)\}`/, "main passes the real app.getVersion() through the same appended-argument channel the update dialog uses");
assert.match(renderer, /brand:\s*\{[\s\S]*displayName:\s*["']felipe avinzano VoiceFlow["'][\s\S]*baseName:\s*["']felipe avinzano Voice["'][\s\S]*suffix:\s*["']Flow["'][\s\S]*copper:\s*["']#B87333["']/, "browser preview exposes the approved brand fallback");
assert.doesNotMatch(renderer, /brandWordmarkMarkup/, "the retired guide's split-brand markup helper is not reintroduced");
assert.match(renderer, /`\$\{brand\.displayName\} diagnostics`/, "diagnostics use the complete runtime display name");
assert.doesNotMatch(renderer, /NextStepAI|nextstepai\.com/, "diagnostics copy no longer exposes the legacy brand");
assert.match(overlayRenderer, /const overlayFallbackAPI\s*=\s*Object\.freeze\(\{[\s\S]*brand:\s*Object\.freeze\(\{/, "overlay direct preview fallback and its brand are frozen");

{
  const elements = new Map();
  const makeElement = () => ({
    dataset: {},
    textContent: "",
    attributes: {},
    children: [],
    style: { setProperty() {} },
    appendChild(child) { this.children.push(child); },
    setAttribute(name, value) { this.attributes[name] = value; },
    getAttribute(name) { return this.attributes[name] ?? null; }
  });
  for (const id of ["overlay", "signal", "message", "timer"]) elements.set(`#${id}`, makeElement());
  const baseTarget = makeElement();
  const suffixTarget = makeElement();
  const labelTarget = makeElement();
  const suffixedLabelTarget = makeElement();
  suffixedLabelTarget.attributes["data-brand-label-suffix"] = ", versión 1.1.3";
  const document = {
    title: "",
    querySelector(selector) { return elements.get(selector); },
    querySelectorAll(selector) {
      return {
        "[data-brand-base]": [baseTarget],
        "[data-brand-suffix]": [suffixTarget],
        "[data-brand-label]": [labelTarget, suffixedLabelTarget]
      }[selector] || [];
    },
    createElement: makeElement
  };
  assert.doesNotThrow(() => vm.runInNewContext(overlayRenderer, { document, window: {}, Math }), "overlay direct preview executes without preload");
  assert.equal(document.title, brand.displayName, "overlay direct preview applies the title");
  assert.equal(baseTarget.textContent, brand.baseName, "overlay direct preview applies the base name");
  assert.equal(suffixTarget.textContent, brand.suffix, "overlay direct preview applies only the suffix");
  assert.equal(labelTarget.attributes["aria-label"], brand.displayName, "overlay direct preview applies the accessible label");
  assert.equal(suffixedLabelTarget.attributes["aria-label"], `${brand.displayName}, versión 1.1.3`, "runtime brand application preserves an accessible label suffix");
  assert.equal(elements.get("#signal").children.length, 0, "overlay renderer never appends child bars to the canvas element");
}

assert.equal(brand.displayName, "felipe avinzano VoiceFlow");
assert.deepEqual(packageJson.build.win.extraResources[0].filter, [brand.helperExecutable], "packaging includes exactly the canonical native helper");
assert.ok(!packageJson.build.win.extraResources[0].filter.includes("NextStepAI.PasteHelper.exe"), "packaging excludes the legacy native helper");

assert.ok(fs.existsSync(helperProjectPath), "the approved native helper project exists");
assert.ok(fs.existsSync(path.join(helperProjectDirectory, "Program.cs")), "the approved native helper source exists");
assert.ok(!fs.existsSync(legacyHelperProjectDirectory), "the legacy native helper project path is absent");
const helperProject = fs.readFileSync(helperProjectPath, "utf8");
assert.match(helperProject, /<AssemblyName>FelipeAvinzano\.VoiceFlow\.PasteHelper<\/AssemblyName>/, "the native helper assembly uses the approved identity");

assert.ok(fs.existsSync(launcherPath), "the approved local launcher exists");
assert.ok(!fs.existsSync(legacyLauncherPath), "the legacy local launcher path is absent");
const launcher = fs.readFileSync(launcherPath, "utf8");
assert.match(launcher, /title felipe avinzano VoiceFlow/, "the launcher title uses the approved display name");
assert.doesNotMatch(launcher, /NextStepAI Voice/, "the launcher messages do not use the legacy display name");

const buildNative = fs.readFileSync(path.join(projectRoot, "scripts", "build-native.ps1"), "utf8");
const compressNatives = fs.readFileSync(path.join(projectRoot, "scripts", "compress-natives.cjs"), "utf8");
for (const [source, surface] of [[buildNative, "native build script"], [compressNatives, "native compression script"]]) {
  assert.match(source, /FelipeAvinzano\.VoiceFlow\.PasteHelper\.exe|brand\.helperExecutable/, `${surface} selects the approved helper executable`);
  assert.doesNotMatch(source, /NextStepAI\.PasteHelper/, `${surface} has no active legacy helper reference`);
}
assert.match(buildNative, /tools\\FelipeAvinzano\.VoiceFlow\.PasteHelper\\FelipeAvinzano\.VoiceFlow\.PasteHelper\.csproj/, "native build script selects the approved project");

const gitignore = fs.readFileSync(path.join(projectRoot, ".gitignore"), "utf8");
assert.match(gitignore, /^tools\/\*\*\/bin\/$/m, "native project bin output is ignored");
assert.match(gitignore, /^tools\/\*\*\/obj\/$/m, "native project obj output is ignored");
console.log("brand surface tests passed");
