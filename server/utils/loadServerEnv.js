import dotenv from "dotenv";
import fs from "fs";
/**
 * @file loadServerEnv.js
 * @description Utility for discovering and loading the .env file recursively from the server directory.
 */
import path from "path";
import { fileURLToPath } from "url";

let loaded = false;

function resolveServerRoot(metaUrl) {
  // Determine the server root directory by checking for the presence of package.json
  const currentDir = path.dirname(fileURLToPath(metaUrl));
  if (fs.existsSync(path.join(currentDir, "package.json"))) {
    return currentDir;
  }
  return path.resolve(currentDir, "..");
}

function loadIfExists(filePath, override = false) {
  // Helper function to conditionally load a .env file if it exists on disk
  if (fs.existsSync(filePath)) {
    dotenv.config({ path: filePath, override });
  }
}

/**
 * Loads environment variables from a .env file located at or above the given module path.
 *
 * @param {string} [metaUrl=import.meta.url] - The meta URL of the caller module to start the search from.
 * @returns {void}
 */
export function loadServerEnv(metaUrl = import.meta.url) {
  // Prevent multiple executions of the environment loader
  if (loaded) return;

  const serverRoot = resolveServerRoot(metaUrl);

  // Define file paths for base, local, and production environment configurations
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

  const wasProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";

  // Load base environment variable files without overriding existing ones
  for (const filePath of baseCandidates) {
    loadIfExists(filePath, false);
  }

  // Determine environment overrides from the current process state
  const forceLocal = String(process.env.DEV_FORCE_LOCAL_ENV || "").trim() === "1";

  // Conditionally load local or production overrides based on current mode
  if (forceLocal) {
    for (const filePath of localCandidates) {
      loadIfExists(filePath, true);
    }
  } else if (wasProd) {
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
