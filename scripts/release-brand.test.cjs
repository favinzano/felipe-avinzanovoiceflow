'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const brand = require('../src/brand-config.cjs');
const packageJson = require('../package.json');
const { normalizeAsarPath, resolveReleasePaths } = require('./verify-release.cjs');
const { isCanonicalModelCache } = require('./verify-packaged-models.cjs');

assert.equal(fs.readFileSync(path.join(root, 'package.json'), 'utf8')[0], '{', 'package.json must not contain a UTF-8 BOM');
assert.equal(normalizeAsarPath('\\src\\brand-config.json'), 'src/brand-config.json');
assert.equal(isCanonicalModelCache(path.join('C:\\AppData', brand.displayName, 'models')), true);
assert.equal(isCanonicalModelCache(path.join('C:\\AppData', 'Old Product', 'models')), false);

const standard = resolveReleasePaths({ root, version: packageJson.version });
assert.equal(path.basename(standard.installerPath), brand.installerName(packageJson.version));
assert.equal(path.basename(standard.unpackedExe), `${brand.displayName}.exe`);
assert.equal(path.basename(standard.pasteHelper), brand.helperExecutable);

const avx2 = resolveReleasePaths({ root, version: packageJson.version, releaseFlavor: 'AVX2' });
assert.equal(path.basename(avx2.installerPath), brand.installerName(packageJson.version, 'AVX2'));
assert.throws(
  () => resolveReleasePaths({ root, version: packageJson.version, releaseFlavor: 'SSE2' }),
  /Unsupported RELEASE_FLAVOR: SSE2/,
);

const nodeScripts = [
  'verify-release.cjs',
  'verify-packaged-models.cjs',
  'generate-release-notes.cjs',
];
for (const name of nodeScripts) {
  const source = fs.readFileSync(path.join(__dirname, name), 'utf8');
  assert.match(source, /require\(['"]\.\.\/src\/brand-config\.cjs['"]\)/, `${name} must load canonical brand config`);
}

const powershellScripts = [
  'release-signed.ps1',
  'verify-signature.ps1',
  'test-installer.ps1',
  'test-tray.ps1',
  'release-1.1.0.ps1',
];
for (const name of powershellScripts) {
  const source = fs.readFileSync(path.join(__dirname, name), 'utf8');
  assert.match(source, /brand-config\.json/, `${name} must load canonical brand config`);
  assert.match(source, /ConvertFrom-Json/, `${name} must parse canonical brand config`);
}

const activeScripts = fs.readdirSync(__dirname)
  .filter((name) => /\.(?:cjs|ps1)$/.test(name) && name !== 'release-brand.test.cjs');
const forbidden = /NEXTSTEPAI|NextStepAI Voice|NextStepAI\.PasteHelper|nextstepai-voice|NextStepAI-Voice-Setup/i;
for (const name of activeScripts) {
  const source = fs.readFileSync(path.join(__dirname, name), 'utf8');
  assert.doesNotMatch(source, forbidden, `${name} contains an active legacy product identifier`);
}

assert.equal(packageJson.build.win.artifactName, `${brand.slug}-Setup-\${version}-\${arch}.\${ext}`);
assert.equal(packageJson.build.publish[0].owner, brand.repository.owner);
assert.equal(packageJson.build.publish[0].repo, brand.repository.name);

console.log('Release brand paths and script derivation verified.');
