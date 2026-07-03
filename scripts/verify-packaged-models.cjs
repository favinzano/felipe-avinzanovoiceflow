const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { verifyModelDownloads } = require("../src/model-smoke-utils.cjs");
const { resolveWhisperProfile } = require("../src/whisper-profiles.cjs");
const brand = require('../src/brand-config.cjs');

const root = path.join(__dirname, "..");
const executable = path.join(root, 'release', 'win-unpacked', `${brand.displayName}.exe`);
const userData = fs.mkdtempSync(path.join(os.tmpdir(), `${brand.slug}-packaged-model-smoke-`));

function isPathContained(rootPath, candidatePath) {
  const relative = path.relative(path.resolve(rootPath), path.resolve(candidatePath));
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function resolveProfiles(argv) {
  const requested = argv.filter((value) => value.startsWith('--profile=')).map((value) => value.slice('--profile='.length));
  const profiles = requested.length ? requested : ['fast', 'accurate'];
  for (const profile of profiles) {
    if (!['fast', 'accurate'].includes(profile)) throw new Error(`Unsupported packaged model profile: ${profile}`);
  }
  return profiles;
}

async function run() {
  assert.ok(fs.existsSync(executable), "Construye el release antes de probar los modelos empaquetados.");

  try {
    for (const profileId of resolveProfiles(process.argv.slice(2))) {
      const reportPath = path.join(userData, `${profileId}-self-test-report.json`);
      const result = spawnSync(executable, [
        `--self-test-model=${profileId}`,
        `--self-test-user-data=${userData}`,
        `--self-test-report=${reportPath}`,
        "--disable-gpu"
      ], {
        encoding: "utf8",
        timeout: 20 * 60 * 1000,
        windowsHide: true
      });
      assert.equal(result.status, 0, `${profileId}: ${result.stderr || result.error || "falló"}`);

      const profile = resolveWhisperProfile(profileId);
      const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
      console.log(`Packaged ${profileId} cache: ${report.cacheDir}`);
      assert.ok(isPathContained(userData, report.cacheDir), `${profileId}: la caché salió del directorio temporal aislado`);
      await verifyModelDownloads(report.cacheDir, profile.model);
      assert.equal(report.model, profile.model, `${profileId}: el reporte validó otro modelo`);
      assert.equal(report.dtype, profile.dtype, `${profileId}: el reporte validó otro dtype`);
      assert.ok(report.cacheBytes > 0, `${profileId}: el reporte no confirmó pesos descargados`);
      console.log(`Packaged ${profileId} model self-test passed`);
    }

    console.log("Packaged model cache isolation verified.");
  } finally {
    fs.rmSync(userData, { recursive: true, force: true });
  }
}

module.exports = { isPathContained, resolveProfiles };

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
