'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'voiceflow-acceptance-'));
const verifier = path.join(__dirname, 'verify-acceptance.cjs');
const makeCase = (platform, index) => ({
  id: `${platform}-${index}`,
  platform,
  operatingSystem: `${platform} test`,
  hardware: '16 GB',
  microphone: 'USB',
  accent: 'Español',
  environment: 'Silencioso',
  status: 'passed',
  wer: 0.08,
  pasteSuccess: true
});

const valid = { version: 2, cases: ['windows', 'macos', 'linux'].flatMap((platform) => [1, 2, 3, 4].map((index) => makeCase(platform, index))) };
const validPath = path.join(directory, 'valid.json');
fs.writeFileSync(validPath, JSON.stringify(valid), 'utf8');
const validResult = spawnSync(process.execPath, [verifier, validPath], { encoding: 'utf8' });
assert.equal(validResult.status, 0, validResult.stderr);

const windowsOnlyPath = path.join(directory, 'windows-only.json');
fs.writeFileSync(windowsOnlyPath, JSON.stringify({ version: 2, cases: Array.from({ length: 12 }, (_, index) => makeCase('windows', index)) }), 'utf8');
const windowsOnlyResult = spawnSync(process.execPath, [verifier, windowsOnlyPath], { encoding: 'utf8' });
assert.notEqual(windowsOnlyResult.status, 0);
assert.match(windowsOnlyResult.stderr, /macos/);

const failedPaste = structuredClone(valid);
failedPaste.cases[0].pasteSuccess = false;
const failedPastePath = path.join(directory, 'failed-paste.json');
fs.writeFileSync(failedPastePath, JSON.stringify(failedPaste), 'utf8');
assert.notEqual(spawnSync(process.execPath, [verifier, failedPastePath]).status, 0);

fs.rmSync(directory, { recursive: true, force: true });
console.log('Human acceptance verifier: 3 scenarios passed.');
