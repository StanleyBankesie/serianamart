import * as dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
import { query } from "../db/pool.js";

async function run() {
  try {
    console.log("Adding created_by column to adm_users...");
    await query(`
      ALTER TABLE adm_users 
      ADD COLUMN created_by BIGINT UNSIGNED NULL AFTER role_id,
      ADD INDEX idx_user_created_by (created_by)
    `);
    console.log("Column added successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}
run();
