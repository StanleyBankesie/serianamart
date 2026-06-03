import mysql from "mysql2/promise";
import "../utils/loadServerEnv.js";

function optionalEnv(name, fallback) {
  const value = process.env[name];
  return value === undefined ? fallback : value;
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const dbConfig = {
  host: String(optionalEnv("DB_HOST", "")).trim(),
  user: String(optionalEnv("DB_USER", "")).trim(),
  password:
    process.env.DB_PASSWORD === undefined ? undefined : process.env.DB_PASSWORD,
  database: String(optionalEnv("DB_NAME", "")).trim(),
  port: parseNumber(optionalEnv("DB_PORT", 3306), 3306),
  connectionLimit: parseNumber(optionalEnv("DB_CONNECTION_LIMIT", 50), 50),
  connectTimeout: parseNumber(
    optionalEnv("DB_CONNECT_TIMEOUT_MS", 10000),
    10000,
  ),
  queryTimeout: parseNumber(optionalEnv("DB_QUERY_TIMEOUT_MS", 15000), 15000),
  reconnectCooldownMs: parseNumber(
    optionalEnv("DB_RECONNECT_COOLDOWN_MS", 5000),
    5000,
  ),
};

const startupTime = Date.now();

const dbState = {
  status: "down",
  lastError: null,
  lastErrorAt: null,
  lastSuccessAt: null,
  lastConnectAttemptAt: 0,
  lastConnectLogKey: null,
};

let activePool = null;
let activePoolPromise = null;

function sanitizeCreatedByAuditJoin(sql) {
  if (!sql) return sql;
  let next = String(sql);

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
  next = next.replace(
    /\s+(?:LEFT\s+JOIN|JOIN)\s+adm_users\s+[a-z_][a-z0-9_]*\s+ON\s+[a-z_][a-z0-9_]*\.id\s*=\s*(?:[a-z_][a-z0-9_]*\.)?created_by\b/gi,
    "",
  );
  next = next.replace(
    /\s+(?:LEFT\s+JOIN|JOIN)\s+adm_users\s+[a-z_][a-z0-9_]*\s+ON\s+[a-z_][a-z0-9_]*\.id\s*=\s*created_by\b/gi,
    "",
  );
  next = next.replace(/,\s*(FROM)\b/gi, " $1");

  return next;
}

export function formatDbError(err) {
  if (!err) {
    return {
      code: "DB_UNKNOWN",
      errno: null,
      sqlMessage: null,
      message: "Unknown database error",
      stack: null,
    };
  }

  return {
    code: err.code || "DB_ERROR",
    errno: err.errno ?? null,
    sqlMessage: err.sqlMessage || null,
    message: err.message || String(err),
    stack: err.stack || null,
  };
}

export function logDbError(context, err) {
  const details = formatDbError(err);
  console.error(`[DB] ${context}`);
  console.error(
    `[DB] code=${details.code} errno=${details.errno ?? "n/a"} sqlMessage=${details.sqlMessage ?? "n/a"}`,
  );
  console.error(`[DB] message=${details.message}`);
  if (details.stack) {
    console.error(details.stack);
  }
}

function setDbFailure(err) {
  dbState.status = "down";
  dbState.lastError = formatDbError(err);
  dbState.lastErrorAt = Date.now();
}

function setDbSuccess() {
  dbState.status = "up";
  dbState.lastSuccessAt = Date.now();
  dbState.lastError = null;
}

function isConfigured() {
  return Boolean(
    dbConfig.host &&
      dbConfig.user &&
      dbConfig.database &&
      dbConfig.password !== undefined,
  );
}

function getMissingConfigFields() {
  const missing = [];
  if (!dbConfig.host) missing.push("DB_HOST");
  if (!dbConfig.user) missing.push("DB_USER");
  if (!dbConfig.database) missing.push("DB_NAME");
  if (dbConfig.password === undefined) missing.push("DB_PASSWORD");
  return missing;
}

function createDbUnavailableError(baseError = null) {
  const details = formatDbError(baseError || dbState.lastError);
  const error = new Error(details.message || "Database unavailable");
  error.code = details.code || "DB_UNAVAILABLE";
  error.errno = details.errno ?? null;
  error.sqlMessage = details.sqlMessage || null;
  error.stack = details.stack || error.stack;
  return error;
}

function logDbConnectionTarget() {
  const logKey = `${dbConfig.host}:${dbConfig.port}:${dbConfig.user}:${dbConfig.database}`;
  if (dbState.lastConnectLogKey === logKey) return;
  dbState.lastConnectLogKey = logKey;
  console.log(
    `DB connecting to ${dbConfig.host || "(missing-host)"}:${dbConfig.port} as ${dbConfig.user || "(missing-user)"} db=${dbConfig.database || "(missing-db)"}`,
  );
}

function createPoolInstance() {
  return mysql.createPool({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    waitForConnections: true,
    connectionLimit: dbConfig.connectionLimit,
    queueLimit: 0,
    acquireTimeout: 10000,
    namedPlaceholders: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    connectTimeout: dbConfig.connectTimeout,
  });
}

async function closePool(poolToClose) {
  if (!poolToClose) return;
  try {
    await poolToClose.end();
  } catch {}
}

function isReconnectableError(err) {
  const code = String(err?.code || "").toUpperCase();
  return [
    "PROTOCOL_CONNECTION_LOST",
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "EHOSTUNREACH",
    "ENOTFOUND",
    "EPIPE",
    "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR",
    "POOL_CLOSED",
  ].includes(code);
}

function isDbConnectionFailure(err) {
  const code = String(err?.code || "").toUpperCase();
  return isReconnectableError(err) || [
    "ER_ACCESS_DENIED_ERROR",
    "ER_BAD_DB_ERROR",
    "ER_CON_COUNT_ERROR",
    "ER_NOT_SUPPORTED_AUTH_MODE",
  ].includes(code);
}

function withQueryTimeout(executor, sqlText) {
  if (!dbConfig.queryTimeout) {
    return executor();
  }

  let timeoutHandle = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      const timeoutError = new Error(
        `Database query timeout after ${dbConfig.queryTimeout}ms`,
      );
      timeoutError.code = "DB_QUERY_TIMEOUT";
      timeoutError.sqlMessage = typeof sqlText === "string" ? sqlText : null;
      reject(timeoutError);
    }, dbConfig.queryTimeout);
    if (typeof timeoutHandle?.unref === "function") {
      timeoutHandle.unref();
    }
  });

  return Promise.race([executor(), timeoutPromise]).finally(() => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  });
}

