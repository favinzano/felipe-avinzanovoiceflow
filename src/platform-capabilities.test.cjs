'use strict';

const assert = require('node:assert');
const { normalizePlatformSettings, resolvePlatformCapabilities } = require('./platform-capabilities.cjs');

const windows = resolvePlatformCapabilities('win32', true);
assert.deepEqual(windows.inferenceDevices, ['cpu', 'dml']);
assert.deepEqual(windows.shortcutModes, ['toggle', 'hold']);
assert.equal(windows.autoStart, true);

for (const platform of ['darwin', 'linux']) {
  const capabilities = resolvePlatformCapabilities(platform, true);
  assert.deepEqual(capabilities.inferenceDevices, ['cpu']);
  assert.deepEqual(capabilities.shortcutModes, ['toggle']);
  assert.equal(capabilities.autoStart, true);
  assert.deepEqual(
    normalizePlatformSettings({ inferenceDevice: 'dml', shortcutMode: 'hold', autoStartEnabled: true }, capabilities),
    { inferenceDevice: 'cpu', shortcutMode: 'toggle', autoStartEnabled: true }
  );
}

const development = resolvePlatformCapabilities('linux', false);
assert.equal(development.autoStart, false);
assert.equal(normalizePlatformSettings({ autoStartEnabled: true }, development).autoStartEnabled, false);

const unsupported = resolvePlatformCapabilities('freebsd', true);
assert.equal(unsupported.autoStart, false);
assert.deepEqual(unsupported.inferenceDevices, ['cpu']);

console.log('Platform capabilities: 16 checks passed.');
