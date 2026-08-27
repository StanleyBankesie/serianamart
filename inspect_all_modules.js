import { query } from "./server/db/pool.js";

async function inspectAllModules() {
  const tables = [
    "pm_projects", "pm_expenses", "pm_tasks", "pm_timesheets", "pm_invoices",
    "hr_employees", "hr_departments", "hr_leave_requests", "hr_payroll",
    "pos_sales", "pos_sessions", "pos_sale_lines",
    "sal_invoices", "sal_customers", "sal_orders",
    "pur_orders", "pur_suppliers", "pur_bills",
    "maint_job_orders", "maint_requests", "maint_assets", "maint_equipment", "maint_bills",
    "srv_service_invoices", "srv_service_invoice_details",
    "trn_transport_expenses", "trn_transport_income", "fleet_alerts", "fleet_geofences"
  ];

  for (const t of tables) {
    try {
      const cols = await query(`DESCRIBE ${t}`);
      const [cnt] = await query(`SELECT COUNT(*) as cnt FROM ${t}`);
      console.log(`\nTable ${t} (${cnt.cnt} rows):`, cols.map(c => c.Field).join(", "));
    } catch (e) {
      console.log(`\nTable ${t}: NOT FOUND (${e.message})`);
    }
  }

  const prdTables = await query("SHOW TABLES LIKE 'prd_%'");
  console.log("\nProduction tables in DB:", prdTables);
  for (const pt of prdTables) {
    const name = Object.values(pt)[0];
    const cols = await query(`DESCRIBE ${name}`);
    const [cnt] = await query(`SELECT COUNT(*) as cnt FROM ${name}`);
    console.log(`  ${name} (${cnt.cnt} rows):`, cols.map(c => c.Field).join(", "));
  }

  process.exit(0);
}

inspectAllModules();
