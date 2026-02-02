import { pool } from '../db/pool.js';

async function run() {
  const conn = await pool.getConnection();
  try {
    const rows = [
      { company_id: 1, branch_id: 1, name: 'Finance', code: 'FIN' },
      { company_id: 1, branch_id: 1, name: 'Operations', code: 'OPS' },
      { company_id: 1, branch_id: 1, name: 'Sales', code: 'SAL' },
    ];
    for (const r of rows) {
      await conn.execute(
        `INSERT INTO adm_departments (company_id, branch_id, name, code, is_active)
         VALUES (:company_id, :branch_id, :name, :code, 1)
         ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = VALUES(is_active)`,
        r
      );
    }
    console.log('ok');
  } catch (e) {
    console.error(e.message || String(e));
    process.exitCode = 1;
  } finally {
    conn.release();
    process.exit();
  }
}

run();
