'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveSelfTestPaths } = require('./self-test-paths.cjs');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'voiceflow-self-test-'));
try {
  const result = resolveSelfTestPaths([
    '--self-test-model=fast',
    `--self-test-user-data=${root}`,
  ]);
  assert.equal(result.root, path.resolve(root));
  assert.equal(result.userData, path.join(path.resolve(root), 'userData'));
  assert.equal(result.sessionData, path.join(path.resolve(root), 'sessionData'));
  assert.ok(fs.statSync(result.userData).isDirectory());
  assert.ok(fs.statSync(result.sessionData).isDirectory());
  assert.throws(() => resolveSelfTestPaths([`--self-test-user-data=${root}`]), /only valid with a self-test/);
  assert.throws(() => resolveSelfTestPaths(['--self-test-model=fast', '--self-test-user-data=relative']), /absolute/);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log('Self-test path isolation tests passed.');