async function ensurePool(forceReconnect = false) {
  if (!isConfigured()) {
    const missing = getMissingConfigFields();
    const configError = new Error(
      `Database not configured: missing ${missing.join(", ")}`,
    );
    configError.code = "DB_NOT_CONFIGURED";
    setDbFailure(configError);
    logDbError("Database configuration invalid", configError);
    return null;
  }

  if (!forceReconnect && activePool) {
    return activePool;
  }

  if (
    !forceReconnect &&
    activePoolPromise
  ) {
    return activePoolPromise;
  }

  const now = Date.now();
  if (
    !forceReconnect &&
    !activePool &&
    dbState.lastConnectAttemptAt &&
    now - dbState.lastConnectAttemptAt < dbConfig.reconnectCooldownMs
  ) {
    return null;
  }

  dbState.lastConnectAttemptAt = now;

  activePoolPromise = (async () => {
    const previousPool = activePool;
    activePool = null;

    if (forceReconnect) {
      await closePool(previousPool);
      dbState.lastConnectLogKey = null;
    }

    logDbConnectionTarget();

    let candidatePool = null;
    try {
      candidatePool = createPoolInstance();
      const connection = await candidatePool.getConnection();
      try {
        await withQueryTimeout(() => connection.query("SELECT 1"), "SELECT 1");
      } finally {
        connection.release();
      }
      activePool = candidatePool;
      setDbSuccess();
      console.log("DB connected OK");
      return activePool;
    } catch (err) {
      setDbFailure(err);
      logDbError("DB connection failed", err);
      await closePool(candidatePool);
      return null;
    } finally {
      activePoolPromise = null;
    }
  })();

  return activePoolPromise;
}

