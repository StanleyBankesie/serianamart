import { query } from "./server/db/pool.js";

async function auditAllEndpoints() {
  const companyId = 1;
  const branchId = null;
  const branchIdsStr = "";
  const p = { companyId, branchId, branchIdsStr };
  const whereBranch = "(:branchId IS NULL OR branch_id = :branchId OR :branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr) OR branch_id IS NULL)";

  console.log("=== 1. FINANCIAL ===");
  try {
    const revTrend = await query(`SELECT DATE_FORMAT(COALESCE(invoice_date, created_at), '%Y-%m') as month,
      COALESCE(SUM(total_amount), 0) as revenue
      FROM sal_invoices WHERE (company_id = :companyId OR company_id IS NULL)
      GROUP BY month ORDER BY month DESC LIMIT 6`, p);
    console.log("Financial revTrend:", revTrend);

    const purchTrend = await query(`SELECT DATE_FORMAT(COALESCE(order_date, created_at), '%Y-%m') as month,
      COALESCE(SUM(total_amount), 0) as spend
      FROM pur_orders WHERE (company_id = :companyId OR company_id IS NULL)
      GROUP BY month ORDER BY month DESC LIMIT 6`, p);
    console.log("Financial purchTrend:", purchTrend);

    const topCust = await query(`SELECT c.id, c.customer_name, COALESCE(SUM(i.total_amount), 0) as revenue, COUNT(i.id) as invoices
      FROM sal_customers c
      JOIN sal_invoices i ON i.customer_id = c.id
      WHERE (c.company_id = :companyId OR c.company_id IS NULL)
      GROUP BY c.id, c.customer_name ORDER BY revenue DESC LIMIT 10`, p);
    console.log("Financial topCust:", topCust);

    const topSupp = await query(`SELECT s.id, s.supplier_name, COALESCE(SUM(o.total_amount), 0) as spend, COUNT(o.id) as orders
      FROM pur_suppliers s
      JOIN pur_orders o ON o.supplier_id = s.id
      WHERE (s.company_id = :companyId OR s.company_id IS NULL)
      GROUP BY s.id, s.supplier_name ORDER BY spend DESC LIMIT 10`, p);
    console.log("Financial topSupp:", topSupp);
  } catch (e) {
    console.error("FINANCIAL ERROR:", e.message);
  }

  console.log("\n=== 2. PROJECTS ===");
  try {
    const [summary] = await query(`SELECT COUNT(*) as total,
      SUM(CASE WHEN status IN ('active','IN_PROGRESS','IN PROGRESS','EXECUTION') THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status IN ('COMPLETED','DONE') THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status IN ('PLANNING','PENDING') THEN 1 ELSE 0 END) as planning,
      COALESCE(SUM(budget), 0) as totalBudget
      FROM pm_projects WHERE (company_id = :companyId OR company_id IS NULL)`, p);
    console.log("Projects summary:", summary);

    const [finances] = await query(`SELECT 
      COALESCE(SUM(actual_amount), 0) as totalExpenses,
      COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN actual_amount ELSE 0 END), 0) as approvedExpenses
      FROM pm_expenses WHERE (company_id = :companyId OR company_id IS NULL)`, p);
    console.log("Projects finances:", finances);

    const [tasks] = await query(`SELECT COUNT(*) as totalTasks,
      SUM(CASE WHEN status IN ('COMPLETED','DONE') THEN 1 ELSE 0 END) as completedTasks,
      SUM(CASE WHEN status NOT IN ('COMPLETED','DONE') AND end_date < CURDATE() THEN 1 ELSE 0 END) as overdueTasks
      FROM pm_tasks WHERE (company_id = :companyId OR company_id IS NULL)`, p);
    console.log("Projects tasks:", tasks);

    const [timesheets] = await query(`SELECT COALESCE(SUM(hours_spent), 0) as totalHours,
      COUNT(DISTINCT log_date) as loggedDays
      FROM pm_timesheets WHERE (company_id = :companyId OR company_id IS NULL)`, p);
    console.log("Projects timesheets:", timesheets);
  } catch (e) {
    console.error("PROJECTS ERROR:", e.message);
  }

  console.log("\n=== 3. HR ===");
  try {
    const hrTables = await query("SHOW TABLES LIKE 'hr_%'");
    console.log("HR tables:", hrTables);
    const [headcount] = await query(`SELECT COUNT(*) as total,
      SUM(CASE WHEN status = 'ACTIVE' OR is_active = 1 THEN 1 ELSE 0 END) as active
      FROM hr_employees WHERE (company_id = :companyId OR company_id IS NULL)`, p);
    console.log("HR headcount:", headcount);
  } catch (e) {
    console.error("HR ERROR:", e.message);
  }

  console.log("\n=== 4. POS ===");
  try {
    const posTables = await query("SHOW TABLES LIKE 'pos_%'");
    console.log("POS tables:", posTables);
    const [salesSummary] = await query(`SELECT COUNT(*) as totalTransactions,
      COALESCE(SUM(grand_total), 0) as totalSales,
      COALESCE(AVG(grand_total), 0) as avgBasket
      FROM pos_sales WHERE (company_id = :companyId OR company_id IS NULL)`, p);
    console.log("POS summary:", salesSummary);
  } catch (e) {
    console.error("POS ERROR:", e.message);
  }

  console.log("\n=== 5. TRANSPORT ===");
  try {
    const trTables = await query("SHOW TABLES LIKE '%transport%' OR SHOW TABLES LIKE '%fleet%' OR SHOW TABLES LIKE '%vehicle%'");
    console.log("Transport/Fleet tables:", trTables);
  } catch (e) {
    try {
      const t1 = await query("SHOW TABLES LIKE 'fleet_%'");
      const t2 = await query("SHOW TABLES LIKE 'transport_%'");
      const t3 = await query("SHOW TABLES LIKE 'trn_%'");
      const t4 = await query("SHOW TABLES LIKE 'veh_%'");
      console.log("Fleet tables:", t1, "Transport tables:", t2, "TRN tables:", t3, "Veh tables:", t4);
    } catch (e2) {
      console.error("Fleet tables query error:", e2.message);
    }
  }

  console.log("\n=== 6. MAINTENANCE ===");
  try {
    const mTables = await query("SHOW TABLES LIKE 'maint_%' OR SHOW TABLES LIKE 'mt_%' OR SHOW TABLES LIKE 'maintenance_%'");
    console.log("Maintenance tables:", mTables);
  } catch (e) {
    const m1 = await query("SHOW TABLES LIKE 'maint_%'");
    const m2 = await query("SHOW TABLES LIKE '%maint%'");
    console.log("Maint tables:", m1, m2);
  }

  console.log("\n=== 7. PURCHASE ===");
  try {
    const [purSummary] = await query(`SELECT COUNT(*) as total,
      SUM(CASE WHEN status IN ('APPROVED','RECEIVED','COMPLETED') THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status IN ('PENDING','SUBMITTED','DRAFT') THEN 1 ELSE 0 END) as pending,
      COALESCE(SUM(total_amount), 0) as totalSpend
      FROM pur_orders WHERE (company_id = :companyId OR company_id IS NULL)`, p);
    console.log("Purchase summary:", purSummary);
  } catch (e) {
    console.error("PURCHASE ERROR:", e.message);
  }

  console.log("\n=== 8. PRODUCTION ===");
  try {
    const [prodSummary] = await query(`SELECT COUNT(*) as total,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as inProgress,
      COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN planned_qty ELSE 0 END), 0) as totalProduced
      FROM prd_job_cards WHERE (company_id = :companyId OR company_id IS NULL)`, p);
    console.log("Production summary:", prodSummary);
  } catch (e) {
    console.error("PRODUCTION ERROR:", e.message);
  }

  console.log("\n=== 9. SERVICE ===");
  try {
    const srvTables = await query("SHOW TABLES LIKE 'srv_%' OR SHOW TABLES LIKE 'service_%'");
    console.log("Service tables:", srvTables);
  } catch (e) {
    const s1 = await query("SHOW TABLES LIKE 'srv_%'");
    const s2 = await query("SHOW TABLES LIKE 'service_%'");
    console.log("Service tables:", s1, s2);
  }

  process.exit(0);
}

auditAllEndpoints();
