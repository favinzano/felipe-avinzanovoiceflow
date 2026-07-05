'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveIsolatedAppPaths, resolveSelfTestPaths } = require('./self-test-paths.cjs');

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
  assert.equal(result.mode, 'self-test');
  const bridge = resolveIsolatedAppPaths(['--self-test-desktop-bridge', `--self-test-user-data=${root}`]);
  assert.equal(bridge.mode, 'self-test');
  const shortcuts = resolveIsolatedAppPaths(['--self-test-shortcuts', `--self-test-user-data=${root}`]);
  assert.equal(shortcuts.mode, 'self-test');
  assert.throws(() => resolveSelfTestPaths([`--self-test-user-data=${root}`]), /only valid with a self-test/);
  assert.throws(() => resolveSelfTestPaths(['--self-test-model=fast', '--self-test-user-data=relative']), /absolute/);
  const qaRoot = path.join(root, 'qa');
  const qa = resolveIsolatedAppPaths(['--allow-test-instance', `--test-user-data=${qaRoot}`]);
  assert.equal(qa.mode, 'qa');
  assert.equal(qa.userData, path.join(path.resolve(qaRoot), 'userData'));
  assert.equal(qa.sessionData, path.join(path.resolve(qaRoot), 'sessionData'));
  assert.throws(() => resolveIsolatedAppPaths([`--test-user-data=${qaRoot}`]), /requires --allow-test-instance/);
  assert.throws(() => resolveIsolatedAppPaths(['--allow-test-instance', '--test-user-data=relative']), /absolute/);
  assert.throws(() => resolveIsolatedAppPaths(['--allow-test-instance', `--test-user-data=${qaRoot}`, '--self-test-model=fast', `--self-test-user-data=${root}`]), /cannot be combined/);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log('Self-test path isolation tests passed.');
