import cron from "node-cron";
import { runBackup } from "../scripts/backup.js";
import { runComplianceNotifications } from "../scripts/complianceNotification.js";
import { runServicingNotifications } from "../scripts/servicingNotification.js";

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

  // Schedule compliance notifications daily at 10:00 AM
  cron.schedule("0 10 * * *", async () => {
    try {
      await runComplianceNotifications();
    } catch (err) {
      console.error("[Cron] Compliance notifications failed:", err);
    }
  });
  console.log("[Cron] Scheduled compliance notifications for 10:00 AM (0 10 * * *)");

  // Schedule servicing notifications daily at 10:00 AM
  cron.schedule("0 10 * * *", async () => {
    try {
      await runServicingNotifications();
    } catch (err) {
      console.error("[Cron] Servicing notifications failed:", err);
    }
  });
  console.log("[Cron] Scheduled servicing notifications for 10:00 AM (0 10 * * *)");
}
