const fs = require("node:fs");
const path = require("node:path");
const { selectWinningCandidate } = require("../src/benchmark-gates.cjs");

const inputPath = path.resolve(process.argv[2] || "benchmarks/results/acceptance.json");
const report = JSON.parse(fs.readFileSync(inputPath, "utf8"));
if (!Number.isFinite(report.baselineWer) || !Array.isArray(report.candidates)) throw new Error("El reporte requiere baselineWer y candidates[].");
const evaluation = selectWinningCandidate(report.candidates, report.baselineWer);
process.stdout.write(`${JSON.stringify(evaluation, null, 2)}\n`);
if (!evaluation.winner) process.exitCode = 2;
