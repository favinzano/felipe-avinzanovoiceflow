'use strict';

// Shared between the main process (input-helper.cjs, paste-permission-notice.cjs) and the
// renderer bundle, so it stays dependency-free: no Node-only APIs, safe for esbuild's
// browser build.
const PASTE_FAILURE_REASON = Object.freeze({
  NO_CAPTURE_TARGET: 'no-capture-target',
  HELPER_ERROR: 'helper-error',
  PERMISSION_DENIED: 'permission-denied',
  AUTOMATION_UNAVAILABLE: 'automation-unavailable',
  UNKNOWN: 'unknown'
});

module.exports = { PASTE_FAILURE_REASON };
