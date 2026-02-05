import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------------- ENV ---------------- */
dotenv.config({ path: path.join(__dirname, ".env") });
if (fs.existsSync(path.join(__dirname, ".env.local"))) {
  dotenv.config({ path: path.join(__dirname, ".env.local"), override: true });
}

const app = express();

console.log(
  `Environment: ${process.env.NODE_ENV || "development"} | DB host: ${process.env.DB_HOST} | DB name: ${process.env.DB_NAME}`,
);

/* ---------------- CORS ---------------- */
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://serianamart.omnisuite-erp.com",
];

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
    ],
  }),
);

app.options("*", cors());
app.use(express.json({ limit: "2mb" }));

/* ---------------- STATIC FILES ---------------- */
// Serve frontend (public folder)
app.use(express.static(path.join(__dirname, "public")));

// Serve uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ---------------- DB ---------------- */
try {
  await query("SELECT 1");
  console.log("Database connection OK");
} catch (err) {
  const code = String(err?.code || "");
  const msg = String(err?.message || "");
  console.error("Database connection failed:", code, msg);
  console.error(
    "Verify DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME in server/.env.local or server/.env.",
  );
}

/* ---------------- ROUTES ---------------- */
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
/* ---------------- ROOT ---------------- */
// API info page (does NOT block routes)
app.get("/", (req, res) => {
  res.send("OmniSuite ERP API");
});

app.get("/favicon.ico", (req, res) => res.status(204).end());

/* ---------------- ERRORS ---------------- */
app.use(notFound);
app.use(errorHandler);

/* ---------------- SERVER ---------------- */
function tryListen(ports) {
  const [first, ...rest] = ports;
  if (!Number.isFinite(first)) return;
  const server = app.listen(first, () => {
    console.log(`API listening on port ${first}`);
  });
  server.on("error", (err) => {
    if (String(err?.code) === "EADDRINUSE" && rest.length) {
      try {
        server.close();
      } catch {}
      tryListen(rest);
    } else {
      throw err;
    }
  });
}
const envPort = Number(process.env.PORT || 0);
const candidatePorts = [
  envPort || 0,
  5000,
  5001,
  4000,
  4001,
  4002,
  4003,
].filter((n, i, arr) => Number.isFinite(n) && n > 0 && arr.indexOf(n) === i);
tryListen(candidatePorts);
