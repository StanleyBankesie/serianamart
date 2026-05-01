import { query } from '../db/pool.js';
async function run() {
  const r = await query("SHOW TABLES");
  console.log(r.map(x => Object.values(x)[0]).filter(x => x.includes('setup') || x.includes('pref') || x.includes('settings')));
  process.exit(0);
}
run();
