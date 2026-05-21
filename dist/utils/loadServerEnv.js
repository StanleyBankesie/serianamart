import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

let loaded = false;

function resolveServerRoot(metaUrl) {
  const currentDir = path.dirname(fileURLToPath(metaUrl));
  if (fs.existsSync(path.join(currentDir, "package.json"))) {
    return currentDir;
  }
  return path.resolve(currentDir, "..");
}

function loadIfExists(filePath, override = false) {
  if (fs.existsSync(filePath)) {
    dotenv.config({ path: filePath, override });
  }
}

export function loadServerEnv(metaUrl = import.meta.url) {
  if (loaded) return;

  const serverRoot = resolveServerRoot(metaUrl);
  const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  const forceLocal = String(process.env.DEV_FORCE_LOCAL_ENV || "").trim() === "1";

  const baseCandidates = [
    path.join(serverRoot, "server.env"),
    path.join(serverRoot, ".env"),
  ];
  const localCandidates = [
    path.join(serverRoot, "server.env.local"),
    path.join(serverRoot, ".env.local"),
  ];
  const prodCandidates = [
    path.join(serverRoot, "server.env.production"),
    path.join(serverRoot, ".env.production"),
  ];

  for (const filePath of baseCandidates) {
    loadIfExists(filePath, false);
  }

  if (forceLocal) {
    for (const filePath of localCandidates) {
      loadIfExists(filePath, true);
    }
  } else if (isProd) {
    for (const filePath of prodCandidates) {
      loadIfExists(filePath, true);
    }
  } else {
    for (const filePath of localCandidates) {
      loadIfExists(filePath, true);
    }
  }

  loaded = true;
}

loadServerEnv(import.meta.url);
