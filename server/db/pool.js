import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });
const localPath = path.join(__dirname, "../.env.local");
const prodPath = path.join(__dirname, "../.env.production");
const isProd =
  String(process.env.NODE_ENV || "").toLowerCase() === "production";
const forceLocal = String(process.env.DEV_FORCE_LOCAL_ENV || "").trim() === "1";
if (forceLocal && fs.existsSync(localPath)) {
  dotenv.config({ path: localPath, override: true });
} else if (isProd && fs.existsSync(prodPath)) {
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

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required env var ${name}. Create server/.env (copy from .env.example) and set it.`,
    );
  }
  return v;
}

function optionalEnv(name, fallback) {
  const v = process.env[name];
  return v === undefined ? fallback : v;
}

const DB_HOST = requiredEnv("DB_HOST");
const DB_USER = requiredEnv("DB_USER");
const DB_NAME = requiredEnv("DB_NAME");
const DB_PORT = Number(optionalEnv("DB_PORT", 3306));

// Important: allow empty password ONLY if it is explicitly set to empty string in .env.
// If DB_PASSWORD is undefined, it usually means you forgot to create server/.env.
if (process.env.DB_PASSWORD === undefined) {
  throw new Error(
    "DB_PASSWORD is not set. Create server/.env and set DB_PASSWORD to your MySQL password (or set it to an empty value intentionally).",
  );
}

if (process.env.DB_PASSWORD.startsWith(" ")) {
  throw new Error(
    'DB_PASSWORD has a leading space. Remove the space after "DB_PASSWORD=" in server/.env.',
  );
}

if (
  process.env.DB_PASSWORD.startsWith("$2a$") ||
  process.env.DB_PASSWORD.startsWith("$2b$")
) {
  throw new Error(
    "DB_PASSWORD looks like a bcrypt hash (e.g. $2a$...). DB_PASSWORD must be your MySQL user password. Put the bcrypt hash into createAdminUser.sql, not into server/.env.",
  );
}

const DB_PASSWORD = process.env.DB_PASSWORD;

export const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: true,
});

export async function query(sql, params = {}) {
  const isMetadata = /^\s*(SHOW|ALTER|CREATE|DROP|DESCRIBE)\s/i.test(sql);
  try {
    if (isMetadata) {
      const [rows] = await pool.query(sql, params);
      return rows;
    }
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (err) {
    if (
      err.code === "ER_UNSUPPORTED_PS" ||
      (err.message && (err.message.includes("prepared statement") || err.message.includes("syntax to use near '?'")))
    ) {
      const [rows] = await pool.query(sql, params);
      return rows;
    }
    throw err;
  }
}
