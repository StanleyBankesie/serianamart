/**
 * Complete Features Registry for Backend
 * Contains all modules, features, and dashboards for RBAC system
 */

export const FEATURES_REGISTRY = {
  // Administration Module
  administration: [
    { feature_key: "administration:users", type: "feature", label: "User Management", path: "/administration/users" },
    { feature_key: "administration:roles", type: "feature", label: "Role Setup", path: "/administration/roles" },
    { feature_key: "administration:companies", type: "feature", label: "Company Setup", path: "/administration/companies" },
    { feature_key: "administration:branches", type: "feature", label: "Branch Setup", path: "/administration/branches" },
    { feature_key: "administration:workflows", type: "feature", label: "Workflows", path: "/administration/workflows" },
    { feature_key: "administration:templates", type: "feature", label: "Document Templates", path: "/administration/templates" },
    { feature_key: "administration:reports", type: "feature", label: "System Reports", path: "/administration/reports" },
    { feature_key: "administration:settings", type: "feature", label: "System Settings", path: "/administration/settings" },
    
    // Administration Dashboards
    { feature_key: "administration:system-overview", type: "dashboard", label: "System Overview Dashboard", path: "/administration/system-overview" },
    { feature_key: "administration:user-activity", type: "dashboard", label: "User Activity Dashboard", path: "/administration/user-activity" },
  ],

  // Sales Module
  sales: [
    { feature_key: "sales:quotations", type: "feature", label: "Quotations", path: "/sales/quotations" },
    { feature_key: "sales:sales-orders", type: "feature", label: "Sales Orders", path: "/sales/sales-orders" },
    { feature_key: "sales:invoices", type: "feature", label: "Invoices", path: "/sales/invoices" },
    { feature_key: "sales:delivery", type: "feature", label: "Delivery Management", path: "/sales/delivery" },
    { feature_key: "sales:customers", type: "feature", label: "Customer Management", path: "/sales/customers" },
    { feature_key: "sales:returns", type: "feature", label: "Sales Returns", path: "/sales/returns" },
    { feature_key: "sales:price-setup", type: "feature", label: "Price Setup", path: "/sales/price-setup" },
    { feature_key: "sales:discount-schemes", type: "feature", label: "Discount Schemes", path: "/sales/discount-schemes" },
    { feature_key: "sales:customer-credit", type: "feature", label: "Customer Credit", path: "/sales/customer-credit" },
    { feature_key: "sales:bulk-upload", type: "feature", label: "Bulk Customer Upload", path: "/sales/bulk-upload" },
    { feature_key: "sales:reports", type: "feature", label: "Sales Reports", path: "/sales/reports" },
    
    // Sales Dashboards
    { feature_key: "sales:sales-overview", type: "dashboard", label: "Sales Overview Dashboard", path: "/sales/sales-overview" },
    { feature_key: "sales:revenue-analytics", type: "dashboard", label: "Revenue Analytics Dashboard", path: "/sales/revenue-analytics" },
    { feature_key: "sales:customer-analytics", type: "dashboard", label: "Customer Analytics Dashboard", path: "/sales/customer-analytics" },
  ],

  // Purchase Module
  purchase: [
    { feature_key: "purchase:rfq", type: "feature", label: "Request for Quotation", path: "/purchase/rfq" },
    { feature_key: "purchase:purchase-orders", type: "feature", label: "Purchase Orders", path: "/purchase/purchase-orders" },
    { feature_key: "purchase:goods-receipt", type: "feature", label: "Goods Receipt Note", path: "/purchase/goods-receipt" },
    { feature_key: "purchase:purchase-invoices", type: "feature", label: "Purchase Invoices", path: "/purchase/purchase-invoices" },
    { feature_key: "purchase:suppliers", type: "feature", label: "Supplier Management", path: "/purchase/suppliers" },
    { feature_key: "purchase:service-procurement", type: "feature", label: "Service Procurement", path: "/purchase/service-procurement" },
    { feature_key: "purchase:import-procurement", type: "feature", label: "Import Procurement", path: "/purchase/import-procurement" },
    
    // Purchase Dashboards
    { feature_key: "purchase:procurement-overview", type: "dashboard", label: "Procurement Overview Dashboard", path: "/purchase/procurement-overview" },
    { feature_key: "purchase:supplier-analytics", type: "dashboard", label: "Supplier Analytics Dashboard", path: "/purchase/supplier-analytics" },
  ],

  // Inventory Module
  inventory: [
    { feature_key: "inventory:material-requisitions", type: "feature", label: "Material Requisitions", path: "/inventory/material-requisitions" },
    { feature_key: "inventory:stock-upload", type: "feature", label: "Stock Upload", path: "/inventory/stock-upload" },
    { feature_key: "inventory:stock-updation", type: "feature", label: "Stock Updation", path: "/inventory/stock-updation" },
    { feature_key: "inventory:stock-adjustment", type: "feature", label: "Stock Adjustment", path: "/inventory/stock-adjustment" },
    { feature_key: "inventory:stock-transfer", type: "feature", label: "Stock Transfer", path: "/inventory/stock-transfer" },
    { feature_key: "inventory:items", type: "feature", label: "Item Management", path: "/inventory/items" },
    { feature_key: "inventory:categories", type: "feature", label: "Item Categories", path: "/inventory/categories" },
    { feature_key: "inventory:warehouses", type: "feature", label: "Warehouse Management", path: "/inventory/warehouses" },
    { feature_key: "inventory:stock-taking", type: "feature", label: "Stock Taking", path: "/inventory/stock-taking" },
    { feature_key: "inventory:reports", type: "feature", label: "Inventory Reports", path: "/inventory/reports" },
    
    // Inventory Dashboards
    { feature_key: "inventory:inventory-overview", type: "dashboard", label: "Inventory Overview Dashboard", path: "/inventory/inventory-overview" },
    { feature_key: "inventory:stock-analytics", type: "dashboard", label: "Stock Analytics Dashboard", path: "/inventory/stock-analytics" },
  ],

  // Finance Module
  finance: [
    { feature_key: "finance:journal-voucher", type: "feature", label: "Journal Entry", path: "/finance/journal-voucher" },
    { feature_key: "finance:payment-voucher", type: "feature", label: "Make Payment", path: "/finance/payment-voucher" },
    { feature_key: "finance:receipt-voucher", type: "feature", label: "Receive Payment", path: "/finance/receipt-voucher" },
    { feature_key: "finance:contra-voucher", type: "feature", label: "Contra Entry", path: "/finance/contra-voucher" },
    { feature_key: "finance:chart-of-accounts", type: "feature", label: "Chart of Accounts", path: "/finance/chart-of-accounts" },
    { feature_key: "finance:account-groups", type: "feature", label: "Account Groups", path: "/finance/account-groups" },
    { feature_key: "finance:fiscal-years", type: "feature", label: "Fiscal Years", path: "/finance/fiscal-years" },
    { feature_key: "finance:budget", type: "feature", label: "Budget Management", path: "/finance/budget" },
    { feature_key: "finance:bank-reconciliation", type: "feature", label: "Bank Reconciliation", path: "/finance/bank-reconciliation" },
    { feature_key: "finance:fixed-assets", type: "feature", label: "Fixed Assets", path: "/finance/fixed-assets" },
    
    // Finance Dashboards
    { feature_key: "finance:financial-overview", type: "dashboard", label: "Financial Overview Dashboard", path: "/finance/financial-overview" },
    { feature_key: "finance:cash-flow", type: "dashboard", label: "Cash Flow Dashboard", path: "/finance/cash-flow" },
    { feature_key: "finance:budget-analysis", type: "dashboard", label: "Budget Analysis Dashboard", path: "/finance/budget-analysis" },
  ],

  // Human Resources Module
  "human-resources": [
    { feature_key: "human-resources:employees", type: "feature", label: "Employee Setup", path: "/human-resources/employees" },
    { feature_key: "human-resources:departments", type: "feature", label: "Departments", path: "/human-resources/departments" },
    { feature_key: "human-resources:designations", type: "feature", label: "Designations", path: "/human-resources/designations" },
    { feature_key: "human-resources:attendance", type: "feature", label: "Attendance Management", path: "/human-resources/attendance" },
    { feature_key: "human-resources:leave-setup", type: "feature", label: "Leave Setup", path: "/human-resources/leave-setup" },
    { feature_key: "human-resources:leave-management", type: "feature", label: "Leave Management", path: "/human-resources/leave-management" },
    { feature_key: "human-resources:payroll", type: "feature", label: "Payroll Processing", path: "/human-resources/payroll" },
    { feature_key: "human-resources:promotions", type: "feature", label: "Promotions", path: "/human-resources/promotions" },
    { feature_key: "human-resources:medical-policies", type: "feature", label: "Medical Policies", path: "/human-resources/medical-policies" },
    { feature_key: "human-resources:hr-reports", type: "feature", label: "HR Reports", path: "/human-resources/hr-reports" },
    
    // HR Dashboards
    { feature_key: "human-resources:hr-overview", type: "dashboard", label: "HR Overview Dashboard", path: "/human-resources/hr-overview" },
    { feature_key: "human-resources:attendance-dashboard", type: "dashboard", label: "Attendance Dashboard", path: "/human-resources/attendance-dashboard" },
    { feature_key: "human-resources:payroll-dashboard", type: "dashboard", label: "Payroll Dashboard", path: "/human-resources/payroll-dashboard" },
  ],

  // Maintenance Module
  maintenance: [
    { feature_key: "maintenance:assets", type: "feature", label: "Asset Management", path: "/maintenance/assets" },
    { feature_key: "maintenance:work-orders", type: "feature", label: "Work Orders", path: "/maintenance/work-orders" },
    { feature_key: "maintenance:pm-schedules", type: "feature", label: "PM Schedules", path: "/maintenance/pm-schedules" },
    { feature_key: "maintenance:maintenance-reports", type: "feature", label: "Maintenance Reports", path: "/maintenance/maintenance-reports" },
    
    // Maintenance Dashboards
    { feature_key: "maintenance:maintenance-overview", type: "dashboard", label: "Maintenance Overview Dashboard", path: "/maintenance/maintenance-overview" },
    { feature_key: "maintenance:asset-analytics", type: "dashboard", label: "Asset Analytics Dashboard", path: "/maintenance/asset-analytics" },
  ],

  // Production Module
  production: [
    { feature_key: "production:bom", type: "feature", label: "Bills of Materials", path: "/production/bom" },
    { feature_key: "production:work-orders", type: "feature", label: "Work Orders", path: "/production/work-orders" },
    { feature_key: "production:production-planning", type: "feature", label: "Production Planning", path: "/production/production-planning" },
    { feature_key: "production:job-cards", type: "feature", label: "Job Cards", path: "/production/job-cards" },
    { feature_key: "production:production-reports", type: "feature", label: "Production Reports", path: "/production/production-reports" },
    
    // Production Dashboards
    { feature_key: "production:production-overview", type: "dashboard", label: "Production Overview Dashboard", path: "/production/production-overview" },
    { feature_key: "production:efficiency-analytics", type: "dashboard", label: "Efficiency Analytics Dashboard", path: "/production/efficiency-analytics" },
  ],

  // Project Management Module
  "project-management": [
    { feature_key: "project-management:projects", type: "feature", label: "Projects", path: "/project-management/projects" },
    { feature_key: "project-management:tasks", type: "feature", label: "Task Management", path: "/project-management/tasks" },
    { feature_key: "project-management:milestones", type: "feature", label: "Milestones", path: "/project-management/milestones" },
    { feature_key: "project-management:resources", type: "feature", label: "Resource Management", path: "/project-management/resources" },
    { feature_key: "project-management:project-reports", type: "feature", label: "Project Reports", path: "/project-management/project-reports" },
    
    // Project Management Dashboards
    { feature_key: "project-management:project-overview", type: "dashboard", label: "Project Overview Dashboard", path: "/project-management/project-overview" },
    { feature_key: "project-management:resource-utilization", type: "dashboard", label: "Resource Utilization Dashboard", path: "/project-management/resource-utilization" },
  ],

  // POS Module
  pos: [
    { feature_key: "pos:sales-entry", type: "feature", label: "Sales Entry", path: "/pos/sales-entry" },
    { feature_key: "pos:day-management", type: "feature", label: "Start/End Business Day", path: "/pos/day-management" },
    { feature_key: "pos:cash-collection", type: "feature", label: "Cash Collection", path: "/pos/cash-collection" },
    { feature_key: "pos:invoices", type: "feature", label: "POS Invoices", path: "/pos/invoices" },
    { feature_key: "pos:post-to-finance", type: "feature", label: "Post to Finance", path: "/pos/post-to-finance" },
    { feature_key: "pos:returns", type: "feature", label: "POS Returns", path: "/pos/returns" },
    { feature_key: "pos:register", type: "feature", label: "POS Register", path: "/pos/register" },
    { feature_key: "pos:setup", type: "feature", label: "POS Setup", path: "/pos/setup" },
    
    // POS Dashboards
    { feature_key: "pos:pos-overview", type: "dashboard", label: "POS Overview Dashboard", path: "/pos/pos-overview" },
    { feature_key: "pos:sales-analytics", type: "dashboard", label: "Sales Analytics Dashboard", path: "/pos/sales-analytics" },
  ],

  // Business Intelligence Module
  "business-intelligence": [
    { feature_key: "business-intelligence:dashboards", type: "feature", label: "Dashboard Management", path: "/business-intelligence/dashboards" },
    { feature_key: "business-intelligence:reports", type: "feature", label: "Custom Reports", path: "/business-intelligence/reports" },
    { feature_key: "business-intelligence:data-sources", type: "feature", label: "Data Sources", path: "/business-intelligence/data-sources" },
    { feature_key: "business-intelligence:analytics", type: "feature", label: "Analytics", path: "/business-intelligence/analytics" },
    
    // BI Dashboards
    { feature_key: "business-intelligence:bi-overview", type: "dashboard", label: "BI Overview Dashboard", path: "/business-intelligence/bi-overview" },
    { feature_key: "business-intelligence:executive-dashboard", type: "dashboard", label: "Executive Dashboard", path: "/business-intelligence/executive-dashboard" },
  ],

  // Service Management Module
  "service-management": [
    { feature_key: "service-management:service-requests", type: "feature", label: "Service Requests", path: "/service-management/service-requests" },
    { feature_key: "service-management:service-confirmations", type: "feature", label: "Service Confirmations", path: "/service-management/service-confirmations" },
    { feature_key: "service-management:billing", type: "feature", label: "Service Billing", path: "/service-management/billing" },
    { feature_key: "service-management:service-reports", type: "feature", label: "Service Reports", path: "/service-management/service-reports" },
    
    // Service Management Dashboards
    { feature_key: "service-management:service-overview", type: "dashboard", label: "Service Overview Dashboard", path: "/service-management/service-overview" },
    { feature_key: "service-management:billing-analytics", type: "dashboard", label: "Billing Analytics Dashboard", path: "/service-management/billing-analytics" },
  ],
};

// Helper function to get all features as flat array
export function getAllFeatures() {
  const features = [];
  Object.entries(FEATURES_REGISTRY).forEach(([moduleKey, moduleFeatures]) => {
    moduleFeatures.forEach(feature => {
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
