'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { auditRepository } = require('./verify-brand-references.cjs');

const legacyName = ['Next', 'Step', 'AI'].join('');
const mandatedHistoricalIdentityNote = '> Identidad anterior: NextStepAI Voice. Los nombres conservados en este documento corresponden a artefactos publicados antes del cambio a felipe avinzano VoiceFlow.';
const temporaryDirectoryPrefix = 'voiceflow-brand-audit-';
const temporaryRoots = [];

function listTemporaryRepositories() {
  return fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith(temporaryDirectoryPrefix)).sort();
}

const temporaryRepositoriesBefore = listTemporaryRepositories();

function createRepository(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), temporaryDirectoryPrefix));
  temporaryRoots.push(root);
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  execFileSync('git', ['config', 'core.autocrlf', 'false'], { cwd: root });
  for (const [relativePath, contents] of Object.entries(files)) {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents, 'utf8');
  }
  execFileSync('git', ['add', '.'], { cwd: root });
  return root;
}

try {
const validRoot = createRepository({
  'README.md': '# felipe avinzano VoiceFlow\n',
  'dist/renderer.js': `const retiredLabel = '${legacyName} Voice';\n`,
  'docs/superpowers/plans/rebrand.md': `${legacyName} Voice planning record\n`,
  'RELEASE_NOTES_1.0.0.md': `# ${legacyName} Voice 1.0.0\n\n${mandatedHistoricalIdentityNote}\n\n- Instalador objetivo: \`${legacyName}-Voice-Setup-1.0.0-x64.exe\`.\n`,
  'src/brand-config.json': `{\n  "legacyDataNames": [\n    "${legacyName} Voice",\n    "${legacyName} Voice Development"\n  ]\n}\n`,
});
assert.deepEqual(auditRepository(validRoot), [], 'approved history, migration data, and planning records pass');

fs.writeFileSync(path.join(validRoot, 'untracked.txt'), `${legacyName} Voice\n`, 'utf8');
assert.deepEqual(auditRepository(validRoot), [], 'untracked files are outside the audit');

const activeRoot = createRepository({ 'README.md': `# ${legacyName} Voice\n` });
assert.match(auditRepository(activeRoot)[0], /README\.md:1:/, 'active legacy copy reports path and line');

const generatedDirectoryRoot = createRepository({
  'tools/x/bin/generated.txt': `${legacyName} Voice generated output\n`,
  'tools/x/obj/generated.txt': `${legacyName} Voice generated output\n`,
  'tools/x/src/active.txt': `${legacyName} Voice active source\n`,
  'app/bin/README.md': `${legacyName} Voice active application content\n`,
  'src/obj/note.txt': `${legacyName} Voice active source content\n`,
});
assert.deepEqual(
  auditRepository(generatedDirectoryRoot),
  [
    `app/bin/README.md:1: ${legacyName} Voice active application content`,
    `src/obj/note.txt:1: ${legacyName} Voice active source content`,
    `tools/x/src/active.txt:1: ${legacyName} Voice active source`,
  ],
  'only known tool build roots are excluded',
);

const utf16Legacy = Buffer.concat([
  Buffer.from([0xff, 0xfe]),
  Buffer.from(`${legacyName} Voice in UTF-16LE\n`, 'utf16le'),
]);
const utf16Root = createRepository({ 'notes/utf16.txt': utf16Legacy });
assert.match(auditRepository(utf16Root)[0], /notes\/utf16\.txt:1:/, 'UTF-16LE text is decoded and audited');

const utf16BePayload = Buffer.from(`${legacyName} Voice in UTF-16BE\n`, 'utf16le');
for (let index = 0; index < utf16BePayload.length; index += 2) {
  [utf16BePayload[index], utf16BePayload[index + 1]] = [utf16BePayload[index + 1], utf16BePayload[index]];
}
const utf16BeRoot = createRepository({
  'notes/utf16be.txt': Buffer.concat([Buffer.from([0xfe, 0xff]), utf16BePayload]),
});
assert.match(auditRepository(utf16BeRoot)[0], /notes\/utf16be\.txt:1:/, 'UTF-16BE text is decoded and audited');

const malformedUtf16LeRoot = createRepository({
  'notes/malformed-le.txt': Buffer.from([0xff, 0xfe, 0x00, 0xd8]),
});
assert.match(auditRepository(malformedUtf16LeRoot)[0], /notes\/malformed-le\.txt:0: unauditable tracked text: invalid UTF-16LE/, 'lone UTF-16LE surrogate fails closed');

const malformedUtf16BeRoot = createRepository({
  'notes/malformed-be.txt': Buffer.from([0xfe, 0xff, 0xd8, 0x00]),
});
assert.match(auditRepository(malformedUtf16BeRoot)[0], /notes\/malformed-be\.txt:0: unauditable tracked text: invalid UTF-16BE/, 'lone UTF-16BE surrogate fails closed');

const nulRoot = createRepository({
  'notes/contains-nul.txt': Buffer.concat([Buffer.from(`${legacyName} Voice`, 'utf8'), Buffer.from([0])]),
});
assert.match(auditRepository(nulRoot)[0], /notes\/contains-nul\.txt:0: unauditable tracked text: NUL/, 'NUL-containing text fails closed');

const invalidUtf8Root = createRepository({ 'notes/invalid.txt': Buffer.from([0xc3, 0x28]) });
assert.match(auditRepository(invalidUtf8Root)[0], /notes\/invalid\.txt:0: unauditable tracked text: invalid UTF-8/, 'invalid UTF-8 fails closed');

const binaryRoot = createRepository({ 'assets/legacy.png': Buffer.from(`${legacyName} Voice\0`, 'utf8') });
assert.deepEqual(auditRepository(binaryRoot), [], 'known binary extensions are excluded before decoding');

const legacyPathRoot = createRepository({ [`Iniciar ${legacyName} Voice.bat`]: '@echo off\n' });
assert.match(auditRepository(legacyPathRoot)[0], /Iniciar .* Voice\.bat:0:/, 'legacy tracked filenames are rejected');

const missingNoteRoot = createRepository({
  'CHANGELOG.md': `# Historial\n\n- \`${legacyName}-Voice-Setup-1.0.0-x64.exe\`\n`,
});
assert.match(auditRepository(missingNoteRoot)[0], /missing the required historical identity note/, 'historical files require the identity note');

const appendedHistoricalRoot = createRepository({
  'RELEASE_NOTES_1.0.0.md': `# ${legacyName} Voice 1.0.0\n\n${mandatedHistoricalIdentityNote}\n\n${legacyName} Voice 1.0.0 es el primer lanzamiento para Windows x64 de nuestro; ${legacyName} Voice extra\n`,
});
assert.match(auditRepository(appendedHistoricalRoot)[0], /RELEASE_NOTES_1\.0\.0\.md:5:/, 'historical exceptions reject appended legacy prose');

const broadCompatibilityRoot = createRepository({
  'src/brand-config.json': `{\n  "legacyDataNames": [\n    "${legacyName} Voice",\n    "comment": "${legacyName} Voice"\n  ]\n}\n`,
});
assert.match(auditRepository(broadCompatibilityRoot)[0], /src\/brand-config\.json:4:/, 'compatibility exceptions are line-pattern based');

assert.match(
  auditRepository(validRoot, { listTrackedFiles: () => { throw new Error('git unavailable'); } })[0],
  /unable to enumerate tracked files: git unavailable/,
  'tracked-file enumeration failures fail closed',
);

const projectRoot = path.resolve(__dirname, '..');
const readme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
const currentVersion = require(path.join(projectRoot, 'package.json')).version;
assert.match(readme, new RegExp('La versión `' + currentVersion.replaceAll('.', '\\.') + '` es la versión actual para Windows x64\\.'), 'README identifies the current release');
assert.doesNotMatch(readme, /1\.0\.0` se prepara como primer release/, 'README has no stale upcoming 1.0 release copy');

const transitionGuide = fs.readFileSync(path.join(projectRoot, 'docs', 'UPDATE_AND_ROLLBACK.md'), 'utf8');
const legacyRepository = ['favinzano', `${legacyName.toLowerCase()}-voice`].join('/');
assert.match(transitionGuide, new RegExp('Renombrar el repositorio `' + legacyRepository + '` a `favinzano/felipe-avinzanovoiceflow`'), 'release gate documents the external repository rename');
assert.match(transitionGuide, /git remote set-url origin https:\/\/github\.com\/favinzano\/felipe-avinzanovoiceflow\.git/, 'release gate documents the local origin update');

} finally {
  for (const root of temporaryRoots) fs.rmSync(root, { recursive: true, force: true });
  assert.deepEqual(listTemporaryRepositories(), temporaryRepositoriesBefore, 'brand audit tests leave no temporary repositories');
}

console.log('Brand reference audit behavior verified.');
