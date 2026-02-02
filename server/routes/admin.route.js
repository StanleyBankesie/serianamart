import express from "express";
import multer from "multer";
import {
  logErrorController,
  updateExceptionalPermissionController,
  deleteExceptionalPermissionController,
  listPages,
  listExceptionalPermissions,
  getExceptionalPermissionById,
  createExceptionalPermission,
  getMe,
  getDashboardStats,
} from "../controllers/admin.controller.js";

import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import {
  createBranch,
  getBranchById,
  getBranches,
  getCompanies,
  getCompanyById,
  getCompanyLogo,
  getDepartments,
  mangeCompanies,
  updateBranch,
  updateCompanies,
  updateDepartment,
  uploadCompanyLogo,
  getDepartmentById,
  createDepartment,
} from "../controllers/companies.controller.js";
import {
  getUserRole,
  listRoles,
  getRoleById,
  createRole,
  updateRole,
} from "../controllers/roles.controller.js";
import {
  getUsers,
  getUserById,
  getUserBranches,
  updateUserBranches,
  createUser,
  updateUser,
  patchUser,
  getUserPermissionsContext,
  saveUserPermissions,
  getUserAssignments,
} from "../controllers/users.controller.js";

const router = express.Router();

function toNumber(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function hasColumn(tableName, columnName) {
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

async function ensureBranchColumns() {
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

async function ensureUserColumns() {
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

async function ensurePagesTable() {
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

async function ensurePagesSeed() {
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
      name: "Permissions Dashboard",
      path: "/administration/permissions",
    },
    {
      module: "Administration",
      name: "User Permission Assignment",
      path: "/administration/user-permissions",
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
      name: "Employee Form",
      path: "/human-resources/employees/new",
    },
    {
      module: "Human Resources",
      name: "Employee Edit",
      path: "/human-resources/employees/:id",
    },
    {
      module: "Human Resources",
      name: "Leave Setup",
      path: "/human-resources/leave-setup",
    },
    {
      module: "Human Resources",
      name: "Leave Setup Form",
      path: "/human-resources/leave-setup/new",
    },
    {
      module: "Human Resources",
      name: "Leave Setup Edit",
      path: "/human-resources/leave-setup/:id",
    },
    {
      module: "Human Resources",
      name: "Shifts",
      path: "/human-resources/shifts",
    },
    {
      module: "Human Resources",
      name: "Shift Form",
      path: "/human-resources/shifts/new",
    },
    {
      module: "Human Resources",
      name: "Shift Edit",
      path: "/human-resources/shifts/:id",
    },
    {
      module: "Human Resources",
      name: "Attendance",
      path: "/human-resources/attendance",
    },
    {
      module: "Human Resources",
      name: "Attendance Form",
      path: "/human-resources/attendance/new",
    },
    {
      module: "Human Resources",
      name: "Attendance Edit",
      path: "/human-resources/attendance/:id",
    },
    {
      module: "Human Resources",
      name: "Salary Config",
      path: "/human-resources/salary-config",
    },
    {
      module: "Human Resources",
      name: "Salary Config Form",
      path: "/human-resources/salary-config/new",
    },
    {
      module: "Human Resources",
      name: "Salary Config Edit",
      path: "/human-resources/salary-config/:id",
    },
    {
      module: "Human Resources",
      name: "Tax Config",
      path: "/human-resources/tax-config",
    },
    {
      module: "Human Resources",
      name: "Tax Config Form",
      path: "/human-resources/tax-config/new",
    },
    {
      module: "Human Resources",
      name: "Tax Config Edit",
      path: "/human-resources/tax-config/:id",
    },
    {
      module: "Human Resources",
      name: "Allowances",
      path: "/human-resources/allowances",
    },
    {
      module: "Human Resources",
      name: "Allowance Form",
      path: "/human-resources/allowances/new",
    },
    {
      module: "Human Resources",
      name: "Allowance Edit",
      path: "/human-resources/allowances/:id",
    },
    {
      module: "Human Resources",
      name: "Loans",
      path: "/human-resources/loans",
    },
    {
      module: "Human Resources",
      name: "Loan Form",
      path: "/human-resources/loans/new",
    },
    {
      module: "Human Resources",
      name: "Loan Edit",
      path: "/human-resources/loans/:id",
    },
    {
      module: "Human Resources",
      name: "Payslips",
      path: "/human-resources/payslips",
    },
    {
      module: "Human Resources",
      name: "Payslip Form",
      path: "/human-resources/payslips/new",
    },
    {
      module: "Human Resources",
      name: "Payslip Edit",
      path: "/human-resources/payslips/:id",
    },
    {
      module: "Human Resources",
      name: "Promotions",
      path: "/human-resources/promotions",
    },
    {
      module: "Human Resources",
      name: "Promotion Form",
      path: "/human-resources/promotions/new",
    },
    {
      module: "Human Resources",
      name: "Promotion Edit",
      path: "/human-resources/promotions/:id",
    },
    {
      module: "Human Resources",
      name: "Medical Policies",
      path: "/human-resources/medical-policies",
    },
    {
      module: "Human Resources",
      name: "Medical Policy Form",
      path: "/human-resources/medical-policies/new",
    },
    {
      module: "Human Resources",
      name: "Medical Policy Edit",
      path: "/human-resources/medical-policies/:id",
    },
    {
      module: "Human Resources",
      name: "Reports",
      path: "/human-resources/reports",
    },

    { module: "Maintenance", name: "Assets", path: "/maintenance/assets" },
    {
      module: "Maintenance",
      name: "Asset Form",
      path: "/maintenance/assets/new",
    },
    {
      module: "Maintenance",
      name: "Asset Edit",
      path: "/maintenance/assets/:id",
    },
    {
      module: "Maintenance",
      name: "Work Orders",
      path: "/maintenance/work-orders",
    },
    {
      module: "Maintenance",
      name: "Work Order Form",
      path: "/maintenance/work-orders/new",
    },
    {
      module: "Maintenance",
      name: "Work Order Edit",
      path: "/maintenance/work-orders/:id",
    },
    {
      module: "Maintenance",
      name: "Schedules",
      path: "/maintenance/pm-schedules",
    },
    {
      module: "Maintenance",
      name: "Schedule Form",
      path: "/maintenance/pm-schedules/new",
    },
    {
      module: "Maintenance",
      name: "Schedule Edit",
      path: "/maintenance/pm-schedules/:id",
    },
    { module: "Maintenance", name: "Reports", path: "/maintenance/reports" },

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

async function ensureRolePagesTable() {
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

async function ensureUserPermissionsTable() {
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

async function ensureErrorLogsTable() {
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

async function ensureExceptionalPermissionsTable() {
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

async function logError({
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

async function ensureUserBranchMapping() {
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

async function ensureDocumentTemplatesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_document_templates (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      doc_type VARCHAR(30) NOT NULL,
      template_html LONGTEXT NOT NULL,
      created_by BIGINT UNSIGNED NULL,
      updated_by BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_doc_tpl (company_id, branch_id, doc_type),
      KEY idx_doc_tpl_scope (company_id, branch_id, doc_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}
function defaultDocumentTemplate(docType) {
  const t = String(docType || "")
    .trim()
    .toUpperCase();
  if (t !== "DELIVERY_NOTE") return "";
  return `
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;">
    <div style="min-width:120px;max-width:200px;">{{{company.logoHtml}}}</div>
    <div style="text-align:right;font-size:11px;line-height:1.35;">
      <div style="font-weight:800;font-size:14px;">{{company.name}}</div>
      <div>{{company.address}}</div>
      <div>{{company.city}}, {{company.state}}, {{company.country}} {{company.postalCode}}</div>
      <div>Contact: {{company.phone}} / {{company.email}}</div>
      <div>{{company.website}}</div>
      <div>TIN: {{company.taxId}} &nbsp; Reg: {{company.registrationNo}}</div>
    </div>
  </div>
  <div style="display:flex;align-items:center;gap:10px;color:#0f172a;margin:4px 0 10px;">
    <div style="flex:1;height:1px;background:#0f172a;"></div>
    <div style="font-weight:700;">* Delivery Note *</div>
    <div style="flex:1;height:1px;background:#0f172a;"></div>
  </div>
  <table style="width:100%;margin-bottom:10px;border:1px solid #cbd5e1;">
    <tr>
      <td style="width:50%;vertical-align:top;border-right:1px solid #cbd5e1;">
        <table style="width:100%;font-size:12px;">
          <tr><td style="width:32%;color:#475569;">Customer Name</td><td>:</td><td>{{customer.name}}</td></tr>
          <tr><td style="color:#475569;">Address</td><td>:</td><td>{{customer.address}}</td></tr>
          <tr><td style="color:#475569;">City</td><td>:</td><td>{{customer.city}}</td></tr>
          <tr><td style="color:#475569;">State</td><td>:</td><td>{{customer.state}}</td></tr>
          <tr><td style="color:#475569;">Country</td><td>:</td><td>{{customer.country}}</td></tr>
        </table>
      </td>
      <td style="width:50%;vertical-align:top;">
        <table style="width:100%;font-size:12px;">
          <tr><td style="width:40%;color:#475569;">Delivery No</td><td>:</td><td>{{delivery.delivery_no}}</td></tr>
          <tr><td style="color:#475569;">Delivery Date</td><td>:</td><td>{{delivery.delivery_date}}</td></tr>
          <tr><td style="color:#475569;">Order No</td><td>:</td><td>{{delivery.order_no}}</td></tr>
          <tr><td style="color:#475569;">Order Date</td><td>:</td><td>{{delivery.order_date}}</td></tr>
          <tr><td style="color:#475569;">Del Method</td><td>:</td><td>{{delivery.delivery_method}}</td></tr>
          <tr><td style="color:#475569;">Our Ref</td><td>:</td><td>{{delivery.our_ref}}</td></tr>
        </table>
      </td>
    </tr>
  </table>
  <table style="font-size:12px;">
    <thead>
      <tr>
        <th style="width:6%;">Sr No.</th>
        <th style="width:16%;">Product Code</th>
        <th>Product Description</th>
        <th class="right" style="width:18%;">Quantity Unit</th>
      </tr>
    </thead>
    <tbody>
      {{#each @root.items}}
      <tr>
        <td class="center">{{sr_no}}</td>
        <td>{{item_code}}</td>
        <td>{{item_name}}</td>
        <td class="right">{{qty_display}}</td>
      </tr>
      {{/each}}
      <tr>
        <td colspan="3" class="right"><strong>Total Quantity</strong></td>
        <td class="right"><strong>{{@root.totals.total_qty}}</strong></td>
      </tr>
    </tbody>
  </table>
  <div style="margin-top:10px;font-size:12px;">
    <table style="width:100%;">
      <tr><td style="width:20%;">Item Count</td><td>:</td><td>{{@root.items.length}}</td></tr>
      <tr><td>Vehicle No</td><td>:</td><td>{{delivery.vehicle_no}}</td></tr>
      <tr><td>DRIVER NAME AND SIGN</td><td>:</td><td></td></tr>
      <tr><td>WAY BILL NO & CARRIER</td><td>:</td><td>{{delivery.waybill_no}}</td></tr>
      <tr><td>GOODS ISSUED BY (SIGN)</td><td>:</td><td></td></tr>
    </table>
  </div>
  <div style="margin-top:14px;font-size:12px;">
    <div style="text-align:right;">
      <span style="border-bottom:1px solid #0f172a;">All above goods received in good order and condition</span>
    </div>
    <div style="height:40px;"></div>
    <div style="text-align:right;">
      <span style="border-bottom:1px solid #0f172a;">Signature with Company's Rubber Stamp</span>
    </div>
  </div>
  `;
}
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (String(file.mimetype || "").startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"), false);
  },
});

router.get("/me", requireAuth, requireCompanyScope, requireBranchScope, getMe);

router.get(
  "/document-templates",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      await ensureDocumentTemplatesTable();
      const items = await query(
        `
        SELECT doc_type, template_html, updated_at
        FROM adm_document_templates
        WHERE company_id = :companyId AND branch_id = :branchId
        ORDER BY doc_type ASC
        `,
        { companyId, branchId },
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/document-templates/:docType",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const docType = String(req.params.docType || "")
        .trim()
        .toUpperCase();
      if (!docType) {
        throw httpError(400, "VALIDATION_ERROR", "docType is required");
      }
      await ensureDocumentTemplatesTable();
      const rows = await query(
        `
        SELECT doc_type, template_html, updated_at
        FROM adm_document_templates
        WHERE company_id = :companyId AND branch_id = :branchId AND doc_type = :docType
        LIMIT 1
        `,
        { companyId, branchId, docType },
      );
      const item = rows[0] || null;
      if (item) {
        res.json({ item });
        return;
      }
      const def = defaultDocumentTemplate(docType);
      if (def && def.length) {
        res.json({
          item: { doc_type: docType, template_html: def, updated_at: null },
        });
        return;
      }
      res.json({ item: null });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/document-templates/:docType",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("ADMIN.COMPANIES.MANAGE"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const docType = String(req.params.docType || "")
        .trim()
        .toUpperCase();
      const templateHtml = String(req.body?.templateHtml || "");
      if (!docType) {
        throw httpError(400, "VALIDATION_ERROR", "docType is required");
      }
      if (!templateHtml.trim()) {
        throw httpError(400, "VALIDATION_ERROR", "templateHtml is required");
      }
      await ensureDocumentTemplatesTable();
      await query(
        `
        INSERT INTO adm_document_templates (
          company_id,
          branch_id,
          doc_type,
          template_html,
          created_by,
          updated_by
        ) VALUES (
          :companyId,
          :branchId,
          :docType,
          :templateHtml,
          :userId,
          :userId
        )
        ON DUPLICATE KEY UPDATE
          template_html = VALUES(template_html),
          updated_by = VALUES(updated_by),
          updated_at = CURRENT_TIMESTAMP
        `,
        {
          companyId,
          branchId,
          docType,
          templateHtml,
          userId: Number(req.user?.id) || null,
        },
      );
      const rows = await query(
        `
        SELECT doc_type, template_html, updated_at
        FROM adm_document_templates
        WHERE company_id = :companyId AND branch_id = :branchId AND doc_type = :docType
        LIMIT 1
        `,
        { companyId, branchId, docType },
      );
      res.json({ item: rows[0] || null });
    } catch (err) {
      next(err);
    }
  },
);

// ===== COMPANIES =====

router.get(
  "/companies",
  requireAuth,
  requirePermission("ADMIN.COMPANIES.VIEW"),
  getCompanies,
);

router.get(
  "/companies/:id",
  requireAuth,
  requirePermission("ADMIN.COMPANIES.VIEW"),
  getCompanyById,
);

router.post(
  "/companies/:id/logo",
  requireAuth,
  requirePermission("ADMIN.COMPANIES.MANAGE"),
  logoUpload.single("logo"),
  uploadCompanyLogo,
);

router.get(
  "/companies/:id/logo",
  requireAuth,
  requirePermission("ADMIN.COMPANIES.VIEW"),
  getCompanyLogo,
);

// ===== USER ROLE ASSIGNMENTS =====
router.get("/users/:id/roles", requireAuth, getUserRole);

router.post(
  "/companies",
  requireAuth,
  requirePermission("ADMIN.COMPANIES.MANAGE"),
  mangeCompanies,
);

router.put(
  "/companies/:id",
  requireAuth,
  requirePermission("ADMIN.COMPANIES.MANAGE"),
  updateCompanies,
);

// ===== BRANCHES =====

router.get(
  "/branches",
  requireAuth,
  requirePermission("ADMIN.BRANCHES.VIEW"),
  getBranches,
);
router.get(
  "/branches/:id",
  requireAuth,
  requirePermission("ADMIN.BRANCHES.VIEW"),
  getBranchById,
);

router.post(
  "/branches",
  requireAuth,
  requirePermission("ADMIN.BRANCHES.MANAGE"),
  createBranch,
);

router.put(
  "/branches/:id",
  requireAuth,
  requirePermission("ADMIN.BRANCHES.MANAGE"),
  updateBranch,
);

// ===== DEPARTMENTS =====

router.get(
  "/departments",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  getDepartments,
);

router.get("/departments/:id", requireAuth, getDepartmentById);

router.post("/departments", requireAuth, createDepartment);

router.put("/departments/:id", requireAuth, updateDepartment);

// ===== PAGES =====

router.get("/pages", requireAuth, listPages);

// ===== ROLES =====

router.get(
  "/roles",
  requireAuth,
  requirePermission("ADMIN.ROLES.VIEW"),
  listRoles,
);

router.get(
  "/roles/:id",
  requireAuth,
  requireCompanyScope,
  requirePermission("ADMIN.ROLES.VIEW"),
  getRoleById,
);

router.post(
  "/roles",
  requireAuth,
  requireCompanyScope,
  requirePermission("ADMIN.ROLES.MANAGE"),
  createRole,
);

router.put(
  "/roles/:id",
  requireAuth,
  requireCompanyScope,
  requirePermission("ADMIN.ROLES.MANAGE"),
  updateRole,
);

// ===== USERS =====

router.get(
  "/users",
  requireAuth,
  requirePermission("ADMIN.USERS.VIEW"),
  getUsers,
);

router.get(
  "/users/:id",
  requireAuth,
  requirePermission("ADMIN.USERS.VIEW"),
  getUserById,
);

router.get(
  "/users/:id/branches",
  requireAuth,
  requirePermission("ADMIN.USERS.MANAGE"),
  getUserBranches,
);

router.put(
  "/users/:id/branches",
  requireAuth,
  requirePermission("ADMIN.USERS.MANAGE"),
  updateUserBranches,
);

router.post(
  "/users",
  requireAuth,
  requirePermission("ADMIN.USERS.MANAGE"),
  createUser,
);

router.put(
  "/users/:id",
  requireAuth,
  requirePermission("ADMIN.USERS.MANAGE"),
  updateUser,
);

// Patch for quick updates (e.g. branch assignment)
router.patch(
  "/users/:id",
  requireAuth,
  requirePermission("ADMIN.USERS.MANAGE"),
  patchUser,
);

// ===== USER PERMISSIONS =====

router.get(
  "/users/:id/permissions-context",
  requireAuth,
  requirePermission("ADMIN.USERS.MANAGE"),
  getUserPermissionsContext,
);

router.post(
  "/users/:id/permissions",
  requireAuth,
  requirePermission("ADMIN.USERS.MANAGE"),
  saveUserPermissions,
);

router.get("/user-assignments", requireAuth, getUserAssignments);

// ===== DASHBOARD STATS =====

// duplicate removed; single dashboard-stats route defined above

// ===== EXCEPTIONAL PERMISSIONS =====

router.get(
  "/exceptional-permissions",
  requireAuth,
  requirePermission("ADMIN.EXCEPTIONS.VIEW"),
  listExceptionalPermissions,
);

router.get(
  "/exceptional-permissions/:id",
  requireAuth,
  requirePermission("ADMIN.EXCEPTIONS.VIEW"),
  getExceptionalPermissionById,
);

router.post(
  "/exceptional-permissions",
  requireAuth,
  requirePermission("ADMIN.EXCEPTIONS.MANAGE"),
  createExceptionalPermission,
);

router.put(
  "/exceptional-permissions/:id",
  requireAuth,
  requirePermission("ADMIN.EXCEPTIONS.MANAGE"),
  updateExceptionalPermissionController,
);

router.delete(
  "/exceptional-permissions/:id",
  requireAuth,
  requirePermission("ADMIN.EXCEPTIONS.MANAGE"),
  deleteExceptionalPermissionController,
);

router.post("/error-logs", requireAuth, logErrorController);

export default router;
