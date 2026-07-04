/**
 * @fileoverview Bootstraps the server environment and handles unhandled process errors.
 * @module bootstrap
 */

// Pre-load environment variables
import "./utils/loadServerEnv.js";

/**
 * Logs a process-level error with consistent formatting.
 *
 * @param {string} label - A label indicating the error context (e.g., "unhandledRejection").
 * @param {Error|any} err - The error object or reason.
 */
import fs from "fs";

function logProcessError(label, err) {
  const error = err instanceof Error ? err : new Error(String(err));
  const msg = `[Process] ${label}\nCode: ${error.code || "n/a"}\nMessage: ${error.message}\nStack: ${error.stack}\n`;
  console.error(msg);
  try {
    fs.appendFileSync("CRASH_REPORT.txt", new Date().toISOString() + "\n" + msg + "\n---\n");
  } catch (e) {}
}

// Global Unhandled Promise Rejection Handler
process.on("unhandledRejection", (reason) => {
  logProcessError("unhandledRejection", reason);
  process.exit(1);
});

// Global Uncaught Exception Handler
process.on("uncaughtException", (error) => {
  logProcessError("uncaughtException", error);
  process.exit(1);
});

// Start application by importing main entry point (index.js)
// Catches and logs any top-level initialization errors
import("./index.js").catch((error) => {
  logProcessError("bootstrap import failure", error);
  process.exit(1);
});
