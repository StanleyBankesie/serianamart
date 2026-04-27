import mysql from "mysql2/promise";
import "../utils/loadServerEnv.js";

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

function sanitizeCreatedByAuditJoin(sql) {
  if (!sql) return sql;
  let next = String(sql);

  // Remove injected audit projection fragments.
  next = next.replace(
    /,\s*(?:[a-z_][a-z0-9_]*\.)?created_at\s*,\s*[a-z_][a-z0-9_]*\.username\s+AS\s+created_by_name/gi,
    "",
  );
  next = next.replace(
    /\b(?:[a-z_][a-z0-9_]*\.)?created_at\s*,\s*[a-z_][a-z0-9_]*\.username\s+AS\s+created_by_name\s*,\s*/gi,
    "",
  );
  next = next.replace(
    /,\s*[a-z_][a-z0-9_]*\.username\s+AS\s+created_by_name/gi,
    "",
  );
  next = next.replace(
    /[a-z_][a-z0-9_]*\.username\s+AS\s+created_by_name\s*,\s*/gi,
    "",
  );

  // Remove created_by audit joins that are unsafe across many tables/views.
  next = next.replace(
    /\s+(?:LEFT\s+JOIN|JOIN)\s+adm_users\s+[a-z_][a-z0-9_]*\s+ON\s+[a-z_][a-z0-9_]*\.id\s*=\s*(?:[a-z_][a-z0-9_]*\.)?created_by\b/gi,
    "",
  );
  next = next.replace(
    /\s+(?:LEFT\s+JOIN|JOIN)\s+adm_users\s+[a-z_][a-z0-9_]*\s+ON\s+[a-z_][a-z0-9_]*\.id\s*=\s*created_by\b/gi,
    "",
  );

  // Clean up common trailing comma artifacts in SELECT lists.
  next = next.replace(/,\s*(FROM)\b/gi, " $1");

  return next;
}

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
      (err.message &&
        (err.message.includes("prepared statement") ||
          err.message.includes("syntax to use near '?'")))
    ) {
      const [rows] = await pool.query(sql, params);
      return rows;
    }
    const msg = String(err?.message || "").toLowerCase();
    const sqlText = String(sql || "").toLowerCase();
    const canRetryAuditJoin =
      (err?.code === "ER_BAD_FIELD_ERROR" ||
        err?.code === "ER_NON_UNIQ_ERROR" ||
        err?.code === "ER_NONUNIQ_TABLE" ||
        err?.code === "ER_PARSE_ERROR" ||
        err?.code === "ER_OPERAND_COLUMNS") &&
      (msg.includes("created_by") ||
        msg.includes("created_by_name") ||
        sqlText.includes("created_by") ||
        sqlText.includes("created_by_name"));
    if (canRetryAuditJoin) {
      const patchedSql = sanitizeCreatedByAuditJoin(sql);
      if (patchedSql !== sql) {
        const [rows] = await pool.query(patchedSql, params);
        return rows;
      }
    }
    throw err;
  }
}
