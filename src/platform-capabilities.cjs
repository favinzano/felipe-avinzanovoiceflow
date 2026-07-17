'use strict';

const SUPPORTED_PLATFORMS = new Set(['win32', 'darwin', 'linux']);

function resolvePlatformCapabilities(platform = process.platform, isPackaged = false) {
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    return {
      platform,
      autoStart: false,
      inferenceDevices: ['cpu'],
      shortcutModes: ['toggle']
    };
  }

  return {
    platform,
    autoStart: Boolean(isPackaged),
    inferenceDevices: platform === 'win32' ? ['cpu', 'dml'] : ['cpu'],
    shortcutModes: platform === 'win32' ? ['toggle', 'hold'] : ['toggle']
  };
}

function normalizePlatformSettings(settings, capabilities) {
  const normalized = { ...settings };
  if (!capabilities.inferenceDevices.includes(normalized.inferenceDevice)) normalized.inferenceDevice = 'cpu';
  if (!capabilities.shortcutModes.includes(normalized.shortcutMode)) normalized.shortcutMode = 'toggle';
  if (!capabilities.autoStart) normalized.autoStartEnabled = false;
  return normalized;
}

module.exports = { normalizePlatformSettings, resolvePlatformCapabilities };
