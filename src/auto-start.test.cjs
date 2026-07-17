'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  configurePlatformAutoStart,
  escapeDesktopExecArgument,
  getPlatformAutoStartEnabled,
  linuxAutoStartPath,
  resolveAutoStartExecutablePath
} = require('./auto-start.cjs');

assert.equal(escapeDesktopExecArgument('/opt/Voice Flow/app'), '"/opt/Voice Flow/app"');
assert.equal(escapeDesktopExecArgument('/opt/"Voice"'), '"/opt/\\"Voice\\""');
assert.equal(resolveAutoStartExecutablePath({ platform: 'linux', executablePath: '/tmp/.mount/app', appImagePath: '/opt/Voice Flow.AppImage' }), path.resolve('/opt/Voice Flow.AppImage'));
assert.equal(resolveAutoStartExecutablePath({ platform: 'win32', executablePath: 'C:\\VoiceFlow.exe', appImagePath: undefined }), 'C:\\VoiceFlow.exe');

for (const platform of ['win32', 'darwin']) {
  let stored = false;
  let applied;
  let legacyCalls = 0;
  const common = {
    platform,
    isPackaged: true,
    displayName: 'VoiceFlow',
    executablePath: platform === 'win32' ? 'C:\\VoiceFlow\\VoiceFlow.exe' : '/Applications/VoiceFlow.app',
    appSetLoginItemSettings: (settings) => { applied = settings; stored = settings.openAtLogin; },
    appGetLoginItemSettings: () => ({ openAtLogin: stored }),
    disableLegacyItems: () => { legacyCalls += 1; }
  };
  assert.equal(configurePlatformAutoStart({ ...common, enabled: true }), true);
  assert.equal(applied.openAtLogin, true);
  assert.equal(getPlatformAutoStartEnabled(common), true);
  assert.equal(configurePlatformAutoStart({ ...common, enabled: false }), false);
  assert.equal(legacyCalls, platform === 'win32' ? 2 : 0);
}

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'voiceflow-autostart-'));
const linuxOptions = {
  platform: 'linux',
  isPackaged: true,
  enabled: true,
  displayName: 'felipe avinzano VoiceFlow',
  executablePath: '/opt/Voice Flow/voiceflow',
  configHome: directory,
  homePath: directory
};
assert.equal(configurePlatformAutoStart(linuxOptions), true);
const desktopPath = linuxAutoStartPath({ configHome: directory, homePath: directory, fileName: 'felipe-avinzanovoiceflow.desktop' });
const desktopEntry = fs.readFileSync(desktopPath, 'utf8');
assert.match(desktopEntry, /Type=Application/);
assert.match(desktopEntry, /Exec="\/opt\/Voice Flow\/voiceflow" --hidden/);
assert.equal(getPlatformAutoStartEnabled(linuxOptions), true);
assert.equal(configurePlatformAutoStart({ ...linuxOptions, enabled: false }), false);
assert.equal(fs.existsSync(desktopPath), false);
assert.equal(configurePlatformAutoStart({ ...linuxOptions, enabled: true, isPackaged: false }), false);
assert.equal(configurePlatformAutoStart({ ...linuxOptions, enabled: true, platform: 'freebsd' }), false);

fs.rmSync(directory, { recursive: true, force: true });
console.log('Auto-start: 24 checks passed.');
