import { query } from "../db/pool.js";

const STARTED_AT = Date.now();

export const getHealth = async (req, res) => {
  const started = Date.now();
  let dbOk = false;
  let dbLatencyMs = null;
  let dbError = null;
  try {
    const dbStart = Date.now();
    await query("SELECT 1 AS ok");
    dbLatencyMs = Date.now() - dbStart;
    dbOk = true;
  } catch (err) {
    dbError = String(err?.message || "Database check failed");
  }

  const uptimeSeconds = Math.floor((Date.now() - STARTED_AT) / 1000);
  const payload = {
    ok: dbOk,
    service: "serianamart-api",
    status: dbOk ? "healthy" : "degraded",
    uptime_seconds: uptimeSeconds,
    checks: {
      database: {
        ok: dbOk,
        latency_ms: dbLatencyMs,
        error: dbError,
      },
    },
    response_time_ms: Date.now() - started,
  };

  return res.status(dbOk ? 200 : 503).json(payload);
};
