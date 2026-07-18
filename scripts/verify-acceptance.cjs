const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const resultsPath = path.resolve(process.argv[2] || "docs/acceptance-results.json");
assert.ok(fs.existsSync(resultsPath), `Falta la matriz humana: ${resultsPath}`);
const results = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
assert.ok(Array.isArray(results.cases) && results.cases.length >= 12, "La matriz debe incluir al menos 12 casos.");
const supportedPlatforms = new Set(["windows", "macos", "linux"]);
for (const item of results.cases) {
  assert.ok(item.id && supportedPlatforms.has(item.platform) && item.operatingSystem && item.hardware && item.microphone && item.accent && item.environment, `${item.id || "caso"}: faltan dimensiones multiplataforma`);
  assert.equal(item.status, "passed", `${item.id}: estado ${item.status || "sin estado"}`);
  assert.equal(typeof item.wer, "number", `${item.id}: falta WER`);
  assert.equal(typeof item.pasteSuccess, "boolean", `${item.id}: falta resultado de pegado`);
}
for (const platform of supportedPlatforms) {
  assert.ok(results.cases.filter((item) => item.platform === platform).length >= 4, `La matriz debe incluir al menos 4 casos de ${platform}.`);
}
assert.ok(results.cases.every((item) => item.pasteSuccess), "La matriz contiene fallos de pegado.");
console.log(`Human acceptance verified: ${results.cases.length} cases passed.`);
