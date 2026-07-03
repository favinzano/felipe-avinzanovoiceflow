'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const brand = require('../src/brand-config.cjs');

function validateTag(tag) {
  if (!/^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(tag)) throw new Error(`Invalid git tag: ${tag}`);
  return tag;
}

function escapeMarkdown(value) {
  return value
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/([\\`*_{}\[\]()#+.!|-])/g, '\\$1');
}

function categoryForSubject(subject) {
  const normalized = subject.toLowerCase();
  if (/^(?:feat|add)(?:\(.+?\))?[!:]/.test(normalized)) return 'added';
  if (/^(?:perf|refactor|opt)(?:\(.+?\))?[!:]/.test(normalized)) return 'optimized';
  return 'fixed';
}

function parseCommitLines(lines) {
  return lines.filter(Boolean).map((line) => {
    const separator = line.indexOf('\t');
    if (separator < 1) throw new Error(`Invalid git log record: ${line}`);
    const hash = line.slice(0, separator);
    const subject = line.slice(separator + 1).trim();
    if (!/^[a-f0-9]+$/i.test(hash) || !subject) throw new Error(`Invalid git log record: ${line}`);
    return { hash, subject, category: categoryForSubject(subject) };
  });
}

function getGitLogs() {
  const lastTag = validateTag(execFileSync('git', ['describe', '--tags', '--abbrev=0'], { encoding: 'utf8' }).trim());
  const output = execFileSync('git', ['log', `${lastTag}..HEAD`, '--format=%h%x09%s'], { encoding: 'utf8' });
  return parseCommitLines(output.trim().split(/\r?\n/));
}

function readVersion(packagePath) {
  const parsed = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  if (typeof parsed.version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(parsed.version)) {
    throw new Error('package.json must contain a valid package version');
  }
  return parsed.version;
}

function renderReleaseNotes({ version, commits }) {
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) throw new Error('Invalid release version');
  const items = commits.map(({ subject }) => `* ${escapeMarkdown(subject)}`);
  const novedades = items.length ? items.join('\n') : '* Actualizaciones de estabilidad menores en el núcleo local.';
  return `# ${brand.displayName} v${version} - Maintenance Release

Esta actualización amplía la experiencia de dictado local en Windows con correcciones de estabilidad, optimizaciones internas y mejoras en el proceso de distribución.

## Novedades

${novedades}

## Instaladores

* **Legacy x64:** recomendado para actualizaciones automáticas y máxima compatibilidad.
* **AVX2 x64:** descarga opcional para procesadores modernos compatibles con AVX2.

ONNX Runtime mantiene selección dinámica de optimizaciones compatibles durante la ejecución.

## Actualización desde v1.1.0

La actualización conserva la configuración, preferencias, historial local y modelos descargados. El canal automático utiliza el instalador Legacy x64 para evitar incompatibilidades de CPU.

## Privacidad

El audio y las transcripciones continúan procesándose localmente. ${brand.displayName} no requiere cuentas ni servicios externos de transcripción.

## Verificación

Cada instalador incluye archivos .sha256 y .blockmap. Los instaladores actuales no tienen firma Authenticode; Windows puede mostrar una advertencia de editor desconocido.

Repositorio: ${brand.repository.url}`;
}

function writeDraft(outputPath, contents, force) {
  fs.writeFileSync(outputPath, contents, { encoding: 'utf8', flag: force ? 'w' : 'wx' });
}

function main(argv = process.argv.slice(2)) {
  const unknown = argv.filter((arg) => arg !== '--force');
  if (unknown.length) throw new Error(`Unknown argument: ${unknown[0]}`);
  const packagePath = path.join(__dirname, '../package.json');
  const outputPath = path.join(__dirname, '../release-notes-draft.md');
  try {
    writeDraft(outputPath, renderReleaseNotes({ version: readVersion(packagePath), commits: getGitLogs() }), argv.includes('--force'));
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Release notes draft already exists: ${outputPath}. Re-run with --force to overwrite.`);
    throw error;
  }
  console.log(`Plantilla generada con éxito en: ${outputPath}`);
}

module.exports = { escapeMarkdown, getGitLogs, parseCommitLines, readVersion, renderReleaseNotes, validateTag, writeDraft };
if (require.main === module) main();
