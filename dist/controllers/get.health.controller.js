import { getDbHealth } from "../db/pool.js";

function buildHealthPayload(dbHealth) {
  return {
    status: dbHealth.db === "up" ? "ok" : "degraded",
    db: dbHealth.db,
    dbError: dbHealth.dbError || undefined,
    uptime: dbHealth.uptime,
    pid: dbHealth.pid,
  };
}

export const getHealth = async (_req, res) => {
  const dbHealth = await getDbHealth({ probe: true });
  const payload = buildHealthPayload(dbHealth);
  return res.status(dbHealth.db === "up" ? 200 : 503).json(payload);
};

export const getDbHealthDetails = async (_req, res) => {
  const dbHealth = await getDbHealth({ probe: true });
  const payload = buildHealthPayload(dbHealth);
  return res.status(dbHealth.db === "up" ? 200 : 503).json(payload);
};
