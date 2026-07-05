'use strict';

const fs = require('node:fs');
const path = require('node:path');

function createIsolatedPaths(option, optionName, mode) {
  const requestedRoot = option.slice(`${optionName}=`.length);
  if (!path.isAbsolute(requestedRoot)) throw new Error(`${optionName} must be an absolute path`);
  const root = path.resolve(requestedRoot);
  if (root === path.parse(root).root) throw new Error(`${optionName} cannot use a filesystem root`);
  fs.mkdirSync(root, { recursive: true });
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error(`${optionName} must be a real directory`);
  const userData = path.join(root, 'userData');
  const sessionData = path.join(root, 'sessionData');
  fs.mkdirSync(userData, { recursive: true });
  fs.mkdirSync(sessionData, { recursive: true });
  return { root, userData, sessionData, mode };
}

function resolveIsolatedAppPaths(argv) {
  const selfTestOption = argv.find((value) => value.startsWith('--self-test-user-data='));
  const qaOption = argv.find((value) => value.startsWith('--test-user-data='));
  if (selfTestOption && qaOption) throw new Error('--test-user-data and --self-test-user-data cannot be combined');
  if (qaOption) {
    if (!argv.includes('--allow-test-instance')) throw new Error('--test-user-data requires --allow-test-instance');
    return createIsolatedPaths(qaOption, '--test-user-data', 'qa');
  }
  if (!selfTestOption) return null;
  const selfTestMode = argv.some((value) => value.startsWith('--self-test-model='))
    || argv.includes('--self-test-audio-worklet')
    || argv.includes('--self-test-desktop-bridge')
    || argv.includes('--self-test-shortcuts');
  if (!selfTestMode) throw new Error('--self-test-user-data is only valid with a self-test mode');
  return createIsolatedPaths(selfTestOption, '--self-test-user-data', 'self-test');
}

function resolveSelfTestPaths(argv) {
  const paths = resolveIsolatedAppPaths(argv);
  return paths?.mode === 'self-test' ? paths : null;
}

module.exports = { resolveIsolatedAppPaths, resolveSelfTestPaths };
