'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const historicalIdentityNote = '> Identidad anterior: NextStepAI Voice. Los nombres conservados en este documento corresponden a artefactos publicados antes del cambio a felipe avinzano VoiceFlow.';

const excludedPaths = /^(?:dist\/|release\/|docs\/superpowers\/|scripts\/verify-brand-references\.cjs$)/;
const binaryExtensions = /\.(?:bmp|gif|ico|jpe?g|onnx|onnx_data|pdf|png|ttf|woff2?|zip)$/i;
const legacyReference = /next[\s._-]*step[\s._-]*ai/i;

const historicalAllowlist = {
  'RELEASE_NOTES_1.0.0.md': [
    /^# NextStepAI Voice 1\.0\.0$/,
    /^NextStepAI Voice 1\.0\.0 es el primer lanzamiento /,
    /^\| .+ \| Enfoque de NextStepAI Voice 1\.0\.0 \|$/,
    /^OpenWhispr ofrece .+\. NextStepAI Voice$/,
    /^- Instalador objetivo: `NextStepAI-Voice-Setup-1\.0\.0-x64\.exe`\.$/,
  ],
  'docs/CERTIFICATION_REPORT_1.0.0.md': [
    /^NextStepAI Voice `1\.0\.0` cumple /,
    /^- `NextStepAI-Voice-Setup-1\.0\.0-x64\.exe`$/,
  ],
  'CHANGELOG.md': [
    /^  `NextStepAI-Voice-Setup-1\.0\.0-x64\.exe`\.$/,
    /^- NextStepAI Voice mantiene una implementaci/,
  ],
  'THIRD_PARTY_NOTICES.md': [
    /^Aplicable a: NextStepAI Voice `1\.0\.0` para Windows x64$/,
    /^NextStepAI Voice incluye, utiliza o descarga componentes de terceros\. Cada$/,
    /^El helper autocontenido `NextStepAI\.PasteHelper\.exe` incluye componentes del$/,
    /^Para solicitar una copia de los textos de licencia incluidos con NextStepAI$/,
  ],
};

const compatibilityAllowlist = {
  'src/brand-config.json': [
    /^\s+"NextStepAI Voice",$/,
    /^\s+"NextStepAI Voice Development"[,]?$/,
  ],
  'src/brand-config.test.cjs': [
    /^\s+'NextStepAI Voice',$/,
    /^\s+'NextStepAI Voice Development'[,]?$/,
  ],
  'src/brand-session-path.test.cjs': [
    /^const legacyPath = path\.join\("app-data", "NextStepAI Voice"\);$/,
  ],
  'src/brand-surfaces.test.cjs': [
    /^const legacyHelperProjectDirectory = path\.join\(projectRoot, "tools", "NextStepAI\.PasteHelper"\);$/,
    /^const legacyLauncherPath = path\.join\(projectRoot, "Iniciar NextStepAI Voice\.bat"\);$/,
    /^assert\.doesNotMatch\(main, \/com\\\.nextstepai\\\.voice\/i, "legacy app ID is inactive"\);$/,
    /^assert\.doesNotMatch\(.+\/NextStepAI Voice\/.+legacy display name.+\);$/,
    /^assert\.doesNotMatch\(indexHtml, \/NextStepAI Voice\/, "active main-window copy no longer uses the legacy product name"\);$/,
    /^\s+assert\.doesNotMatch\(source, \/NextStepAI\\\.PasteHelper\/.+legacy helper reference.+\);$/,
    /^assert\.ok\(!packageJson.+"NextStepAI\.PasteHelper\.exe".+legacy native helper.+\);$/,
    /^assert\.doesNotMatch\(renderer, \/NextStepAI\|nextstepai\\\.com\/.+legacy brand.+\);$/,
  ],
  'scripts/release-brand.test.cjs': [
    /^const forbidden = \/NEXTSTEPAI\|NextStepAI Voice\|NextStepAI\\\.PasteHelper\|nextstepai-voice\|NextStepAI-Voice-Setup\/i;$/,
  ],
};

function normalizedTrackedFiles(root) {
  const output = execFileSync('git', ['ls-files', '-z'], { cwd: root });
  return output.toString('utf8').split('\0').filter(Boolean).map((entry) => entry.replace(/\\/g, '/'));
}

function isAllowedLine(relativePath, line) {
  if (historicalAllowlist[relativePath] && line === historicalIdentityNote) return true;
  const patterns = [...(historicalAllowlist[relativePath] || []), ...(compatibilityAllowlist[relativePath] || [])];
  return patterns.some((pattern) => pattern.test(line));
}

function auditRepository(root) {
  const violations = [];
  for (const relativePath of normalizedTrackedFiles(root)) {
    if (excludedPaths.test(relativePath) || binaryExtensions.test(relativePath)) continue;
    if (legacyReference.test(relativePath)) {
      violations.push(`${relativePath}:0: active legacy brand in tracked path`);
    }

    const absolutePath = path.join(root, ...relativePath.split('/'));
    const contents = fs.readFileSync(absolutePath);
    if (contents.includes(0)) continue;
    const text = contents.toString('utf8');
    if (historicalAllowlist[relativePath] && !text.split(/\r?\n/).slice(0, 8).includes(historicalIdentityNote)) {
      violations.push(`${relativePath}:1: missing the required historical identity note`);
    }
    text.split(/\r?\n/).forEach((line, index) => {
      if (legacyReference.test(line) && !isAllowedLine(relativePath, line)) {
        violations.push(`${relativePath}:${index + 1}: ${line.trim()}`);
      }
    });
  }
  return violations;
}

if (require.main === module) {
  const violations = auditRepository(path.resolve(__dirname, '..'));
  if (violations.length) {
    console.error(violations.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Brand references verified.');
  }
}

module.exports = { auditRepository, historicalIdentityNote };
