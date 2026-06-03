import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import rateLimit from "express-rate-limit";

import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import adminRoutes from "./routes/admin.route.js";
import salesRoutes from "./routes/sales.route.js";
import purchaseRoutes from "./routes/purchase.routes.js";
import purchaseBillsRoutes from "./routes/purchase.bills.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import financeRoutes from "./routes/finance.routes.js";
import hrRoutes from "./routes/hr.routes.js";
import maintenanceRoutes from "./routes/maintenance.routes.js";
import projectsRoutes from "./routes/projects.routes.js";
import productionRoutes from "./routes/production.routes.js";
import posRoutes from "./routes/pos.routes.js";
import biRoutes from "./routes/bi.routes.js";
import serviceMgmtRoutes from "./routes/service-management.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import workflowRoutes from "./routes/workflow.routes.js";
import healthRoutes from "./routes/health.route.js";
import authRoutes from "./routes/auth.routes.js";
import { logDbError, query, testDbConnection } from "./db/pool.js";
import { isMailerConfigured, verifyMailer, sendMail } from "./utils/mailer.js";
import pushRoutes, {
  sendPushToUser,
  getPublicKey,
} from "./routes/push.routes.js";
import templatesRoutes from "./routes/templates.routes.js";
import documentsRoutes from "./routes/documents.routes.js";
import socialFeedRoutes from "./routes/social-feed.routes.js";
import accessRoutes from "./routes/access.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import emailTestRoutes from "./routes/email-test.routes.js";
import visitorsRoutes from "./routes/visitors.routes.js";
import { initializeSocket } from "./utils/socket.js";
import {
  ensureExceptionalPermissionsTable,
  ensureSystemLogsTable,
} from "./utils/dbUtils.js";
import { seedDefaultTemplates } from "./services/seed-defaults.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------------- ENV ---------------- */
dotenv.config({ path: path.join(__dirname, ".env") });
const isProd = String(process.env.NODE_ENV).toLowerCase() === "production";
const prodPath = path.join(__dirname, ".env.production");
const localPath = path.join(__dirname, ".env.local");
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

const app = express();

app.use((req, res, next) => {
  res.setHeader(
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import rateLimit from "express-rate-limit";

import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import adminRoutes from "./routes/admin.route.js";
import salesRoutes from "./routes/sales.route.js";
import purchaseRoutes from "./routes/purchase.routes.js";
import purchaseBillsRoutes from "./routes/purchase.bills.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import financeRoutes from "./routes/finance.routes.js";
import hrRoutes from "./routes/hr.routes.js";
import maintenanceRoutes from "./routes/maintenance.routes.js";
import projectsRoutes from "./routes/projects.routes.js";
import productionRoutes from "./routes/production.routes.js";
import posRoutes from "./routes/pos.routes.js";
import biRoutes from "./routes/bi.routes.js";
import serviceMgmtRoutes from "./routes/service-management.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import workflowRoutes from "./routes/workflow.routes.js";
import healthRoutes from "./routes/health.route.js";
import authRoutes from "./routes/auth.routes.js";
import { logDbError, query, testDbConnection } from "./db/pool.js";
import { isMailerConfigured, verifyMailer, sendMail } from "./utils/mailer.js";
import pushRoutes, {
  sendPushToUser,
  getPublicKey,
} from "./routes/push.routes.js";
import templatesRoutes from "./routes/templates.routes.js";
import documentsRoutes from "./routes/documents.routes.js";
import socialFeedRoutes from "./routes/social-feed.routes.js";
import accessRoutes from "./routes/access.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import emailTestRoutes from "./routes/email-test.routes.js";
import visitorsRoutes from "./routes/visitors.routes.js";
import { initializeSocket } from "./utils/socket.js";
import {
  ensureExceptionalPermissionsTable,
  ensureSystemLogsTable,
} from "./utils/dbUtils.js";
import { seedDefaultTemplates } from "./services/seed-defaults.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------------- ENV ---------------- */
dotenv.config({ path: path.join(__dirname, ".env") });
const isProd = String(process.env.NODE_ENV).toLowerCase() === "production";
const prodPath = path.join(__dirname, ".env.production");
const localPath = path.join(__dirname, ".env.local");
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

const app = express();

app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' http://localhost:* ws://localhost:*;"
  );
  next();
});

/* ---------------- HTTP/2 COMPAT ---------------- */
// Removed monkey-patch: stripping Transfer-Encoding and Connection headers
// severely breaks HTTP/1.1 chunked encoding behind Apache/Nginx proxies,
// leading to 30-second delays and worker pool exhaustion (ERR_CONNECTION_TIMED_OUT).



