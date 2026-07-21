'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { TextDecoder } = require('node:util');

const historicalIdentityNote = '> Identidad anterior: NextStepAI Voice. Los nombres conservados en este documento corresponden a artefactos publicados antes del cambio a felipe avinzano VoiceFlow.';

const excludedPaths = /^(?:dist\/|release\/|docs\/superpowers\/|scripts\/verify-brand-references\.cjs$)/;
const generatedDirectorySegment = /^tools\/[^/]+\/(?:bin|obj)\//;
const binaryExtensions = /\.(?:bmp|flac|gif|ico|jpe?g|mp3|ogg|onnx|onnx_data|pdf|png|ttf|wav|woff2?|zip)$/i;
const legacyReference = /next[\s._-]*step[\s._-]*ai/i;

const historicalAllowlist = {
  'RELEASE_NOTES_1.0.0.md': [
    /^# NextStepAI Voice 1\.0\.0\s*$/,
    /^NextStepAI Voice 1\.0\.0 es el primer lanzamiento para Windows x64 de nuestro\s*$/,
    /^\| Área \| Enfoque de NextStepAI Voice 1\.0\.0 \|\s*$/,
    /^OpenWhispr ofrece un alcance más amplio y multiplataforma\. NextStepAI Voice\s*$/,
    /^- Instalador objetivo: `NextStepAI-Voice-Setup-1\.0\.0-x64\.exe`\.\s*$/,
  ],
  'docs/CERTIFICATION_REPORT_1.0.0.md': [
    /^NextStepAI Voice `1\.0\.0` cumple la validación técnica automatizable disponible en el entorno actual\. El release permanece como candidato, no como distribución pública estable, hasta resolver firma de código y pruebas humanas\/multiequipo\.\s*$/,
    /^- `NextStepAI-Voice-Setup-1\.0\.0-x64\.exe`\s*$/,
  ],
  'CHANGELOG.md': [
    /^  `NextStepAI-Voice-Setup-1\.0\.0-x64\.exe`\.\s*$/,
    /^- NextStepAI Voice mantiene una implementaciÃ³n independiente y especializada en\s*$/,
  ],
  'THIRD_PARTY_NOTICES.md': [
    /^Aplicable a: NextStepAI Voice `1\.0\.0` para Windows x64\s*$/,
    /^NextStepAI Voice incluye, utiliza o descarga componentes de terceros\. Cada\s*$/,
    /^El helper autocontenido `NextStepAI\.PasteHelper\.exe` incluye componentes del\s*$/,
    /^Para solicitar una copia de los textos de licencia incluidos con NextStepAI\s*$/,
  ],
};

const compatibilityAllowlist = {
  'docs/UPDATE_AND_ROLLBACK.md': [
    /^- \[ \] Renombrar el repositorio `favinzano\/nextstepai-voice` a `favinzano\/felipe-avinzanovoiceflow`\.\s*$/,
  ],
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
  'scripts/verify-brand-references.test.cjs': [
    /^const mandatedHistoricalIdentityNote = '> Identidad anterior: NextStepAI Voice\. Los nombres conservados en este documento corresponden a artefactos publicados antes del cambio a felipe avinzano VoiceFlow\.';\s*$/,
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

function decodeTrackedText(contents) {
  let text;
  if (contents[0] === 0xff && contents[1] === 0xfe) {
    try {
      text = new TextDecoder('utf-16le', { fatal: true }).decode(contents.subarray(2));
    } catch {
      return { error: 'invalid UTF-16LE' };
    }
  } else if (contents[0] === 0xfe && contents[1] === 0xff) {
    try {
      text = new TextDecoder('utf-16be', { fatal: true }).decode(contents.subarray(2));
    } catch {
      return { error: 'invalid UTF-16BE' };
    }
  } else {
    if (contents.includes(0)) return { error: 'NUL byte' };
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(contents);
    } catch {
      return { error: 'invalid UTF-8' };
    }
  }
  if (text.includes('\0')) return { error: 'NUL character' };
  return { text };
}

function auditRepository(root, { listTrackedFiles = normalizedTrackedFiles } = {}) {
  const violations = [];
  let trackedFiles;
  try {
    trackedFiles = listTrackedFiles(root);
  } catch (error) {
    return [`<repository>:0: unable to enumerate tracked files: ${error.message}`];
  }
  for (const relativePath of trackedFiles) {
    if (excludedPaths.test(relativePath) || generatedDirectorySegment.test(relativePath) || binaryExtensions.test(relativePath)) continue;
    if (legacyReference.test(relativePath)) {
      violations.push(`${relativePath}:0: active legacy brand in tracked path`);
    }

    const absolutePath = path.join(root, ...relativePath.split('/'));
    let contents;
    try {
      contents = fs.readFileSync(absolutePath);
    } catch (error) {
      violations.push(`${relativePath}:0: unauditable tracked text: ${error.message}`);
      continue;
    }
    const decoded = decodeTrackedText(contents);
    if (decoded.error) {
      violations.push(`${relativePath}:0: unauditable tracked text: ${decoded.error}`);
      continue;
    }
    const { text } = decoded;
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
