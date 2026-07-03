'use strict';

const path = require('node:path');

function resolveLegacyLoginItems({ exePath, localAppData, legacyNames, pathApi = path }) {
  const productionNames = legacyNames.filter((name) => !name.endsWith(' Development'));
  const seen = new Set();
  const candidates = [];
  for (const name of productionNames) {
    const paths = [
      pathApi.join(pathApi.dirname(exePath), `${name}.exe`),
      localAppData ? pathApi.join(localAppData, 'Programs', name, `${name}.exe`) : null
    ];
    for (const candidatePath of paths) {
      if (!candidatePath) continue;
      const key = `${name}\0${candidatePath}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ name, candidatePath });
    }
  }
  return candidates;
}

function disableLegacyLoginItems({ isPackaged, platform, isolated, exePath, localAppData, legacyNames = [], setter, pathApi = path }) {
  if (!isPackaged || platform !== 'win32' || isolated) return 0;
  const candidates = resolveLegacyLoginItems({ exePath, localAppData, legacyNames, pathApi });
  for (const { name, candidatePath } of candidates) {
    setter({ name, path: candidatePath, args: ['--hidden'], openAtLogin: false });
  }
  return candidates.length;
}

module.exports = { disableLegacyLoginItems, resolveLegacyLoginItems };
