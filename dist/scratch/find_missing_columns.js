import * as dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
import { query } from "../db/pool.js";

async function run() {
  try {
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
    `);
    
    const missing = [];
    for (const t of tables) {
      const tableName = t.table_name || t.TABLE_NAME;
      const columns = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = DATABASE() 
          AND table_name = :tableName 
          AND column_name = 'created_by'
      `, { tableName });
      
      if (columns.length === 0) {
        missing.push(tableName);
      }
    }
    
    console.log("Tables missing 'created_by':");
    console.log(missing.join(', '));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
