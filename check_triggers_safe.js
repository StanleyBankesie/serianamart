import { pool } from './server/db/pool.js';

async function main() {
  const [triggers] = await pool.query('SHOW TRIGGERS');
  console.log('Triggers:', JSON.stringify(triggers, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
