const assert = require("node:assert/strict");
const { evaluateCandidate, selectWinningCandidate } = require("./benchmark-gates.cjs");

function candidate(id, overrides = {}) {
  return { id, wer: 0.11, packageBytes: 1_000_000_000, peakMemoryMb: 2000, consecutiveSuccessfulDictations: 100, offline: true, runs: [{ audioMs: 5000, endToPasteMs: 900 }, { audioMs: 8000, endToPasteMs: 1200 }], ...overrides };
}

assert.equal(evaluateCandidate(candidate("fast"), 0.1).qualified, true);
assert.equal(evaluateCandidate(candidate("slow", { runs: [{ audioMs: 5000, endToPasteMs: 3100 }] }), 0.1).checks.p95, false);
assert.equal(evaluateCandidate(candidate("inaccurate", { wer: 0.12 }), 0.1).checks.wer, false);
assert.equal(evaluateCandidate(candidate("online", { offline: false }), 0.1).qualified, false);
assert.equal(selectWinningCandidate([candidate("a"), candidate("b", { runs: [{ audioMs: 5000, endToPasteMs: 800 }] })], 0.1).winner, "b");
assert.equal(selectWinningCandidate([candidate("a", { wer: 0.105 }), candidate("b", { wer: 0.1, runs: [{ audioMs: 5000, endToPasteMs: 930 }] })], 0.1).winner, "b");
assert.equal(selectWinningCandidate([candidate("bad", { peakMemoryMb: 4000 })], 0.1).winner, null);

console.log("Benchmark gates: 7 checks passed.");