/* ---------------- UTILS ---------------- */
const boolEnv = (v) => {
  if (v == null) return false;
  const s = String(v).toLowerCase().trim();
  return s === "1" || s === "true" || s === "yes" || s === "on";
};

/* ---------------- CORS ---------------- */
const allowedOrigins = (() => {
  const raw = String(process.env.CORS_ALLOWED_ORIGINS || "").trim();
  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "https://serianamart.omnisuite-erp.com",
  ];
})();

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-company-id",
    "x-branch-id",
    "x-user-id",
    "x-skip-offline-queue",
  ],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
  boolEnv(process.env.DISABLE_SOCKETS) ||
  boolEnv(process.env.DISABLE_LONG_CONNECTIONS);
if (process.env.NODE_ENV !== "test" && !socketsDisabled) {
  ioInstance = initializeSocket(server);
} else {
  try {
    console.log(
      socketsDisabled
        ? "Socket.io disabled by environment"
        : "Skipping Socket.io in test environment",
    );
  } catch {}
}

// Export io for use in other modules
export { ioInstance as io };

if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Mailer configured: ${isMailerConfigured() ? "yes" : "no"}`);
    verifyMailer()
      .then((ok) => {
        console.log(`Mailer verified: ${ok ? "yes" : "no"}`);
      })
      .catch((error) => {
        console.error(`[Mailer] verification failed: ${error?.message || error}`);
      });
    (async () => {
      try {
        const dbCheck = await testDbConnection({ silent: true });
        if (!dbCheck.ok) {
          throw dbCheck.error;
        }
        try {
          await ensureExceptionalPermissionsTable();
        } catch {}
        try {
          await ensureSystemLogsTable();
        } catch {}
        try {
          await seedDefaultTemplates();
        } catch {}
      } catch (e) {
        logDbError("Startup check failed", e);
      }
      try {
        const secret = process.env.JWT_SECRET || "";
        if (!secret) {
          console.log("JWT secret missing");
        }
      } catch {}
    })();
    // Automatic low-stock push + email scheduler (6:00 AM and 6:00 PM)
    const scheduledHours = [6, 18];
    const throttleHours = Number(
      process.env.LOW_STOCK_ALERT_THROTTLE_HOURS || 11,
    );
    async function runLowStockAlerts() {
      try {
        const branches = await query(
          `SELECT id, company_id FROM adm_branches WHERE is_active = 1 LIMIT 1000`,
        );
        for (const b of branches) {
          const companyId = Number(b.company_id);
          const branchId = Number(b.id);
          const items = await query(
            `
            SELECT 
              i.id, i.item_code, i.item_name, i.uom,
              COALESCE(sb.qty, 0) AS qty,
              COALESCE(i.reorder_level, 0) AS reorder_level
            FROM inv_items i
            LEFT JOIN (
              SELECT company_id, branch_id, item_id, SUM(qty) AS qty
              FROM inv_stock_balances
              GROUP BY company_id, branch_id, item_id
            ) sb
              ON sb.company_id = i.company_id
             AND sb.branch_id = :branchId
             AND sb.item_id = i.id
            WHERE i.company_id = :companyId
              AND COALESCE(i.reorder_level, 0) > 0
              AND COALESCE(sb.qty, 0) <= COALESCE(i.reorder_level, 0)
            ORDER BY qty ASC, i.item_name ASC
            LIMIT 100
            `,
            { companyId, branchId },
          );
          if (!items.length) continue;
          // Filter recipients by notification preferences (low-stock)
          await query(`
            CREATE TABLE IF NOT EXISTS adm_notification_prefs (
              user_id BIGINT UNSIGNED NOT NULL,
              pref_key VARCHAR(100) NOT NULL,
              push_enabled TINYINT(1) NOT NULL DEFAULT 0,
              email_enabled TINYINT(1) NOT NULL DEFAULT 0,
              created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (user_id, pref_key),
              INDEX idx_pref_key (pref_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);
          const recipients = await query(
            `SELECT u.id, u.email, np.push_enabled, np.email_enabled
             FROM adm_users u
             JOIN adm_notification_prefs np ON np.user_id = u.id AND np.pref_key = 'low-stock'
             WHERE u.is_active = 1 
               AND u.company_id = :companyId 
               AND u.branch_id = :branchId`,
            { companyId, branchId },
          );
          for (const u of recipients) {
            const recent = await query(
              `SELECT id FROM adm_system_logs 
               WHERE user_id = :userId 
                 AND action = 'low-stock-alert' 
                 AND event_time > DATE_SUB(NOW(), INTERVAL :throttle HOUR) 
               LIMIT 1`,
              { userId: u.id, throttle: throttleHours },
            );
            if (recent.length) continue;
            const count = items.length;
            const subject = `Low Stock Alert (${count} items)`;
            const lines = items
              .slice(0, 20)
              .map(
                (it) =>
                  `${it.item_code} ${it.item_name} — qty ${Number(
                    it.qty || 0,
                  )}, reorder ${Number(it.reorder_level || 0)}`,
              )
              .join("\n");
            const text = `${count} items are at or below reorder levels.\n\n${lines}\n\nOpen: /inventory/alerts/low-stock`;
            const htmlRows = items
              .slice(0, 20)
              .map(
                (it) =>
                  `<tr><td>${it.item_code}</td><td>${it.item_name}</td><td style="text-align:right">${Number(
                    it.qty || 0,
                  )}</td><td style="text-align:right">${Number(
                    it.reorder_level || 0,
                  )}</td></tr>`,
              )
              .join("");
            const html = `<p>${count} items are at or below reorder levels.</p><table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Code</th><th>Name</th><th>Qty</th><th>Reorder</th></tr></thead><tbody>${htmlRows}</tbody></table><p><a href="/inventory/alerts/low-stock">Open Alerts</a></p>`;
            if (
              Number(u?.email_enabled) === 1 &&
              isMailerConfigured() &&
              u.email
            ) {
              try {
                await sendMail({
                  to: u.email,
                  subject,
                  text,
                  html,
                  meta: {
                    moduleName: "Inventory",
                    action: "EMAIL_SENT",
                    userId: u.id,
                    companyId,
                    branchId,
                    message: `Low stock alert email sent to ${u.email}`,
                    urlPath: "/inventory/alerts/low-stock",
                  },
                });
              } catch (e) {
                console.log(`[EMAIL ERROR] ${e?.message || e}`);
              }
            } else {
              console.log(
                `[MOCK ERROR] To: ${u.email || "(none)"} | Subject: ${subject}`,
              );
            }
            if (Number(u?.push_enabled) === 1) {
              await query(
                `INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
                 VALUES (:companyId, :userId, :title, :message, :link, 0)`,
                {
                  companyId,
                  userId: u.id,
                  title: "Low Stock Alert",
                  message:
                    count <= 5
                      ? "Items are at or below reorder levels"
                      : `${count} items are at or below reorder levels`,
                  link: "/inventory/alerts/low-stock",
                },
              );
              try {
                await sendPushToUser(u.id, {
                  title: "Low Stock Alert",
                  message:
                    count <= 5
                      ? "Items are at or below reorder levels"
                      : `${count} items are at or below reorder levels`,
                  link: "/inventory/alerts/low-stock",
                  tag: "low-stock",
                });
              } catch {}
            }
            try {
              await query(
                `INSERT INTO adm_system_logs (company_id, branch_id, user_id, module_name, action, message, url_path, event_time)
                 VALUES (:companyId, :branchId, :userId, 'Inventory', 'low-stock-alert', :message, '/inventory/alerts/low-stock', NOW())`,
                {
                  companyId,
                  branchId,
                  userId: u.id,
                  message: `Low stock alerts processed (${count} items)`,
                },
              );
            } catch {}
          }
        }
      } catch (e) {
        console.log(`[LowStockScheduler] Error: ${e?.message || e}`);
      }
    }
    let lowStockRunInProgress = false;
    let lastLowStockSlotKey = "";
    async function runLowStockAlertsOnSchedule() {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      if (!scheduledHours.includes(hour) || minute !== 0) return;
      const y = String(now.getFullYear());
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const h = String(hour).padStart(2, "0");
      const slotKey = `${y}-${m}-${d}-${h}`;
      if (lastLowStockSlotKey === slotKey || lowStockRunInProgress) return;
      lowStockRunInProgress = true;
      try {
        await runLowStockAlerts();
        lastLowStockSlotKey = slotKey;
        console.log(`[LowStockScheduler] Completed scheduled run at ${slotKey}:00`);
      } finally {
        lowStockRunInProgress = false;
      }
    }
    setInterval(() => {
      runLowStockAlertsOnSchedule().catch((e) =>
        console.log(`[LowStockScheduler] Schedule check failed: ${e?.message || e}`),
      );
    }, 30 * 1000);
    runLowStockAlertsOnSchedule().catch((e) =>
      console.log(`[LowStockScheduler] Initial schedule check failed: ${e?.message || e}`),
    );
  });
}

export default app;
