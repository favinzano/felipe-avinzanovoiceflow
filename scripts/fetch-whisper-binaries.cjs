#!/usr/bin/env node
// Fetches the official prebuilt whisper.cpp CPU CLI binary for the current
// platform/arch, verifies its SHA-256, and stages it (plus its sibling shared
// libraries) flat under native/<platform>-<arch>/ so electron-builder ships it
// via extraResources (same mechanism as the native paste helper).
//
// macOS has no prebuilt whisper-cli (only an XCFramework), so it is a no-op —
// the app transparently falls back to the transformers.js engine when the
// sidecar binary is absent. `native/` is gitignored: these are build artifacts,
// never committed. Sources verified in docs/superpowers/notes/whisper-cpp-spike.md.

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const VERSION = "v1.9.1";
const BASE = `https://github.com/ggml-org/whisper.cpp/releases/download/${VERSION}`;

const TARGETS = {
  "win32-x64": {
    url: `${BASE}/whisper-bin-x64.zip`,
    sha256: "7d8be46ecd31828e1eb7a2ecdd0d6b314feafd82163038ab6092594b0a063539",
    archive: "zip",
    binary: "whisper-cli.exe",
    libExt: [".dll"]
  },
  "linux-x64": {
    url: `${BASE}/whisper-bin-ubuntu-x64.tar.gz`,
    sha256: "f3bf3b4369a99b54665b0f19b88483b30de27f25963b0414235dea03198515c5",
    archive: "tar",
    binary: "whisper-cli",
    libExt: [".so"]
  },
  "linux-arm64": {
    url: `${BASE}/whisper-bin-ubuntu-arm64.tar.gz`,
    sha256: "e0b66cd551ff6f2a28fabe3c6e89691eea037bb76833493abb9a71ca788994b3",
    archive: "tar",
    binary: "whisper-cli",
    libExt: [".so"]
  }
};

const key = `${process.platform}-${process.arch}`;
const repoRoot = path.resolve(__dirname, "..");

function collectWanted(dir, target) {
  const out = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name === target.binary || target.libExt.some((ext) => entry.name.includes(ext))) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}

async function main() {
  if (process.platform === "darwin") {
    console.log("whisper.cpp: macOS has no prebuilt whisper-cli; relying on transformers.js fallback. Skipping.");
    return;
  }
  const target = TARGETS[key];
  if (!target) {
    console.log(`whisper.cpp: no prebuilt binary mapped for ${key}; transformers.js fallback covers it. Skipping.`);
    return;
  }

  const destDir = path.join(repoRoot, "native", key);
  const destBinary = path.join(destDir, target.binary);
  if (fs.existsSync(destBinary)) {
    console.log(`whisper.cpp: already staged at native/${key}/${target.binary}. Skipping.`);
    return;
  }

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vf-whisper-"));
  try {
    console.log(`whisper.cpp: downloading ${target.url}`);
    const response = await fetch(target.url, { redirect: "follow" });
    if (!response.ok) throw new Error(`download failed: HTTP ${response.status} for ${target.url}`);
    const bytes = Buffer.from(await response.arrayBuffer());

    const got = crypto.createHash("sha256").update(bytes).digest("hex");
    if (got !== target.sha256) {
      throw new Error(`sha256 mismatch for ${target.url}\n  expected ${target.sha256}\n  got      ${got}`);
    }
    console.log(`whisper.cpp: sha256 verified (${got})`);

    const archivePath = path.join(tmpRoot, path.basename(target.url));
    fs.writeFileSync(archivePath, bytes);

    const extractDir = path.join(tmpRoot, "extract");
    fs.mkdirSync(extractDir, { recursive: true });
    if (target.archive === "zip") {
      execFileSync("powershell", [
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
        `Expand-Archive -LiteralPath '${archivePath}' -DestinationPath '${extractDir}' -Force`
      ], { stdio: "inherit" });
    } else {
      execFileSync("tar", ["-xzf", archivePath, "-C", extractDir], { stdio: "inherit" });
    }

    const wanted = collectWanted(extractDir, target);
    if (!wanted.some((file) => path.basename(file) === target.binary)) {
      throw new Error(`extracted archive did not contain ${target.binary}`);
    }

    fs.mkdirSync(destDir, { recursive: true });
    const staged = [];
    for (const file of wanted) {
      const to = path.join(destDir, path.basename(file));
      fs.copyFileSync(file, to);
      staged.push(`native/${key}/${path.basename(file)}`);
    }
    console.log(`whisper.cpp: staged ${staged.length} file(s):`);
    for (const relativePath of staged) console.log(`  - ${relativePath}`);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`whisper.cpp fetch failed: ${error.message}`);
  process.exit(1);
});
