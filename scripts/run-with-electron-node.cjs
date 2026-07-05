const { spawnSync } = require("node:child_process");
const electronPath = require("electron");

const scriptPath = process.argv[2];
if (!scriptPath) {
  console.error("Usage: node scripts/run-with-electron-node.cjs <script.cjs>");
  process.exit(1);
}

const result = spawnSync(electronPath, [scriptPath], {
  stdio: "inherit",
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }
});

process.exit(result.status === null ? 1 : result.status);
