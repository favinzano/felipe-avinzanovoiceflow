'use strict';

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const brand = require('../src/brand-config.cjs');

const UPX_FLAGS = '--best';

function warn(message) {
  console.warn(`[compress-natives] ${message}`);
}

function resolveOnnxRuntimeDllDirectory() {
  try {
    const packageJson = require.resolve('onnxruntime-node/package.json');
    return path.join(path.dirname(packageJson), 'bin', 'napi-v3', 'win32', 'x64');
  } catch {
    return path.resolve(
      __dirname,
      '..',
      'node_modules',
      'onnxruntime-node',
      'bin',
      'napi-v3',
      'win32',
      'x64',
    );
  }
}

function runUpx(command, cwd) {
  return execSync(`upx ${command}`, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

if (process.platform !== 'win32') {
  warn('Se omite UPX porque este paso solo procesa binarios de Windows x64.');
  process.exit(0);
}

try {
  runUpx('--version', process.cwd());
} catch {
  warn('UPX no esta instalado o no esta disponible en PATH; el empaquetado continuara sin comprimir DLL.');
  process.exit(0);
}

const dllDirectory = resolveOnnxRuntimeDllDirectory();
let nativePaths = [];
if (fs.existsSync(dllDirectory)) {
  nativePaths = fs
    .readdirSync(dllDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^[A-Za-z0-9_.-]+\.dll$/i.test(entry.name))
    .map((entry) => path.join(dllDirectory, entry.name));
} else {
  warn(`No se encontro el directorio de DLL de onnxruntime-node: ${dllDirectory}`);
}

const helperPath = path.resolve(__dirname, '..', 'native', 'win32-x64', brand.helperExecutable);
if (fs.existsSync(helperPath)) {
  nativePaths.push(helperPath);
} else {
  warn(`No se encontro el helper nativo: ${helperPath}`);
}

if (nativePaths.length === 0) {
  warn('No se encontraron binarios nativos para comprimir.');
  process.exit(0);
}

const backupDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'voiceflow-upx-'));

try {
  for (const nativePath of nativePaths) {
    const nativeDirectory = path.dirname(nativePath);
    const nativeName = path.basename(nativePath);
    const backupPath = path.join(backupDirectory, nativeName);
    const originalBytes = fs.statSync(nativePath).size;

    fs.copyFileSync(nativePath, backupPath);

    try {
      // Native names come from a restricted DLL pattern or the canonical brand config.
      runUpx(`${UPX_FLAGS} -- "${nativeName}"`, nativeDirectory);
      runUpx(`-t -- "${nativeName}"`, nativeDirectory);

      const compressedBytes = fs.statSync(nativePath).size;
      const savedPercent = ((1 - compressedBytes / originalBytes) * 100).toFixed(1);
      console.log(
        `[compress-natives] ${nativeName}: ${originalBytes} -> ${compressedBytes} bytes (${savedPercent}% menos)`,
      );
    } catch (error) {
      fs.copyFileSync(backupPath, nativePath);
      const detail = error.stderr?.trim() || error.message;
      warn(`UPX no pudo comprimir/verificar ${nativeName}; se restauro el original. ${detail}`);
    }
  }
} finally {
  fs.rmSync(backupDirectory, { recursive: true, force: true });
}