async function withPoolOperation(operationName, executor, options = {}) {
  const { sqlText = null, retryOnReconnect = true } = options;
  const currentPool = await ensurePool();
  if (!currentPool) {
    throw createDbUnavailableError();
  }

  try {
    const result = await withQueryTimeout(
      () => executor(currentPool),
      sqlText || operationName,
    );
    if (operationName === "db-health-check") {
      setDbSuccess();
    }
    return result;
  } catch (err) {
    if (isDbConnectionFailure(err)) {
      setDbFailure(err);
      logDbError(`${operationName} failed`, err);
    }

    if (retryOnReconnect && isReconnectableError(err)) {
      const reconnectedPool = await ensurePool(true);
      if (!reconnectedPool) {
        throw createDbUnavailableError(err);
      }
      return withQueryTimeout(
        () => executor(reconnectedPool),
        sqlText || operationName,
      );
    }

    throw err;
  }
}

function wrapConnection(connection) {
  return new Proxy(connection, {
    get(target, prop, receiver) {
      if (prop === "query") {
        return (sql, params) =>
          withQueryTimeout(() => target.query(sql, params), sql);
      }

      if (prop === "execute") {
        return (sql, params) =>
          withQueryTimeout(() => target.execute(sql, params), sql);
      }

      if (prop === "release" || prop === "destroy") {
        return (...args) => Reflect.get(target, prop, receiver).apply(target, args);
      }

      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export const pool = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === "query") {
        return (sql, params) =>
          withPoolOperation(
            "pool.query",
            (currentPool) => currentPool.query(sql, params),
            { sqlText: sql },
          );
      }

      if (prop === "execute") {
        return (sql, params) =>
          withPoolOperation(
            "pool.execute",
            (currentPool) => currentPool.execute(sql, params),
            { sqlText: sql },
          );
      }

      if (prop === "getConnection") {
        return async () => {
          const connection = await withPoolOperation(
            "pool.getConnection",
            (currentPool) => currentPool.getConnection(),
            { retryOnReconnect: true },
          );
          return wrapConnection(connection);
        };
      }

      if (prop === "end") {
        return async () => {
          const currentPool = activePool;
          activePool = null;
          activePoolPromise = null;
          dbState.lastConnectLogKey = null;
          await closePool(currentPool);
        };
      }

      if (!activePool) {
        return undefined;
      }

      const value = activePool[prop];
      return typeof value === "function" ? value.bind(activePool) : value;
    },
  },
);

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

    const message = String(err?.message || "").toLowerCase();
    const sqlText = String(sql || "").toLowerCase();
    const canRetryAuditJoin =
      (err?.code === "ER_BAD_FIELD_ERROR" ||
        err?.code === "ER_NON_UNIQ_ERROR" ||
        err?.code === "ER_NONUNIQ_TABLE" ||
        err?.code === "ER_PARSE_ERROR" ||
        err?.code === "ER_OPERAND_COLUMNS") &&
      (message.includes("created_by") ||
        message.includes("created_by_name") ||
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

export async function testDbConnection({ silent = false } = {}) {
  try {
    const rows = await withPoolOperation(
      "db-health-check",
      (currentPool) => currentPool.query("SELECT 1 AS ok"),
      { sqlText: "SELECT 1", retryOnReconnect: true },
    );
    if (!silent) {
      console.log("DB connected OK");
    }
    return { ok: true, rows };
  } catch (err) {
    setDbFailure(err);
    if (!silent) {
      logDbError("DB health check failed", err);
    }
    return { ok: false, error: formatDbError(err) };
  }
}

export async function getDbHealth({ probe = false } = {}) {
  if (probe) {
    await testDbConnection({ silent: true });
  }

  return {
    status: dbState.status,
    db: dbState.status === "up" ? "up" : "down",
    dbError: dbState.lastError?.message || null,
    dbErrorCode: dbState.lastError?.code || null,
    uptime: Math.floor((Date.now() - startupTime) / 1000),
    pid: process.pid,
    lastErrorAt: dbState.lastErrorAt,
    lastSuccessAt: dbState.lastSuccessAt,
  };
}

export function getDbConfig() {
  return {
    host: dbConfig.host || null,
    port: dbConfig.port,
    user: dbConfig.user || null,
    database: dbConfig.database || null,
    connectionLimit: dbConfig.connectionLimit,
    connectTimeout: dbConfig.connectTimeout,
    queryTimeout: dbConfig.queryTimeout,
    hasPassword: dbConfig.password !== undefined,
    isConfigured: isConfigured(),
  };
}

query.pool = pool;

void testDbConnection({ silent: false });

export default pool;