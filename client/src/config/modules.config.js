/**
 * Centralized Module-Feature Configuration Registry
 * 
 * This file defines the complete hierarchical structure of all modules,
 * features, and dashboards in the system. It serves as the single
 * source of truth for RBAC configuration.
 * 
 * Structure:
 * - Each module contains features and dashboards
 * - Features are business functions (pages, forms, reports)
 * - Dashboards are analytical views
 * - All permissions are derived from this configuration
 */

export const MODULES_CONFIG = [
  {
    key: "purchase",
    name: "Purchase",
    icon: "🛒",
    path: "/purchase",
    features: [
      {
        key: "purchase-order",
        name: "Purchase Order",
        description: "Create and manage purchase orders",
        path: "/purchase/purchase-orders"
      },
      {
        key: "grn",
        name: "GRN",
        description: "Goods Receipt Note management",
        path: "/purchase/grn"
      },
      {
        key: "purchase-bill",
        name: "Purchase Bill",
        description: "Purchase invoice processing",
        path: "/purchase/purchase-bills"
      },
      {
        key: "direct-purchase",
        name: "Direct Purchase",
        description: "Quick purchase processing",
        path: "/purchase/direct-purchase"
      },
      {
        key: "purchase-return",
        name: "Purchase Return",
        description: "Return purchase items",
        path: "/purchase/purchase-returns"
      },
      {
        key: "rfq",
        name: "RFQ",
        description: "Request for Quotation",
        path: "/purchase/rfq"
      }
    ],
    dashboards: [
      {
        key: "purchase-dashboard",
        name: "Purchase Dashboard",
        description: "Purchase analytics and insights",
        path: "/purchase/dashboard"
      }
    ]
  },
  {
    key: "sales",
    name: "Sales",
    icon: "💰",
    path: "/sales",
    features: [
      {
        key: "sales-order",
        name: "Sales Order",
        description: "Create and manage sales orders",
        path: "/sales/sales-orders"
      },
      {
        key: "sales-invoice",
        name: "Sales Invoice",
        description: "Generate sales invoices",
        path: "/sales/sales-invoices"
      },
      {
        key: "sales-return",
        name: "Sales Return",
        description: "Process sales returns",
        path: "/sales/sales-returns"
      },
      {
        key: "quotation",
        name: "Quotation",
        description: "Create customer quotations",
        path: "/sales/quotations"
      },
      {
        key: "customer-payment",
        name: "Customer Payment",
        description: "Process customer payments",
        path: "/sales/customer-payments"
      }
    ],
    dashboards: [
      {
        key: "sales-dashboard",
        name: "Sales Dashboard",
        description: "Sales performance analytics",
        path: "/sales/dashboard"
      }
    ]
  },
  {
    key: "inventory",
    name: "Inventory",
    icon: "📦",
    path: "/inventory",
    features: [
      {
        key: "stock-management",
        name: "Stock Management",
        description: "Manage stock levels",
        path: "/inventory/stock"
      },
      {
        key: "stock-transfer",
        name: "Stock Transfer",
        description: "Transfer stock between locations",
        path: "/inventory/stock-transfer"
      },
      {
        key: "stock-adjustment",
        name: "Stock Adjustment",
        description: "Adjust stock quantities",
        path: "/inventory/stock-adjustment"
      },
      {
        key: "item-master",
        name: "Item Master",
        description: "Product/item management",
        path: "/inventory/items"
      }
    ],
    dashboards: [
      {
        key: "inventory-dashboard",
        name: "Inventory Dashboard",
        description: "Stock level analytics",
        path: "/inventory/dashboard"
      }
    ]
  },
  {
    key: "accounts",
    name: "Accounts",
    icon: "📊",
    path: "/accounts",
    features: [
      {
        key: "chart-of-accounts",
        name: "Chart of Accounts",
        description: "Account management",
        path: "/accounts/chart-of-accounts"
      },
      {
        key: "journal-entry",
        name: "Journal Entry",
        description: "Create journal entries",
        path: "/accounts/journal-entries"
      },
      {
        key: "ledger",
        name: "Ledger",
        description: "View account ledgers",
        path: "/accounts/ledger"
      },
      {
        key: "trial-balance",
        name: "Trial Balance",
        description: "Generate trial balance",
        path: "/accounts/trial-balance"
      },
      {
        key: "balance-sheet",
        name: "Balance Sheet",
        description: "View balance sheet",
        path: "/accounts/balance-sheet"
      },
      {
        key: "profit-loss",
        name: "Profit & Loss",
        description: "View P&L statement",
        path: "/accounts/profit-loss"
      }
    ],
    dashboards: [
      {
        key: "accounts-dashboard",
        name: "Accounts Dashboard",
        description: "Financial overview",
        path: "/accounts/dashboard"
      }
    ]
  },
  {
    key: "admin",
    name: "Admin",
    icon: "⚙️",
    path: "/admin",
    features: [
      {
        key: "user-management",
        name: "User Management",
        description: "Manage system users",
        path: "/admin/users"
      },
      {
        key: "role-management",
        name: "Role Management",
        description: "Manage user roles",
        path: "/admin/roles"
      },
      {
        key: "company-settings",
        name: "Company Settings",
        description: "Configure company details",
        path: "/admin/company"
      },
      {
        key: "system-settings",
        name: "System Settings",
        description: "System configuration",
        path: "/admin/settings"
      }
    ],
    dashboards: [
      {
        key: "admin-dashboard",
        name: "Admin Dashboard",
        description: "System administration overview",
        path: "/admin/dashboard"
      }
    ]
  }
];

/**
 * Helper functions for working with the module configuration
 */

export const getModuleByKey = (key) => {
  return MODULES_CONFIG.find(module => module.key === key);
};

export const getFeatureByKey = (moduleKey, featureKey) => {
  const module = getModuleByKey(moduleKey);
  return module?.features.find(feature => feature.key === featureKey);
};

export const getDashboardByKey = (moduleKey, dashboardKey) => {
  const module = getModuleByKey(moduleKey);
  return module?.dashboards.find(dashboard => dashboard.key === dashboardKey);
};

export const getAllModuleKeys = () => {
  return MODULES_CONFIG.map(module => module.key);
};

export const getAllFeatureKeys = () => {
  const features = [];
  MODULES_CONFIG.forEach(module => {
    module.features.forEach(feature => {
      features.push(`${module.key}:${feature.key}`);
    });
  });
  return features;
};

export const getAllDashboardKeys = () => {
  const dashboards = [];
  MODULES_CONFIG.forEach(module => {
    module.dashboards.forEach(dashboard => {
      dashboards.push(`${module.key}:${dashboard.key}`);
    });
  });
  return dashboards;
};

export const getModuleFeatures = (moduleKey) => {
  const module = getModuleByKey(moduleKey);
  return module?.features.map(feature => `${module.key}:${feature.key}`) || [];
};

export const getModuleDashboards = (moduleKey) => {
  const module = getModuleByKey(moduleKey);
  return module?.dashboards.map(dashboard => `${module.key}:${dashboard.key}`) || [];
};

export default MODULES_CONFIG;