'use strict';

const fs = require('node:fs');
const path = require('node:path');

function resolveSelfTestPaths(argv) {
  const option = argv.find((value) => value.startsWith('--self-test-user-data='));
  if (!option) return null;
  const selfTestMode = argv.some((value) => value.startsWith('--self-test-model='))
    || argv.includes('--self-test-audio-worklet');
  if (!selfTestMode) throw new Error('--self-test-user-data is only valid with a self-test mode');
  const requestedRoot = option.slice('--self-test-user-data='.length);
  if (!path.isAbsolute(requestedRoot)) throw new Error('--self-test-user-data must be an absolute path');
  const root = path.resolve(requestedRoot);
  if (root === path.parse(root).root) throw new Error('--self-test-user-data cannot use a filesystem root');
  fs.mkdirSync(root, { recursive: true });
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('--self-test-user-data must be a real directory');
  const userData = path.join(root, 'userData');
  const sessionData = path.join(root, 'sessionData');
  fs.mkdirSync(userData, { recursive: true });
  fs.mkdirSync(sessionData, { recursive: true });
  return { root, userData, sessionData };
}

module.exports = { resolveSelfTestPaths };
