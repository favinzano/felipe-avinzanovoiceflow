'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const brand = require('../src/brand-config.cjs');
const packageJson = require('../package.json');
const { normalizeAsarPath, resolveReleasePaths } = require('./verify-release.cjs');
const { spawnSync } = require('node:child_process');

const packagedSmokePrefix = `${brand.slug}-packaged-model-smoke-`;
const listPackagedSmokeDirs = () => fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith(packagedSmokePrefix)).sort();
const smokeDirsBeforeImport = listPackagedSmokeDirs();
const { isPathContained, resolveProfiles } = require('./verify-packaged-models.cjs');
assert.deepEqual(listPackagedSmokeDirs(), smokeDirsBeforeImport, 'importing packaged model helpers must not allocate temp storage');
const lifecycleTest = spawnSync(process.execPath, [path.join(__dirname, 'verify-packaged-models-lifecycle.test.cjs')], { encoding: 'utf8' });
assert.equal(lifecycleTest.status, 0, lifecycleTest.stderr);

assert.equal(fs.readFileSync(path.join(root, 'package.json'), 'utf8')[0], '{', 'package.json must not contain a UTF-8 BOM');
assert.equal(normalizeAsarPath('\\src\\brand-config.json'), 'src/brand-config.json');
assert.equal(isPathContained('C:\\temp\\smoke', 'C:\\temp\\smoke\\userData\\models'), true);
assert.equal(isPathContained('C:\\temp\\smoke', 'C:\\AppData\\models'), false);
assert.deepEqual(resolveProfiles(['--profile=fast']), ['fast']);
assert.deepEqual(resolveProfiles([]), ['fast', 'accurate']);
assert.throws(() => resolveProfiles(['--profile=turbo']), /Unsupported packaged model profile/);

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
  const escapedPath = path.join(__dirname, name).replace(/'/g, "''");
  const parse = spawnSync('powershell', ['-NoProfile', '-Command', `$t=$null;$e=$null;[Management.Automation.Language.Parser]::ParseFile('${escapedPath}',[ref]$t,[ref]$e)|Out-Null;if($e.Count){$e|ForEach-Object{Write-Error $_};exit 1}`], { encoding: 'utf8' });
  assert.equal(parse.status, 0, `${name} PowerShell parse failed: ${parse.stderr}`);
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
assert.deepEqual(packageJson.build.extraResources[0].filter, [brand.helperExecutable]);

const workflow = fs.readFileSync(path.join(root, '.github/workflows/release.yml'), 'utf8');
assert.doesNotMatch(workflow, forbidden, 'release workflow contains a legacy product identifier');
assert.match(workflow, new RegExp(brand.slug, 'i'));
assert.match(workflow, new RegExp(brand.displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(workflow, new RegExp(brand.repository.slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

const historicalRelease = fs.readFileSync(path.join(__dirname, 'release-1.1.0.ps1'), 'utf8');
assert.doesNotMatch(historicalRelease, /git\s+reset\s+--hard/i);
assert.doesNotMatch(historicalRelease, /^\s*#\s*\$WorkingTree/m);
assert.doesNotMatch(historicalRelease, /Set-Content[^\r\n]+(?:PackagePath|ChangelogPath)/i);
assert.match(historicalRelease, /\[IO\.File\]::WriteAllText/);
assert.match(historicalRelease, /UTF8Encoding\]\s*::new\(\$false\)/);
for (const writeCall of historicalRelease.match(/\[IO\.File\]::WriteAllText\([^\r\n]+/g) || []) {
  assert.match(writeCall, /\[Text\.UTF8Encoding\]::new\(\$false\)\)/, 'every release file write must be BOM-free');
}
assert.ok(historicalRelease.indexOf('$WorkingTree = & git status --porcelain') < historicalRelease.indexOf('[IO.File]::WriteAllText($PackagePath, $PackageJson'));

const mainSource = fs.readFileSync(path.join(root, 'src/main.cjs'), 'utf8');
assert.match(mainSource, /resolveSelfTestPaths\(process\.argv\)/);
assert.match(mainSource, /const allowTestInstance = process\.argv\.includes\("--allow-test-instance"\) \|\| Boolean\(selfTestPaths\)/);
assert.match(mainSource, /app\.setPath\("userData", targetUserDataPath\)/);
assert.match(mainSource, /app\.setPath\("sessionData", selfTestPaths\?\.sessionData/);
assert.match(mainSource, /const migrationPromise = selfTestPaths/);

const signatureProbe = spawnSync('powershell', [
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'verify-signature.ps1'),
  '-ResolveOnly', '-ReleaseFlavor', 'AVX2',
], { cwd: root, encoding: 'utf8' });
assert.equal(signatureProbe.status, 0, signatureProbe.stderr);
const signaturePaths = JSON.parse(signatureProbe.stdout);
assert.equal(path.basename(signaturePaths.installer), brand.installerName(packageJson.version, 'AVX2'));
assert.equal(path.basename(signaturePaths.application), `${brand.displayName}.exe`);
assert.equal(path.basename(signaturePaths.helper), brand.helperExecutable);
const invalidSignatureProbe = spawnSync('powershell', [
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'verify-signature.ps1'),
  '-ResolveOnly', '-ReleaseFlavor', 'SSE2',
], { cwd: root, encoding: 'utf8' });
assert.notEqual(invalidSignatureProbe.status, 0);
assert.doesNotMatch(fs.readFileSync(path.join(__dirname, 'verify-signature.ps1'), 'utf8'), /Get-ChildItem/);

require('./generate-release-notes.test.cjs');
require('../src/self-test-paths.test.cjs');

console.log('Release brand paths and script derivation verified.');
