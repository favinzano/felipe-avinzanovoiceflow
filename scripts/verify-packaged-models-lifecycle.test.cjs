'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const brand = require('../src/brand-config.cjs');
const { withPackagedSmokeTemp } = require('./verify-packaged-models.cjs');

(async () => {
  let allocated;
  await assert.rejects(
    withPackagedSmokeTemp(async (directory) => {
      allocated = directory;
      throw new Error('failure before spawn');
    }),
    /failure before spawn/,
  );
  assert.ok(allocated.startsWith(path.join(os.tmpdir(), `${brand.slug}-packaged-model-smoke-`)));
  assert.equal(fs.existsSync(allocated), false, 'failure before spawn must remove the allocated temp directory');
  console.log('Packaged model temp failure cleanup verified.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
