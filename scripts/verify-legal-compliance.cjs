const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
let checks = 0;

function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
}

const requiredFiles = [
  "TERMS.md",
  "TERMS.en.md",
  "PRIVACY.md",
  "PRIVACY.en.md",
  "docs/GDPR_ASSESSMENT.md",
  "docs/AI_ACT_CLASSIFICATION.md",
  "docs/NETWORK_DATA_INVENTORY.md",
  "docs/MARKETING_CLAIMS_MATRIX.md",
  "docs/LEGAL_RELEASE_GATE.md",
  "docs/legal-release-approval.example.json",
  "scripts/verify-legal-release-gate.cjs"
];
for (const file of requiredFiles) check(fs.existsSync(path.join(root, file)), `Missing required legal file: ${file}`);

const termsVersion = "2026-07-17-beta-1";
for (const file of ["TERMS.md", "TERMS.en.md"]) {
  const content = read(file);
  check(content.includes(termsVersion), `${file} does not contain the current Terms version.`);
  check(/AAA|American Arbitration Association/.test(content), `${file} does not describe the consumer arbitration administrator.`);
  check(/30 (días|days)/.test(content), `${file} does not contain the 30-day process.`);
  check(/18 años|at least 18/.test(content), `${file} does not state the beta age requirement.`);
}

for (const file of ["PRIVACY.md", "PRIVACY.en.md"]) {
  const content = read(file);
  check(/Hugging Face/.test(content), `${file} must disclose Hugging Face.`);
  check(/GitHub/.test(content), `${file} must disclose GitHub.`);
  check(/memoria|memory/.test(content), `${file} must disclose temporary in-memory audio.`);
  check(/telemetría|telemetry/.test(content), `${file} must state the telemetry posture.`);
  check(/Eliminar mis datos personales locales|Delete my local personal data/.test(content), `${file} must document the erasure action.`);
}

const packageJson = JSON.parse(read("package.json"));
const packagedFiles = new Set(packageJson.build.files);
for (const file of ["TERMS.md", "TERMS.en.md", "PRIVACY.md", "PRIVACY.en.md", "docs/AI_ACT_CLASSIFICATION.md"]) {
  check(packagedFiles.has(file), `${file} is not included in packaged builds.`);
}
check(Boolean(packageJson.build.mac?.extendInfo?.NSMicrophoneUsageDescription), "macOS microphone usage description is missing.");
check(packageJson.scripts.test.includes("verify-legal-compliance.cjs"), "The legal compliance check is not part of npm test.");
check(packageJson.scripts["test:production"].includes("verify-legal-compliance.cjs"), "The legal compliance check is not part of production tests.");
check(packageJson.scripts["release:legal-gate"] === "node scripts/verify-legal-release-gate.cjs", "The enforceable public-release gate is missing.");
check(read(".github/workflows/release.yml").includes("needs: legal-release-gate"), "The public release workflow does not depend on legal approval.");

const appPreferences = read("src/app-preferences.cjs");
check(appPreferences.includes(`CURRENT_TERMS_VERSION = "${termsVersion}"`), "The runtime Terms version does not match the documents.");
check(appPreferences.includes("termsVersion") && appPreferences.includes("acceptedAt"), "Versioned local acceptance fields are missing.");

const main = read("src/main.cjs");
check(main.includes('ipcMain.handle("legal:accept-current-terms"'), "The Terms acceptance IPC is missing.");
check(main.includes('ipcMain.handle("privacy:erase-local-personal-data"'), "The local erasure IPC is missing.");
check(main.includes("hasAcceptedCurrentTerms(activeUserDataPath)"), "The main-process legal gate is missing.");
check(/function activateAcceptedRuntime\(\)[\s\S]*?hasAcceptedCurrentTerms\(activeUserDataPath\)[\s\S]*?configureAutoUpdater\(\)[\s\S]*?warmTranscriberOnStartup\(\)/.test(main), "Network/model startup is not protected by the acceptance gate.");
check(/setPermissionRequestHandler[\s\S]*?permission === "media" && hasAcceptedCurrentTerms\(activeUserDataPath\)/.test(main), "Microphone permission is not protected by the acceptance gate.");

const html = read("index.html");
check(/id="acceptTermsCheckbox"(?![^>]*checked)/.test(html), "The Terms checkbox must not be preselected.");
check(/id="acceptTermsButton"[^>]*disabled/.test(html), "The acceptance action must start disabled.");
check(/Whisper de inteligencia artificial ejecutados en este equipo/.test(html), "The first-run AI disclosure is missing.");
check(/autorización exigida por la ley antes de grabar voces de terceros/.test(html), "The recording authorization notice is missing.");
check(/id="termsEnButton"/.test(html) && /id="privacyEnButton"/.test(html), "Permanent English legal-document access is missing.");

const directDependencies = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
  ...packageJson.optionalDependencies
};
const disallowedPatterns = [/google-analytics/i, /analytics-node/i, /facebook.*pixel/i, /meta.*pixel/i, /sentry/i, /segment/i, /mixpanel/i, /amplitude/i, /posthog/i, /crashlytics/i];
for (const dependency of Object.keys(directDependencies)) {
  check(!disallowedPatterns.some((pattern) => pattern.test(dependency)), `Unreviewed analytics/advertising/crash dependency: ${dependency}`);
}

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    if (!/\.(?:cjs|js|json)$/.test(entry.name) || /\.(?:test|smoke)\.cjs$/.test(entry.name)) return [];
    return [target];
  });
}
const approvedNetworkHosts = ["github.com", "githubusercontent.com", "huggingface.co", "hf.co", "xethub.hf.co"];
for (const file of sourceFiles(path.join(root, "src"))) {
  for (const match of fs.readFileSync(file, "utf8").matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
    const host = match[1].toLowerCase();
    check(approvedNetworkHosts.some((approved) => host === approved || host.endsWith(`.${approved}`)), `Uninventoried hard-coded network host ${host} in ${path.relative(root, file)}.`);
  }
}

const networkInventory = read("docs/NETWORK_DATA_INVENTORY.md");
check(networkInventory.includes("huggingface.co") && networkInventory.includes("api.github.com"), "The approved endpoint families are incomplete.");
check(networkInventory.includes("frase canaria"), "The network content-leak test is not documented.");

console.log(`Legal compliance guardrails: ${checks} checks passed.`);
