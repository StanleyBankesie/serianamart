/**
 * Module Features Registry
 * Centralized definition of all modules, their features, and dashboards
 * Used by Role Management UI and permission system
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
      { key: "reports", label: "Reports", type: "feature" },
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
      { key: "stock-adjustment", label: "Stock Adjustment", type: "feature" },
      { key: "stock-transfer", label: "Stock Transfer", type: "feature" },
      { key: "items", label: "Item Management", type: "feature" },
      { key: "categories", label: "Item Categories", type: "feature" },
      { key: "warehouses", label: "Warehouse Management", type: "feature" },
      { key: "stock-taking", label: "Stock Taking", type: "feature" },
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
      { key: "chart-of-accounts", label: "Chart of Accounts", type: "feature" },
      { key: "account-groups", label: "Account Groups", type: "feature" },
      { key: "fiscal-years", label: "Fiscal Years", type: "feature" },
      { key: "budget", label: "Budget Management", type: "feature" },
      { key: "bank-reconciliation", label: "Bank Reconciliation", type: "feature" },
      { key: "fixed-assets", label: "Fixed Assets", type: "feature" },
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
      { key: "attendance", label: "Attendance Management", type: "feature" },
      { key: "leave-setup", label: "Leave Setup", type: "feature" },
      { key: "leave-management", label: "Leave Management", type: "feature" },
      { key: "payroll", label: "Payroll Processing", type: "feature" },
      { key: "promotions", label: "Promotions", type: "feature" },
      { key: "medical-policies", label: "Medical Policies", type: "feature" },
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
      { key: "work-orders", label: "Work Orders", type: "feature" },
      { key: "pm-schedules", label: "PM Schedules", type: "feature" },
      { key: "maintenance-reports", label: "Maintenance Reports", type: "feature" },
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
      { key: "bom", label: "Bills of Materials", type: "feature" },
      { key: "work-orders", label: "Work Orders", type: "feature" },
      { key: "production-planning", label: "Production Planning", type: "feature" },
      { key: "job-cards", label: "Job Cards", type: "feature" },
      { key: "production-reports", label: "Production Reports", type: "feature" },
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
      { key: "milestones", label: "Milestones", type: "feature" },
      { key: "resources", label: "Resource Management", type: "feature" },
      { key: "project-reports", label: "Project Reports", type: "feature" },
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
      { key: "setup", label: "POS Setup", type: "feature" },
    ],
    dashboards: [
      { key: "pos-overview", label: "POS Overview Dashboard", type: "dashboard" },
      { key: "sales-analytics", label: "Sales Analytics Dashboard", type: "dashboard" },
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
    ],
    dashboards: [
      { key: "bi-overview", label: "BI Overview Dashboard", type: "dashboard" },
      { key: "executive-dashboard", label: "Executive Dashboard", type: "dashboard" },
    ]
  },

  "service-management": {
    name: "Service Management",
    icon: "🔧",
    features: [
      { key: "service-requests", label: "Service Requests", type: "feature" },
      { key: "service-confirmations", label: "Service Confirmations", type: "feature" },
      { key: "billing", label: "Service Billing", type: "feature" },
      { key: "service-reports", label: "Service Reports", type: "feature" },
    ],
    dashboards: [
      { key: "service-overview", label: "Service Overview Dashboard", type: "dashboard" },
      { key: "billing-analytics", label: "Billing Analytics Dashboard", type: "dashboard" },
    ]
  }
};

// Helper functions for permission management
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
