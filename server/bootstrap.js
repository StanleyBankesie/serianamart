import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });
const isProd = String(process.env.NODE_ENV).toLowerCase() === "production";
const prodPath = path.join(__dirname, ".env.production");
const localPath = path.join(__dirname, ".env.local");
if (isProd && fs.existsSync(prodPath)) {
  dotenv.config({ path: prodPath, override: true });
} else if (fs.existsSync(localPath)) {
  dotenv.config({ path: localPath, override: true });
}
try {
  if (fs.existsSync(prodPath)) {
    const parsed = dotenv.config({ path: prodPath }).parsed || {};
    [
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_USER",
      "SMTP_PASS",
      "SMTP_FROM",
      "SMTP_SECURE",
    ].forEach((k) => {
      if (parsed[k]) process.env[k] = parsed[k];
    });
  }
} catch {}

import("./index.js");
