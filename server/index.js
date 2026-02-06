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
import { isMailerConfigured } from "./utils/mailer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------------- ENV ---------------- */
dotenv.config({ path: path.join(__dirname, ".env") });
const isProd = String(process.env.NODE_ENV).toLowerCase() === "production";
const prodPath = path.join(__dirname, ".env.production");
const localPath = path.join(__dirname, ".env.local");
if (isProd && fs.existsSync(prodPath)) {
  dotenv.config({ path: prodPath, override: true });
} else if (fs.existsSync(localPath)) {
  dotenv.config({ path: localPath, override: true });
}

const app = express();

/* ---------------- CORS ---------------- */
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "https://serianamart.omnisuite-erp.com",
  "https://serianaserver.omnisuite-erp.com",
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
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

/* ---------------- DB ---------------- */

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

/* ---------------- STATIC FILES & SPA FALLBACK ---------------- */
// Determine where the frontend build is located
// Prefer ../client/dist if it has index.html, otherwise fallback to ./public if it has index.html
let frontendPath = null;
const distPath = path.join(__dirname, "../client/dist");
const distIndex = path.join(distPath, "index.html");
const publicPath = path.join(__dirname, "public");
const publicIndex = path.join(publicPath, "index.html");
if (fs.existsSync(distIndex)) {
  frontendPath = distPath;
  console.log("Serving frontend from ../client/dist");
} else if (fs.existsSync(publicIndex)) {
  frontendPath = publicPath;
  console.log("Serving frontend from ./public");
} else {
  // Fallback to dist directory even if index missing (for assets), but warn
  frontendPath = fs.existsSync(distPath) ? distPath : publicPath;
  console.warn(
    "Frontend build not found (index.html missing) in ./public or ../client/dist",
  );
}

// Serve static assets
app.use(express.static(frontendPath));

// SPA Catch-all: serve index.html for any unknown route (that isn't /api)
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

/* ---------------- ERRORS ---------------- */
// app.use(notFound); // Handled by SPA catch-all now, or use for API 404s if desired
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Mailer configured: ${isMailerConfigured() ? "yes" : "no"}`);
  });
}

export default app;
