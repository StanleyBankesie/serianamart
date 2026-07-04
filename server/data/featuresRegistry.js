/**
 * Complete Features Registry for Backend
 * Must stay in sync with client/src/data/modulesRegistry.js
 * Contains all modules, features, and dashboards for RBAC system
 */

// Main registry mapping module keys to their respective features and dashboards
// This serves as the single source of truth for all system features in the backend
export const FEATURES_REGISTRY = {
  // Administration Module: Contains features for user, role, company, and system configuration
  administration: {
    features: [
      { feature_key: "administration:users", type: "feature", label: "User Management", path: "/administration/users" },
      { feature_key: "administration:user-permissions", type: "feature", label: "User Permissions", path: "/administration/user-permissions" },
      { feature_key: "administration:user-overrides", type: "feature", label: "Exceptional Permissions", path: "/administration/user-overrides" },
      { feature_key: "administration:roles", type: "feature", label: "Role Setup", path: "/administration/roles" },
      { feature_key: "administration:companies", type: "feature", label: "Company Setup", path: "/administration/companies" },
      { feature_key: "administration:branches", type: "feature", label: "Branch Setup", path: "/administration/branches" },
      { feature_key: "administration:workflows", type: "feature", label: "Workflows", path: "/administration/workflows" },
      { feature_key: "administration:templates", type: "feature", label: "Document Templates", path: "/administration/templates" },
      { feature_key: "administration:reports", type: "feature", label: "System Reports", path: "/administration/reports" },
      { feature_key: "administration:settings", type: "feature", label: "System Settings", path: "/administration/settings" },
      { feature_key: "administration:backups", type: "feature", label: "System Backups", path: "/administration/backups" },
    ],
    dashboards: [
      { feature_key: "administration:system-overview", type: "dashboard", label: "System Overview Dashboard", path: "/administration/system-overview" },
      { feature_key: "administration:user-activity", type: "dashboard", label: "User Activity Dashboard", path: "/administration/user-activity" },
    ],
  },

  // Sales Module: Contains features for managing quotations, sales orders, invoices, and customer relations
  sales: {
    features: [
      { feature_key: "sales:quotations", type: "feature", label: "Quotations", path: "/sales/quotations" },
      { feature_key: "sales:sales-orders", type: "feature", label: "Sales Orders", path: "/sales/sales-orders" },
      { feature_key: "sales:invoices", type: "feature", label: "Invoices", path: "/sales/invoices" },
      { feature_key: "sales:delivery", type: "feature", label: "Delivery Management", path: "/sales/delivery" },
      { feature_key: "sales:customers", type: "feature", label: "Customer Management", path: "/sales/customers" },
      { feature_key: "sales:reports", type: "feature", label: "Sales Reports", path: "/sales/reports" },
      { feature_key: "sales:returns", type: "feature", label: "Sales Returns", path: "/sales/returns" },
      { feature_key: "sales:price-setup", type: "feature", label: "Price Setup", path: "/sales/price-setup" },
      { feature_key: "sales:discount-schemes", type: "feature", label: "Discount Schemes", path: "/sales/discount-schemes" },
      { feature_key: "sales:customer-credit", type: "feature", label: "Customer Credit", path: "/sales/customer-credit" },
      { feature_key: "sales:bulk-upload", type: "feature", label: "Bulk Customer Upload", path: "/sales/bulk-upload" },
      { feature_key: "sales:prospect-customers", type: "feature", label: "Prospective Customers", path: "/sales/prospect-customers" },
      { feature_key: "sales:prospect-conversion", type: "feature", label: "Prospect Conversion", path: "/sales/prospect-conversion" },
    ],
    dashboards: [
      { feature_key: "sales:sales-overview", type: "dashboard", label: "Sales Overview Dashboard", path: "/sales/sales-overview" },
      { feature_key: "sales:revenue-analytics", type: "dashboard", label: "Revenue Analytics Dashboard", path: "/sales/revenue-analytics" },
      { feature_key: "sales:customer-analytics", type: "dashboard", label: "Customer Analytics Dashboard", path: "/sales/customer-analytics" },
    ],
  },

  // Purchase Module: Contains features for procurement, purchase orders, RFQs, and supplier management
  purchase: {
    features: [
      { feature_key: "purchase:direct-purchase", type: "feature", label: "Direct Purchase", path: "/purchase/direct-purchase" },
      { feature_key: "purchase:general-requisitions", type: "feature", label: "General Requisition", path: "/purchase/general-requisitions" },
      { feature_key: "purchase:rfqs", type: "feature", label: "Request for Quotation", path: "/purchase/rfqs" },
      { feature_key: "purchase:supplier-quotations", type: "feature", label: "Supplier Quotations", path: "/purchase/supplier-quotations" },
      { feature_key: "purchase:quotation-analysis", type: "feature", label: "Quotation Analysis", path: "/purchase/quotation-analysis" },
      { feature_key: "purchase:purchase-orders-local", type: "feature", label: "Local Purchase Orders", path: "/purchase/purchase-orders-local" },
      { feature_key: "purchase:purchase-orders-import", type: "feature", label: "Import Purchase Orders", path: "/purchase/purchase-orders-import" },
      { feature_key: "purchase:shipping-advice", type: "feature", label: "Shipping Advice", path: "/purchase/shipping-advice" },
      { feature_key: "purchase:port-clearances", type: "feature", label: "Port Clearances", path: "/purchase/port-clearances" },
      { feature_key: "purchase:purchase-bills-local", type: "feature", label: "Local Purchase Bills", path: "/purchase/purchase-bills-local" },
      { feature_key: "purchase:purchase-bills-import", type: "feature", label: "Import Purchase Bills", path: "/purchase/purchase-bills-import" },
      { feature_key: "purchase:suppliers", type: "feature", label: "Suppliers", path: "/purchase/suppliers" },
      { feature_key: "purchase:purchase-returns", type: "feature", label: "Purchase Returns", path: "/purchase/purchase-returns" },
      { feature_key: "purchase:reports", type: "feature", label: "Reports", path: "/purchase/reports" },
      { feature_key: "purchase:setup", type: "feature", label: "Purchase Setup", path: "/purchase/setup" },
    ],
    dashboards: [
      { feature_key: "purchase:procurement-overview", type: "dashboard", label: "Procurement Overview Dashboard", path: "/purchase/procurement-overview" },
      { feature_key: "purchase:supplier-analytics", type: "dashboard", label: "Supplier Analytics Dashboard", path: "/purchase/supplier-analytics" },
    ],
  },

  // Inventory Module: Contains features for material requisitions, stock management, and warehousing
  inventory: {
    features: [
      { feature_key: "inventory:material-requisitions", type: "feature", label: "Material Requisitions", path: "/inventory/material-requisitions" },
      { feature_key: "inventory:stock-upload", type: "feature", label: "Stock Upload", path: "/inventory/stock-upload" },
      { feature_key: "inventory:stock-updation", type: "feature", label: "Stock Updation", path: "/inventory/stock-updation" },
      { feature_key: "inventory:stock-adjustments", type: "feature", label: "Stock Adjustment", path: "/inventory/stock-adjustments" },
      { feature_key: "inventory:stock-transfers", type: "feature", label: "Stock Transfer", path: "/inventory/stock-transfers" },
      { feature_key: "inventory:stock-verification", type: "feature", label: "Stock Verification", path: "/inventory/stock-verification" },
      { feature_key: "inventory:return-to-stores", type: "feature", label: "Return to Stores Advice", path: "/inventory/return-to-stores" },
      { feature_key: "inventory:issue-to-requirement", type: "feature", label: "Issue to Requirement Area", path: "/inventory/issue-to-requirement" },
      { feature_key: "inventory:transfer-acceptance", type: "feature", label: "Transfer Acceptance", path: "/inventory/transfer-acceptance" },
      { feature_key: "inventory:grn-local", type: "feature", label: "Material Receipt (GRN) - Local", path: "/inventory/grn-local" },
      { feature_key: "inventory:grn-import", type: "feature", label: "Material Receipt (GRN) - Import", path: "/inventory/grn-import" },
      { feature_key: "inventory:items", type: "feature", label: "Item Management", path: "/inventory/items" },
      { feature_key: "inventory:item-groups", type: "feature", label: "Item Categories", path: "/inventory/item-groups" },
      { feature_key: "inventory:unit-conversions", type: "feature", label: "Unit Conversion", path: "/inventory/unit-conversions" },
      { feature_key: "inventory:warehouses", type: "feature", label: "Warehouse Management", path: "/inventory/warehouses" },
      { feature_key: "inventory:batches", type: "feature", label: "Item Batches Tracking", path: "/inventory/batches" },
      { feature_key: "inventory:stock-taking", type: "feature", label: "Stock Taking", path: "/inventory/stock-taking" },
      { feature_key: "inventory:stock-reorder", type: "feature", label: "Stock Reorder", path: "/inventory/stock-reorder" },
      { feature_key: "inventory:reports", type: "feature", label: "Inventory Reports", path: "/inventory/reports" },
    ],
    dashboards: [
      { feature_key: "inventory:inventory-overview", type: "dashboard", label: "Inventory Overview Dashboard", path: "/inventory/inventory-overview" },
      { feature_key: "inventory:stock-analytics", type: "dashboard", label: "Stock Analytics Dashboard", path: "/inventory/stock-analytics" },
    ],
  },

  // Finance Module: Contains features for accounting, vouchers, bank reconciliation, and budget management
  finance: {
    features: [
      { feature_key: "finance:journal-voucher", type: "feature", label: "Journal Entry", path: "/finance/journal-voucher" },
      { feature_key: "finance:payment-voucher", type: "feature", label: "Make Payment", path: "/finance/payment-voucher" },
      { feature_key: "finance:receipt-voucher", type: "feature", label: "Receive Payment", path: "/finance/receipt-voucher" },
      { feature_key: "finance:contra-voucher", type: "feature", label: "Contra Entry", path: "/finance/contra-voucher" },
      { feature_key: "finance:credit-note", type: "feature", label: "Credit Note", path: "/finance/credit-note" },
      { feature_key: "finance:debit-note", type: "feature", label: "Debit Note", path: "/finance/debit-note" },
      { feature_key: "finance:sales-voucher", type: "feature", label: "Sales Voucher", path: "/finance/sales-voucher" },
      { feature_key: "finance:purchase-voucher", type: "feature", label: "Purchase Voucher", path: "/finance/purchase-voucher" },
      { feature_key: "finance:chart-of-accounts", type: "feature", label: "Chart of Accounts", path: "/finance/chart-of-accounts" },
      { feature_key: "finance:account-groups", type: "feature", label: "Account Groups", path: "/finance/account-groups" },
      { feature_key: "finance:cost-centers", type: "feature", label: "Cost Centers", path: "/finance/cost-centers" },
      { feature_key: "finance:tax-codes", type: "feature", label: "Tax Codes & Deductions", path: "/finance/tax-codes" },
      { feature_key: "finance:currencies", type: "feature", label: "Currencies", path: "/finance/currencies" },
      { feature_key: "finance:fiscal-years", type: "feature", label: "Fiscal Years", path: "/finance/fiscal-years" },
      { feature_key: "finance:budget", type: "feature", label: "Budget Management", path: "/finance/budget" },
      { feature_key: "finance:bank-reconciliation", type: "feature", label: "Bank Reconciliation", path: "/finance/bank-reconciliation" },
      { feature_key: "finance:fixed-assets", type: "feature", label: "Fixed Assets", path: "/finance/fixed-assets" },
      { feature_key: "finance:opening-balances", type: "feature", label: "Opening Balances", path: "/finance/opening-balances" },
      { feature_key: "finance:pdc-postings", type: "feature", label: "Post-Dated Cheques", path: "/finance/pdc-postings" },
      { feature_key: "finance:reports", type: "feature", label: "Finance Reports", path: "/finance/reports" },
    ],
    dashboards: [
      { feature_key: "finance:financial-overview", type: "dashboard", label: "Financial Overview Dashboard", path: "/finance/financial-overview" },
      { feature_key: "finance:cash-flow", type: "dashboard", label: "Cash Flow Dashboard", path: "/finance/cash-flow" },
      { feature_key: "finance:budget-analysis", type: "dashboard", label: "Budget Analysis Dashboard", path: "/finance/budget-analysis" },
    ],
  },

  // Human Resources Module: Contains features for employee management, payroll, attendance, and leave management
  "human-resources": {
    features: [
      { feature_key: "human-resources:employees", type: "feature", label: "Employee Setup", path: "/human-resources/employees" },
      { feature_key: "human-resources:departments", type: "feature", label: "Departments", path: "/human-resources/departments" },
      { feature_key: "human-resources:designations", type: "feature", label: "Designations", path: "/human-resources/designations" },
      { feature_key: "human-resources:requisitions", type: "feature", label: "Job Requisitions", path: "/human-resources/requisitions" },
      { feature_key: "human-resources:candidates", type: "feature", label: "Candidates", path: "/human-resources/candidates" },
      { feature_key: "human-resources:interviews", type: "feature", label: "Interviews", path: "/human-resources/interviews" },
      { feature_key: "human-resources:offers", type: "feature", label: "Offers", path: "/human-resources/offers" },
      { feature_key: "human-resources:attendance", type: "feature", label: "Attendance Management", path: "/human-resources/attendance" },
      { feature_key: "human-resources:work-schedules", type: "feature", label: "Work Schedule Management", path: "/human-resources/work-schedules" },
      { feature_key: "human-resources:roster", type: "feature", label: "Roster Management", path: "/human-resources/roster" },
      { feature_key: "human-resources:leave-setup", type: "feature", label: "Leave Setup", path: "/human-resources/leave-setup" },
      { feature_key: "human-resources:leave-management", type: "feature", label: "Leave Management", path: "/human-resources/leave-management" },
      { feature_key: "human-resources:payroll", type: "feature", label: "Payroll Processing", path: "/human-resources/payroll" },
      { feature_key: "human-resources:payslips", type: "feature", label: "Payslips", path: "/human-resources/payslips" },
      { feature_key: "human-resources:salary-config", type: "feature", label: "Salary Configurations", path: "/human-resources/salary-config" },
      { feature_key: "human-resources:tax-config", type: "feature", label: "Statutory Contributions", path: "/human-resources/tax-config" },
      { feature_key: "human-resources:allowances", type: "feature", label: "Allowances", path: "/human-resources/allowances" },
      { feature_key: "human-resources:loans", type: "feature", label: "Employee Loans", path: "/human-resources/loans" },
      { feature_key: "human-resources:promotions", type: "feature", label: "Promotions", path: "/human-resources/promotions" },
      { feature_key: "human-resources:medical-policies", type: "feature", label: "Medical Policies", path: "/human-resources/medical-policies" },
      { feature_key: "human-resources:policies", type: "feature", label: "Policies", path: "/human-resources/policies" },
      { feature_key: "human-resources:setup", type: "feature", label: "HR Setup", path: "/human-resources/setup" },
      { feature_key: "human-resources:hr-reports", type: "feature", label: "HR Reports", path: "/human-resources/hr-reports" },
    ],
    dashboards: [
      { feature_key: "human-resources:hr-overview", type: "dashboard", label: "HR Overview Dashboard", path: "/human-resources/hr-overview" },
      { feature_key: "human-resources:attendance-dashboard", type: "dashboard", label: "Attendance Dashboard", path: "/human-resources/attendance-dashboard" },
      { feature_key: "human-resources:payroll-dashboard", type: "dashboard", label: "Payroll Dashboard", path: "/human-resources/payroll-dashboard" },
    ],
  },

  // Maintenance Module: Contains features for asset management, equipment, and maintenance schedules
  maintenance: {
    features: [
      { feature_key: "maintenance:assets", type: "feature", label: "Asset Management", path: "/maintenance/assets" },
      { feature_key: "maintenance:equipment", type: "feature", label: "Equipment", path: "/maintenance/equipment" },
      { feature_key: "maintenance:contracts", type: "feature", label: "Maintenance Contracts", path: "/maintenance/contracts" },
      { feature_key: "maintenance:maintenance-requests", type: "feature", label: "Maintenance Requests", path: "/maintenance/maintenance-requests" },
      { feature_key: "maintenance:job-orders", type: "feature", label: "Job Orders", path: "/maintenance/job-orders" },
      { feature_key: "maintenance:pm-schedules", type: "feature", label: "PM Schedules", path: "/maintenance/pm-schedules" },
      { feature_key: "maintenance:schedules", type: "feature", label: "Maintenance Schedules", path: "/maintenance/schedules" },
      { feature_key: "maintenance:rosters", type: "feature", label: "Maintenance Rosters", path: "/maintenance/rosters" },
      { feature_key: "maintenance:maintenance-reports", type: "feature", label: "Maintenance Reports", path: "/maintenance/maintenance-reports" },
      { feature_key: "maintenance:setup", type: "feature", label: "Maintenance Setup", path: "/maintenance/setup" },
      { feature_key: "maintenance:material-receipts", type: "feature", label: "Material Receipts", path: "/maintenance/material-receipts" },
    ],
    dashboards: [
      { feature_key: "maintenance:maintenance-overview", type: "dashboard", label: "Maintenance Overview Dashboard", path: "/maintenance/maintenance-overview" },
      { feature_key: "maintenance:asset-analytics", type: "dashboard", label: "Asset Analytics Dashboard", path: "/maintenance/asset-analytics" },
    ],
  },

  // Production Module: Contains features for manufacturing processes, BOMs, routings, and work orders
  production: {
    features: [
      { feature_key: "production:boms", type: "feature", label: "Bills of Materials", path: "/production/boms" },
      { feature_key: "production:routings", type: "feature", label: "Routing & Operations", path: "/production/routings" },
      { feature_key: "production:work-orders", type: "feature", label: "Work Orders", path: "/production/work-orders" },
      { feature_key: "production:production-planning", type: "feature", label: "Production Planning", path: "/production/production-planning" },
      { feature_key: "production:job-cards", type: "feature", label: "Job Cards", path: "/production/job-cards" },
      { feature_key: "production:production-reports", type: "feature", label: "Production Reports", path: "/production/production-reports" },
      { feature_key: "production:setup", type: "feature", label: "Manufacturing Setup", path: "/production/setup" },
    ],
    dashboards: [
      { feature_key: "production:production-overview", type: "dashboard", label: "Production Overview Dashboard", path: "/production/production-overview" },
      { feature_key: "production:efficiency-analytics", type: "dashboard", label: "Efficiency Analytics Dashboard", path: "/production/efficiency-analytics" },
    ],
  },

  // Project Management Module: Contains features for project tracking, task management, and resource allocation
  "project-management": {
    features: [
      { feature_key: "project-management:projects", type: "feature", label: "Projects", path: "/project-management/projects" },
      { feature_key: "project-management:tasks", type: "feature", label: "Task Management", path: "/project-management/tasks" },
      { feature_key: "project-management:milestones", type: "feature", label: "Milestones", path: "/project-management/milestones" },
      { feature_key: "project-management:resources", type: "feature", label: "Resource Management", path: "/project-management/resources" },
      { feature_key: "project-management:timesheets", type: "feature", label: "Timesheets", path: "/project-management/timesheets" },
      { feature_key: "project-management:expenses", type: "feature", label: "Project Expenses", path: "/project-management/expenses" },
      { feature_key: "project-management:setup", type: "feature", label: "Project Setup", path: "/project-management/setup" },
      { feature_key: "project-management:material-requisitions", type: "feature", label: "Material Requisitions", path: "/project-management/material-requisitions" },
      { feature_key: "project-management:material-utilizations", type: "feature", label: "Material Utilizations", path: "/project-management/material-utilizations" },
      { feature_key: "project-management:material-receipts", type: "feature", label: "Material Receipts", path: "/project-management/material-receipts" },
      { feature_key: "project-management:project-orders", type: "feature", label: "Project Orders", path: "/project-management/project-orders" },
      { feature_key: "project-management:purchase-requisition", type: "feature", label: "Purchase Requisition", path: "/project-management/purchase-requisition" },
      { feature_key: "project-management:project-reports", type: "feature", label: "Project Reports", path: "/project-management/project-reports" },
      { feature_key: "project-management:project-status-report", type: "feature", label: "Project Status Report", path: "/project-management/reports/project-status" },
      { feature_key: "project-management:project-income-report", type: "feature", label: "Project Income Report", path: "/project-management/reports/project-income" },
      { feature_key: "project-management:project-expense-report", type: "feature", label: "Project Expense Report", path: "/project-management/reports/project-expense" },
    ],
    dashboards: [
      { feature_key: "project-management:project-overview", type: "dashboard", label: "Project Overview Dashboard", path: "/project-management/project-overview" },
      { feature_key: "project-management:resource-utilization", type: "dashboard", label: "Resource Utilization Dashboard", path: "/project-management/resource-utilization" },
    ],
  },

  // Point of Sale (POS) Module: Contains features for retail operations, cash collection, and day management
  pos: {
    features: [
      { feature_key: "pos:sales-entry", type: "feature", label: "Sales Entry", path: "/pos/sales-entry" },
      { feature_key: "pos:day-management", type: "feature", label: "Start/End Business Day", path: "/pos/day-management" },
      { feature_key: "pos:cash-collection", type: "feature", label: "Cash Collection", path: "/pos/cash-collection" },
      { feature_key: "pos:invoices", type: "feature", label: "POS Invoices", path: "/pos/invoices" },
      { feature_key: "pos:post-to-finance", type: "feature", label: "Post to Finance", path: "/pos/post-to-finance" },
      { feature_key: "pos:returns", type: "feature", label: "POS Returns", path: "/pos/returns" },
      { feature_key: "pos:register", type: "feature", label: "POS Register", path: "/pos/register" },
      { feature_key: "pos:reports", type: "feature", label: "POS Reports", path: "/pos/reports" },
      { feature_key: "pos:dashboard", type: "feature", label: "POS Dashboard", path: "/pos/dashboard" },
      { feature_key: "pos:customer-history", type: "feature", label: "Customer Accounts", path: "/pos/customer-history" },
      { feature_key: "pos:on-hold", type: "feature", label: "On-Hold Sales", path: "/pos/holds" },
      { feature_key: "pos:reconciliation", type: "feature", label: "Sync Reconciliation", path: "/pos/reconciliation" },
      { feature_key: "pos:setup", type: "feature", label: "POS Setup", path: "/pos/setup" },
    ],
    dashboards: [
      { feature_key: "pos:pos-overview", type: "dashboard", label: "POS Overview Dashboard", path: "/pos/pos-overview" },
      { feature_key: "pos:sales-analytics", type: "dashboard", label: "Sales Analytics Dashboard", path: "/pos/sales-analytics" },
    ],
  },

  // Business Intelligence Module: Contains features for custom reports, dashboards, and analytics
  "business-intelligence": {
    features: [
      { feature_key: "business-intelligence:dashboards", type: "feature", label: "Dashboard Management", path: "/business-intelligence/dashboards" },
      { feature_key: "business-intelligence:reports", type: "feature", label: "Custom Reports", path: "/business-intelligence/reports" },
      { feature_key: "business-intelligence:data-sources", type: "feature", label: "Data Sources", path: "/business-intelligence/data-sources" },
      { feature_key: "business-intelligence:analytics", type: "feature", label: "Analytics", path: "/business-intelligence/analytics" },
      { feature_key: "business-intelligence:bi-reports", type: "feature", label: "BI Reports", path: "/business-intelligence/bi-reports" },
    ],
    dashboards: [
      { feature_key: "business-intelligence:bi-overview", type: "dashboard", label: "BI Overview Dashboard", path: "/business-intelligence/bi-overview" },
      { feature_key: "business-intelligence:executive-dashboard", type: "dashboard", label: "Executive Dashboard", path: "/business-intelligence/executive-dashboard" },
    ],
  },

  // Executive Overview Module: Contains features for high-level KPIs and executive dashboards
  "executive-overview": {
    features: [
      { feature_key: "executive-overview:dashboard", type: "feature", label: "Executive Dashboard", path: "/executive-overview/dashboard" },
      { feature_key: "executive-overview:kpi-reports", type: "feature", label: "KPI Reports", path: "/executive-overview/kpi-reports" },
    ],
    dashboards: [
      { feature_key: "executive-overview:executive-dashboard", type: "dashboard", label: "Executive Dashboard", path: "/executive-overview/executive-dashboard" },
    ],
  },

  // Service Management Module: Contains features for customer/supplier service requests and service orders
  "service-management": {
    features: [
      { feature_key: "service-management:customer-service-requests", type: "feature", label: "Customer Service Requests", path: "/service-management/customer-service-requests" },
      { feature_key: "service-management:supplier-service-requests", type: "feature", label: "Supplier Service Requests", path: "/service-management/supplier-service-requests" },
      { feature_key: "service-management:service-requests", type: "feature", label: "Service Requests", path: "/service-management/service-requests" },
      { feature_key: "service-management:service-orders", type: "feature", label: "Service Orders", path: "/service-management/service-orders" },
      { feature_key: "service-management:service-executions", type: "feature", label: "Service Execution", path: "/service-management/service-executions" },
      { feature_key: "service-management:service-confirmations", type: "feature", label: "Service Confirmations", path: "/service-management/service-confirmations" },
      { feature_key: "service-management:service-bills", type: "feature", label: "Service Bills", path: "/service-management/service-bills" },
      { feature_key: "service-management:service-invoices", type: "feature", label: "Service Invoices", path: "/service-management/service-invoices" },
      { feature_key: "service-management:billing", type: "feature", label: "Service Billing", path: "/service-management/billing" },
      { feature_key: "service-management:service-reports", type: "feature", label: "Service Reports", path: "/service-management/service-reports" },
      { feature_key: "service-management:visitors-log", type: "feature", label: "Visitors Log Book", path: "/service-management/visitors-log" },
      { feature_key: "service-management:setup", type: "feature", label: "Service Setup", path: "/service-management/setup" },
    ],
    dashboards: [
      { feature_key: "service-management:service-overview", type: "dashboard", label: "Service Overview Dashboard", path: "/service-management/service-overview" },
      { feature_key: "service-management:billing-analytics", type: "dashboard", label: "Billing Analytics Dashboard", path: "/service-management/billing-analytics" },
    ],
  },
};

