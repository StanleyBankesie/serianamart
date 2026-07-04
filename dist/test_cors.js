import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(__dirname, ".env.production"), override: true });

const allowedOrigins = (() => {
  const raw = String(process.env.CORS_ALLOWED_ORIGINS || "").trim();
  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
})();

console.log("Allowed Origins:", allowedOrigins);
console.log("Includes https://serianamart.omnisuite-erp.com:", allowedOrigins.includes("https://serianamart.omnisuite-erp.com"));
