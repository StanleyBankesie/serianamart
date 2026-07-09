/**
 * @file jobQueue.js
 * @description BullMQ-backed job queue utilities with graceful fallback when Redis is unavailable.
 */
import { Queue, Worker } from "bullmq";
import { getRawRedis } from "./redis.js";

const QUEUE_NAME = "low-stock-alerts";

/** @type {Queue|null} */
let lowStockQueue = null;

/** @type {Worker|null} */
let lowStockWorker = null;

/**
 * Initialise (or return existing) BullMQ queue + worker for low-stock alerts.
 * Returns null if Redis is unavailable, allowing the caller to fall back to setInterval.
 *
 * @param {() => Promise<void>} jobHandler - async function to run for each job
 * @returns {Queue|null}
 */
export function getLowStockQueue(jobHandler) {
  // Disable BullMQ to avoid max request limit errors on Upstash Redis
  // This forces the caller to use the setInterval fallback
  console.log("[JobQueue] BullMQ disabled, will use setInterval fallback");
  return null;
}

/**
 * Gracefully close all job queues and workers.
 */
export async function closeJobQueues() {
  try {
    if (lowStockWorker) {
      await lowStockWorker.close();
      lowStockWorker = null;
    }
    if (lowStockQueue) {
      await lowStockQueue.close();
      lowStockQueue = null;
    }
    console.log("[JobQueue] All queues closed");
  } catch (err) {
    console.error("[JobQueue] Error closing queues:", err.message);
  }
}
