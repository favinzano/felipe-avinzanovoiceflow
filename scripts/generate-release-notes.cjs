'use strict';

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const brand = require('../src/brand-config.cjs');

function getGitLogs() {
  try {
    const lastTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
    const logOutput = execSync(`git log ${lastTag}..HEAD --oneline`, { encoding: 'utf8' });
    return logOutput.trim().split('\n').filter(Boolean);
  } catch {
    console.error('No se pudieron recuperar los commits de Git. Asegúrate de tener al menos un tag previo.');
    return [];
  }
}

function getNextVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    return `v${packageJson.version}`;
  } catch {
    return 'v1.1.1';
  }
}

function parseCommits(commits) {
  const categories = { added: [], optimized: [], fixed: [] };
  for (const commit of commits) {
    const lowerCommit = commit.toLowerCase();
    const cleanMessage = commit.replace(/^[a-f0-9]+\s+/, '').trim();
    if (lowerCommit.includes('feat') || lowerCommit.includes('add')) categories.added.push(`* ${cleanMessage}`);
    else if (lowerCommit.includes('perf') || lowerCommit.includes('refactor') || lowerCommit.includes('opt')) categories.optimized.push(`* ${cleanMessage}`);
    else categories.fixed.push(`* ${cleanMessage}`);
  }
  return categories;
}

function generateMarkdown() {
  const parsed = parseCommits(getGitLogs());
  const allNovedades = [...parsed.added, ...parsed.optimized, ...parsed.fixed];
  const novedadesMarkdown = allNovedades.length > 0
    ? allNovedades.join('\n')
    : '* Actualizaciones de estabilidad menores en el núcleo local.';
  const template = `# ${brand.displayName} ${getNextVersion()} - Maintenance Release

Esta actualización amplía la experiencia de dictado local en Windows con correcciones de estabilidad, optimizaciones internas y mejoras en el proceso de distribución.

## Novedades

${novedadesMarkdown}

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
  const outputPath = path.join(__dirname, '../release-notes-draft.md');
  fs.writeFileSync(outputPath, template, 'utf8');
  console.log(`Plantilla generada con éxito en: ${outputPath}`);
}

generateMarkdown();
