import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
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
