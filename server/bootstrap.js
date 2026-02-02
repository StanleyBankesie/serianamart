import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });
if (fs.existsSync(path.join(__dirname, ".env.local"))) {
  dotenv.config({ path: path.join(__dirname, ".env.local"), override: true });
}

await import("./index.js");
