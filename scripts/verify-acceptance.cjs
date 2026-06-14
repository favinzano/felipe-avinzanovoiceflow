const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const resultsPath = path.resolve(process.argv[2] || "docs/acceptance-results.json");
assert.ok(fs.existsSync(resultsPath), `Falta la matriz humana: ${resultsPath}`);
const results = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
assert.ok(Array.isArray(results.cases) && results.cases.length >= 12, "La matriz debe incluir al menos 12 casos.");
for (const item of results.cases) {
  assert.ok(item.id && item.windows && item.hardware && item.microphone && item.accent && item.environment, `${item.id || "caso"}: faltan dimensiones`);
  assert.equal(item.status, "passed", `${item.id}: estado ${item.status || "sin estado"}`);
  assert.equal(typeof item.wer, "number", `${item.id}: falta WER`);
  assert.equal(typeof item.pasteSuccess, "boolean", `${item.id}: falta resultado de pegado`);
}
assert.ok(results.cases.every((item) => item.pasteSuccess), "La matriz contiene fallos de pegado.");
console.log(`Human acceptance verified: ${results.cases.length} cases passed.`);
