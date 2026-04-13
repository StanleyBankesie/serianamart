import { query } from './server/db/pool.js';

async function run() {
  try {
    await query(`DROP VIEW IF EXISTS v_inv_issue_register`);
    await query(`
      CREATE VIEW v_inv_issue_register AS
      SELECT 
        i.company_id,
        i.branch_id,
        i.id AS issue_id,
        i.issue_no,
        i.issue_date,
        i.issue_type,
        i.warehouse_id,
        i.department_id,
        d.item_id,
        d.qty_issued,
        d.uom,
        COALESCE((
          SELECT SUM(rd.qty_returned)
          FROM inv_return_to_stores r
          JOIN inv_return_to_stores_details rd ON rd.rts_id = r.id
          WHERE r.company_id = i.company_id
            AND r.branch_id = i.branch_id
            AND rd.item_id = d.item_id
            AND (r.department_id <=> i.department_id)
            AND (r.warehouse_id <=> i.warehouse_id)
            AND r.rts_date >= i.issue_date
        ), 0) AS returned_qty,
        COALESCE(d.qty_issued, 0) - COALESCE((
          SELECT SUM(rd.qty_returned)
          FROM inv_return_to_stores r
          JOIN inv_return_to_stores_details rd ON rd.rts_id = r.id
          WHERE r.company_id = i.company_id
            AND r.branch_id = i.branch_id
            AND rd.item_id = d.item_id
            AND (r.department_id <=> i.department_id)
            AND (r.warehouse_id <=> i.warehouse_id)
            AND r.rts_date >= i.issue_date
        ), 0) AS remaining_qty
      FROM inv_issue_to_requirement i
      JOIN inv_issue_to_requirement_details d ON d.issue_id = i.id
    `);
    console.log("Success");
  } catch(e) {
    console.log("Error:", e.message);
  }
  process.exit();
}
run();
