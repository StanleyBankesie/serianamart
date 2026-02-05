import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const env = process.env.NODE_ENV || "development";
const baseEnv = path.join(__dirname, ".env");
const modeEnv = path.join(__dirname, `.env.${env}`);
const localEnv = path.join(__dirname, ".env.local");
const modeLocalEnv = path.join(__dirname, `.env.${env}.local`);

if (fs.existsSync(baseEnv)) dotenv.config({ path: baseEnv });
if (fs.existsSync(modeEnv)) dotenv.config({ path: modeEnv, override: true });
if (env !== "production" && fs.existsSync(localEnv))
  dotenv.config({ path: localEnv, override: true });
if (fs.existsSync(modeLocalEnv))
  dotenv.config({ path: modeLocalEnv, override: true });

await import("./index.js");
