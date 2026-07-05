const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  DEFAULT_SHORTCUTS,
  getAutoStartEnabled,
  getCloseBehavior,
  getPastePermissionNoticeDismissed,
  getShortcutMode,
  getShortcuts,
  hasAutoStartPreference,
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

fs.rmSync(directory, { recursive: true, force: true });
console.log("App preferences: 28 checks passed.");
