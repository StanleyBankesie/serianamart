import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";

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

const localIndex = path.join(__dirname, "index.js");
const serverIndex = path.join(__dirname, "../server/index.js");
let target = null;
if (fs.existsSync(localIndex)) {
  target = localIndex;
} else if (fs.existsSync(serverIndex)) {
  target = serverIndex;
}
if (target) {
  import(pathToFileURL(target).href).catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  import("./index.js")
    .catch(() => import("../server/index.js"))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
