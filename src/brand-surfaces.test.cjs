const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const brand = require("./brand-config.cjs");
const main = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");
const preload = fs.readFileSync(path.join(__dirname, "preload.cjs"), "utf8");
const overlayPreload = fs.readFileSync(path.join(__dirname, "overlay-preload.cjs"), "utf8");

function assertRendererBrand(source, surface) {
  assert.match(source, /require\(["']\.\/brand-config\.cjs["']\)/, `${surface} imports the canonical brand`);
  assert.match(source, /Object\.freeze\(\{[\s\S]*displayName:\s*brand\.displayName[\s\S]*baseName:\s*brand\.baseName[\s\S]*suffix:\s*brand\.suffix[\s\S]*copper:\s*brand\.copper[\s\S]*\}\)/, `${surface} freezes renderer-safe brand fields`);
  assert.match(source, /brand:\s*rendererBrand/, `${surface} exposes rendererBrand`);
}

assert.match(main, /require\(["']\.\/brand-config\.cjs["']\)/, "main imports the canonical brand");
assert.match(main, /require\(["']\.\/brand-migration\.cjs["']\)/, "main imports brand migration");
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
assert.match(main, /tray\.setToolTip\(brand\.displayName\)/, "tray tooltip uses the display name");
assert.match(main, /title:\s*brand\.displayName/, "native window title uses the display name");
assert.match(main, /`\$\{brand\.slug\}-History-\$\{new Date\(\)\.toISOString\(\)\.slice\(0, 10\)\}\.json`/, "history export uses the branded slug");
assert.match(main, /["']native["'],\s*["']win32-x64["'],\s*brand\.helperExecutable/, "native helper path uses the brand contract");
assert.match(main, /brandMigration:\s*safeBrandMigrationDiagnostics\(\)/, "diagnostics expose a sanitized migration summary");

assertRendererBrand(preload, "main preload");
assertRendererBrand(overlayPreload, "overlay preload");

assert.equal(brand.displayName, "felipe avinzano VoiceFlow");
console.log("brand surface tests passed");
