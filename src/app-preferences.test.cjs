const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
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
} = require("./app-preferences.cjs");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "voiceflow-preferences-"));

assert.equal(getCloseBehavior(directory), "tray");
assert.equal(setCloseBehavior(directory, "tray"), "tray");
assert.equal(getCloseBehavior(directory), "tray");
assert.equal(setCloseBehavior(directory, "exit"), "exit");
assert.equal(getCloseBehavior(directory), "exit");
assert.throws(() => setCloseBehavior(directory, "invalid"));
assert.equal(hasAutoStartPreference(directory), false);
assert.equal(getAutoStartEnabled(directory), true);
assert.equal(setAutoStartEnabled(directory, false), false);
assert.equal(hasAutoStartPreference(directory), true);
assert.equal(getAutoStartEnabled(directory), false);
assert.equal(setAutoStartEnabled(directory, true), true);
assert.throws(() => setAutoStartEnabled(directory, "true"));
assert.deepEqual(getShortcuts(directory), DEFAULT_SHORTCUTS);
assert.deepEqual(
  setShortcuts(directory, { record: "CommandOrControl+Shift+D", reprocess: "CommandOrControl+Alt+D" }),
  { record: "CommandOrControl+Shift+D", reprocess: "CommandOrControl+Alt+D" }
);
assert.deepEqual(getShortcuts(directory), {
  record: "CommandOrControl+Shift+D",
  reprocess: "CommandOrControl+Alt+D"
});
assert.throws(() => setShortcuts(directory, { record: "CommandOrControl+D", reprocess: "CommandOrControl+D" }));
assert.throws(() => setShortcuts(directory, { record: "CommandOrControl+D" }));
assert.equal(getShortcutMode(directory), "toggle");
assert.equal(setShortcutMode(directory, "hold"), "hold");
assert.equal(getShortcutMode(directory), "hold");
assert.equal(setShortcutMode(directory, "toggle"), "toggle");
assert.throws(() => setShortcutMode(directory, "invalid"));
assert.equal(getPastePermissionNoticeDismissed(directory), false);
assert.equal(setPastePermissionNoticeDismissed(directory, true), true);
assert.equal(getPastePermissionNoticeDismissed(directory), true);
assert.equal(setPastePermissionNoticeDismissed(directory, false), false);
assert.equal(getPastePermissionNoticeDismissed(directory), false);
assert.throws(() => setPastePermissionNoticeDismissed(directory, "true"));
assert.equal(getLegalAcceptance(directory), null);
assert.equal(hasAcceptedCurrentTerms(directory), false);
const acceptedAt = "2026-07-17T12:00:00.000Z";
assert.deepEqual(acceptCurrentTerms(directory, acceptedAt), {
  termsVersion: CURRENT_TERMS_VERSION,
  acceptedAt
});
assert.deepEqual(getLegalAcceptance(directory), {
  termsVersion: CURRENT_TERMS_VERSION,
  acceptedAt
});
assert.equal(hasAcceptedCurrentTerms(directory), true);
const preferencesFile = path.join(directory, "app-preferences.json");
const stalePreferences = JSON.parse(fs.readFileSync(preferencesFile, "utf8"));
stalePreferences.legalAcceptance.termsVersion = "previous-material-version";
fs.writeFileSync(preferencesFile, JSON.stringify(stalePreferences), "utf8");
assert.equal(hasAcceptedCurrentTerms(directory), false);
assert.throws(() => acceptCurrentTerms(directory, "not-a-date"));

fs.rmSync(directory, { recursive: true, force: true });
console.log("App preferences: 35 checks passed.");
