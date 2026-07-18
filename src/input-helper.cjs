'use strict';

const path = require('node:path');
const { execFile, spawn } = require('node:child_process');
const { PASTE_FAILURE_REASON } = require('./paste-failure-reason.cjs');

function resolveWin32HelperPath({ isPackaged, resourcesPath, appRoot, helperExecutableName, pathApi = path }) {
  return isPackaged
    ? pathApi.join(resourcesPath, 'native', 'win32-x64', helperExecutableName)
    : pathApi.join(appRoot, 'native', 'win32-x64', helperExecutableName);
}

function runWin32Helper(helperPath, args, execFileImpl) {
  return new Promise((resolve, reject) => {
    execFileImpl(helperPath, args, { windowsHide: true }, (error, stdout) => {
      let result;
      try {
        result = JSON.parse((stdout || '').trim());
      } catch {
        result = { ok: false, error: error?.message || 'invalid_helper_response' };
      }
      if (error || !result.ok) reject(new Error(result.error || error?.message || 'invalid_helper_response'));
      else resolve(result);
    });
  });
}

function createPersistentWin32Client(helperPath, { spawnImpl = spawn, timeoutMs = 2000 } = {}) {
  let child;
  let stdoutBuffer = '';
  const pending = [];

  function rejectPending(error) {
    while (pending.length) {
      const request = pending.shift();
      clearTimeout(request.timeout);
      request.reject(error);
    }
  }

  function stop() {
    const running = child;
    child = undefined;
    stdoutBuffer = '';
    rejectPending(new Error('helper_stopped'));
    if (running && !running.killed) {
      running.stdin?.write(`${JSON.stringify({ command: 'quit' })}\n`);
      running.kill();
    }
  }

  function ensureChild() {
    if (child && !child.killed) return child;
    const started = spawnImpl(helperPath, ['serve'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    child = started;
    started.stdout.setEncoding('utf8');
    started.stdout.on('data', (data) => {
      stdoutBuffer += data;
      let newline;
      while ((newline = stdoutBuffer.indexOf('\n')) >= 0) {
        const line = stdoutBuffer.slice(0, newline).trim();
        stdoutBuffer = stdoutBuffer.slice(newline + 1);
        if (!line) continue;
        const request = pending.shift();
        if (!request) continue;
        clearTimeout(request.timeout);
        try {
          const result = JSON.parse(line);
          if (!result.ok) request.reject(new Error(result.error || 'invalid_helper_response'));
          else request.resolve(result);
        } catch (error) {
          request.reject(error);
        }
      }
    });
    const handleFailure = (error) => {
      if (child === started) child = undefined;
      rejectPending(error instanceof Error ? error : new Error('helper_exited'));
    };
    started.once('error', handleFailure);
    started.once('exit', (code) => handleFailure(new Error(`helper_exited_${code}`)));
    return started;
  }

  function request(command, args = []) {
    return new Promise((resolve, reject) => {
      let process;
      try {
        process = ensureChild();
      } catch (error) {
        reject(error);
        return;
      }
      const item = { resolve, reject };
      item.timeout = setTimeout(() => {
        const index = pending.indexOf(item);
        if (index >= 0) pending.splice(index, 1);
        if (child === process) {
          child = undefined;
          process.kill();
        }
        reject(new Error('helper_timeout'));
      }, timeoutMs);
      pending.push(item);
      process.stdin.write(`${JSON.stringify({ command, args })}\n`, (error) => {
        if (!error) return;
        const index = pending.indexOf(item);
        if (index >= 0) pending.splice(index, 1);
        clearTimeout(item.timeout);
        reject(error);
      });
    });
  }

  return {
    request,
    stop,
    warm() { ensureChild(); return true; },
    health: () => ({ running: Boolean(child && !child.killed), pending: pending.length })
  };
}

// Windows requires the target window to be foreground before SendInput will deliver
// synthetic keystrokes to it, so the helper captures a handle up front and restores
// focus to it at paste time. macOS/Linux input injection has no such restriction.
function createWin32Strategy({ helperPath, execFileImpl = execFile, spawnImpl }) {
  const persistentClient = spawnImpl || execFileImpl === execFile
    ? createPersistentWin32Client(helperPath, { spawnImpl: spawnImpl || spawn })
    : null;

  async function run(args) {
    if (persistentClient) {
      try {
        return await persistentClient.request(args[0], args.slice(1));
      } catch {
        // The one-shot helper remains a safe fallback while the persistent host
        // is restarted lazily by the next request.
      }
    }
    return runWin32Helper(helperPath, args, execFileImpl);
  }

  return {
    async captureTarget() {
      const result = await run(['capture']);
      return { handle: result.handle, focusHandle: result.focusHandle, processId: result.processId };
    },
    async paste(target) {
      if (!target?.handle) return { ok: false, reason: PASTE_FAILURE_REASON.NO_CAPTURE_TARGET };
      const args = ['paste', '--handle', String(target.handle), '--process', String(target.processId)];
      if (target.focusHandle) args.push('--focus', String(target.focusHandle));
      try {
        const result = await run(args);
        return Number.isFinite(result.focusMs) ? { ok: true, focusMs: result.focusMs } : { ok: true };
      } catch {
        return { ok: false, reason: PASTE_FAILURE_REASON.HELPER_ERROR };
      }
    },
    dispose() {
      persistentClient?.stop();
    },
    warm() {
      return persistentClient?.warm() || false;
    },
    health() {
      return persistentClient?.health() || { running: false, mode: 'one-shot' };
    }
  };
}

const NATIVE_MODIFIER_KEY_BY_PLATFORM = {
  darwin: 'LeftCmd',
  linux: 'LeftControl'
};

function loadNutJs() {
  return require('@nut-tree-fork/nut-js');
}

function loadMacAccessibilityPermissions() {
  return require('@nut-tree-fork/node-mac-permissions');
}

// macOS drops synthetic keystrokes silently instead of throwing when Accessibility
// access hasn't been granted, so a reactive try/catch alone can never detect this case
// (it would look identical to a successful paste). Checking the auth status up front
// lets us report the real cause instead of a false success. If the check itself can't
// run (module missing, unexpected shape, older/newer macOS, etc.) we assume authorized
// and fall through to attempting the paste, classified reactively like any other error.
function isMacAccessibilityAuthorized(loadPermissions) {
  try {
    return loadPermissions().getAuthStatus('accessibility') === 'authorized';
  } catch {
    return true;
  }
}

// Best-effort only: libnut-linux's native binding has no proactive permission API (its
// permissionCheck module is a verbatim copy of the darwin one, gated on process.platform
// === 'darwin', so it's a no-op on linux), and this hasn't been verified against a real
// X11/Wayland failure. Beyond the original display/x11 match, this also catches generic
// permission/EACCES wording (e.g. a denied automation grant under a hardened Wayland
// session) so those aren't lumped in with "no automation backend at all".
function classifyNativeAutomationError(error, platform) {
  if (platform === 'linux') {
    const message = String(error?.message || '').toLowerCase();
    if (/display|x11|xopendisplay|permission|access denied|not authorized|eacces/.test(message)) {
      return PASTE_FAILURE_REASON.PERMISSION_DENIED;
    }
  }
  return PASTE_FAILURE_REASON.AUTOMATION_UNAVAILABLE;
}

// darwin/linux have no cross-platform equivalent of restoring focus to a captured
// window handle, so these strategies rely on the OS keeping the last-focused app
// frontmost (the overlay window is created non-focusable for this reason) and
// simply replay the platform's paste shortcut once the clipboard has been written.
function createNativeKeyboardStrategy({ platform, loadNativeKeyboard = loadNutJs, loadMacPermissions = loadMacAccessibilityPermissions }) {
  const modifierKeyName = NATIVE_MODIFIER_KEY_BY_PLATFORM[platform];
  return {
    async captureTarget() {
      return undefined;
    },
    async paste() {
      if (platform === 'darwin' && !isMacAccessibilityAuthorized(loadMacPermissions)) {
        return { ok: false, reason: PASTE_FAILURE_REASON.PERMISSION_DENIED };
      }
      try {
        const { keyboard, Key } = loadNativeKeyboard();
        const modifier = Key[modifierKeyName];
        await keyboard.pressKey(modifier, Key.V);
        await keyboard.releaseKey(modifier, Key.V);
        return { ok: true };
      } catch (error) {
        return { ok: false, reason: classifyNativeAutomationError(error, platform) };
      }
    }
  };
}

function createInputStrategy({ platform = process.platform, helperPath, execFileImpl, spawnImpl, loadNativeKeyboard, loadMacPermissions } = {}) {
  if (platform === 'win32') return createWin32Strategy({ helperPath, execFileImpl, spawnImpl });
  if (platform === 'darwin' || platform === 'linux') {
    return createNativeKeyboardStrategy({ platform, loadNativeKeyboard, loadMacPermissions });
  }
  throw new Error(`Unsupported platform for input helper: ${platform}`);
}

module.exports = {
  PASTE_FAILURE_REASON,
  createPersistentWin32Client,
  resolveWin32HelperPath,
  createInputStrategy
};
