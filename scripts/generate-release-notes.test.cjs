'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const brand = require('../src/brand-config.cjs');
const {
  escapeMarkdown,
  parseCommitLines,
  readVersion,
  renderReleaseNotes,
  validateTag,
  writeDraft,
} = require('./generate-release-notes.cjs');

assert.equal(validateTag('v1.2.3'), 'v1.2.3');
assert.throws(() => validateTag('v1.2.3; calc.exe'), /Invalid git tag/);
assert.equal(escapeMarkdown('# <b>[x](y) *z*'), '\\# &lt;b&gt;\\[x\\]\\(y\\) \\*z\\*');
const parsed = parseCommitLines(['abcdef1\tfix: safe', '1234567\tdocs: # injected']);
assert.deepEqual(parsed.map((item) => item.subject), ['fix: safe', 'docs: # injected']);
assert.equal(parsed[1].category, 'fixed');

const notes = renderReleaseNotes({ version: '1.2.3', commits: parsed });
assert.match(notes, new RegExp(`^# ${brand.displayName} v1\\.2\\.3`, 'm'));
assert.match(notes, new RegExp(brand.repository.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.doesNotMatch(notes, /^# injected/m);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), `${brand.slug}-notes-test-`));
try {
  const packagePath = path.join(temp, 'package.json');
  fs.writeFileSync(packagePath, '{"version":"2.0.0"}');
  assert.equal(readVersion(packagePath), '2.0.0');
  fs.writeFileSync(packagePath, '{"name":"missing"}');
  assert.throws(() => readVersion(packagePath), /valid package version/);
  const draft = path.join(temp, 'draft.md');
  writeDraft(draft, 'one', false);
  assert.throws(() => writeDraft(draft, 'two', false), /already exists/);
  writeDraft(draft, 'two', true);
  assert.equal(fs.readFileSync(draft, 'utf8'), 'two');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('Release notes safety tests passed.');
