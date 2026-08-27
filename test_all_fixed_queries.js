import { query } from "./server/db/pool.js";

async function testAllFixedQueries() {
  const companyId = 1;
  const branchId = null;
  const branchIdsStr = "";
  const p = { companyId, branchId, branchIdsStr };
  const whereBranch = "(:branchId IS NULL OR branch_id = :branchId OR :branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr) OR branch_id IS NULL)";

  console.log("--- 1. HR Test ---");
  const [hrSummary] = await query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status IN ('ACTIVE', 'CONFIRMED') THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'PROBATION' THEN 1 ELSE 0 END) as probation
    FROM hr_employees 
    WHERE (company_id = :companyId OR company_id IS NULL) AND deleted_at IS NULL
  `, p);
  console.log("HR summary:", hrSummary);

  const hrByDept = await query(`
    SELECT 
      COALESCE(d.dept_name, 'General Administration') as department_name,
      COUNT(e.id) as count
    FROM hr_employees e
    LEFT JOIN hr_departments d ON e.dept_id = d.id
    WHERE (e.company_id = :companyId OR e.company_id IS NULL) AND e.deleted_at IS NULL
    GROUP BY d.id, d.dept_name
    ORDER BY count DESC
  `, p);
  console.log("HR by dept:", hrByDept);

  const hrRecent = await query(`
    SELECT first_name, last_name, joining_date as date_joined
    FROM hr_employees
    WHERE (company_id = :companyId OR company_id IS NULL) AND deleted_at IS NULL
    ORDER BY joining_date DESC LIMIT 5
  `, p);
  console.log("HR recent hires:", hrRecent);

  console.log("\n--- 2. POS Test ---");
  const [posToday] = await query(`
    SELECT COALESCE(SUM(net_amount), 0) as sales, COUNT(*) as txns, COALESCE(AVG(net_amount), 0) as avgBasket
    FROM pos_sales
    WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch} AND DATE(sale_datetime) = CURDATE() AND status != 'VOID'
  `, p);
  console.log("POS today:", posToday);

  const [posMonth] = await query(`
    SELECT COALESCE(SUM(net_amount), 0) as sales, COUNT(*) as txns
    FROM pos_sales
    WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch} AND MONTH(sale_datetime) = MONTH(CURDATE()) AND YEAR(sale_datetime) = YEAR(CURDATE()) AND status != 'VOID'
  `, p);
  console.log("POS thisMonth:", posMonth);

  const posTopProducts = await query(`
    SELECT i.item_name, COALESCE(SUM(sl.qty), 0) as unitsSold, COALESCE(SUM(sl.line_total), 0) as revenue
    FROM pos_sale_lines sl
    JOIN inv_items i ON sl.item_id = i.id
    JOIN pos_sales s ON sl.sale_id = s.id
    WHERE (s.company_id = :companyId OR s.company_id IS NULL) AND ${whereBranch} AND s.status != 'VOID'
    GROUP BY sl.item_id, i.item_name
    ORDER BY revenue DESC LIMIT 10
  `, p);
  console.log("POS top products:", posTopProducts);

  console.log("\n--- 3. Transport & Fleet Test ---");
  const [trnSummary] = await query(`
    SELECT 
      (SELECT COALESCE(SUM(amount), 0) FROM trn_transport_income WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch}) as totalIncome,
      (SELECT COALESCE(SUM(amount), 0) FROM trn_transport_expenses WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch}) as totalExpenses,
      (SELECT COUNT(*) FROM sal_orders WHERE (company_id = :companyId OR company_id IS NULL) AND carrier IS NOT NULL) as trackedDeliveries
  `, p);
  console.log("Transport summary:", trnSummary);

  const trnExpensesByCategory = await query(`
    SELECT COALESCE(category, 'General Transport') as category, COALESCE(SUM(amount), 0) as totalAmount, COUNT(*) as count
    FROM trn_transport_expenses
    WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch}
    GROUP BY category
  `, p);
  console.log("Transport expenses:", trnExpensesByCategory);

  console.log("\n--- 4. Maintenance Test ---");
  const [maintJobSummary] = await query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status IN ('COMPLETED', 'CLOSED') THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status NOT IN ('COMPLETED', 'CLOSED', 'CANCELLED') THEN 1 ELSE 0 END) as open
    FROM maint_job_orders
    WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch}
  `, p);
  console.log("Maint jobs:", maintJobSummary);

  const [maintEquipSummary] = await query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'ACTIVE' OR status = 'OPERATIONAL' OR status IS NULL THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'UNDER_MAINTENANCE' THEN 1 ELSE 0 END) as underMaintenance
    FROM maint_equipment
    WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch}
  `, p);
  console.log("Maint equipment:", maintEquipSummary);

  console.log("\n--- 5. Service Test ---");
  const [srvSummary] = await query(`
    SELECT 
      (SELECT COUNT(*) FROM svc_visitors_log WHERE (company_id = :companyId OR company_id IS NULL)) as totalVisitors,
      (SELECT COUNT(*) FROM svc_service_categories WHERE (company_id = :companyId OR company_id IS NULL)) as serviceCategories,
      (SELECT COUNT(*) FROM srv_service_invoices WHERE (company_id = :companyId OR company_id IS NULL)) as serviceInvoices,
      (SELECT COALESCE(SUM(total_amount), 0) FROM srv_service_invoices WHERE (company_id = :companyId OR company_id IS NULL)) as totalRevenue
  `, p);
  console.log("Service summary:", srvSummary);

  console.log("\n--- 6. Administration Test ---");
  const [admSummary] = await query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive
    FROM adm_users
    WHERE (company_id = :companyId OR company_id IS NULL) AND deleted_at IS NULL
  `, p);
  console.log("Admin summary:", admSummary);

  const admRoles = await query(`
    SELECT r.role_name, COUNT(u.id) as userCount
    FROM adm_roles r
    LEFT JOIN adm_users u ON u.role_id = r.id AND (u.company_id = :companyId OR u.company_id IS NULL) AND u.deleted_at IS NULL
    WHERE (r.company_id = :companyId OR r.company_id IS NULL)
    GROUP BY r.id, r.role_name
    ORDER BY userCount DESC LIMIT 10
  `, p);
  console.log("Admin roles:", admRoles);

  console.log("\n--- 7. Cross-Module Test ---");
  const crossPosSales = await query(`
    SELECT i.item_name, COALESCE(SUM(sl.qty), 0) as unitsSold, COALESCE(SUM(sl.line_total), 0) as posRevenue 
    FROM pos_sale_lines sl 
    JOIN pos_sales s ON sl.sale_id = s.id AND (s.company_id = :companyId OR s.company_id IS NULL) AND s.status != 'VOID' 
    JOIN inv_items i ON sl.item_id = i.id 
    WHERE (i.company_id = :companyId OR i.company_id IS NULL)
    GROUP BY i.id, i.item_name 
    ORDER BY posRevenue DESC LIMIT 10
  `, p);
  console.log("Cross module pos sales:", crossPosSales);

  process.exit(0);
}

testAllFixedQueries();
