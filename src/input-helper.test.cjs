'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { PASTE_FAILURE_REASON, resolveWin32HelperPath, createInputStrategy } = require('./input-helper.cjs');

function fakeExecFile(responsesByArgs) {
  const calls = [];
  const impl = (helperPath, args, options, callback) => {
    calls.push({ helperPath, args, options });
    const response = responsesByArgs(args);
    callback(response.error || null, response.stdout || '');
  };
  impl.calls = calls;
  return impl;
}

async function run() {
  const packagedPath = resolveWin32HelperPath({
    isPackaged: true,
    resourcesPath: 'C:\\resources',
    appRoot: 'C:\\dev\\app',
    helperExecutableName: 'Helper.exe',
    pathApi: path.win32
  });
  assert.equal(packagedPath, path.win32.join('C:\\resources', 'native', 'win32-x64', 'Helper.exe'));

  const devPath = resolveWin32HelperPath({
    isPackaged: false,
    resourcesPath: 'C:\\resources',
    appRoot: 'C:\\dev\\app',
    helperExecutableName: 'Helper.exe',
    pathApi: path.win32
  });
  assert.equal(devPath, path.win32.join('C:\\dev\\app', 'native', 'win32-x64', 'Helper.exe'));

  // win32 strategy: capture reads the helper's JSON stdout.
  {
    const execFileImpl = fakeExecFile(() => ({
      stdout: JSON.stringify({ ok: true, handle: 42, focusHandle: 7, processId: 99 })
    }));
    const strategy = createInputStrategy({ platform: 'win32', helperPath: 'C:\\helper.exe', execFileImpl });
    const target = await strategy.captureTarget();
    assert.deepEqual(target, { handle: 42, focusHandle: 7, processId: 99 });
    assert.equal(execFileImpl.calls.length, 1);
    assert.deepEqual(execFileImpl.calls[0].args, ['capture']);
    assert.equal(execFileImpl.calls[0].helperPath, 'C:\\helper.exe');
  }

  // win32 strategy: capture rejects when the helper reports failure.
  {
    const execFileImpl = fakeExecFile(() => ({ stdout: JSON.stringify({ ok: false, error: 'boom' }) }));
    const strategy = createInputStrategy({ platform: 'win32', helperPath: 'C:\\helper.exe', execFileImpl });
    await assert.rejects(() => strategy.captureTarget(), /boom/);
  }

  // win32 strategy: paste without a captured handle is a no-op that reports failure.
  {
    const execFileImpl = fakeExecFile(() => { throw new Error('should not be called'); });
    const strategy = createInputStrategy({ platform: 'win32', helperPath: 'C:\\helper.exe', execFileImpl });
    assert.deepEqual(await strategy.paste(undefined), { ok: false, reason: PASTE_FAILURE_REASON.NO_CAPTURE_TARGET });
    assert.deepEqual(await strategy.paste({}), { ok: false, reason: PASTE_FAILURE_REASON.NO_CAPTURE_TARGET });
    assert.equal(execFileImpl.calls.length, 0);
  }

  // win32 strategy: paste forwards handle/process/focus to the helper.
  {
    const execFileImpl = fakeExecFile(() => ({ stdout: JSON.stringify({ ok: true }) }));
    const strategy = createInputStrategy({ platform: 'win32', helperPath: 'C:\\helper.exe', execFileImpl });
    const result = await strategy.paste({ handle: 42, focusHandle: 7, processId: 99 });
    assert.deepEqual(result, { ok: true });
    assert.deepEqual(execFileImpl.calls[0].args, ['paste', '--handle', '42', '--process', '99', '--focus', '7']);
  }

  // win32 strategy: paste omits --focus when no focusHandle was captured.
  {
    const execFileImpl = fakeExecFile(() => ({ stdout: JSON.stringify({ ok: true }) }));
    const strategy = createInputStrategy({ platform: 'win32', helperPath: 'C:\\helper.exe', execFileImpl });
    await strategy.paste({ handle: 42, processId: 99 });
    assert.deepEqual(execFileImpl.calls[0].args, ['paste', '--handle', '42', '--process', '99']);
  }

  // win32 strategy: a helper launch failure is reported as a helper-error reason, not a rejection.
  {
    const execFileImpl = fakeExecFile(() => ({ error: new Error('spawn failed'), stdout: '' }));
    const strategy = createInputStrategy({ platform: 'win32', helperPath: 'C:\\helper.exe', execFileImpl });
    const result = await strategy.paste({ handle: 1, processId: 2 });
    assert.deepEqual(result, { ok: false, reason: PASTE_FAILURE_REASON.HELPER_ERROR });
  }

  // darwin strategy: captureTarget is a no-op; paste presses Cmd+V via the native keyboard
  // once the (mocked) accessibility check reports the app is authorized.
  {
    const calls = [];
    const loadNativeKeyboard = () => ({
      keyboard: {
        pressKey: (...keys) => { calls.push(['press', ...keys]); return Promise.resolve(); },
        releaseKey: (...keys) => { calls.push(['release', ...keys]); return Promise.resolve(); }
      },
      Key: { LeftCmd: 'LeftCmd', LeftControl: 'LeftControl', V: 'V' }
    });
    const loadMacPermissions = () => ({ getAuthStatus: () => 'authorized' });
    const strategy = createInputStrategy({ platform: 'darwin', loadNativeKeyboard, loadMacPermissions });
    assert.equal(await strategy.captureTarget(), undefined);
    assert.deepEqual(await strategy.paste(), { ok: true });
    assert.deepEqual(calls, [
      ['press', 'LeftCmd', 'V'],
      ['release', 'LeftCmd', 'V']
    ]);
  }

  // linux strategy: paste presses Ctrl+V via the native keyboard (no accessibility gate on linux).
  {
    const calls = [];
    const loadNativeKeyboard = () => ({
      keyboard: {
        pressKey: (...keys) => { calls.push(['press', ...keys]); return Promise.resolve(); },
        releaseKey: (...keys) => { calls.push(['release', ...keys]); return Promise.resolve(); }
      },
      Key: { LeftCmd: 'LeftCmd', LeftControl: 'LeftControl', V: 'V' }
    });
    const strategy = createInputStrategy({ platform: 'linux', loadNativeKeyboard });
    assert.deepEqual(await strategy.paste(), { ok: true });
    assert.deepEqual(calls, [
      ['press', 'LeftControl', 'V'],
      ['release', 'LeftControl', 'V']
    ]);
  }

  // darwin strategy: when accessibility access has not been granted, paste reports
  // permission-denied WITHOUT ever attempting the keystroke (macOS drops synthetic
  // input silently rather than throwing, so we must not rely on a reactive catch here).
  {
    const loadNativeKeyboard = () => { throw new Error('should not be called'); };
    const loadMacPermissions = () => ({ getAuthStatus: () => 'denied' });
    const strategy = createInputStrategy({ platform: 'darwin', loadNativeKeyboard, loadMacPermissions });
    const result = await strategy.paste();
    assert.deepEqual(result, { ok: false, reason: PASTE_FAILURE_REASON.PERMISSION_DENIED });
  }

  // darwin strategy: if the accessibility check itself is unavailable (module missing,
  // unexpected shape, etc.), fall through and attempt the paste rather than blocking it.
  {
    const calls = [];
    const loadNativeKeyboard = () => ({
      keyboard: {
        pressKey: (...keys) => { calls.push(['press', ...keys]); return Promise.resolve(); },
        releaseKey: (...keys) => { calls.push(['release', ...keys]); return Promise.resolve(); }
      },
      Key: { LeftCmd: 'LeftCmd', V: 'V' }
    });
    const loadMacPermissions = () => { throw new Error('module not installed'); };
    const strategy = createInputStrategy({ platform: 'darwin', loadNativeKeyboard, loadMacPermissions });
    assert.deepEqual(await strategy.paste(), { ok: true });
    assert.equal(calls.length, 2);
  }

  // native keyboard strategy: an unexpected native automation failure on darwin (after
  // passing/skipping the accessibility gate) is reported as automation-unavailable, not
  // permission-denied, since darwin's permission signal is the proactive check above.
  {
    const loadNativeKeyboard = () => ({
      keyboard: {
        pressKey: () => Promise.reject(new Error('unexpected native failure')),
        releaseKey: () => Promise.resolve()
      },
      Key: { LeftCmd: 'LeftCmd', V: 'V' }
    });
    const loadMacPermissions = () => ({ getAuthStatus: () => 'authorized' });
    const strategy = createInputStrategy({ platform: 'darwin', loadNativeKeyboard, loadMacPermissions });
    const result = await strategy.paste();
    assert.deepEqual(result, { ok: false, reason: PASTE_FAILURE_REASON.AUTOMATION_UNAVAILABLE });
  }

  // linux strategy: a display/X11-flavored error is classified as permission-denied
  // (best-effort heuristic; libnut-linux has no proactive permission API to check instead).
  {
    const loadNativeKeyboard = () => ({
      keyboard: {
        pressKey: () => Promise.reject(new Error('Cannot open display: (null)')),
        releaseKey: () => Promise.resolve()
      },
      Key: { LeftControl: 'LeftControl', V: 'V' }
    });
    const strategy = createInputStrategy({ platform: 'linux', loadNativeKeyboard });
    const result = await strategy.paste();
    assert.deepEqual(result, { ok: false, reason: PASTE_FAILURE_REASON.PERMISSION_DENIED });
  }

  // linux strategy: generic permission/EACCES-flavored errors are also classified as
  // permission-denied, not just the display/X11 wording (e.g. a denied automation grant
  // under a hardened Wayland session shouldn't be lumped in with "no backend at all").
  {
    for (const message of ['Permission denied', 'access denied by security policy', 'operation not authorized', 'EACCES']) {
      const loadNativeKeyboard = () => ({
        keyboard: {
          pressKey: () => Promise.reject(new Error(message)),
          releaseKey: () => Promise.resolve()
        },
        Key: { LeftControl: 'LeftControl', V: 'V' }
      });
      const strategy = createInputStrategy({ platform: 'linux', loadNativeKeyboard });
      const result = await strategy.paste();
      assert.deepEqual(result, { ok: false, reason: PASTE_FAILURE_REASON.PERMISSION_DENIED });
    }
  }

  // linux strategy: any other native failure falls back to automation-unavailable.
  {
    const loadNativeKeyboard = () => ({
      keyboard: {
        pressKey: () => Promise.reject(new Error('libnut native call failed')),
        releaseKey: () => Promise.resolve()
      },
      Key: { LeftControl: 'LeftControl', V: 'V' }
    });
    const strategy = createInputStrategy({ platform: 'linux', loadNativeKeyboard });
    const result = await strategy.paste();
    assert.deepEqual(result, { ok: false, reason: PASTE_FAILURE_REASON.AUTOMATION_UNAVAILABLE });
  }

  // Unsupported platforms fail fast instead of silently doing nothing.
  assert.throws(() => createInputStrategy({ platform: 'freebsd' }), /Unsupported platform/);

  console.log('Input helper: 30 checks passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
