'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const asar = require('@electron/asar');
const brand = require('../src/brand-config.cjs');

function resolveReleasePaths({ root, version, releaseFlavor }) {
  if (releaseFlavor && !['Legacy', 'AVX2'].includes(releaseFlavor)) {
    throw new Error(`Unsupported RELEASE_FLAVOR: ${releaseFlavor}`);
  }
  const releaseDir = path.join(root, 'release');
  const resourcesDir = path.join(releaseDir, 'win-unpacked', 'resources');
  return {
    releaseDir,
    installerPath: path.join(releaseDir, brand.installerName(version, releaseFlavor)),
    unpackedExe: path.join(releaseDir, 'win-unpacked', `${brand.displayName}.exe`),
    resourcesDir,
    appAsar: path.join(resourcesDir, 'app.asar'),
    pasteHelper: path.join(resourcesDir, 'native', 'win32-x64', brand.helperExecutable),
  };
}

function findFiles(directory, predicate) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? findFiles(entryPath, predicate) : predicate(entryPath) ? [entryPath] : [];
  });
}

function normalizeAsarPath(file) {
  return file.replace(/^[/\\]/, '').replace(/\\/g, '/');
}

function verifyRelease({ root = path.join(__dirname, '..'), releaseFlavor = process.env.RELEASE_FLAVOR } = {}) {
  const packageJson = require(path.join(root, 'package.json'));
  const paths = resolveReleasePaths({ root, version: packageJson.version, releaseFlavor });
  const installerName = path.basename(paths.installerPath);
  const unpackedModulesDir = path.join(paths.resourcesDir, 'app.asar.unpacked', 'node_modules');
  const onnxRuntimeX64Dir = path.join(unpackedModulesDir, 'onnxruntime-node', 'bin', 'napi-v3', 'win32', 'x64');
  const forbiddenOnnxRuntimeDirs = [
    path.join(unpackedModulesDir, 'onnxruntime-node', 'bin', 'napi-v3', 'darwin'),
    path.join(unpackedModulesDir, 'onnxruntime-node', 'bin', 'napi-v3', 'linux'),
    path.join(unpackedModulesDir, 'onnxruntime-node', 'bin', 'napi-v3', 'win32', 'arm64'),
  ];

  assert.ok(fs.existsSync(paths.installerPath), `Falta el instalador: ${installerName}`);
  assert.ok(fs.statSync(paths.installerPath).size > 10 * 1024 * 1024, 'El instalador parece incompleto.');
  assert.ok(fs.existsSync(paths.unpackedExe), `Falta el ejecutable desempaquetado: ${brand.displayName}.exe`);
  assert.ok(fs.existsSync(paths.appAsar), 'Falta app.asar.');
  assert.ok(fs.existsSync(paths.pasteHelper), `Falta el helper nativo: ${brand.helperExecutable}`);
  assert.ok(fs.statSync(paths.pasteHelper).size > 1024 * 1024, 'El helper nativo parece incompleto.');
  for (const file of ['DirectML.dll', 'onnxruntime.dll', 'onnxruntime_binding.node']) {
    assert.ok(fs.existsSync(path.join(onnxRuntimeX64Dir, file)), `Falta el binario ONNX Runtime x64 desempaquetado: ${file}`);
  }
  for (const directory of forbiddenOnnxRuntimeDirs) {
    assert.ok(!fs.existsSync(directory), `El release x64 contiene binarios innecesarios: ${directory}`);
  }

  const leakedModels = findFiles(paths.resourcesDir, (file) => /\.(?:onnx|onnx_data)$/i.test(file));
  const packagedFiles = asar.listPackage(paths.appAsar).map(normalizeAsarPath);
  for (const required of [
    'src/brand-config.cjs',
    'src/brand-config.json',
    'assets/fonts/DMSerifDisplay-Regular.ttf',
    'assets/fonts/Geist-Variable.woff2',
  ]) {
    assert.ok(packagedFiles.includes(required), `Falta el recurso empaquetado en app.asar: ${required}`);
  }
  const leakedAsarModels = packagedFiles.filter((file) => /\.(?:onnx|onnx_data)$/i.test(file));
  assert.deepEqual([...leakedModels, ...leakedAsarModels], [], 'El release contiene modelos ONNX de desarrollo.');
  const foreignAsarBinaries = packagedFiles.filter((file) => (
    /onnxruntime-node[\\/]bin[\\/]napi-v3[\\/](?:darwin|linux)[\\/]/i.test(file)
    || /onnxruntime-node[\\/]bin[\\/]napi-v3[\\/]win32[\\/]arm64[\\/]/i.test(file)
  ));
  assert.deepEqual(foreignAsarBinaries, [], 'El ASAR contiene binarios ONNX Runtime innecesarios.');

  const hash = crypto.createHash('sha256').update(fs.readFileSync(paths.installerPath)).digest('hex');
  fs.writeFileSync(`${paths.installerPath}.sha256`, `${hash}  ${installerName}\n`);
  console.log(`Release verified: ${installerName}`);
  console.log(`SHA-256: ${hash}`);
}

module.exports = { normalizeAsarPath, resolveReleasePaths, verifyRelease };

if (require.main === module) verifyRelease();
