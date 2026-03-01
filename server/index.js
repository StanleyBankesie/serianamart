import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";

import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import adminRoutes from "./routes/admin.route.js";
import salesRoutes from "./routes/sales.route.js";
import purchaseRoutes from "./routes/purchase.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import financeRoutes from "./routes/finance.routes.js";
import hrRoutes from "./routes/hr.routes.js";
import maintenanceRoutes from "./routes/maintenance.routes.js";
import projectsRoutes from "./routes/projects.routes.js";
import productionRoutes from "./routes/production.routes.js";
import posRoutes from "./routes/pos.routes.js";
import biRoutes from "./routes/bi.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import workflowRoutes from "./routes/workflow.routes.js";
import healthRoutes from "./routes/health.route.js";
import authRoutes from "./routes/auth.routes.js";
import { query } from "./db/pool.js";
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
import { initializeSocket } from "./utils/socket.js";

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

const app = express();

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
    // "https://serianaserver.omnisuite-erp.com",
  ];
})();

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, true);
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
  }),
);

app.options("*", cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

/* ---------------- DB ---------------- */

/* ---------------- ROUTES ---------------- */
if (boolEnv(process.env.DISABLE_KEEP_ALIVE)) {
  app.use((req, res, next) => {
    try {
      res.setHeader("Connection", "close");
    } catch {}
    next();
  });
}
app.use(
  "/uploads",
  express.static(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "uploads"),
  ),
);
app.use("/api/admin", adminRoutes);
app.use("/api/workflows", workflowRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/purchase", purchaseRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/hr", hrRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/production", productionRoutes);
app.use("/api/pos", posRoutes);
app.use("/api/bi", biRoutes);
app.use("/api/", healthRoutes);
app.use("/api", authRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/templates", templatesRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/social-feed", socialFeedRoutes);
app.use("/api/access", accessRoutes);
app.use("/api/chat", chatRoutes);

/* ---------------- STATIC FILES & SPA FALLBACK ---------------- */
const serveFrontendFlag = (() => {
  const v1 = String(process.env.SERVE_FRONTEND || "").toLowerCase();
  const v2 = String(process.env.ENABLE_SPA || "").toLowerCase();
  return v1 === "1" || v1 === "true" || v2 === "1" || v2 === "true";
})();
if (serveFrontendFlag) {
  let frontendPath = null;
  const overrideDir =
    String(process.env.STATIC_DIR || process.env.PUBLIC_DIR || "").trim() ||
    null;
  if (overrideDir) {
    const abs =
      path.isAbsolute(overrideDir) === true
        ? overrideDir
        : path.join(process.cwd(), overrideDir);
    if (fs.existsSync(path.join(abs, "index.html"))) {
      frontendPath = abs;
    }
  }
  const distPath = path.join(__dirname, "../client/dist");
  const distIndex = path.join(distPath, "index.html");
  const publicPath = path.join(__dirname, "public");
  const publicIndex = path.join(publicPath, "index.html");
  if (!frontendPath && fs.existsSync(distIndex)) {
    frontendPath = distPath;
    console.log("Serving frontend from ../client/dist");
  } else if (!frontendPath && fs.existsSync(publicIndex)) {
    frontendPath = publicPath;
    console.log("Serving frontend from ./public");
  } else if (!frontendPath) {
    frontendPath = fs.existsSync(distPath) ? distPath : publicPath;
    console.warn(
      "Frontend build not found (index.html missing) in ./public or ../client/dist",
    );
  }
  if (frontendPath && fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
  }
  app.get("*", (req, res, next) => {
    if (req.url.startsWith("/api")) {
      return next();
    }
    const indexPath = path.join(frontendPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send("Frontend not built or index.html missing.");
    }
  });
} else {
  app.get("/", (req, res) => {
    res.status(200).json({ status: "ok" });
  });
  // Explicitly block any non-API routes from rendering a SPA or static login
  app.get(/^\/(?!api\/|uploads\/|socket\.io\/).*/, (req, res) => {
    res.status(404).json({
      error: "Not Found",
      scope: "backend-api",
      path: req.path,
    });
  });
}

/* ---------------- ERRORS ---------------- */
// app.use(notFound); // Handled by SPA catch-all now, or use for API 404s if desired
app.use(errorHandler);

const PORT = Number(process.env.PORT || 4002);

// Create HTTP server for Socket.io
const server = http.createServer(app);

// Timeouts to avoid long-hanging connections in managed hosting
try {
  const keepAliveMs = Number(process.env.KEEP_ALIVE_TIMEOUT_MS || 60000);
  const headersMs = Number(process.env.HEADERS_TIMEOUT_MS || 65000);
  const requestMs = process.env.REQUEST_TIMEOUT_MS
    ? Number(process.env.REQUEST_TIMEOUT_MS)
    : undefined;
  server.keepAliveTimeout = keepAliveMs;
  server.headersTimeout = headersMs;
  if (requestMs !== undefined && Number.isFinite(requestMs)) {
    server.requestTimeout = requestMs;
  }
} catch {}

// Initialize Socket.io
let ioInstance = null;
const socketsDisabled =
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
    verifyMailer().then((ok) => {
      console.log(`Mailer verified: ${ok ? "yes" : "no"}`);
    });
    (async () => {
      try {
        await query("SELECT 1");
        console.log("Database connectivity: ok");
        const admin = await query(
          "SELECT id, is_active FROM adm_users WHERE username = :u LIMIT 1",
          { u: "admin" },
        );
        if (!admin.length) {
          console.log("Admin user 'admin' not found");
        } else {
          const a = admin[0];
          console.log(
            `Admin user status: id=${a.id}, active=${Number(a.is_active) === 1 ? "yes" : "no"}`,
          );
        }
      } catch (e) {
        console.log(`[StartupCheck] ${e?.message || e}`);
      }
      try {
        const allowDefault =
          String(process.env.AUTH_ALLOW_DEFAULT_LOGIN || "").trim() === "1";
        if (allowDefault) {
          console.log("Emergency default login is ENABLED");
        }
      } catch {}
      try {
        const secret = process.env.JWT_SECRET || "";
        if (!secret) {
          console.log("JWT secret missing");
        }
      } catch {}
    })();
    // Automatic low-stock email & notification scheduler
    const intervalMin = Number(process.env.LOW_STOCK_ALERT_INTERVAL_MIN || 30);
    const throttleHours = Number(
      process.env.LOW_STOCK_ALERT_THROTTLE_HOURS || 6,
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
              `SELECT id FROM adm_notifications 
               WHERE user_id = :userId 
                 AND title = 'Low Stock Alert' 
                 AND created_at > DATE_SUB(NOW(), INTERVAL :h HOUR)
               LIMIT 1`,
              { userId: u.id, h: throttleHours },
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
                await sendMail({ to: u.email, subject, text, html });
              } catch (e) {
                console.log(`[EMAIL ERROR] ${e?.message || e}`);
              }
            } else {
              console.log(
                `[MOCK EMAIL] To: ${u.email || "(none)"} | Subject: ${subject}`,
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
          }
        }
      } catch (e) {
        console.log(`[LowStockScheduler] Error: ${e?.message || e}`);
      }
    }
    setInterval(runLowStockAlerts, Math.max(5, intervalMin) * 60 * 1000);
  });
}

export default app;
