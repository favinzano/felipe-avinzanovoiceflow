const fs = require("fs");
const path = require("path");

const CLOSE_BEHAVIORS = new Set(["ask", "tray", "exit"]);
const SHORTCUT_MODES = new Set(["toggle", "hold"]);
const CURRENT_TERMS_VERSION = "2026-07-17-beta-1";
const DEFAULT_SHORTCUTS = Object.freeze({
  record: "CommandOrControl+Shift+Space",
  reprocess: "CommandOrControl+Alt+Space"
});

function preferencesPath(userDataPath) {
  return path.join(userDataPath, "app-preferences.json");
}

function readPreferences(userDataPath) {
  try {
    return JSON.parse(fs.readFileSync(preferencesPath(userDataPath), "utf8"));
  } catch {
    return {};
  }
}

function writePreferences(userDataPath, preferences) {
  fs.mkdirSync(userDataPath, { recursive: true });
  fs.writeFileSync(preferencesPath(userDataPath), JSON.stringify(preferences, null, 2), "utf8");
}

function getCloseBehavior(userDataPath) {
  const behavior = readPreferences(userDataPath).closeBehavior;
  return CLOSE_BEHAVIORS.has(behavior) ? behavior : "tray";
}

function setCloseBehavior(userDataPath, behavior) {
  if (!CLOSE_BEHAVIORS.has(behavior)) throw new Error(`Unsupported close behavior: ${behavior}`);
  const preferences = readPreferences(userDataPath);
  preferences.closeBehavior = behavior;
  writePreferences(userDataPath, preferences);
  return behavior;
}

function hasAutoStartPreference(userDataPath) {
  return typeof readPreferences(userDataPath).autoStartEnabled === "boolean";
}

function getAutoStartEnabled(userDataPath) {
  const enabled = readPreferences(userDataPath).autoStartEnabled;
  return typeof enabled === "boolean" ? enabled : true;
}

function setAutoStartEnabled(userDataPath, enabled) {
  if (typeof enabled !== "boolean") throw new Error("Auto-start preference must be a boolean.");
  const preferences = readPreferences(userDataPath);
  preferences.autoStartEnabled = enabled;
  writePreferences(userDataPath, preferences);
  return enabled;
}

function getShortcuts(userDataPath) {
  const shortcuts = readPreferences(userDataPath).shortcuts;
  return {
    record: typeof shortcuts?.record === "string" ? shortcuts.record : DEFAULT_SHORTCUTS.record,
    reprocess: typeof shortcuts?.reprocess === "string" ? shortcuts.reprocess : DEFAULT_SHORTCUTS.reprocess
  };
}

function setShortcuts(userDataPath, shortcuts) {
  if (!shortcuts || typeof shortcuts.record !== "string" || typeof shortcuts.reprocess !== "string") {
    throw new Error("Both shortcut accelerators are required.");
  }
  if (shortcuts.record === shortcuts.reprocess) throw new Error("Shortcuts must be different.");
  const preferences = readPreferences(userDataPath);
  preferences.shortcuts = { record: shortcuts.record, reprocess: shortcuts.reprocess };
  writePreferences(userDataPath, preferences);
  return preferences.shortcuts;
}

function getPastePermissionNoticeDismissed(userDataPath) {
  return readPreferences(userDataPath).pastePermissionNoticeDismissed === true;
}

function setPastePermissionNoticeDismissed(userDataPath, dismissed) {
  if (typeof dismissed !== "boolean") throw new Error("Paste permission notice dismissed flag must be a boolean.");
  const preferences = readPreferences(userDataPath);
  preferences.pastePermissionNoticeDismissed = dismissed;
  writePreferences(userDataPath, preferences);
  return dismissed;
}

function getLegalAcceptance(userDataPath) {
  const acceptance = readPreferences(userDataPath).legalAcceptance;
  if (!acceptance || typeof acceptance !== "object") return null;
  if (typeof acceptance.termsVersion !== "string" || typeof acceptance.acceptedAt !== "string") return null;
  return {
    termsVersion: acceptance.termsVersion,
    acceptedAt: acceptance.acceptedAt
  };
}

function hasAcceptedCurrentTerms(userDataPath) {
  return getLegalAcceptance(userDataPath)?.termsVersion === CURRENT_TERMS_VERSION;
}

function acceptCurrentTerms(userDataPath, acceptedAt = new Date().toISOString()) {
  if (typeof acceptedAt !== "string" || !Number.isFinite(Date.parse(acceptedAt))) {
    throw new Error("A valid acceptance timestamp is required.");
  }
  const preferences = readPreferences(userDataPath);
  preferences.legalAcceptance = {
    termsVersion: CURRENT_TERMS_VERSION,
    acceptedAt
  };
  writePreferences(userDataPath, preferences);
  return preferences.legalAcceptance;
}

function getShortcutMode(userDataPath) {
  const mode = readPreferences(userDataPath).shortcutMode;
  return SHORTCUT_MODES.has(mode) ? mode : "toggle";
}

function setShortcutMode(userDataPath, mode) {
  if (!SHORTCUT_MODES.has(mode)) throw new Error(`Unsupported shortcut mode: ${mode}`);
  const preferences = readPreferences(userDataPath);
  preferences.shortcutMode = mode;
  writePreferences(userDataPath, preferences);
  return mode;
}

module.exports = {
  CURRENT_TERMS_VERSION,
  DEFAULT_SHORTCUTS,
  acceptCurrentTerms,
  getAutoStartEnabled,
  getCloseBehavior,
  getLegalAcceptance,
  getPastePermissionNoticeDismissed,
  getShortcutMode,
  getShortcuts,
  hasAutoStartPreference,
  hasAcceptedCurrentTerms,
  setAutoStartEnabled,
  setCloseBehavior,
  setPastePermissionNoticeDismissed,
  setShortcutMode,
  setShortcuts
};
