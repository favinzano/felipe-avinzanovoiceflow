'use strict';

const fs = require('node:fs');
const path = require('node:path');

function escapeDesktopExecArgument(value) {
  return `"${String(value).replace(/[\\"`$]/g, '\\$&')}"`;
}

function linuxAutoStartPath({ configHome, homePath, fileName }) {
  const root = configHome || path.join(homePath, '.config');
  return path.join(root, 'autostart', fileName);
}

function resolveAutoStartExecutablePath({ platform, executablePath, appImagePath }) {
  if (platform === 'linux' && typeof appImagePath === 'string' && path.isAbsolute(appImagePath)) {
    return path.resolve(appImagePath);
  }
  return executablePath;
}

function linuxDesktopEntry({ displayName, executablePath }) {
  return [
    '[Desktop Entry]',
    'Type=Application',
    `Name=${displayName}`,
    `Exec=${escapeDesktopExecArgument(executablePath)} --hidden`,
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    ''
  ].join('\n');
}

function nativeLoginSettings(platform, { displayName, executablePath }) {
  if (platform === 'darwin') return { openAtLogin: true, openAsHidden: true };
  return { name: displayName, openAtLogin: true, path: executablePath, args: ['--hidden'] };
}

function getPlatformAutoStartEnabled({
  platform = process.platform,
  isPackaged,
  isolated = false,
  displayName,
  executablePath,
  appGetLoginItemSettings,
  configHome,
  homePath,
  linuxFileName = 'felipe-avinzanovoiceflow.desktop',
  fsApi = fs
}) {
  if (!isPackaged || isolated) return false;
  if (platform === 'win32' || platform === 'darwin') {
    const query = nativeLoginSettings(platform, { displayName, executablePath });
    query.openAtLogin = undefined;
    query.openAsHidden = undefined;
    return Boolean(appGetLoginItemSettings(query).openAtLogin);
  }
  if (platform === 'linux') {
    return fsApi.existsSync(linuxAutoStartPath({ configHome, homePath, fileName: linuxFileName }));
  }
  return false;
}

function configurePlatformAutoStart({
  platform = process.platform,
  enabled,
  isPackaged,
  isolated = false,
  displayName,
  executablePath,
  appSetLoginItemSettings,
  appGetLoginItemSettings,
  disableLegacyItems = () => {},
  configHome,
  homePath,
  linuxFileName = 'felipe-avinzanovoiceflow.desktop',
  fsApi = fs
}) {
  if (!isPackaged || isolated) return false;
  const shouldEnable = Boolean(enabled);

  if (platform === 'win32' || platform === 'darwin') {
    if (platform === 'win32') disableLegacyItems();
    const settings = nativeLoginSettings(platform, { displayName, executablePath });
    settings.openAtLogin = shouldEnable;
    if (platform === 'darwin') settings.openAsHidden = shouldEnable;
    appSetLoginItemSettings(settings);
    return getPlatformAutoStartEnabled({
      platform,
      isPackaged,
      displayName,
      executablePath,
      appGetLoginItemSettings
    });
  }

  if (platform === 'linux') {
    const target = linuxAutoStartPath({ configHome, homePath, fileName: linuxFileName });
    if (shouldEnable) {
      fsApi.mkdirSync(path.dirname(target), { recursive: true });
      fsApi.writeFileSync(target, linuxDesktopEntry({ displayName, executablePath }), { encoding: 'utf8', mode: 0o600 });
    } else {
      fsApi.rmSync(target, { force: true });
    }
    return fsApi.existsSync(target);
  }

  return false;
}

module.exports = {
  configurePlatformAutoStart,
  escapeDesktopExecArgument,
  getPlatformAutoStartEnabled,
  linuxAutoStartPath,
  linuxDesktopEntry,
  resolveAutoStartExecutablePath
};
