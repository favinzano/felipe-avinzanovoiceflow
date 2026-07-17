const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const MANIFEST_FILE = "manifest.json";
const MAX_MODEL_PACK_BYTES = 2 * 1024 * 1024 * 1024;
const PACK_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const VERSION_PATTERN = /^[0-9]+(?:\.[0-9]+){0,3}(?:-[a-z0-9.-]+)?$/i;

function compareVersions(left, right) {
  const numeric = (value) => String(value).split("-")[0].split(".").map((part) => Number(part) || 0);
  const a = numeric(left);
  const b = numeric(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

function safeRelativePath(filePath) {
  if (typeof filePath !== "string" || !filePath || path.isAbsolute(filePath)) return false;
  const normalized = path.normalize(filePath);
  return normalized !== ".." && !normalized.startsWith(`..${path.sep}`) && !normalized.includes(`:${path.sep}`);
}

function validateManifest(manifest, appVersion, options = {}) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) throw new Error("El manifiesto del paquete no es válido.");
  if (manifest.schemaVersion !== 1) throw new Error("Versión de manifiesto no compatible.");
  if (!PACK_ID_PATTERN.test(manifest.id || "")) throw new Error("El identificador del paquete no es válido.");
  if (!VERSION_PATTERN.test(manifest.version || "")) throw new Error("La versión del paquete no es válida.");
  if (typeof manifest.engine !== "string" || !manifest.engine.trim()) throw new Error("El paquete no declara un motor.");
  if (manifest.profile !== undefined && !PACK_ID_PATTERN.test(manifest.profile)) throw new Error("El perfil del paquete no es válido.");
  if (!Array.isArray(manifest.languages) || !manifest.languages.every((item) => typeof item === "string" && item)) {
    throw new Error("El paquete no declara idiomas válidos.");
  }
  if (typeof manifest.license !== "string" || !manifest.license.trim()) throw new Error("El paquete no declara su licencia.");
  if (typeof manifest.minAppVersion !== "string" || !VERSION_PATTERN.test(manifest.minAppVersion)) {
    throw new Error("El paquete no declara una versión mínima válida.");
  }
  if (compareVersions(appVersion, manifest.minAppVersion) < 0) {
    throw new Error(`Este paquete requiere VoiceFlow ${manifest.minAppVersion} o posterior.`);
  }
  if (!Array.isArray(manifest.files) || !manifest.files.length) throw new Error("El paquete no contiene archivos declarados.");
  const seen = new Set();
  let totalBytes = 0;
  for (const file of manifest.files) {
    if (!file || !safeRelativePath(file.path) || seen.has(path.normalize(file.path).toLowerCase())) {
      throw new Error("El manifiesto contiene una ruta de archivo insegura o duplicada.");
    }
    seen.add(path.normalize(file.path).toLowerCase());
    if (!Number.isSafeInteger(file.size) || file.size < 0) throw new Error(`Tamaño inválido para ${file.path}.`);
    if (!/^[a-f0-9]{64}$/i.test(file.sha256 || "")) throw new Error(`SHA-256 inválido para ${file.path}.`);
    totalBytes += file.size;
  }
  const maximumBytes = options.maximumBytes || MAX_MODEL_PACK_BYTES;
  if (totalBytes > maximumBytes) throw new Error("El paquete supera el límite de 2 GB.");
  return { ...manifest, totalBytes };
}

async function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  const handle = await fs.open(filePath, "r");
  try {
    for await (const chunk of handle.createReadStream()) hash.update(chunk);
  } finally {
    await handle.close().catch(() => {});
  }
  return hash.digest("hex");
}

async function verifyPackDirectory(sourceDirectory, appVersion, options = {}) {
  const manifestPath = path.join(sourceDirectory, MANIFEST_FILE);
  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`No se pudo leer ${MANIFEST_FILE}: ${error.message}`);
  }
  const validated = validateManifest(manifest, appVersion, options);
  for (const file of validated.files) {
    const absolutePath = path.resolve(sourceDirectory, file.path);
    const sourceRoot = `${path.resolve(sourceDirectory)}${path.sep}`;
    if (!absolutePath.startsWith(sourceRoot)) throw new Error(`Ruta insegura: ${file.path}.`);
    const stats = await fs.stat(absolutePath).catch(() => null);
    if (!stats?.isFile() || stats.size !== file.size) throw new Error(`Tamaño o archivo ausente: ${file.path}.`);
    const digest = await sha256File(absolutePath);
    if (digest.toLowerCase() !== file.sha256.toLowerCase()) throw new Error(`SHA-256 no coincide: ${file.path}.`);
  }
  return validated;
}

function publicPackInfo(manifest, directory) {
  return {
    id: manifest.id,
    version: manifest.version,
    engine: manifest.engine,
    profile: manifest.profile,
    model: manifest.model,
    languages: manifest.languages,
    license: manifest.license,
    minAppVersion: manifest.minAppVersion,
    totalBytes: manifest.totalBytes ?? manifest.files?.reduce((sum, file) => sum + file.size, 0),
    directory
  };
}

function createModelPackManager(userDataPath, appVersion, options = {}) {
  const packsRoot = options.packsRoot || path.join(userDataPath, "model-packs");

  async function install(sourceDirectory) {
    const manifest = await verifyPackDirectory(sourceDirectory, appVersion, options);
    const parent = path.join(packsRoot, manifest.id);
    const destination = path.join(parent, manifest.version);
    const temporary = path.join(parent, `.install-${manifest.version}-${crypto.randomUUID()}`);
    if (await fs.stat(destination).then(() => true, () => false)) throw new Error("Esta versión del paquete ya está instalada.");
    await fs.mkdir(temporary, { recursive: true });
    try {
      await fs.copyFile(path.join(sourceDirectory, MANIFEST_FILE), path.join(temporary, MANIFEST_FILE));
      for (const file of manifest.files) {
        const target = path.join(temporary, file.path);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.copyFile(path.join(sourceDirectory, file.path), target);
      }
      await verifyPackDirectory(temporary, appVersion, options);
      await fs.rename(temporary, destination);
      return publicPackInfo(manifest, destination);
    } catch (error) {
      await fs.rm(temporary, { recursive: true, force: true });
      throw error;
    }
  }

  async function list(listOptions = {}) {
    const found = [];
    const ids = await fs.readdir(packsRoot, { withFileTypes: true }).catch(() => []);
    for (const id of ids.filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))) {
      const versions = await fs.readdir(path.join(packsRoot, id.name), { withFileTypes: true }).catch(() => []);
      for (const version of versions.filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))) {
        const directory = path.join(packsRoot, id.name, version.name);
        try {
          const manifest = listOptions.verify
            ? await verifyPackDirectory(directory, appVersion, options)
            : validateManifest(JSON.parse(await fs.readFile(path.join(directory, MANIFEST_FILE), "utf8")), appVersion, options);
          found.push(publicPackInfo(manifest, directory));
        } catch {
          found.push({ id: id.name, version: version.name, directory, valid: false });
        }
      }
    }
    return found;
  }

  return { install, list, packsRoot, verify: (directory) => verifyPackDirectory(directory, appVersion, options) };
}

module.exports = {
  MANIFEST_FILE,
  MAX_MODEL_PACK_BYTES,
  compareVersions,
  createModelPackManager,
  safeRelativePath,
  validateManifest,
  verifyPackDirectory
};
