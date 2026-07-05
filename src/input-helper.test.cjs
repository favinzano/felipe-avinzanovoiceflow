'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { resolveWin32HelperPath, createInputStrategy } = require('./input-helper.cjs');

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
    assert.equal(await strategy.paste(undefined), false);
    assert.equal(await strategy.paste({}), false);
    assert.equal(execFileImpl.calls.length, 0);
  }

  // win32 strategy: paste forwards handle/process/focus to the helper.
  {
    const execFileImpl = fakeExecFile(() => ({ stdout: JSON.stringify({ ok: true }) }));
    const strategy = createInputStrategy({ platform: 'win32', helperPath: 'C:\\helper.exe', execFileImpl });
    const result = await strategy.paste({ handle: 42, focusHandle: 7, processId: 99 });
    assert.equal(result, true);
    assert.deepEqual(execFileImpl.calls[0].args, ['paste', '--handle', '42', '--process', '99', '--focus', '7']);
  }

  // win32 strategy: paste omits --focus when no focusHandle was captured.
  {
    const execFileImpl = fakeExecFile(() => ({ stdout: JSON.stringify({ ok: true }) }));
    const strategy = createInputStrategy({ platform: 'win32', helperPath: 'C:\\helper.exe', execFileImpl });
    await strategy.paste({ handle: 42, processId: 99 });
    assert.deepEqual(execFileImpl.calls[0].args, ['paste', '--handle', '42', '--process', '99']);
  }

  // win32 strategy: a helper launch failure rejects the paste call.
  {
    const execFileImpl = fakeExecFile(() => ({ error: new Error('spawn failed'), stdout: '' }));
    const strategy = createInputStrategy({ platform: 'win32', helperPath: 'C:\\helper.exe', execFileImpl });
    await assert.rejects(() => strategy.paste({ handle: 1, processId: 2 }), /spawn failed/);
  }

  // darwin strategy: captureTarget is a no-op; paste presses Cmd+V via the native keyboard.
  {
    const calls = [];
    const loadNativeKeyboard = () => ({
      keyboard: {
        pressKey: (...keys) => { calls.push(['press', ...keys]); return Promise.resolve(); },
        releaseKey: (...keys) => { calls.push(['release', ...keys]); return Promise.resolve(); }
      },
      Key: { LeftCmd: 'LeftCmd', LeftControl: 'LeftControl', V: 'V' }
    });
    const strategy = createInputStrategy({ platform: 'darwin', loadNativeKeyboard });
    assert.equal(await strategy.captureTarget(), undefined);
    assert.equal(await strategy.paste(), true);
    assert.deepEqual(calls, [
      ['press', 'LeftCmd', 'V'],
      ['release', 'LeftCmd', 'V']
    ]);
  }

  // linux strategy: paste presses Ctrl+V via the native keyboard.
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
    assert.deepEqual(await strategy.paste(), true);
    assert.deepEqual(calls, [
      ['press', 'LeftControl', 'V'],
      ['release', 'LeftControl', 'V']
    ]);
  }

  // native keyboard strategy: a native automation failure propagates to the caller.
  {
    const loadNativeKeyboard = () => ({
      keyboard: {
        pressKey: () => Promise.reject(new Error('accessibility permission denied')),
        releaseKey: () => Promise.resolve()
      },
      Key: { LeftCmd: 'LeftCmd', V: 'V' }
    });
    const strategy = createInputStrategy({ platform: 'darwin', loadNativeKeyboard });
    await assert.rejects(() => strategy.paste(), /accessibility permission denied/);
  }

  // Unsupported platforms fail fast instead of silently doing nothing.
  assert.throws(() => createInputStrategy({ platform: 'freebsd' }), /Unsupported platform/);

  console.log('Input helper: 12 checks passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
