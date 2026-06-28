/**
 * Module Features Registry
 * Centralized definition of all modules, their features, and dashboards
 * Used by Role Management UI and permission system
 * 
 * IMPORTANT: Keep this in sync with the module home page sections and
 * server/data/featuresRegistry.js
 */

export const MODULES_REGISTRY = {
  administration: {
    name: "Administration",
    icon: "⚙️",
    features: [
      { key: "users", label: "User Management", type: "feature" },
      { key: "user-permissions", label: "User Permissions", type: "feature" },
      { key: "user-overrides", label: "Exceptional Permissions", type: "feature" },
      { key: "roles", label: "Role Setup", type: "feature" },
      { key: "companies", label: "Company Setup", type: "feature" },
      { key: "branches", label: "Branch Setup", type: "feature" },
      { key: "workflows", label: "Workflows", type: "feature" },
      { key: "templates", label: "Document Templates", type: "feature" },
      { key: "reports", label: "System Reports", type: "feature" },
      { key: "settings", label: "System Settings", type: "feature" },
    ],
    dashboards: [
      { key: "system-overview", label: "System Overview Dashboard", type: "dashboard" },
      { key: "user-activity", label: "User Activity Dashboard", type: "dashboard" },
    ]
  },

  sales: {
    name: "Sales",
    icon: "💰",
    features: [
      { key: "quotations", label: "Quotations", type: "feature" },
      { key: "sales-orders", label: "Sales Orders", type: "feature" },
      { key: "invoices", label: "Invoices", type: "feature" },
      { key: "delivery", label: "Delivery Management", type: "feature" },
      { key: "customers", label: "Customer Management", type: "feature" },
      { key: "reports", label: "Sales Reports", type: "feature" },
      { key: "returns", label: "Sales Returns", type: "feature" },
      { key: "price-setup", label: "Price Setup", type: "feature" },
      { key: "discount-schemes", label: "Discount Schemes", type: "feature" },
      { key: "customer-credit", label: "Customer Credit", type: "feature" },
      { key: "bulk-upload", label: "Bulk Customer Upload", type: "feature" },
      { key: "prospect-customers", label: "Prospective Customers", type: "feature" },
      { key: "prospect-conversion", label: "Prospect Conversion", type: "feature" },
    ],
    dashboards: [
      { key: "sales-overview", label: "Sales Overview Dashboard", type: "dashboard" },
      { key: "revenue-analytics", label: "Revenue Analytics Dashboard", type: "dashboard" },
      { key: "customer-analytics", label: "Customer Analytics Dashboard", type: "dashboard" },
    ]
  },

  purchase: {
    name: "Purchase",
    icon: "🛒",
    features: [
      { key: "direct-purchase", label: "Direct Purchase", type: "feature" },
      { key: "general-requisitions", label: "General Requisition", type: "feature" },
      { key: "rfqs", label: "Request for Quotation", type: "feature" },
      { key: "supplier-quotations", label: "Supplier Quotations", type: "feature" },
      { key: "quotation-analysis", label: "Quotation Analysis", type: "feature" },
      { key: "purchase-orders-local", label: "Local Purchase Orders", type: "feature" },
      { key: "purchase-orders-import", label: "Import Purchase Orders", type: "feature" },
      { key: "shipping-advice", label: "Shipping Advice", type: "feature" },
      { key: "port-clearances", label: "Port Clearances", type: "feature" },
      { key: "purchase-bills-local", label: "Local Purchase Bills", type: "feature" },
      { key: "purchase-bills-import", label: "Import Purchase Bills", type: "feature" },
      { key: "suppliers", label: "Suppliers", type: "feature" },
      { key: "purchase-returns", label: "Purchase Returns", type: "feature" },
      { key: "reports", label: "Reports", type: "feature" },
      { key: "setup", label: "Purchase Setup", type: "feature" },
    ],
    dashboards: [
      { key: "procurement-overview", label: "Procurement Overview Dashboard", type: "dashboard" },
      { key: "supplier-analytics", label: "Supplier Analytics Dashboard", type: "dashboard" },
    ]
  },

  inventory: {
    name: "Inventory",
    icon: "📦",
    features: [
      { key: "material-requisitions", label: "Material Requisitions", type: "feature" },
      { key: "stock-upload", label: "Stock Upload", type: "feature" },
      { key: "stock-updation", label: "Stock Updation", type: "feature" },
      { key: "stock-adjustments", label: "Stock Adjustment", type: "feature" },
      { key: "stock-transfers", label: "Stock Transfer", type: "feature" },
      { key: "stock-verification", label: "Stock Verification", type: "feature" },
      { key: "return-to-stores", label: "Return to Stores Advice", type: "feature" },
      { key: "issue-to-requirement", label: "Issue to Requirement Area", type: "feature" },
      { key: "transfer-acceptance", label: "Transfer Acceptance", type: "feature" },
      { key: "grn-local", label: "Material Receipt (GRN) - Local", type: "feature" },
      { key: "grn-import", label: "Material Receipt (GRN) - Import", type: "feature" },
      { key: "items", label: "Item Management", type: "feature" },
      { key: "item-groups", label: "Item Categories", type: "feature" },
      { key: "unit-conversions", label: "Unit Conversion", type: "feature" },
      { key: "warehouses", label: "Warehouse Management", type: "feature" },
      { key: "batches", label: "Item Batches Tracking", type: "feature" },
      { key: "stock-taking", label: "Stock Taking", type: "feature" },
      { key: "stock-reorder", label: "Stock Reorder", type: "feature" },
      { key: "reports", label: "Inventory Reports", type: "feature" },
    ],
    dashboards: [
      { key: "inventory-overview", label: "Inventory Overview Dashboard", type: "dashboard" },
      { key: "stock-analytics", label: "Stock Analytics Dashboard", type: "dashboard" },
    ]
  },

  finance: {
    name: "Finance",
    icon: "🏦",
    features: [
      { key: "journal-voucher", label: "Journal Entry", type: "feature" },
      { key: "payment-voucher", label: "Make Payment", type: "feature" },
      { key: "receipt-voucher", label: "Receive Payment", type: "feature" },
      { key: "contra-voucher", label: "Contra Entry", type: "feature" },
      { key: "credit-note", label: "Credit Note", type: "feature" },
      { key: "debit-note", label: "Debit Note", type: "feature" },
      { key: "sales-voucher", label: "Sales Voucher", type: "feature" },
      { key: "purchase-voucher", label: "Purchase Voucher", type: "feature" },
      { key: "chart-of-accounts", label: "Chart of Accounts", type: "feature" },
      { key: "account-groups", label: "Account Groups", type: "feature" },
      { key: "cost-centers", label: "Cost Centers", type: "feature" },
      { key: "tax-codes", label: "Tax Codes & Deductions", type: "feature" },
      { key: "currencies", label: "Currencies", type: "feature" },
      { key: "fiscal-years", label: "Fiscal Years", type: "feature" },
      { key: "budget", label: "Budget Management", type: "feature" },
      { key: "bank-reconciliation", label: "Bank Reconciliation", type: "feature" },
      { key: "fixed-assets", label: "Fixed Assets", type: "feature" },
      { key: "opening-balances", label: "Opening Balances", type: "feature" },
      { key: "pdc-postings", label: "Post-Dated Cheques", type: "feature" },
      { key: "reports", label: "Finance Reports", type: "feature" },
    ],
    dashboards: [
      { key: "financial-overview", label: "Financial Overview Dashboard", type: "dashboard" },
      { key: "cash-flow", label: "Cash Flow Dashboard", type: "dashboard" },
      { key: "budget-analysis", label: "Budget Analysis Dashboard", type: "dashboard" },
    ]
  },

  "human-resources": {
    name: "Human Resources",
    icon: "👥",
    features: [
      { key: "employees", label: "Employee Setup", type: "feature" },
      { key: "departments", label: "Departments", type: "feature" },
      { key: "designations", label: "Designations", type: "feature" },
      { key: "requisitions", label: "Job Requisitions", type: "feature" },
      { key: "candidates", label: "Candidates", type: "feature" },
      { key: "interviews", label: "Interviews", type: "feature" },
      { key: "offers", label: "Offers", type: "feature" },
      { key: "attendance", label: "Attendance Management", type: "feature" },
      { key: "work-schedules", label: "Work Schedule Management", type: "feature" },
      { key: "roster", label: "Roster Management", type: "feature" },
      { key: "leave-setup", label: "Leave Setup", type: "feature" },
      { key: "leave-management", label: "Leave Management", type: "feature" },
      { key: "payroll", label: "Payroll Processing", type: "feature" },
      { key: "payslips", label: "Payslips", type: "feature" },
      { key: "salary-config", label: "Salary Configurations", type: "feature" },
      { key: "tax-config", label: "Statutory Contributions", type: "feature" },
      { key: "allowances", label: "Allowances", type: "feature" },
      { key: "loans", label: "Employee Loans", type: "feature" },
      { key: "promotions", label: "Promotions", type: "feature" },
      { key: "medical-policies", label: "Medical Policies", type: "feature" },
      { key: "policies", label: "Policies", type: "feature" },
      { key: "setup", label: "HR Setup", type: "feature" },
      { key: "hr-reports", label: "HR Reports", type: "feature" },
    ],
    dashboards: [
      { key: "hr-overview", label: "HR Overview Dashboard", type: "dashboard" },
      { key: "attendance-dashboard", label: "Attendance Dashboard", type: "dashboard" },
      { key: "payroll-dashboard", label: "Payroll Dashboard", type: "dashboard" },
    ]
  },

  maintenance: {
    name: "Maintenance",
    icon: "🔧",
    features: [
      { key: "assets", label: "Asset Management", type: "feature" },
      { key: "equipment", label: "Equipment", type: "feature" },
      { key: "contracts", label: "Maintenance Contracts", type: "feature" },
      { key: "maintenance-requests", label: "Maintenance Requests", type: "feature" },
      { key: "work-orders", label: "Work Orders", type: "feature" },
      { key: "job-orders", label: "Job Orders", type: "feature" },
      { key: "pm-schedules", label: "PM Schedules", type: "feature" },
      { key: "schedules", label: "Maintenance Schedules", type: "feature" },
      { key: "rosters", label: "Maintenance Rosters", type: "feature" },
      { key: "maintenance-reports", label: "Maintenance Reports", type: "feature" },
      { key: "setup", label: "Maintenance Setup", type: "feature" },
    ],
    dashboards: [
      { key: "maintenance-overview", label: "Maintenance Overview Dashboard", type: "dashboard" },
      { key: "asset-analytics", label: "Asset Analytics Dashboard", type: "dashboard" },
    ]
  },

  production: {
    name: "Production",
    icon: "🏭",
    features: [
      { key: "boms", label: "Bills of Materials", type: "feature" },
      { key: "routings", label: "Routing & Operations", type: "feature" },
      { key: "work-orders", label: "Work Orders", type: "feature" },
      { key: "production-planning", label: "Production Planning", type: "feature" },
      { key: "job-cards", label: "Job Cards", type: "feature" },
      { key: "production-reports", label: "Production Reports", type: "feature" },
      { key: "setup", label: "Manufacturing Setup", type: "feature" },
    ],
    dashboards: [
      { key: "production-overview", label: "Production Overview Dashboard", type: "dashboard" },
      { key: "efficiency-analytics", label: "Efficiency Analytics Dashboard", type: "dashboard" },
    ]
  },

  "project-management": {
    name: "Project Management",
    icon: "📊",
    features: [
      { key: "projects", label: "Projects", type: "feature" },
      { key: "tasks", label: "Task Management", type: "feature" },
      { key: "setup", label: "Setup", type: "feature" },
      { key: "material-requisitions", label: "Material Requisition", type: "feature" },
      { key: "material-utilizations", label: "Material Utilization", type: "feature" },
      { key: "material-receipts", label: "Materials Receipt", type: "feature" },
      { key: "project-orders", label: "Project Orders", type: "feature" },
      { key: "purchase-requisitions", label: "Purchase Requisition", type: "feature" },
      { key: "milestones", label: "Milestones", type: "feature" },
      { key: "resources", label: "Resource Management", type: "feature" },
      { key: "timesheets", label: "Timesheets", type: "feature" },
      { key: "expenses", label: "Project Expenses", type: "feature" },
      { key: "project-reports", label: "Project Reports", type: "feature" },
      { key: "project-status-report", label: "Project Status Report", type: "feature" },
      { key: "project-income-report", label: "Project Income Report", type: "feature" },
      { key: "project-expense-report", label: "Project Expense Report", type: "feature" },
    ],
    dashboards: [
      { key: "project-overview", label: "Project Overview Dashboard", type: "dashboard" },
      { key: "resource-utilization", label: "Resource Utilization Dashboard", type: "dashboard" },
    ]
  },

  pos: {
    name: "Point of Sale",
    icon: "🛒",
    features: [
      { key: "sales-entry", label: "Sales Entry", type: "feature" },
      { key: "day-management", label: "Start/End Business Day", type: "feature" },
      { key: "cash-collection", label: "Cash Collection", type: "feature" },
      { key: "invoices", label: "POS Invoices", type: "feature" },
      { key: "post-to-finance", label: "Post to Finance", type: "feature" },
      { key: "returns", label: "POS Returns", type: "feature" },
      { key: "register", label: "POS Register", type: "feature" },
      { key: "reports", label: "POS Reports", type: "feature" },
      { key: "dashboard", label: "POS Dashboard", type: "feature" },
      { key: "customer-history", label: "Customer Accounts", type: "feature" },
      { key: "on-hold", label: "On-Hold Sales", type: "feature", path: "/pos/holds" },
      { key: "reconciliation", label: "Sync Reconciliation", type: "feature" },
      { key: "setup", label: "POS Setup", type: "feature" },
    ],
    dashboards: [
      { key: "dashboard", label: "POS Dashboard", type: "dashboard" },
    ]
  },

  "business-intelligence": {
    name: "Business Intelligence",
    icon: "📈",
    features: [
      { key: "dashboards", label: "Dashboard Management", type: "feature" },
      { key: "reports", label: "Custom Reports", type: "feature" },
      { key: "data-sources", label: "Data Sources", type: "feature" },
      { key: "analytics", label: "Analytics", type: "feature" },
      { key: "bi-reports", label: "BI Reports", type: "feature" },
    ],
    dashboards: [
      { key: "bi-overview", label: "BI Overview Dashboard", type: "dashboard" },
      { key: "executive-dashboard", label: "Executive Dashboard", type: "dashboard" },
    ]
  },

  "executive-overview": {
    name: "Executive Overview",
    icon: "🎯",
    features: [
      { key: "dashboard", label: "Executive Dashboard", type: "feature" },
      { key: "kpi-reports", label: "KPI Reports", type: "feature" },
    ],
    dashboards: [
      { key: "executive-dashboard", label: "Executive Dashboard", type: "dashboard" },
    ]
  },

  "service-management": {
    name: "Service Management",
    icon: "🔧",
    features: [
      { key: "customer-service-requests", label: "Customer Service Requests", type: "feature" },
      { key: "supplier-service-requests", label: "Supplier Service Requests", type: "feature" },
      { key: "service-requests", label: "Service Requests", type: "feature" },
      { key: "service-orders", label: "Service Orders", type: "feature" },
      { key: "service-executions", label: "Service Execution", type: "feature" },
      { key: "service-confirmations", label: "Service Confirmations", type: "feature" },
      { key: "service-bills", label: "Service Bills", type: "feature" },
      { key: "billing", label: "Service Billing", type: "feature" },
      { key: "service-reports", label: "Service Reports", type: "feature" },
      { key: "visitors-log", label: "Visitors Log Book", type: "feature" },
      { key: "setup", label: "Service Setup", type: "feature" },
    ],
    dashboards: [
      { key: "service-overview", label: "Service Overview Dashboard", type: "dashboard" },
      { key: "billing-analytics", label: "Billing Analytics Dashboard", type: "dashboard" },
    ]
  }
};

