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
import serviceMgmtRoutes from "./routes/service-management.routes.js";
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
import emailTestRoutes from "./routes/email-test.routes.js";
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
(async () => {
  try {
    await query("SELECT 1");

    // Check if the column already exists
    const columns = await query(
      "SHOW COLUMNS FROM `fin_voucher_lines` LIKE 'payment_method'",
    );

    if (!columns || columns.length === 0) {
      console.log(
        "Adding `payment_method` column to `fin_voucher_lines` table...",
      );
      await query(
        "ALTER TABLE `fin_voucher_lines` ADD COLUMN `payment_method` VARCHAR(50) NULL DEFAULT NULL AFTER `cheque_date`",
      );
      console.log("Successfully added the `payment_method` column.");
    }

    // Check if created_by exists in fin_pdc_postings
    const pdcColumns = await query(
      "SHOW COLUMNS FROM `fin_pdc_postings` LIKE 'created_by'",
    );
    if (!pdcColumns || pdcColumns.length === 0) {
      console.log("Adding `created_by` column to `fin_pdc_postings` table...");
      await query(
        "ALTER TABLE `fin_pdc_postings` ADD COLUMN `created_by` BIGINT UNSIGNED NULL DEFAULT NULL",
      );
      console.log(
        "Successfully added the `created_by` column to `fin_pdc_postings`.",
      );
    }

    // Check if created_by exists in fin_vouchers
    const voucherColumns = await query(
      "SHOW COLUMNS FROM `fin_vouchers` LIKE 'created_by'",
    );
    if (!voucherColumns || voucherColumns.length === 0) {
      console.log("Adding `created_by` column to `fin_vouchers` table...");
      await query(
        "ALTER TABLE `fin_vouchers` ADD COLUMN `created_by` BIGINT UNSIGNED NULL DEFAULT NULL",
      );
      console.log(
        "Successfully added the `created_by` column to `fin_vouchers`.",
      );
    }

    // Check if created_by exists in fin_voucher_reversals
    const reversalColumns = await query(
      "SHOW COLUMNS FROM `fin_voucher_reversals` LIKE 'created_by'",
    );
    if (!reversalColumns || reversalColumns.length === 0) {
      console.log(
        "Adding `created_by` column to `fin_voucher_reversals` table...",
      );
      await query(
        "ALTER TABLE `fin_voucher_reversals` ADD COLUMN `created_by` BIGINT UNSIGNED NULL DEFAULT NULL",
      );
      console.log(
        "Successfully added the `created_by` column to `fin_voucher_reversals`.",
      );
    }

    // Check if created_by exists in fin_bank_reconciliations
    const reconColumns = await query(
      "SHOW COLUMNS FROM `fin_bank_reconciliations` LIKE 'created_by'",
    );
    if (!reconColumns || reconColumns.length === 0) {
      console.log(
        "Adding `created_by` column to `fin_bank_reconciliations` table...",
      );
      await query(
        "ALTER TABLE `fin_bank_reconciliations` ADD COLUMN `created_by` BIGINT UNSIGNED NULL DEFAULT NULL",
      );
      console.log(
        "Successfully added the `created_by` column to `fin_bank_reconciliations`.",
      );
    }

    try {
      await query(
        "ALTER TABLE `fin_account_groups` MODIFY COLUMN `code` VARCHAR(100) NOT NULL",
      );
    } catch (e) {
      console.warn(
        "Could not modify fin_account_groups code column: ",
        e.message,
      );
    }

    // Ensure HR Loan Type has account_id
    try {
      const resp = await query("SHOW TABLES LIKE 'hr_setup_loan_types'");
      if (resp && resp.length > 0) {
        const loanTypeCols = await query(
          "SHOW COLUMNS FROM `hr_setup_loan_types` LIKE 'account_id'",
        );
        if (!loanTypeCols || loanTypeCols.length === 0) {
          console.log("Adding `account_id` column to `hr_setup_loan_types`...");
          await query(
            "ALTER TABLE `hr_setup_loan_types` ADD COLUMN `account_id` BIGINT UNSIGNED NULL DEFAULT NULL",
          );
        }
      }
    } catch (e) {
      console.warn(
        "Could not add account_id to hr_setup_loan_types: ",
        e.message,
      );
    }

    // Ensure HR Loans has amount_due, end_date and correct status type
    try {
      const resp = await query("SHOW TABLES LIKE 'hr_loans'");
      if (resp && resp.length > 0) {
        const loanAmountDueCols = await query(
          "SHOW COLUMNS FROM `hr_loans` LIKE 'amount_due'",
        );
        if (!loanAmountDueCols || loanAmountDueCols.length === 0) {
          console.log("Adding `amount_due` column to `hr_loans`...");
          await query(
            "ALTER TABLE `hr_loans` ADD COLUMN `amount_due` DECIMAL(18,4) NULL DEFAULT NULL",
          );
        }
        const loanEndDateCols = await query(
          "SHOW COLUMNS FROM `hr_loans` LIKE 'end_date'",
        );
        if (!loanEndDateCols || loanEndDateCols.length === 0) {
          console.log("Adding `end_date` column to `hr_loans`...");
          await query(
            "ALTER TABLE `hr_loans` ADD COLUMN `end_date` DATE NULL DEFAULT NULL",
          );
        }
        const loanIdCols = await query(
          "SHOW COLUMNS FROM `hr_loans` LIKE 'loan_id'",
        );
        if (!loanIdCols || loanIdCols.length === 0) {
          console.log("Adding `loan_id` column to `hr_loans`...");
          await query(
            "ALTER TABLE `hr_loans` ADD COLUMN `loan_id` BIGINT UNSIGNED NULL DEFAULT NULL",
          );
        }

        // CRITICAL: Ensure status is VARCHAR to avoid ENUM errors with NEW 'ACTIVE' and 'COMPLETED' statuses
        await query(
          "ALTER TABLE `hr_loans` MODIFY COLUMN `status` VARCHAR(50) NOT NULL DEFAULT 'PENDING'",
        );
      }
    } catch (e) {
      console.warn(
        "Could not add columns or modify status in hr_loans: ",
        e.message,
      );
    }

    // Update HR Loan Statuses
    try {
      const resp = await query("SHOW TABLES LIKE 'hr_loans'");
      if (resp && resp.length > 0) {
        await query(
          "UPDATE hr_loans SET status = 'ACTIVE' WHERE status = 'REPAID'",
        );
        await query(
          "UPDATE hr_loans SET status = 'COMPLETED' WHERE status = 'DISBURSED'",
        );
      }
    } catch (e) {
      console.warn("Could not update hr_loans statuses: ", e.message);
    }

    // HR Loan Repayments Table
    try {
      await query(
        `CREATE TABLE IF NOT EXISTS hr_loan_repayments (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          company_id BIGINT UNSIGNED NOT NULL,
          employee_id BIGINT UNSIGNED NOT NULL,
          loan_id BIGINT UNSIGNED NOT NULL,
          amount_paid DECIMAL(18,4) NOT NULL,
          payment_date DATE NOT NULL,
          payroll_id BIGINT UNSIGNED NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_loan (loan_id),
          KEY idx_employee (employee_id),
          KEY idx_payroll (payroll_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      );
    } catch (e) {
      console.warn("Could not create hr_loan_repayments table: ", e.message);
    }

    // Add Triggers for hr_loans
    try {
      const resp = await query("SHOW TABLES LIKE 'hr_loans'");
      if (resp && resp.length > 0) {
        // Calculation Trigger (Insert)
        await query("DROP TRIGGER IF EXISTS `tg_hr_loans_before_insert`").catch(
          () => {},
        );
        await query(
          `CREATE TRIGGER \`tg_hr_loans_before_insert\` BEFORE INSERT ON \`hr_loans\` FOR EACH ROW
           BEGIN
             IF NEW.start_date IS NOT NULL THEN
               SET NEW.end_date = DATE_ADD(NEW.start_date, INTERVAL NEW.repayment_period_months MONTH);
               SET NEW.amount_due = GREATEST(0, NEW.amount - (NEW.monthly_installment * GREATEST(0, TIMESTAMPDIFF(MONTH, NEW.start_date, CURDATE()))));
             ELSE
               SET NEW.end_date = NULL;
               SET NEW.amount_due = NEW.amount;
             END IF;
           END`,
        );

        // Calculation Trigger (Update) - ONLY recalculate if amount_due is NOT being changed explicitly
        await query("DROP TRIGGER IF EXISTS `tg_hr_loans_before_update`").catch(
          () => {},
        );
        await query(
          `CREATE TRIGGER \`tg_hr_loans_before_update\` BEFORE UPDATE ON \`hr_loans\` FOR EACH ROW
           BEGIN
             IF NEW.start_date IS NOT NULL THEN
               SET NEW.end_date = DATE_ADD(NEW.start_date, INTERVAL NEW.repayment_period_months MONTH);
               -- Only recalculate balance if NOT explicitly changing amount_due (avoids conflict with payroll)
               IF NEW.amount_due = OLD.amount_due THEN
                 SET NEW.amount_due = GREATEST(0, NEW.amount - (NEW.monthly_installment * GREATEST(0, TIMESTAMPDIFF(MONTH, NEW.start_date, CURDATE()))));
               END IF;
             ELSE
               SET NEW.end_date = NULL;
               -- Only reset if not explicitly changing
               IF NEW.amount_due = OLD.amount_due THEN
                 SET NEW.amount_due = NEW.amount;
               END IF;
             END IF;
           END`,
        );

        // Approval Logic Trigger
        await query(
          "DROP TRIGGER IF EXISTS `trg_hr_loans_set_start_date`",
        ).catch(() => {});
        await query(
          `CREATE TRIGGER \`trg_hr_loans_set_start_date\` BEFORE UPDATE ON \`hr_loans\` FOR EACH ROW
           BEGIN
             IF NEW.status = 'APPROVED' AND OLD.status <> 'APPROVED' THEN
               IF NEW.start_date IS NULL THEN
                 SET NEW.start_date = DATE_ADD(CURDATE(), INTERVAL 1 MONTH);
               END IF;
             END IF;
           END`,
        );
      }
    } catch (e) {
      console.warn("Could not add triggers to hr_loans: ", e.message);
    }

    // Task 1: Remove constraints causing error in fin_pdc_postings
    try {
      // 1. Remove foreign key constraint fk_pdc_bank
      const fkConstraints = await query(
        `SELECT CONSTRAINT_NAME 
         FROM information_schema.KEY_COLUMN_USAGE 
         WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'fin_pdc_postings' 
           AND CONSTRAINT_NAME = 'fk_pdc_bank'`,
      );
      if (fkConstraints && fkConstraints.length > 0) {
        console.log(
          "Dropping foreign key constraint `fk_pdc_bank` from `fin_pdc_postings`...",
        );
        await query(
          "ALTER TABLE `fin_pdc_postings` DROP FOREIGN KEY `fk_pdc_bank`",
        ).catch((e) => {
          console.warn("Could not drop foreign key: ", e.message);
        });
        console.log("Successfully dropped `fk_pdc_bank`.");
      }

      // 2. Remove unique index uq_pdc_unique
      const uniqueIndexes = await query(
        `SELECT INDEX_NAME 
         FROM information_schema.STATISTICS 
         WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'fin_pdc_postings' 
           AND INDEX_NAME = 'uq_pdc_unique'`,
      );
      if (uniqueIndexes && uniqueIndexes.length > 0) {
        console.log(
          "Dropping unique index `uq_pdc_unique` from `fin_pdc_postings`...",
        );
        await query(
          "ALTER TABLE `fin_pdc_postings` DROP INDEX `uq_pdc_unique`",
        ).catch((e) => {
          console.warn("Could not drop unique index: ", e.message);
        });
        console.log("Successfully dropped `uq_pdc_unique`.");
      }
    } catch (e) {
      console.warn("Error checking for constraints: ", e.message);
    }
  } catch (err) {
    console.error("Error during database initialization:", err);
    // Don't exit process in dev if it's just a migration issue, but here it might be critical
    // process.exit(1);
  }
})();

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
// Expose uploads also under /api/uploads so dev proxies can access files
app.use(
  "/api/uploads",
  express.static(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "uploads"),
  ),
);
app.use("/api/admin", adminRoutes);
app.use("/api/administration", adminRoutes);
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
app.use("/api/service-management", serviceMgmtRoutes);
app.use("/api/", healthRoutes);
app.use("/api", authRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/templates", templatesRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/social-feed", socialFeedRoutes);
app.use("/api/access", accessRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/email-test", emailTestRoutes);

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
        console.log(`[StartupCheck] ${e?.message || e}`);
      }
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
