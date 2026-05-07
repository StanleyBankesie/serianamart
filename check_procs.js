import { pool } from './server/db/pool.js';

async function main() {
  const [procs] = await pool.query('SHOW PROCEDURE STATUS WHERE Db = DATABASE()');
  console.log('Procedures:', JSON.stringify(procs, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
