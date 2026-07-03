'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { auditRepository, historicalIdentityNote } = require('./verify-brand-references.cjs');

const legacyName = ['Next', 'Step', 'AI'].join('');

function createRepository(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'voiceflow-brand-audit-'));
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

const validRoot = createRepository({
  'README.md': '# felipe avinzano VoiceFlow\n',
  'dist/renderer.js': `const retiredLabel = '${legacyName} Voice';\n`,
  'docs/superpowers/plans/rebrand.md': `${legacyName} Voice planning record\n`,
  'RELEASE_NOTES_1.0.0.md': `# ${legacyName} Voice 1.0.0\n\n${historicalIdentityNote}\n\n- Instalador objetivo: \`${legacyName}-Voice-Setup-1.0.0-x64.exe\`.\n`,
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
});
assert.deepEqual(
  auditRepository(generatedDirectoryRoot),
  [`tools/x/src/active.txt:1: ${legacyName} Voice active source`],
  'bin and obj path segments are excluded without excluding nearby source',
);

const legacyPathRoot = createRepository({ [`Iniciar ${legacyName} Voice.bat`]: '@echo off\n' });
assert.match(auditRepository(legacyPathRoot)[0], /Iniciar .* Voice\.bat:0:/, 'legacy tracked filenames are rejected');

const missingNoteRoot = createRepository({
  'CHANGELOG.md': `# Historial\n\n- \`${legacyName}-Voice-Setup-1.0.0-x64.exe\`\n`,
});
assert.match(auditRepository(missingNoteRoot)[0], /missing the required historical identity note/, 'historical files require the identity note');

const broadCompatibilityRoot = createRepository({
  'src/brand-config.json': `{\n  "legacyDataNames": [\n    "${legacyName} Voice",\n    "comment": "${legacyName} Voice"\n  ]\n}\n`,
});
assert.match(auditRepository(broadCompatibilityRoot)[0], /src\/brand-config\.json:4:/, 'compatibility exceptions are line-pattern based');

console.log('Brand reference audit behavior verified.');
