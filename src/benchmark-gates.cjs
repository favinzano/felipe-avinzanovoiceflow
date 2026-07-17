const { percentile } = require("./transcription-metrics.cjs");

const DEFAULT_GATES = Object.freeze({
  maximumP50Ms: 1500,
  maximumP95Ms: 3000,
  maximumWerRatio: 1.1,
  maximumPackageBytes: 2 * 1024 * 1024 * 1024,
  maximumMemoryMb: 3 * 1024,
  requiredConsecutiveDictations: 100
});

function evaluateCandidate(candidate, baselineWer, gates = DEFAULT_GATES) {
  const shortRuns = (candidate.runs || []).filter((run) => run.audioMs <= 10000 && run.success !== false);
  const latency = shortRuns.map((run) => run.endToPasteMs).filter(Number.isFinite);
  const p50Ms = percentile(latency, 0.5);
  const p95Ms = percentile(latency, 0.95);
  const checks = {
    p50: Number.isFinite(p50Ms) && p50Ms <= gates.maximumP50Ms,
    p95: Number.isFinite(p95Ms) && p95Ms <= gates.maximumP95Ms,
    wer: Number.isFinite(candidate.wer) && Number.isFinite(baselineWer) && candidate.wer <= baselineWer * gates.maximumWerRatio,
    packageSize: Number.isFinite(candidate.packageBytes) && candidate.packageBytes <= gates.maximumPackageBytes,
    memory: Number.isFinite(candidate.peakMemoryMb) && candidate.peakMemoryMb <= gates.maximumMemoryMb,
    stability: candidate.consecutiveSuccessfulDictations >= gates.requiredConsecutiveDictations,
    offline: candidate.offline === true
  };
  return { id: candidate.id, qualified: Object.values(checks).every(Boolean), checks, p50Ms, p95Ms, wer: candidate.wer, packageBytes: candidate.packageBytes, peakMemoryMb: candidate.peakMemoryMb };
}

function selectWinningCandidate(candidates, baselineWer, gates = DEFAULT_GATES) {
  const evaluated = candidates.map((candidate) => evaluateCandidate(candidate, baselineWer, gates));
  const qualified = evaluated.filter((candidate) => candidate.qualified).sort((left, right) => {
    const p95Difference = left.p95Ms - right.p95Ms;
    const withinFivePercent = Math.abs(p95Difference) <= Math.min(left.p95Ms, right.p95Ms) * 0.05;
    if (!withinFivePercent) return p95Difference;
    if (left.wer !== right.wer) return left.wer - right.wer;
    return left.packageBytes - right.packageBytes;
  });
  return { winner: qualified[0]?.id || null, evaluated };
}

module.exports = { DEFAULT_GATES, evaluateCandidate, selectWinningCandidate };
