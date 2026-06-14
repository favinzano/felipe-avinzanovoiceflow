const assert = require("node:assert/strict");
const { normalizeWords, wordErrorRate } = require("./benchmark-utils.cjs");

assert.deepEqual(normalizeWords("¡Auditar la configuración!"), ["auditar", "la", "configuracion"]);
assert.equal(wordErrorRate("uno dos tres", "uno dos tres"), 0);
assert.equal(wordErrorRate("uno dos tres", "uno tres"), 1 / 3);
assert.equal(wordErrorRate("uno dos", "uno tres"), 1 / 2);
assert.equal(wordErrorRate("", ""), 0);
assert.equal(wordErrorRate("", "texto"), 1);

console.log("Benchmark utilities: 6 checks passed.");
