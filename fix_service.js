const fs = require('fs');

const f = 'client/src/pages/modules/service-management/ServiceManagementHome.jsx';
let content = fs.readFileSync(f, 'utf8');

const newSections = `export const serviceManagementSections = [
  {
    title: "Service Requests",
    items: [
      {
        title: "Service Requests",
        desc: "Manage customer service requests.",
        path: "/service-management/customer-service-requests",
        permission: "SERVICE.MANAGE",
        icon: FileText,
        actions: [
          { label: "View", path: "/service-management/customer-service-requests", type: "outline", featureKey: "SERVICE.MANAGE", action: "view" },
          { label: "New", path: "/service-management/customer-service-requests/new", type: "primary", featureKey: "SERVICE.MANAGE", action: "create" }
        ]
      },
      {
        title: "Service Invoices",
        description: "Issue invoices to customers for completed services.",
        path: "/service-management/service-invoices",
        icon: FileText,
        actions: [
          { label: "View", path: "/service-management/service-invoices", type: "outline", featureKey: "SERVICE.MANAGE", action: "view" },
          { label: "New", path: "/service-management/service-invoices/new", type: "primary", featureKey: "SERVICE.MANAGE", action: "create" }
        ]
      },
      {
        title: "Supplier Service Requests",
        desc: "Manage vendor service requests.",
        path: "/service-management/supplier-service-requests",
        permission: "SERVICE.MANAGE",
        icon: FileText,
        actions: [
          { label: "View", path: "/service-management/supplier-service-requests", type: "outline", featureKey: "SERVICE.MANAGE", action: "view" },
          { label: "New", path: "/service-management/supplier-service-requests/new", type: "primary", featureKey: "SERVICE.MANAGE", action: "create" }
        ]
      },
    ],
  },
  {
    title: "Service Orders & Execution",
    items: [
      {
        title: "Service Orders",
        desc: "View and process service orders.",
        path: "/service-management/service-orders",
        permission: "SERVICE.MANAGE",
        icon: FileText,
        actions: [
          { label: "View", path: "/service-management/service-orders", type: "outline", featureKey: "SERVICE.MANAGE", action: "view" },
          { label: "New", path: "/service-management/service-orders/new", type: "primary", featureKey: "SERVICE.MANAGE", action: "create" }
        ]
      },
      {
        title: "Service Executions",
        desc: "Track execution of service orders.",
        path: "/service-management/service-executions",
        permission: "SERVICE.MANAGE",
        icon: FileText,
        actions: [
          { label: "View", path: "/service-management/service-executions", type: "outline", featureKey: "SERVICE.MANAGE", action: "view" }
        ]
      },
      {
        title: "Service Confirmations",
        desc: "Review and approve service confirmations.",
        path: "/service-management/service-confirmations",
        permission: "SERVICE.MANAGE",
        icon: FileText,
        actions: [
          { label: "View", path: "/service-management/service-confirmations", type: "outline", featureKey: "SERVICE.MANAGE", action: "view" }
        ]
      },
      {
        title: "Service Bills",
        desc: "Manage supplier service bills.",
        path: "/service-management/service-bills",
        permission: "SERVICE.MANAGE",
        icon: FileText,
        actions: [
          { label: "View", path: "/service-management/service-bills", type: "outline", featureKey: "SERVICE.MANAGE", action: "view" }
        ]
      },
    ],
  },
  {
    title: "Visitors Log",
    items: [
      {
        title: "Visitors Log",
        description: "Record and manage site visitors",
        path: "/service-management/visitors-log",
        icon: FileText,
        actions: [
          { label: "View", path: "/service-management/visitors-log", type: "outline", featureKey: "SERVICE.MANAGE", action: "view" }
        ]
      }
    ],
  },
  {
    title: "Reports & Parameters",
    items: [
      {
        title: "Service Delivery Report",
        description: "Detailed report of completed service deliveries",
        path: "/service-management/reports/delivery",
        icon: FileText,
        actions: [
          { label: "View Report", path: "/service-management/reports/delivery", type: "primary", featureKey: "SERVICE.MANAGE", action: "view" }
        ]
      },
      {
        title: "SLA Performance Report",
        description: "Track service level agreement compliance",
        path: "/service-management/reports/sla",
        icon: FileText,
        actions: [
          { label: "View Report", path: "/service-management/reports/sla", type: "primary", featureKey: "SERVICE.MANAGE", action: "view" }
        ]
      },
      {
        title: "Technician Utilization",
        description: "Analyze technician workloads and efficiency",
        path: "/service-management/reports/technician-utilization",
        icon: FileText,
        actions: [
          { label: "View Report", path: "/service-management/reports/technician-utilization", type: "primary", featureKey: "SERVICE.MANAGE", action: "view" }
        ]
      },
      {
        title: "Service Cost Analysis",
        description: "Cost breakdown of service operations",
        path: "/service-management/reports/service-cost-analysis",
        icon: FileText,
        actions: [
          { label: "View Report", path: "/service-management/reports/service-cost-analysis", type: "primary", featureKey: "SERVICE.MANAGE", action: "view" }
        ]
      },
      {
        title: "Repeat Requests Analysis",
        description: "Identify recurring service issues",
        path: "/service-management/reports/repeat-requests",
        icon: FileText,
        actions: [
          { label: "View Report", path: "/service-management/reports/repeat-requests", type: "primary", featureKey: "SERVICE.MANAGE", action: "view" }
        ]
      },
      {
        title: "Service Type Performance",
        description: "Performance metrics by service type",
        path: "/service-management/reports/service-type-performance",
        icon: FileText,
        actions: [
          { label: "View Report", path: "/service-management/reports/service-type-performance", type: "primary", featureKey: "SERVICE.MANAGE", action: "view" }
        ]
      },
      {
        title: "Visitors Log Report",
        description: "Summary of visitor activity and statistics",
        path: "/service-management/reports/visitors-log",
        icon: FileText,
        actions: [
          { label: "View Report", path: "/service-management/reports/visitors-log", type: "primary", featureKey: "SERVICE.MANAGE", action: "view" }
        ]
      },
      {
        title: "Service Parameters",
        description: "Configure SLAs, categories, and service settings",
        path: "/service-management/setup/parameters",
        icon: FileText,
        actions: [
          { label: "Manage", path: "/service-management/setup/parameters", type: "primary", featureKey: "SERVICE.MANAGE", action: "view" }
        ]
      }
    ],
  },
];`;

const startIdx = content.indexOf('export const serviceManagementSections = [');
const endIdx = content.indexOf('function ServiceManagementLanding()');

if (startIdx !== -1 && endIdx !== -1) {
  content = content.substring(0, startIdx) + newSections + '\n\n' + content.substring(endIdx);
  fs.writeFileSync(f, content);
  console.log('done');
} else {
  console.log('not found');
}
