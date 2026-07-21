const nodeFs = require("node:fs");
const nodePath = require("node:path");
const crypto = require("node:crypto");

function resolveModelUrl(ggml) {
  return `https://huggingface.co/${ggml.repo}/resolve/main/${ggml.file}`;
}

async function sha256File(path, fs = nodeFs) {
  const buf = await fs.promises.readFile(path);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function ensureModel(ggml, { modelsDir, fetchImpl = fetch, fs = nodeFs } = {}) {
  const finalPath = nodePath.posix.join(modelsDir, ggml.file);
  try {
    await fs.promises.access(finalPath);
    return finalPath;
  } catch { /* not cached */ }
  await fs.promises.mkdir(modelsDir, { recursive: true });
  const partPath = `${finalPath}.part`;
  const res = await fetchImpl(resolveModelUrl(ggml));
  if (!res.ok) throw new Error(`model download failed: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(partPath, bytes);
  const got = crypto.createHash("sha256").update(bytes).digest("hex");
  if (ggml.sha256 && got !== ggml.sha256) throw new Error("model hash mismatch");
  await fs.promises.rename(partPath, finalPath);
  return finalPath;
}

module.exports = { resolveModelUrl, sha256File, ensureModel };
