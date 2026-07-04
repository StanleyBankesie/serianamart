import cron from "node-cron";
import { runBackup } from "../scripts/backup.js";

/**
 * Initializes all cron jobs for the application.
 * This should be imported once at application startup.
 */
export function initCronJobs() {
  console.log("[Cron] Initializing automated scheduled tasks...");
  
  // Schedule the automatic cloud backup at 12:00 AM every day
  cron.schedule("0 0 * * *", async () => {
    console.log("[Cron] Triggering scheduled daily cloud backup...");
    try {
      // isManual = false, localOnly = false, cloudOnly = true
      await runBackup(false, false, true);
    } catch (err) {
      console.error("[Cron] Daily cloud backup failed:", err);
    }
  });
  
  console.log("[Cron] Scheduled daily cloud backup for 12:00 AM (0 0 * * *)");
}
