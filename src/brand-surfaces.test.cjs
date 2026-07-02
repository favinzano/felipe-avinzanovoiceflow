const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const brand = require("./brand-config.cjs");
const main = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");
const preload = fs.readFileSync(path.join(__dirname, "preload.cjs"), "utf8");
const overlayPreload = fs.readFileSync(path.join(__dirname, "overlay-preload.cjs"), "utf8");
const renderer = fs.readFileSync(path.join(__dirname, "renderer.js"), "utf8");
const overlayRenderer = fs.readFileSync(path.join(__dirname, "..", "overlay.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const overlayHtml = fs.readFileSync(path.join(__dirname, "..", "overlay.html"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
const overlayStyles = fs.readFileSync(path.join(__dirname, "..", "overlay.css"), "utf8");

function assertRendererBrand(source, surface) {
  assert.match(source, /require\(["']\.\/brand-config\.cjs["']\)/, `${surface} imports the canonical brand`);
  assert.match(source, /Object\.freeze\(\{[\s\S]*displayName:\s*brand\.displayName[\s\S]*baseName:\s*brand\.baseName[\s\S]*suffix:\s*brand\.suffix[\s\S]*copper:\s*brand\.copper[\s\S]*\}\)/, `${surface} freezes renderer-safe brand fields`);
  assert.match(source, /brand:\s*rendererBrand/, `${surface} exposes rendererBrand`);
}

assert.match(main, /require\(["']\.\/brand-config\.cjs["']\)/, "main imports the canonical brand");
assert.match(main, /require\(["']\.\/brand-migration\.cjs["']\)/, "main imports brand migration");
assert.match(main, /require\(["']\.\/brand-session-path\.cjs["']\)/, "main imports deterministic session selection");
assert.match(main, /app\.setName\(brand\.displayName\)/, "native app name uses brand.displayName");
assert.match(main, /app\.setAppUserModelId\(brand\.appId\)/, "Windows identity uses brand.appId");
assert.match(main, /shell\.openExternal\(brand\.issueUrl\)/, "support opens the canonical issue URL");
assert.doesNotMatch(main, /com\.nextstepai\.voice/i, "legacy app ID is inactive");
assert.match(main, /const migrationPromise\s*=\s*hasSingleInstanceLock\s*\?\s*migrateBrandData\(/, "the owning instance starts migration before readiness");
assert.match(main, /app\.whenReady\(\)\.then\(async \(\) => \{\s*brandMigration\s*=\s*await migrationPromise;/, "migration is the first readiness bootstrap step");
assert.match(main, /app\.whenReady\(\)[\s\S]*\}\)\.catch\(\(\) => \{[\s\S]*app\.exit\(1\)/, "unexpected bootstrap rejection is handled");
assert.match(main, /app\.on\(["']second-instance["'],[\s\S]*if \(!bootstrapComplete\)[\s\S]*pendingShowMainWindow\s*=\s*true/, "a second instance cannot create a window before migration bootstrap");
assert.match(main, /activeUserDataPath/, "one explicit active data path is retained");
assert.doesNotMatch(main, /app\.getPath\(["']userData["']\)/, "state consumers do not bypass activeUserDataPath");
assert.match(main, /const fsSync\s*=\s*require\(["']node:fs["']\)/, "hold-mode helper has a synchronous filesystem binding");
assert.match(main, /fsSync\.existsSync\(helper\)/, "hold-mode helper existence check uses the bound filesystem");
assert.match(main, /app\.setPath\(["']userData["'],\s*targetUserDataPath\)/, "single-instance identity always uses target userData");
assert.match(main, /app\.setPath\(["']sessionData["'],\s*initialSessionDataPath\)/, "Chromium receives the selected pre-ready sessionData path");
assert.equal((main.match(/app\.setPath\(["'](?:userData|sessionData)["']/g) || []).length, 2, "Electron data paths are never rebound after startup");
assert.ok(main.indexOf('app.setPath("userData", targetUserDataPath)') < main.indexOf("app.requestSingleInstanceLock()"), "stable userData identity is set before the singleton lock");
assert.match(main, /tray\.setToolTip\(brand\.displayName\)/, "tray tooltip uses the display name");
assert.match(main, /title:\s*brand\.displayName/, "native window title uses the display name");
assert.match(main, /`\$\{brand\.slug\}-History-\$\{new Date\(\)\.toISOString\(\)\.slice\(0, 10\)\}\.json`/, "history export uses the branded slug");
assert.match(main, /["']native["'],\s*["']win32-x64["'],\s*brand\.helperExecutable/, "native helper path uses the brand contract");
assert.match(main, /brandMigration:\s*safeBrandMigrationDiagnostics\(\)/, "diagnostics expose a sanitized migration summary");

assertRendererBrand(preload, "main preload");
assertRendererBrand(overlayPreload, "overlay preload");

function assertVisualWordmark(html, surface, minimumCount = 1) {
  const bases = html.match(/data-brand-base(?:\s|>)/g) || [];
  const suffixes = html.match(/data-brand-suffix(?:\s|>)/g) || [];
  assert.ok(bases.length >= minimumCount, `${surface} has semantic brand base targets`);
  assert.equal(suffixes.length, bases.length, `${surface} has one suffix target per base target`);
  assert.match(html, /data-brand-base[^>]*>felipe avinzano Voice<\/span>\s*<span[^>]*class=["'][^"']*brand-flow[^"']*["'][^>]*data-brand-suffix[^>]*>Flow<\/span>/, `${surface} keeps only Flow in a distinct adjacent target`);
}

function assertBrandCss(css, surface) {
  assert.match(css, /@font-face\s*\{[^}]*font-family:\s*["']?DM Serif Display["']?[^}]*font-weight:\s*400[^}]*\}/, `${surface} loads DM Serif Display at its native weight`);
  assert.match(css, /--copper:\s*#b66d45/i, `${surface} defines the approved copper token`);
  assert.match(css, /\.brand-flow\s*\{[^}]*font-family:\s*["']DM Serif Display["']\s*,\s*serif[^}]*font-weight:\s*400[^}]*color:\s*var\(--copper\)[^}]*\}/, `${surface} styles only the Flow suffix in copper DM Serif`);
}

assertVisualWordmark(indexHtml, "main HTML", 4);
assertVisualWordmark(overlayHtml, "overlay HTML");
assert.match(indexHtml, /<title>felipe avinzano VoiceFlow<\/title>/, "main HTML has a complete fallback title");
assert.match(overlayHtml, /<title>felipe avinzano VoiceFlow<\/title>/, "overlay HTML has a complete fallback title");
assert.doesNotMatch(indexHtml, /NextStepAI Voice/, "active main-window copy no longer uses the legacy product name");
assertBrandCss(styles, "main stylesheet");
assertBrandCss(overlayStyles, "overlay stylesheet");
assert.match(styles, /\.demo-overlay div\s*>\s*span\s*\{/, "guide overlay limits status-dot styling to the direct child");

for (const [source, surface] of [[renderer, "main renderer"], [overlayRenderer, "overlay renderer"]]) {
  assert.match(source, /function applyBrand\(brand\)/, `${surface} defines applyBrand`);
  assert.match(source, /document\.title\s*=\s*brand\.displayName/, `${surface} applies the complete title`);
  assert.match(source, /querySelectorAll\(["']\[data-brand-base\]["']\)[\s\S]*brand\.baseName/, `${surface} applies the base name`);
  assert.match(source, /querySelectorAll\(["']\[data-brand-suffix\]["']\)[\s\S]*brand\.suffix/, `${surface} applies the suffix independently`);
  assert.match(source, /applyBrand\(brand\)/, `${surface} applies preload brand before interaction`);
}
assert.match(renderer, /brand:\s*\{[\s\S]*displayName:\s*["']felipe avinzano VoiceFlow["'][\s\S]*baseName:\s*["']felipe avinzano Voice["'][\s\S]*suffix:\s*["']Flow["'][\s\S]*copper:\s*["']#B66D45["']/, "browser preview exposes the approved brand fallback");
assert.match(renderer, /brandWordmarkMarkup\(\)/, "dynamic guide wordmarks use the split brand helper");
assert.match(renderer, /`\$\{brand\.displayName\} diagnostics`/, "diagnostics use the complete runtime display name");
assert.doesNotMatch(renderer, /NextStepAI|nextstepai\.com/, "dynamic guide and diagnostics copy no longer exposes the legacy brand");

assert.equal(brand.displayName, "felipe avinzano VoiceFlow");
console.log("brand surface tests passed");
