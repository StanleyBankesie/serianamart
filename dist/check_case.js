import fs from "fs";
import path from "path";

const checkCase = (filePath) => {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  if (!fs.existsSync(dir)) return console.log("Missing dir:", dir);
  const files = fs.readdirSync(dir);
  if (!files.includes(base)) {
    console.log("Case mismatch or missing file:", filePath);
    console.log("Found in dir:", files.filter(f => f.toLowerCase() === base.toLowerCase()));
  }
};

const imports = [
  "./middleware/errorHandler.js",
  "./middleware/notFound.js",
  "./routes/admin.route.js",
  "./routes/backup.routes.js",
  "./routes/sales.route.js",
  "./routes/purchase.routes.js",
  "./routes/purchase.bills.routes.js",
  "./routes/inventory.routes.js",
  "./routes/finance.routes.js",
  "./routes/hr.routes.js",
  "./routes/maintenance.routes.js",
  "./routes/projects.routes.js",
  "./routes/production.routes.js",
  "./routes/pos.routes.js",
  "./routes/bi.routes.js",
  "./routes/service-management.routes.js",
  "./routes/srv_invoices.route.js",
  "./routes/upload.routes.js",
  "./routes/workflow.routes.js",
  "./routes/health.route.js",
  "./routes/auth.routes.js",
  "./db/pool.js",
  "./utils/mailer.js",
  "./utils/redis.js",
  "./utils/jobQueue.js",
  "./routes/push.routes.js",
  "./routes/templates.routes.js",
  "./routes/documents.routes.js",
  "./routes/social-feed.routes.js",
  "./routes/access.routes.js",
  "./routes/chat.routes.js",
  "./routes/email-test.routes.js",
  "./routes/visitors.routes.js",
  "./utils/socket.js",
  "./utils/dbUtils.js",
  "./services/seed-defaults.js",
  "./utils/ensureIndexes.js",
  "./utils/cronJobs.js"
];

imports.forEach(i => checkCase(path.join(process.cwd(), i)));
console.log("Done checking case.");
