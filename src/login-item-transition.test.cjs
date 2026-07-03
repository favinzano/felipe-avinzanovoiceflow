'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const brand = require('./brand-config.cjs');
const { disableLegacyLoginItems, resolveLegacyLoginItems } = require('./login-item-transition.cjs');

const exePath = path.win32.join('C:\\Users\\Test', 'AppData', 'Local', 'Programs', 'felipe avinzano VoiceFlow', 'felipe avinzano VoiceFlow.exe');
const localAppData = path.win32.join('C:\\Users\\Test', 'AppData', 'Local');
const legacyNames = brand.legacyDataNames;
const priorName = legacyNames[0];
const preliminaryName = legacyNames[1];
const candidates = resolveLegacyLoginItems({ exePath, localAppData, legacyNames, pathApi: path.win32 });
assert.deepEqual(candidates.map(({ name }) => name), [priorName, priorName, preliminaryName, preliminaryName]);
assert.deepEqual(candidates.map(({ candidatePath }) => candidatePath), [
  path.win32.join(path.win32.dirname(exePath), `${priorName}.exe`),
  path.win32.join(localAppData, 'Programs', priorName, `${priorName}.exe`),
  path.win32.join(path.win32.dirname(exePath), `${preliminaryName}.exe`),
  path.win32.join(localAppData, 'Programs', preliminaryName, `${preliminaryName}.exe`)
]);
assert.equal(candidates.some(({ name }) => name.endsWith('Development')), false);
const calls = [];
assert.equal(disableLegacyLoginItems({ isPackaged: true, platform: 'win32', isolated: false, exePath, localAppData, legacyNames, setter: (settings) => calls.push(settings), pathApi: path.win32 }), 4);
assert.deepEqual(calls, candidates.map(({ name, candidatePath }) => ({ name, path: candidatePath, args: ['--hidden'], openAtLogin: false })));
assert.equal(disableLegacyLoginItems({ isPackaged: true, platform: 'win32', isolated: true, setter: assert.fail }), 0);
assert.equal(disableLegacyLoginItems({ isPackaged: false, platform: 'win32', isolated: false, setter: assert.fail }), 0);
assert.equal(disableLegacyLoginItems({ isPackaged: true, platform: 'linux', isolated: false, setter: assert.fail }), 0);
console.log('Legacy login item transition tests passed.');
