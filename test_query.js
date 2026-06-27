import { query } from "./server/db/pool.js";

async function run() {
  try {
    const companyId = undefined;
    const branchId = undefined;
    const branchIdsStr = undefined;

    console.log("Running transfer-acceptance query with undefined parameters...");
    const rows = await query(
      `
      SELECT t.*, 
             fw.warehouse_name AS from_warehouse_name,
             tw.warehouse_name AS to_warehouse_name,
             t.created_at,
             u.username AS created_by_name
       FROM inv_stock_transfers t
       LEFT JOIN inv_warehouses fw ON fw.id = t.from_warehouse_id
       LEFT JOIN inv_warehouses tw ON tw.id = t.to_warehouse_id
       LEFT JOIN adm_users u ON u.id = t.created_by
        WHERE t.company_id = :companyId 
         AND (:branchIdsStr = '' OR FIND_IN_SET(COALESCE(t.to_branch_id, tw.branch_id, t.branch_id), :branchIdsStr))
         AND UPPER(REPLACE(COALESCE(t.status, ''), ' ', '_'))
             IN ('DRAFT', 'IN_TRANSIT', 'PARTIALLY_RECEIVED')
       ORDER BY t.transfer_date DESC, t.id DESC
      `,
      { companyId, branchId, branchIdsStr },
    );
    console.log("Query executed successfully. Row count:", rows.length);
  } catch (err) {
    console.error("Query failed with error:", err);
  }
  process.exit(0);
}
run();