export function getAllModuleKeys() {
  return Object.keys(MODULES_REGISTRY);
}

export function getModuleInfo(moduleKey) {
  return MODULES_REGISTRY[moduleKey] || null;
}

export function getAllFeatures() {
  const features = [];
  Object.entries(MODULES_REGISTRY).forEach(([moduleKey, moduleInfo]) => {
    moduleInfo.features.forEach(feature => {
      features.push({
        module_key: moduleKey,
        feature_key: `${moduleKey}:${feature.key}`,
        label: feature.label,
        type: feature.type,
        path: `/${moduleKey}/${feature.key}`,
      });
    });
  });
  return features;
}

export function getAllDashboards() {
  const dashboards = [];
  Object.entries(MODULES_REGISTRY).forEach(([moduleKey, moduleInfo]) => {
    moduleInfo.dashboards.forEach(dashboard => {
      dashboards.push({
        module_key: moduleKey,
        feature_key: `${moduleKey}:${dashboard.key}`,
        label: dashboard.label,
        type: dashboard.type,
        path: `/${moduleKey}/${dashboard.key}`,
      });
    });
  });
  return dashboards;
}

export function getModuleFeatures(moduleKey) {
  const moduleInfo = MODULES_REGISTRY[moduleKey];
  if (!moduleInfo) return [];
  return moduleInfo.features.map(feature => ({
    module_key: moduleKey,
    feature_key: `${moduleKey}:${feature.key}`,
    label: feature.label,
    type: feature.type,
    path: `/${moduleKey}/${feature.key}`,
  }));
}

export function getModuleDashboards(moduleKey) {
  const moduleInfo = MODULES_REGISTRY[moduleKey];
  if (!moduleInfo) return [];
  return moduleInfo.dashboards.map(dashboard => ({
    module_key: moduleKey,
    feature_key: `${moduleKey}:${dashboard.key}`,
    label: dashboard.label,
    type: dashboard.type,
    path: `/${moduleKey}/${dashboard.key}`,
  }));
}
