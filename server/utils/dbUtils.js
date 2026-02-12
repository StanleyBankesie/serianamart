import { query } from "../db/pool.js";

export function toNumber(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function hasColumn(tableName, columnName) {
  const rows = await query(
    `
    SELECT COUNT(*) AS c
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = :tableName
      AND column_name = :columnName
    `,
    { tableName, columnName },
  );
  return Number(rows?.[0]?.c || 0) > 0;
}

export async function ensureBranchColumns() {
  const table = "adm_branches";
  if (!(await hasColumn(table, "address"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN address VARCHAR(255) NULL`);
  }
  if (!(await hasColumn(table, "city"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN city VARCHAR(100) NULL`);
  }
  if (!(await hasColumn(table, "state"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN state VARCHAR(100) NULL`);
  }
  if (!(await hasColumn(table, "postal_code"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN postal_code VARCHAR(20) NULL`);
  }
  if (!(await hasColumn(table, "country"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN country VARCHAR(100) NULL`);
  }
  if (!(await hasColumn(table, "location"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN location VARCHAR(255) NULL`);
  }
  if (!(await hasColumn(table, "telephone"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN telephone VARCHAR(50) NULL`);
  }
  if (!(await hasColumn(table, "email"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN email VARCHAR(255) NULL`);
  }
  if (!(await hasColumn(table, "remarks"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN remarks TEXT NULL`);
  }
}

export async function ensureUserColumns() {
  const table = "adm_users";
  if (!(await hasColumn(table, "profile_picture_url"))) {
    await query(
      `ALTER TABLE ${table} ADD COLUMN profile_picture_url VARCHAR(255) NULL`,
    );
  }
  if (!(await hasColumn(table, "is_employee"))) {
    await query(
      `ALTER TABLE ${table} ADD COLUMN is_employee TINYINT(1) DEFAULT 0`,
    );
  }
  if (!(await hasColumn(table, "user_type"))) {
    await query(
      `ALTER TABLE ${table} ADD COLUMN user_type VARCHAR(50) DEFAULT 'Internal'`,
    );
  }
  if (!(await hasColumn(table, "valid_from"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN valid_from DATETIME NULL`);
  }
  if (!(await hasColumn(table, "valid_to"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN valid_to DATETIME NULL`);
  }
  if (!(await hasColumn(table, "role_id"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN role_id BIGINT UNSIGNED NULL`);
  }
  if (!(await hasColumn(table, "branch_id"))) {
    await query(
      `ALTER TABLE ${table} ADD COLUMN branch_id BIGINT UNSIGNED NULL`,
    );
  }
}

export async function ensurePagesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_pages (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      module VARCHAR(50) NOT NULL,
      name VARCHAR(100) NOT NULL,
      code VARCHAR(100) NOT NULL UNIQUE,
      path VARCHAR(255) NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_module (module)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function ensurePagesSeed() {
  const pages = [
    { module: "Administration", name: "Roles", path: "/administration/roles" },
    {
      module: "Administration",
      name: "Role List",
      path: "/administration/roles",
    },
    {
      module: "Administration",
      name: "Role Form",
      path: "/administration/roles/new",
    },
    {
      module: "Administration",
      name: "Role Edit",
      path: "/administration/roles/:id",
    },
    { module: "Administration", name: "Users", path: "/administration/users" },
    {
      module: "Administration",
      name: "User List",
      path: "/administration/users",
    },
    {
      module: "Administration",
      name: "User Form",
      path: "/administration/users/new",
    },
    {
      module: "Administration",
      name: "User Edit",
      path: "/administration/users/:id",
    },
    {
      module: "Administration",
      name: "Workflows",
      path: "/administration/workflows",
    },
    {
      module: "Administration",
      name: "Workflow List",
      path: "/administration/workflows",
    },
    {
      module: "Administration",
      name: "Workflow Form",
      path: "/administration/workflows/new",
    },
    {
      module: "Administration",
      name: "Workflow Edit",
      path: "/administration/workflows/:id",
    },
    {
      module: "Administration",
      name: "Workflow Approvals",
      path: "/administration/workflows/approvals",
    },
    {
      module: "Administration",
      name: "Document Review",
      path: "/administration/workflows/approvals/:instanceId",
    },
    {
      module: "Administration",
      name: "Branches",
      path: "/administration/branches",
    },
    {
      module: "Administration",
      name: "Branch List",
      path: "/administration/branches",
    },
    {
      module: "Administration",
      name: "Branch Form",
      path: "/administration/branches/new",
    },
    {
      module: "Administration",
      name: "Branch Edit",
      path: "/administration/branches/:id",
    },
    {
      module: "Administration",
      name: "Companies",
      path: "/administration/companies",
    },
    {
      module: "Administration",
      name: "Company List",
      path: "/administration/companies",
    },
    {
      module: "Administration",
      name: "Company Form",
      path: "/administration/companies/new",
    },
    {
      module: "Administration",
      name: "Company Edit",
      path: "/administration/companies/:id",
    },
    {
      module: "Administration",
      name: "Exceptional Permissions",
      path: "/administration/exceptional-permissions",
    },
    {
      module: "Administration",
      name: "Exceptional Permissions List",
      path: "/administration/exceptional-permissions",
    },
    {
      module: "Administration",
      name: "Exceptional Permission Form",
      path: "/administration/exceptional-permissions/new",
    },
    {
      module: "Administration",
      name: "Exceptional Permission Edit",
      path: "/administration/exceptional-permissions/:id",
    },
    {
      module: "Administration",
      name: "Reports",
      path: "/administration/reports",
    },
    {
      module: "Administration",
      name: "User Login Activity Report",
      path: "/administration/reports/user-login-activity",
    },
    {
      module: "Administration",
      name: "System Log Book Report",
      path: "/administration/reports/system-log-book",
    },
    {
      module: "Administration",
      name: "Permissions Dashboard",
      path: "/administration/permissions",
    },
    {
      module: "Administration",
      name: "User Permission Assignment",
      path: "/administration/user-permissions",
    },
    {
      module: "Administration",
      name: "Settings",
      path: "/administration/settings",
    },
    {
      module: "Administration",
      name: "Settings List",
      path: "/administration/settings",
    },
    {
      module: "Administration",
      name: "Settings Form",
      path: "/administration/settings/new",
    },
    {
      module: "Administration",
      name: "Settings Edit",
      path: "/administration/settings/:id",
    },
    { module: "Sales", name: "Quotations", path: "/sales/quotations" },
    { module: "Sales", name: "Quotation List", path: "/sales/quotations" },
    { module: "Sales", name: "Quotation Form", path: "/sales/quotations/new" },
    { module: "Sales", name: "Quotation Edit", path: "/sales/quotations/:id" },
    { module: "Sales", name: "Sales Orders", path: "/sales/sales-orders" },
    { module: "Sales", name: "Sales Order List", path: "/sales/sales-orders" },
    {
      module: "Sales",
      name: "Sales Order Form",
      path: "/sales/sales-orders/new",
    },
    {
      module: "Sales",
      name: "Sales Order Edit",
      path: "/sales/sales-orders/:id",
    },
    { module: "Sales", name: "Invoices", path: "/sales/invoices" },
    { module: "Sales", name: "Invoice List", path: "/sales/invoices" },
    { module: "Sales", name: "Invoice Form", path: "/sales/invoices/new" },
    { module: "Sales", name: "Invoice Edit", path: "/sales/invoices/:id" },
    { module: "Sales", name: "Delivery", path: "/sales/delivery" },
    { module: "Sales", name: "Delivery List", path: "/sales/delivery" },
    { module: "Sales", name: "Delivery Form", path: "/sales/delivery/new" },
    { module: "Sales", name: "Delivery Edit", path: "/sales/delivery/:id" },
    { module: "Sales", name: "Price Setup", path: "/sales/price-setup" },
    {
      module: "Sales",
      name: "Discount Schemes",
      path: "/sales/discount-schemes",
    },
    { module: "Sales", name: "Customers", path: "/sales/customers" },
    { module: "Sales", name: "Customer List", path: "/sales/customers" },
    { module: "Sales", name: "Customer Form", path: "/sales/customers/new" },
    { module: "Sales", name: "Customer Edit", path: "/sales/customers/:id" },
    {
      module: "Sales",
      name: "Customer Credit",
      path: "/sales/customer-credit",
    },
    {
      module: "Sales",
      name: "Bulk Customer Upload",
      path: "/sales/bulk-upload",
    },
    { module: "Sales", name: "Sales Reports", path: "/sales/reports" },
    { module: "Sales", name: "Sales Returns", path: "/sales/returns" },
    {
      module: "Inventory",
      name: "Material Requisitions",
      path: "/inventory/material-requisitions",
    },
    {
      module: "Inventory",
      name: "Material Requisition Edit",
      path: "/inventory/material-requisitions/:id",
    },
    {
      module: "Inventory",
      name: "Stock Updation",
      path: "/inventory/stock-updation",
    },
    {
      module: "Inventory",
      name: "Stock Updation Edit",
      path: "/inventory/stock-updation/:id",
    },
    {
      module: "Inventory",
      name: "Stock Verification",
      path: "/inventory/stock-verification",
    },
    {
      module: "Inventory",
      name: "Stock Verification Edit",
      path: "/inventory/stock-verification/:id",
    },
    {
      module: "Inventory",
      name: "Return To Stores",
      path: "/inventory/return-to-stores",
    },
    {
      module: "Inventory",
      name: "Return To Stores Form",
      path: "/inventory/return-to-stores/new",
    },
    {
      module: "Inventory",
      name: "Return To Stores Edit",
      path: "/inventory/return-to-stores/:id",
    },
    {
      module: "Inventory",
      name: "Stock Adjustments",
      path: "/inventory/stock-adjustments",
    },
    {
      module: "Inventory",
      name: "Stock Adjustment Form",
      path: "/inventory/stock-adjustments/new",
    },
    {
      module: "Inventory",
      name: "Stock Adjustment Edit",
      path: "/inventory/stock-adjustments/:id",
    },
    {
      module: "Inventory",
      name: "Issue To Requirement",
      path: "/inventory/issue-to-requirement",
    },
    {
      module: "Inventory",
      name: "Issue To Requirement Form",
      path: "/inventory/issue-to-requirement/new",
    },
    {
      module: "Inventory",
      name: "Issue To Requirement Edit",
      path: "/inventory/issue-to-requirement/:id",
    },
    {
      module: "Inventory",
      name: "Stock Transfers",
      path: "/inventory/stock-transfers",
    },
    {
      module: "Inventory",
      name: "Stock Transfer Edit",
      path: "/inventory/stock-transfers/:id",
    },
    {
      module: "Inventory",
      name: "Transfer Acceptance",
      path: "/inventory/transfer-acceptance",
    },
    {
      module: "Inventory",
      name: "Transfer Acceptance Edit",
      path: "/inventory/transfer-acceptance/:id",
    },
    {
      module: "Inventory",
      name: "Stock Reorder",
      path: "/inventory/stock-reorder",
    },
    { module: "Inventory", name: "Stock Take", path: "/inventory/stock-take" },
    {
      module: "Inventory",
      name: "Stock Take Edit",
      path: "/inventory/stock-take/:id",
    },
    { module: "Inventory", name: "GRN Local", path: "/inventory/grn-local" },
    {
      module: "Inventory",
      name: "GRN Local Edit",
      path: "/inventory/grn-local/:id",
    },
    { module: "Inventory", name: "GRN Import", path: "/inventory/grn-import" },
    {
      module: "Inventory",
      name: "GRN Import Edit",
      path: "/inventory/grn-import/:id",
    },
    {
      module: "Inventory",
      name: "Sales Returns",
      path: "/inventory/sales-returns",
    },
    { module: "Inventory", name: "Items", path: "/inventory/items" },
    { module: "Inventory", name: "Item Edit", path: "/inventory/items/:id" },
    {
      module: "Inventory",
      name: "Item Groups",
      path: "/inventory/item-groups",
    },
    {
      module: "Inventory",
      name: "Item Group Edit",
      path: "/inventory/item-groups/:id",
    },
    {
      module: "Inventory",
      name: "Unit Conversions",
      path: "/inventory/unit-conversions",
    },
    {
      module: "Inventory",
      name: "Unit Conversion Edit",
      path: "/inventory/unit-conversions/:id",
    },
    { module: "Inventory", name: "Warehouses", path: "/inventory/warehouses" },
    {
      module: "Inventory",
      name: "Warehouse Edit",
      path: "/inventory/warehouses/:id",
    },
    { module: "Inventory", name: "Reports", path: "/inventory/reports" },
    { module: "Purchase", name: "RFQs", path: "/purchase/rfqs" },
    { module: "Purchase", name: "RFQ Form", path: "/purchase/rfqs/new" },
    { module: "Purchase", name: "RFQ Edit", path: "/purchase/rfqs/:id" },
    {
      module: "Purchase",
      name: "RFQ Edit Form",
      path: "/purchase/rfqs/:id/edit",
    },
    {
      module: "Purchase",
      name: "Supplier Quotations",
      path: "/purchase/supplier-quotations",
    },
    {
      module: "Purchase",
      name: "Supplier Quotation Form",
      path: "/purchase/supplier-quotations/new",
    },
    {
      module: "Purchase",
      name: "Supplier Quotation Edit",
      path: "/purchase/supplier-quotations/:id",
    },
    {
      module: "Purchase",
      name: "Supplier Quotation Edit Form",
      path: "/purchase/supplier-quotations/:id/edit",
    },
    {
      module: "Purchase",
      name: "Quotation Analysis",
      path: "/purchase/quotation-analysis",
    },
    {
      module: "Purchase",
      name: "Purchase Orders Local",
      path: "/purchase/purchase-orders-local",
    },
    {
      module: "Purchase",
      name: "Purchase Order Local Form",
      path: "/purchase/purchase-orders-local/new",
    },
    {
      module: "Purchase",
      name: "Purchase Order Local Edit",
      path: "/purchase/purchase-orders-local/:id",
    },
    {
      module: "Purchase",
      name: "Purchase Order Local Edit Form",
      path: "/purchase/purchase-orders-local/:id/edit",
    },
    {
      module: "Purchase",
      name: "Purchase Orders Import",
      path: "/purchase/purchase-orders-import",
    },
    {
      module: "Purchase",
      name: "Purchase Order Import Form",
      path: "/purchase/purchase-orders-import/new",
    },
    {
      module: "Purchase",
      name: "Purchase Order Import Edit",
      path: "/purchase/purchase-orders-import/:id",
    },
    {
      module: "Purchase",
      name: "Purchase Order Import Edit Form",
      path: "/purchase/purchase-orders-import/:id/edit",
    },
    {
      module: "Purchase",
      name: "Shipping Advice",
      path: "/purchase/shipping-advice",
    },
    {
      module: "Purchase",
      name: "Shipping Advice Form",
      path: "/purchase/shipping-advice/new",
    },
    {
      module: "Purchase",
      name: "Shipping Advice Edit",
      path: "/purchase/shipping-advice/:id",
    },
    {
      module: "Purchase",
      name: "Port Clearances",
      path: "/purchase/port-clearances",
    },
    {
      module: "Purchase",
      name: "Port Clearance Form",
      path: "/purchase/port-clearances/new",
    },
    {
      module: "Purchase",
      name: "Port Clearance Edit",
      path: "/purchase/port-clearances/:id",
    },
    {
      module: "Purchase",
      name: "Purchase Bills Local",
      path: "/purchase/purchase-bills-local",
    },
    {
      module: "Purchase",
      name: "Purchase Bill Local Form",
      path: "/purchase/purchase-bills-local/new",
    },
    {
      module: "Purchase",
      name: "Purchase Bill Local Edit",
      path: "/purchase/purchase-bills-local/:id",
    },
    {
      module: "Purchase",
      name: "Purchase Bills Import",
      path: "/purchase/purchase-bills-import",
    },
    {
      module: "Purchase",
      name: "Purchase Bill Import Form",
      path: "/purchase/purchase-bills-import/new",
    },
    {
      module: "Purchase",
      name: "Purchase Bill Import Edit",
      path: "/purchase/purchase-bills-import/:id",
    },
    { module: "Purchase", name: "Suppliers", path: "/purchase/suppliers" },
    {
      module: "Purchase",
      name: "Supplier Form",
      path: "/purchase/suppliers/new",
    },
    {
      module: "Purchase",
      name: "Supplier Edit",
      path: "/purchase/suppliers/:id",
    },
    {
      module: "Purchase",
      name: "Service Confirmation",
      path: "/purchase/service-confirmation",
    },
    {
      module: "Purchase",
      name: "Service Confirmation Edit",
      path: "/purchase/service-confirmation/:id",
    },
    {
      module: "Purchase",
      name: "Service Requests",
      path: "/purchase/service-requests",
    },
    {
      module: "Purchase",
      name: "Service Request Form",
      path: "/purchase/service-requests/new",
    },
    {
      module: "Purchase",
      name: "Service Bills",
      path: "/purchase/service-bills",
    },
    {
      module: "Purchase",
      name: "Service Bill Form",
      path: "/purchase/service-bills/new",
    },
    {
      module: "Purchase",
      name: "Service Bill Edit",
      path: "/purchase/service-bills/:id",
    },
    {
      module: "Purchase",
      name: "Mass Suppliers Upload",
      path: "/purchase/suppliers/mass-upload",
    },
    { module: "Purchase", name: "Reports", path: "/purchase/reports" },
    {
      module: "Finance",
      name: "Account Groups",
      path: "/finance/account-groups",
    },
    { module: "Finance", name: "Accounts", path: "/finance/accounts" },
    { module: "Finance", name: "COA", path: "/finance/coa" },
    { module: "Finance", name: "Tax Codes", path: "/finance/tax-codes" },
    { module: "Finance", name: "Currencies", path: "/finance/currencies" },
    { module: "Finance", name: "Fiscal Years", path: "/finance/fiscal-years" },
    {
      module: "Finance",
      name: "Journal Entry",
      path: "/finance/journal-voucher",
    },
    {
      module: "Finance",
      name: "Journal Entry Form",
      path: "/finance/journal-voucher/create",
    },
    {
      module: "Finance",
      name: "Make Payment",
      path: "/finance/payment-voucher",
    },
    {
      module: "Finance",
      name: "Make Payment Form",
      path: "/finance/payment-voucher/create",
    },
    {
      module: "Finance",
      name: "Receive Payment",
      path: "/finance/receipt-voucher",
    },
    {
      module: "Finance",
      name: "Receive Payment Form",
      path: "/finance/receipt-voucher/create",
    },
    {
      module: "Finance",
      name: "Contra Voucher",
      path: "/finance/contra-voucher",
    },
    {
      module: "Finance",
      name: "Contra Voucher Form",
      path: "/finance/contra-voucher/create",
    },
    {
      module: "Finance",
      name: "Sales Voucher",
      path: "/finance/sales-voucher",
    },
    {
      module: "Finance",
      name: "Sales Voucher Form",
      path: "/finance/sales-voucher/create",
    },
    {
      module: "Finance",
      name: "Purchase Voucher",
      path: "/finance/purchase-voucher",
    },
    {
      module: "Finance",
      name: "Purchase Voucher Form",
      path: "/finance/purchase-voucher/create",
    },
    {
      module: "Finance",
      name: "Bank Reconciliation",
      path: "/finance/bank-reconciliation",
    },
    {
      module: "Finance",
      name: "Bank Reconciliation Edit",
      path: "/finance/bank-reconciliation/:id",
    },
    { module: "Finance", name: "PDC Postings", path: "/finance/pdc-postings" },
    {
      module: "Finance",
      name: "PDC Posting Edit",
      path: "/finance/pdc-postings/:id",
    },
    { module: "Finance", name: "Reports", path: "/finance/reports" },
    {
      module: "Finance",
      name: "Reports Voucher Register",
      path: "/finance/reports/voucher-register",
    },
    {
      module: "Finance",
      name: "Reports Trial Balance",
      path: "/finance/reports/trial-balance",
    },
    {
      module: "Finance",
      name: "Reports Journals",
      path: "/finance/reports/journals",
    },
    {
      module: "Finance",
      name: "Reports General Ledger",
      path: "/finance/reports/general-ledger",
    },
    {
      module: "Finance",
      name: "Reports Profit And Loss",
      path: "/finance/reports/profit-and-loss",
    },
    {
      module: "Finance",
      name: "Reports Balance Sheet",
      path: "/finance/reports/balance-sheet",
    },
    {
      module: "Finance",
      name: "Reports Cash Flow",
      path: "/finance/reports/cash-flow",
    },
    {
      module: "Human Resources",
      name: "Employees",
      path: "/human-resources/employees",
    },
    {
      module: "Human Resources",
      name: "Leave Setup",
      path: "/human-resources/leave-setup",
    },
    {
      module: "Human Resources",
      name: "Shifts",
      path: "/human-resources/shifts",
    },
    {
      module: "Human Resources",
      name: "Attendance",
      path: "/human-resources/attendance",
    },
    {
      module: "Human Resources",
      name: "Salary Config",
      path: "/human-resources/salary-config",
    },
    {
      module: "Human Resources",
      name: "Tax Config",
      path: "/human-resources/tax-config",
    },
    {
      module: "Human Resources",
      name: "Allowances",
      path: "/human-resources/allowances",
    },
    {
      module: "Human Resources",
      name: "Loans",
      path: "/human-resources/loans",
    },
    {
      module: "Human Resources",
      name: "Payslips",
      path: "/human-resources/payslips",
    },
    {
      module: "Human Resources",
      name: "Promotions",
      path: "/human-resources/promotions",
    },
    {
      module: "Human Resources",
      name: "Medical Policies",
      path: "/human-resources/medical-policies",
    },
    {
      module: "Human Resources",
      name: "Reports",
      path: "/human-resources/reports",
    },
    {
      module: "Project Management",
      name: "Projects",
      path: "/project-management/projects",
    },
    {
      module: "Project Management",
      name: "Project Form",
      path: "/project-management/projects/new",
    },
    {
      module: "Project Management",
      name: "Project Edit",
      path: "/project-management/projects/:id",
    },
    {
      module: "Project Management",
      name: "Tasks",
      path: "/project-management/tasks",
    },
    {
      module: "Project Management",
      name: "Task Form",
      path: "/project-management/tasks/new",
    },
    {
      module: "Project Management",
      name: "Task Edit",
      path: "/project-management/tasks/:id",
    },
    {
      module: "Project Management",
      name: "Reports",
      path: "/project-management/reports",
    },
    {
      module: "Production",
      name: "Work Orders",
      path: "/production/work-orders",
    },
    { module: "Production", name: "Reports", path: "/production/reports" },
    { module: "POS", name: "Sales", path: "/pos/sales" },
    { module: "POS", name: "New Sale", path: "/pos/sales/new" },
    { module: "POS", name: "Sale Edit", path: "/pos/sales/:id" },
    { module: "POS", name: "Terminals", path: "/pos/terminals" },
    { module: "POS", name: "Terminal Form", path: "/pos/terminals/new" },
    { module: "POS", name: "Terminal Edit", path: "/pos/terminals/:id" },
    { module: "POS", name: "Reports", path: "/pos/reports" },
    { module: "POS", name: "Sales Entry", path: "/pos/sales-entry" },
    { module: "POS", name: "Invoice List", path: "/pos/invoices" },
    { module: "POS", name: "Sales Return", path: "/pos/returns" },
    { module: "POS", name: "POS Register", path: "/pos/register" },
    { module: "POS", name: "Cash Collection", path: "/pos/cash-collection" },
    { module: "POS", name: "Post to Finance", path: "/pos/post-to-finance" },
    {
      module: "Business Intelligence",
      name: "Dashboards",
      path: "/business-intelligence/dashboards",
    },
    {
      module: "Business Intelligence",
      name: "Analytics",
      path: "/business-intelligence/analytics",
    },
    {
      module: "Business Intelligence",
      name: "Reports",
      path: "/business-intelligence/reports",
    },
    {
      module: "Business Intelligence",
      name: "BI Reports",
      path: "/bi-reports",
    },
  ];
  const deleteDerived = pages
    .filter((p) => /\bEdit\b$/i.test(p.name))
    .map((p) => ({
      module: p.module,
      name: p.name.replace(/\bEdit\b$/i, "Delete"),
      path: p.path,
    }));
  const allPages = [...pages, ...deleteDerived];
  for (const p of allPages) {
    const code = `${p.module}_${p.name}`
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    await query(
      "INSERT IGNORE INTO adm_pages (module, name, code, path) VALUES (:module, :name, :code, :path)",
      { module: p.module, name: p.name, code, path: p.path || null },
    );
  }
}

export async function ensureRolePagesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_role_pages (
      role_id BIGINT UNSIGNED NOT NULL,
      page_id BIGINT UNSIGNED NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (role_id, page_id),
      FOREIGN KEY (role_id) REFERENCES adm_roles(id) ON DELETE CASCADE,
      FOREIGN KEY (page_id) REFERENCES adm_pages(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function ensureUserPermissionsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_user_permissions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      page_id BIGINT UNSIGNED NOT NULL,
      can_view TINYINT(1) DEFAULT 0,
      can_create TINYINT(1) DEFAULT 0,
      can_edit TINYINT(1) DEFAULT 0,
      can_delete TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_user_page (user_id, page_id),
      FOREIGN KEY (user_id) REFERENCES adm_users(id) ON DELETE CASCADE,
      FOREIGN KEY (page_id) REFERENCES adm_pages(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function ensureErrorLogsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_error_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NULL,
      module VARCHAR(100) NULL,
      action VARCHAR(150) NULL,
      error_code VARCHAR(50) NULL,
      message VARCHAR(255) NULL,
      details TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function ensureExceptionalPermissionsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_exceptional_permissions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      permission_code VARCHAR(150) NOT NULL,
      effect ENUM('ALLOW','DENY') NOT NULL DEFAULT 'ALLOW',
      reason VARCHAR(255) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      effective_from DATETIME NULL,
      effective_to DATETIME NULL,
      approved_by BIGINT UNSIGNED NULL,
      exception_type VARCHAR(50) NOT NULL DEFAULT 'TEMPORARY',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_ep_user (user_id),
      KEY idx_ep_code (permission_code),
      FOREIGN KEY (user_id) REFERENCES adm_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function ensureUserBranchMapping() {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_user_branches (
      user_id BIGINT UNSIGNED NOT NULL,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      PRIMARY KEY (user_id, branch_id),
      KEY idx_ub_company (company_id),
      KEY idx_ub_branch (branch_id),
      CONSTRAINT fk_ub_user FOREIGN KEY (user_id) REFERENCES adm_users(id) ON DELETE CASCADE,
      CONSTRAINT fk_ub_company FOREIGN KEY (company_id) REFERENCES adm_companies(id),
      CONSTRAINT fk_ub_branch FOREIGN KEY (branch_id) REFERENCES adm_branches(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

export async function logError({
  user_id = null,
  module = null,
  action = null,
  error_code = null,
  message = null,
  details = null,
}) {
  await ensureErrorLogsTable();
  await query(
    `INSERT INTO adm_error_logs (user_id, module, action, error_code, message, details) VALUES (:user_id, :module, :action, :error_code, :message, :details)`,
    { user_id, module, action, error_code, message, details },
  );
}

export async function nextWorkflowCode(companyId) {
  const rows = await query(
    `
    SELECT workflow_code
    FROM adm_workflows
    WHERE company_id = :companyId
      AND workflow_code REGEXP '^WF-[0-9]{6}$'
    ORDER BY CAST(SUBSTRING(workflow_code, 4) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].workflow_code || "");
    const numPart = prev.slice(3);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `WF-${String(nextNum).padStart(6, "0")}`;
}

export async function ensureWorkflowTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_workflows (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      workflow_code VARCHAR(50) NOT NULL,
      workflow_name VARCHAR(150) NOT NULL,
      module_key VARCHAR(50) NOT NULL,
      document_type VARCHAR(80) NOT NULL,
      document_route VARCHAR(255) DEFAULT NULL,
      min_amount DECIMAL(18,2) DEFAULT NULL,
      max_amount DECIMAL(18,2) DEFAULT NULL,
      default_behavior VARCHAR(20) DEFAULT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_workflow_company_code (company_id, workflow_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS adm_workflow_step_approvers (
      workflow_id BIGINT UNSIGNED NOT NULL,
      step_order INT NOT NULL,
      approver_user_id BIGINT UNSIGNED NOT NULL,
      approval_limit DECIMAL(15,2) DEFAULT NULL,
      PRIMARY KEY (workflow_id, step_order, approver_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  if (!(await hasColumn("adm_workflows", "document_route"))) {
    await query(
      `ALTER TABLE adm_workflows ADD COLUMN document_route VARCHAR(255) DEFAULT NULL`,
    );
  }
  if (!(await hasColumn("adm_workflows", "min_amount"))) {
    await query(
      `ALTER TABLE adm_workflows ADD COLUMN min_amount DECIMAL(18,2) DEFAULT NULL`,
    );
  }
  if (!(await hasColumn("adm_workflows", "max_amount"))) {
    await query(
      `ALTER TABLE adm_workflows ADD COLUMN max_amount DECIMAL(18,2) DEFAULT NULL`,
    );
  }
  if (!(await hasColumn("adm_workflows", "default_behavior"))) {
    await query(
      `ALTER TABLE adm_workflows ADD COLUMN default_behavior VARCHAR(20) DEFAULT NULL`,
    );
  }
  await query(`
    CREATE TABLE IF NOT EXISTS adm_workflow_steps (
      workflow_id BIGINT UNSIGNED NOT NULL,
      step_order INT NOT NULL,
      step_name VARCHAR(150) NOT NULL,
      approver_user_id BIGINT UNSIGNED NOT NULL,
      approver_role_id BIGINT UNSIGNED DEFAULT NULL,
      min_amount DECIMAL(18,2) DEFAULT NULL,
      max_amount DECIMAL(18,2) DEFAULT NULL,
      approval_limit DECIMAL(15,2) DEFAULT NULL,
      is_mandatory TINYINT(1) NOT NULL DEFAULT 1,
      PRIMARY KEY (workflow_id, step_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS adm_document_workflows (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      workflow_id BIGINT UNSIGNED NOT NULL,
      document_id BIGINT UNSIGNED NOT NULL,
      document_type VARCHAR(80) NOT NULL,
      amount DECIMAL(15,2) DEFAULT 0.00,
      current_step_order INT NOT NULL DEFAULT 1,
      status ENUM('PENDING','APPROVED','REJECTED','RETURNED') NOT NULL DEFAULT 'PENDING',
      assigned_to_user_id BIGINT UNSIGNED DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_doc_workflow_lookup (document_id, document_type),
      KEY idx_doc_workflow_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS adm_workflow_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      document_workflow_id BIGINT UNSIGNED NOT NULL,
      step_order INT NOT NULL,
      action VARCHAR(50) NOT NULL,
      actor_user_id BIGINT UNSIGNED NOT NULL,
      comments VARCHAR(255),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_wf_logs_dw (document_workflow_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS adm_notifications (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT,
      link VARCHAR(255),
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_notif_user (user_id, is_read)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS adm_workflow_tasks (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      workflow_id BIGINT UNSIGNED NOT NULL,
      document_workflow_id BIGINT UNSIGNED NOT NULL,
      document_id BIGINT UNSIGNED NOT NULL,
      document_type VARCHAR(80) NOT NULL,
      step_order INT NOT NULL,
      assigned_to_user_id BIGINT UNSIGNED NOT NULL,
      action ENUM('PENDING','APPROVED','REJECTED','RETURNED') NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_wf_task_lookup (document_workflow_id, step_order),
      KEY idx_wf_task_assignee (assigned_to_user_id, action)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

export async function ensurePushTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_push_subscriptions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      endpoint VARCHAR(500) NOT NULL,
      p256dh VARCHAR(255) NOT NULL,
      auth VARCHAR(100) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_active_at TIMESTAMP NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_endpoint (endpoint),
      KEY idx_user (user_id),
      KEY idx_scope (company_id, branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  if (!(await hasColumn("adm_push_subscriptions", "company_id"))) {
    await query(
      "ALTER TABLE adm_push_subscriptions ADD COLUMN company_id BIGINT UNSIGNED NOT NULL DEFAULT 1",
    );
  }
  if (!(await hasColumn("adm_push_subscriptions", "branch_id"))) {
    await query(
      "ALTER TABLE adm_push_subscriptions ADD COLUMN branch_id BIGINT UNSIGNED NOT NULL DEFAULT 1",
    );
  }
  if (!(await hasColumn("adm_push_subscriptions", "user_id"))) {
    await query(
      "ALTER TABLE adm_push_subscriptions ADD COLUMN user_id BIGINT UNSIGNED NOT NULL DEFAULT 0",
    );
  }
  if (!(await hasColumn("adm_push_subscriptions", "is_active"))) {
    await query(
      "ALTER TABLE adm_push_subscriptions ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1",
    );
  }
  if (!(await hasColumn("adm_push_subscriptions", "created_at"))) {
    await query(
      "ALTER TABLE adm_push_subscriptions ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP",
    );
  }
  if (!(await hasColumn("adm_push_subscriptions", "last_active_at"))) {
    await query(
      "ALTER TABLE adm_push_subscriptions ADD COLUMN last_active_at TIMESTAMP NULL",
    );
  }
}

export async function ensureSalesOrderColumns() {
  // Ensure columns used by Sales Orders exist to prevent runtime SQL errors
  const orders = "sal_orders";
  if (!(await hasColumn(orders, "sub_total"))) {
    await query(
      `ALTER TABLE ${orders} ADD COLUMN sub_total DECIMAL(18,2) DEFAULT 0`,
    );
  }
  if (!(await hasColumn(orders, "tax_amount"))) {
    await query(
      `ALTER TABLE ${orders} ADD COLUMN tax_amount DECIMAL(18,2) DEFAULT 0`,
    );
  }
  if (!(await hasColumn(orders, "currency_id"))) {
    await query(
      `ALTER TABLE ${orders} ADD COLUMN currency_id BIGINT UNSIGNED DEFAULT 4`,
    );
  }
  if (!(await hasColumn(orders, "exchange_rate"))) {
    await query(
      `ALTER TABLE ${orders} ADD COLUMN exchange_rate DECIMAL(18,6) DEFAULT 1`,
    );
  }
  if (!(await hasColumn(orders, "price_type"))) {
    await query(
      `ALTER TABLE ${orders} ADD COLUMN price_type ENUM('WHOLESALE','RETAIL') DEFAULT 'RETAIL'`,
    );
  }
  if (!(await hasColumn(orders, "payment_type"))) {
    await query(
      `ALTER TABLE ${orders} ADD COLUMN payment_type ENUM('CASH','CHEQUE','CREDIT') DEFAULT 'CASH'`,
    );
  }
  if (!(await hasColumn(orders, "warehouse_id"))) {
    await query(
      `ALTER TABLE ${orders} ADD COLUMN warehouse_id BIGINT UNSIGNED NULL`,
    );
  }
  if (!(await hasColumn(orders, "quotation_id"))) {
    await query(
      `ALTER TABLE ${orders} ADD COLUMN quotation_id BIGINT UNSIGNED NULL`,
    );
  }
  if (!(await hasColumn(orders, "remarks"))) {
    await query(`ALTER TABLE ${orders} ADD COLUMN remarks VARCHAR(500) NULL`);
  }

  const orderDetails = "sal_order_details";
  if (!(await hasColumn(orderDetails, "qty"))) {
    await query(
      `ALTER TABLE ${orderDetails} ADD COLUMN qty DECIMAL(18,4) NOT NULL DEFAULT 0`,
    );
  }
  if (!(await hasColumn(orderDetails, "unit_price"))) {
    await query(
      `ALTER TABLE ${orderDetails} ADD COLUMN unit_price DECIMAL(18,4) NOT NULL DEFAULT 0`,
    );
  }
  if (!(await hasColumn(orderDetails, "discount_percent"))) {
    await query(
      `ALTER TABLE ${orderDetails} ADD COLUMN discount_percent DECIMAL(5,2) DEFAULT 0`,
    );
  }
  if (!(await hasColumn(orderDetails, "total_amount"))) {
    await query(
      `ALTER TABLE ${orderDetails} ADD COLUMN total_amount DECIMAL(18,2) DEFAULT 0`,
    );
  }
  if (!(await hasColumn(orderDetails, "net_amount"))) {
    await query(
      `ALTER TABLE ${orderDetails} ADD COLUMN net_amount DECIMAL(18,2) DEFAULT 0`,
    );
  }
  if (!(await hasColumn(orderDetails, "tax_amount"))) {
    await query(
      `ALTER TABLE ${orderDetails} ADD COLUMN tax_amount DECIMAL(18,2) DEFAULT 0`,
    );
  }
  if (!(await hasColumn(orderDetails, "uom"))) {
    await query(
      `ALTER TABLE ${orderDetails} ADD COLUMN uom VARCHAR(50) DEFAULT 'PCS'`,
    );
  }
}

export async function ensureTemplateTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS document_templates (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(150) NOT NULL,
      document_type VARCHAR(50) NOT NULL,
      html_content MEDIUMTEXT NOT NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      created_by BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_company_type (company_id, document_type),
      KEY idx_default (company_id, document_type, is_default)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  if (!(await hasColumn("document_templates", "header_logo_url"))) {
    await query(
      "ALTER TABLE document_templates ADD COLUMN header_logo_url VARCHAR(500) NULL",
    );
  }
  if (!(await hasColumn("document_templates", "header_name"))) {
    await query(
      "ALTER TABLE document_templates ADD COLUMN header_name VARCHAR(255) NULL",
    );
  }
  if (!(await hasColumn("document_templates", "header_address"))) {
    await query(
      "ALTER TABLE document_templates ADD COLUMN header_address TEXT NULL",
    );
  }
  if (!(await hasColumn("document_templates", "header_address2"))) {
    await query(
      "ALTER TABLE document_templates ADD COLUMN header_address2 TEXT NULL",
    );
  }
  if (!(await hasColumn("document_templates", "header_phone"))) {
    await query(
      "ALTER TABLE document_templates ADD COLUMN header_phone VARCHAR(50) NULL",
    );
  }
  if (!(await hasColumn("document_templates", "header_email"))) {
    await query(
      "ALTER TABLE document_templates ADD COLUMN header_email VARCHAR(255) NULL",
    );
  }
  if (!(await hasColumn("document_templates", "header_website"))) {
    await query(
      "ALTER TABLE document_templates ADD COLUMN header_website VARCHAR(255) NULL",
    );
  }
}
