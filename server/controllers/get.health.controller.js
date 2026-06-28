/**
 * @file get.health.controller.js
 * @description Controllers for handling database and application health checks.
 */
// Database Dependencies
import { getDbHealth } from "../db/pool.js";

// Utility function to structure health payload
function buildHealthPayload(dbHealth) {
  return {
    status: dbHealth.db === "up" ? "ok" : "degraded",
    db: dbHealth.db,
    dbError: dbHealth.dbError || undefined,
    uptime: dbHealth.uptime,
    pid: dbHealth.pid,
  };
}

// System Health Endpoint
export const getHealth = async (_req, res) => {
  // Probe database connection
  const dbHealth = await getDbHealth({ probe: true });
  // Structure response payload
  const payload = buildHealthPayload(dbHealth);
  // Return appropriate HTTP status based on db state
  return res.status(dbHealth.db === "up" ? 200 : 503).json(payload);
};

// Detailed Database Health Endpoint
export const getDbHealthDetails = async (_req, res) => {
  // Probe database connection for detailed metrics
  const dbHealth = await getDbHealth({ probe: true });
  // Structure response payload
  const payload = buildHealthPayload(dbHealth);
  // Return appropriate HTTP status based on db state
  return res.status(dbHealth.db === "up" ? 200 : 503).json(payload);
};
