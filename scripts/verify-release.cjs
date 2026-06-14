const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const asar = require("@electron/asar");

const root = path.join(__dirname, "..");
const releaseDir = path.join(root, "release");
const packageJson = require(path.join(root, "package.json"));
const releaseFlavor = process.env.RELEASE_FLAVOR;
if (releaseFlavor && !["Legacy", "AVX2"].includes(releaseFlavor)) {
  throw new Error(`Unsupported RELEASE_FLAVOR: ${releaseFlavor}`);
}
const installerName = releaseFlavor
  ? `NextStepAI-Voice-Setup-${packageJson.version}-${releaseFlavor}-x64.exe`
  : `NextStepAI-Voice-Setup-${packageJson.version}-x64.exe`;
const installerPath = path.join(releaseDir, installerName);
const unpackedExe = path.join(releaseDir, "win-unpacked", "NextStepAI Voice.exe");
const resourcesDir = path.join(releaseDir, "win-unpacked", "resources");
const appAsar = path.join(resourcesDir, "app.asar");
const pasteHelper = path.join(resourcesDir, "native", "win32-x64", "NextStepAI.PasteHelper.exe");
const unpackedModulesDir = path.join(resourcesDir, "app.asar.unpacked", "node_modules");
const onnxRuntimeX64Dir = path.join(unpackedModulesDir, "onnxruntime-node", "bin", "napi-v3", "win32", "x64");
const forbiddenOnnxRuntimeDirs = [
  path.join(unpackedModulesDir, "onnxruntime-node", "bin", "napi-v3", "darwin"),
  path.join(unpackedModulesDir, "onnxruntime-node", "bin", "napi-v3", "linux"),
  path.join(unpackedModulesDir, "onnxruntime-node", "bin", "napi-v3", "win32", "arm64")
];
const requiredOnnxRuntimeFiles = ["DirectML.dll", "onnxruntime.dll", "onnxruntime_binding.node"];

function findFiles(directory, predicate) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? findFiles(entryPath, predicate) : predicate(entryPath) ? [entryPath] : [];
  });
}

assert.ok(fs.existsSync(installerPath), `Falta el instalador: ${installerName}`);
assert.ok(fs.statSync(installerPath).size > 10 * 1024 * 1024, "El instalador parece incompleto.");
assert.ok(fs.existsSync(unpackedExe), "Falta el ejecutable desempaquetado.");
assert.ok(fs.existsSync(appAsar), "Falta app.asar.");
assert.ok(fs.existsSync(pasteHelper), "Falta el helper nativo de pegado Windows x64.");
assert.ok(fs.statSync(pasteHelper).size > 1024 * 1024, "El helper nativo parece incompleto.");
for (const file of requiredOnnxRuntimeFiles) {
  assert.ok(fs.existsSync(path.join(onnxRuntimeX64Dir, file)), `Falta el binario ONNX Runtime x64 desempaquetado: ${file}`);
}
for (const directory of forbiddenOnnxRuntimeDirs) {
  assert.ok(!fs.existsSync(directory), `El release x64 contiene binarios innecesarios: ${directory}`);
}
const leakedModels = findFiles(resourcesDir, (file) => /\.(?:onnx|onnx_data)$/i.test(file));
const packagedFiles = asar.listPackage(appAsar);
const leakedAsarModels = packagedFiles.filter((file) => /\.(?:onnx|onnx_data)$/i.test(file));
assert.deepEqual(
  [...leakedModels, ...leakedAsarModels],
  [],
  `El release contiene modelos ONNX de desarrollo:\n${[...leakedModels, ...leakedAsarModels].join("\n")}`
);
const foreignAsarBinaries = packagedFiles.filter((file) => (
  /onnxruntime-node[\\/]bin[\\/]napi-v3[\\/](?:darwin|linux)[\\/]/i.test(file)
  || /onnxruntime-node[\\/]bin[\\/]napi-v3[\\/]win32[\\/]arm64[\\/]/i.test(file)
));
assert.deepEqual(
  foreignAsarBinaries,
  [],
  `El ASAR contiene binarios ONNX Runtime innecesarios:\n${foreignAsarBinaries.join("\n")}`
);

const hash = crypto.createHash("sha256").update(fs.readFileSync(installerPath)).digest("hex");
fs.writeFileSync(`${installerPath}.sha256`, `${hash}  ${installerName}\n`);
console.log(`Release verified: ${installerName}`);
console.log(`SHA-256: ${hash}`);
