'use strict';

const path = require('node:path');
const { execFile } = require('node:child_process');

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

// Windows requires the target window to be foreground before SendInput will deliver
// synthetic keystrokes to it, so the helper captures a handle up front and restores
// focus to it at paste time. macOS/Linux input injection has no such restriction.
function createWin32Strategy({ helperPath, execFileImpl = execFile }) {
  return {
    async captureTarget() {
      const result = await runWin32Helper(helperPath, ['capture'], execFileImpl);
      return { handle: result.handle, focusHandle: result.focusHandle, processId: result.processId };
    },
    async paste(target) {
      if (!target?.handle) return false;
      const args = ['paste', '--handle', String(target.handle), '--process', String(target.processId)];
      if (target.focusHandle) args.push('--focus', String(target.focusHandle));
      await runWin32Helper(helperPath, args, execFileImpl);
      return true;
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

// darwin/linux have no cross-platform equivalent of restoring focus to a captured
// window handle, so these strategies rely on the OS keeping the last-focused app
// frontmost (the overlay window is created non-focusable for this reason) and
// simply replay the platform's paste shortcut once the clipboard has been written.
function createNativeKeyboardStrategy({ platform, loadNativeKeyboard = loadNutJs }) {
  const modifierKeyName = NATIVE_MODIFIER_KEY_BY_PLATFORM[platform];
  return {
    async captureTarget() {
      return undefined;
    },
    async paste() {
      const { keyboard, Key } = loadNativeKeyboard();
      const modifier = Key[modifierKeyName];
      await keyboard.pressKey(modifier, Key.V);
      await keyboard.releaseKey(modifier, Key.V);
      return true;
    }
  };
}

function createInputStrategy({ platform = process.platform, helperPath, execFileImpl, loadNativeKeyboard } = {}) {
  if (platform === 'win32') return createWin32Strategy({ helperPath, execFileImpl });
  if (platform === 'darwin' || platform === 'linux') return createNativeKeyboardStrategy({ platform, loadNativeKeyboard });
  throw new Error(`Unsupported platform for input helper: ${platform}`);
}

module.exports = {
  resolveWin32HelperPath,
  createInputStrategy
};
