'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { notifyPastePermissionDenied } = require('./paste-permission-notice.cjs');
const { getPastePermissionNoticeDismissed } = require('./app-preferences.cjs');

function fakeDialog(response) {
  const calls = [];
  return {
    calls,
    showMessageBox: (options) => {
      calls.push(options);
      return Promise.resolve({ response });
    }
  };
}

function fakeShell() {
  const openedUrls = [];
  return {
    openedUrls,
    openExternal: (url) => {
      openedUrls.push(url);
      return Promise.resolve();
    }
  };
}

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'voiceflow-paste-notice-'));
}

async function run() {
  // darwin: first failure shows the dialog and offers to open Accessibility settings.
  {
    const directory = tmpDir();
    const dialogApi = fakeDialog(0); // "Abrir Ajustes"
    const shellApi = fakeShell();
    await notifyPastePermissionDenied({ platform: 'darwin', userDataPath: directory, dialogApi, shellApi });
    assert.equal(dialogApi.calls.length, 1);
    assert.deepEqual(dialogApi.calls[0].buttons, ['Abrir Ajustes', 'Ahora no']);
    assert.deepEqual(shellApi.openedUrls, ['x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility']);
    assert.equal(getPastePermissionNoticeDismissed(directory), true);
    fs.rmSync(directory, { recursive: true, force: true });
  }

  // darwin: choosing "Ahora no" still marks it dismissed, and never opens a URL.
  {
    const directory = tmpDir();
    const dialogApi = fakeDialog(1); // "Ahora no"
    const shellApi = fakeShell();
    await notifyPastePermissionDenied({ platform: 'darwin', userDataPath: directory, dialogApi, shellApi });
    assert.equal(dialogApi.calls.length, 1);
    assert.deepEqual(shellApi.openedUrls, []);
    assert.equal(getPastePermissionNoticeDismissed(directory), true);
    fs.rmSync(directory, { recursive: true, force: true });
  }

  // darwin: once dismissed, a later failure does not show the dialog again.
  {
    const directory = tmpDir();
    const dialogApi = fakeDialog(1);
    const shellApi = fakeShell();
    await notifyPastePermissionDenied({ platform: 'darwin', userDataPath: directory, dialogApi, shellApi });
    await notifyPastePermissionDenied({ platform: 'darwin', userDataPath: directory, dialogApi, shellApi });
    assert.equal(dialogApi.calls.length, 1);
    fs.rmSync(directory, { recursive: true, force: true });
  }

  // linux: informational-only dialog, no settings URL to open regardless of the button clicked.
  {
    const directory = tmpDir();
    const dialogApi = fakeDialog(0);
    const shellApi = fakeShell();
    await notifyPastePermissionDenied({ platform: 'linux', userDataPath: directory, dialogApi, shellApi });
    assert.equal(dialogApi.calls.length, 1);
    assert.deepEqual(dialogApi.calls[0].buttons, ['Entendido']);
    assert.deepEqual(shellApi.openedUrls, []);
    assert.equal(getPastePermissionNoticeDismissed(directory), true);
    fs.rmSync(directory, { recursive: true, force: true });
  }

  // A platform with no defined copy (e.g. win32, which never produces permission-denied
  // in practice) is a no-op rather than throwing.
  {
    const directory = tmpDir();
    const dialogApi = fakeDialog(0);
    const shellApi = fakeShell();
    await notifyPastePermissionDenied({ platform: 'win32', userDataPath: directory, dialogApi, shellApi });
    assert.equal(dialogApi.calls.length, 0);
    fs.rmSync(directory, { recursive: true, force: true });
  }

  console.log('Paste permission notice: 13 checks passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