/**
 * Utility function to extract a flat list of all normal features across all modules.
 * Used for flattening the registry to assign permissions or list available features.
 * 
 * @returns {Array} A flat array of feature objects, each tagged with its parent module_key
 */
export function getAllFeatures() {
  const features = []; // Array to collect all flattened features
  
  // Iterate over each module in the registry
  Object.entries(FEATURES_REGISTRY).forEach(([moduleKey, moduleData]) => {
    // Check if the module has a features array, defaulting to empty array if missing
    (moduleData.features || []).forEach(feature => {
      // Map and push the feature data, injecting the parent module_key
      features.push({
        module_key: moduleKey,
        feature_key: feature.feature_key,
        type: feature.type,
        label: feature.label,
        path: feature.path,
      });
    });
  });
  
  return features;
}

/**
 * Utility function to extract a flat list of all dashboard features across all modules.
 * Used similarly to getAllFeatures but strictly for dashboard-type elements.
 * 
 * @returns {Array} A flat array of dashboard objects, each tagged with its parent module_key
 */
export function getAllDashboardFeatures() {
  const dashboards = []; // Array to collect all flattened dashboards
  
  // Iterate over each module in the registry
  Object.entries(FEATURES_REGISTRY).forEach(([moduleKey, moduleData]) => {
    // Check if the module has a dashboards array, defaulting to empty array if missing
    (moduleData.dashboards || []).forEach(d => {
      // Map and push the dashboard data, injecting the parent module_key
      dashboards.push({
        module_key: moduleKey,
        feature_key: d.feature_key,
        type: d.type,
        label: d.label,
        path: d.path,
      });
    });
  });
  
  return dashboards;
}
