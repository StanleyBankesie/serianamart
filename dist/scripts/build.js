import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKIP_DIRECTORIES = new Set([
  ".git",
  "coverage",
  "dist",
  "node_modules",
  "scratch",
]);

const SKIP_FILES = [
  /^\.env(?:\..+)?$/i,
  /\.log$/i,
  /\.txt$/i,
  /\.ps1$/i,
];

function shouldSkip(entry) {
  if (entry.isDirectory()) {
    return SKIP_DIRECTORIES.has(entry.name);
  }
  return SKIP_FILES.some((pattern) => pattern.test(entry.name));
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (shouldSkip(entry)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(s, d);
    } else if (entry.isFile()) {
      await fs.copyFile(s, d);
    }
  }
}
async function run() {
  const srcDir = path.resolve(__dirname, "../");
  const distDir = path.resolve(__dirname, "../../dist");
  try {
    await fs.rm(distDir, { recursive: true, force: true });
  } catch {}
  await copyDir(srcDir, distDir);
  process.stdout.write("dist ready\n");
}
run().catch((e) => {
  process.stderr.write(String(e && e.message ? e.message : e));
  process.exit(1);
});
