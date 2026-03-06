import React from "react";
import { Route, Routes } from "react-router-dom";
import ModuleDashboard from "../../../components/ModuleDashboard";
import { api } from "../../../api/client.js";

import ServiceRequestsList from "./service-requests/ServiceRequestsList.jsx";
import ServiceRequestForm from "./service-requests/ServiceRequestForm.jsx";
import ServiceOrderForm from "./service-orders/ServiceOrderForm.jsx";
import ServiceOrdersList from "./service-orders/ServiceOrdersList.jsx";
import ServiceExecutionForm from "./service-execution/ServiceExecutionForm.jsx";
import ServiceExecutionsList from "./service-execution/ServiceExecutionsList.jsx";
import ServiceExecutionView from "./service-execution/ServiceExecutionView.jsx";
import ServiceBillForm from "./service-bills/ServiceBillForm.jsx";
import ServiceBillsList from "./service-bills/ServiceBillsList.jsx";
import ServiceConfirmationsList from "./service-confirmations/ServiceConfirmationsList.jsx";
import ServiceConfirmationForm from "./service-confirmations/ServiceConfirmationForm.jsx";
import ServiceParametersPage from "./setup/ServiceParametersPage.jsx";

function ServiceManagementLanding() {
  const [stats, setStats] = React.useState([
    {
      rbac_key: "open-requests",
      icon: "🔧",
      value: "12",
      label: "Open Requests",
      change: "↑ 3 new today",
      changeType: "positive",
      path: "/service-management/service-requests",
    },
    {
      rbac_key: "pending-bills",
      icon: "🧾",
      value: "7",
      label: "Pending Bills",
      change: "↔ stable",
      changeType: "neutral",
      path: "/service-management/service-bills",
    },
    {
      rbac_key: "confirmed-services",
      icon: "✅",
      value: "19",
      label: "Confirmed Services",
      change: "↑ 5 this week",
      changeType: "positive",
      path: "/service-management/service-confirmation",
    },
  ]);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const resp = await api.get("/bi/dashboards");
        const openReq = Number(
          resp?.data?.summary?.services?.open_requests || 0,
        );
        const pendingBills = Number(
          resp?.data?.summary?.services?.pending_bills || 0,
        );
        const confirmed = Number(resp?.data?.summary?.services?.confirmed || 0);
        if (mounted) {
          setStats((prev) => {
            const next = [...prev];
            next[0] = { ...next[0], value: String(openReq) };
            next[1] = { ...next[1], value: String(pendingBills) };
            next[2] = { ...next[2], value: String(confirmed) };
            return next;
          });
        }
      } catch {}
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const sections = [
    {
      title: "Requests",
      items: [
        {
          title: "Service Requests",
          description: "Submit and track service requests",
          path: "/service-management/service-requests",
          icon: "🔧",
          actions: [
            {
              label: "New Request",
              path: "/service-management/service-requests/new",
              type: "primary",
            },
          ],
        },
        {
          title: "Service Orders",
          description: "Create internal/external service orders",
          path: "/service-management/service-orders",
          icon: "🧾",
          actions: [
            {
              label: "New Order",
              path: "/service-management/service-orders/new",
              type: "primary",
            },
          ],
        },
        {
          title: "Service Execution",
          description: "Execute, verify and close service orders",
          path: "/service-management/service-executions",
          icon: "⚙️",
          actions: [
            {
              label: "Start Execution",
              path: "/service-management/service-execution",
              type: "primary",
            },
          ],
        },
        {
          title: "Service Confirmation",
          description: "Confirm delivered services from suppliers",
          path: "/service-management/service-confirmation",
          icon: "✅",
          actions: [
            {
              label: "New Confirmation",
              path: "/service-management/service-confirmation/new",
              type: "primary",
            },
          ],
        },
        {
          title: "Service Bills",
          description: "Prepare and issue service bills",
          path: "/service-management/service-bills",
          icon: "💵",
          actions: [
            {
              label: "New Bill",
              path: "/service-management/service-bills",
              type: "primary",
            },
          ],
        },
        {
          title: "Service Setup",
          description: "Configure work locations, service types, categories",
          path: "/service-management/setup",
          icon: "⚙️",
          actions: [],
        },
      ],
    },
    {
      title: "Reports",
      items: [
        {
          title: "Service Request Summary",
          description: "Monitor incoming service demand",
          path: "/service-management/reports/service-request-summary",
          icon: "📥",
        },
        {
          title: "Service Order Status",
          description: "Track service order progress",
          path: "/service-management/reports/service-order-status",
          icon: "📋",
        },
        {
          title: "Execution Performance",
          description: "Measure technician productivity",
          path: "/service-management/reports/execution-performance",
          icon: "⚙️",
        },
        {
          title: "SLA Compliance",
          description: "Monitor SLA performance",
          path: "/service-management/reports/sla-compliance",
          icon: "⏱️",
        },
        {
          title: "Service Revenue",
          description: "Financial performance tracking",
          path: "/service-management/reports/service-revenue",
          icon: "💵",
        },
        {
          title: "Outstanding Service Bills",
          description: "Accounts receivable tracking",
          path: "/service-management/reports/outstanding-bills",
          icon: "📑",
        },
        {
          title: "Service Confirmation",
          description: "Confirm customer acceptance",
          path: "/service-management/reports/service-confirmation",
          icon: "✅",
        },
        {
          title: "Technician Utilization",
          description: "Workforce efficiency",
          path: "/service-management/reports/technician-utilization",
          icon: "👷",
        },
        {
          title: "Service Cost Analysis",
          description: "Profitability per job",
          path: "/service-management/reports/service-cost-analysis",
          icon: "📊",
        },
        {
          title: "Repeat Service Requests",
          description: "Identify recurring issues",
          path: "/service-management/reports/repeat-requests",
          icon: "🔁",
        },
        {
          title: "Service Type Performance",
          description: "Which services generate most revenue",
          path: "/service-management/reports/service-type-performance",
          icon: "🏷️",
        },
      ],
    },
  ];

  return (
    <ModuleDashboard
      title="Service Management"
      description="End-to-end service request, confirmation, and billing"
      stats={stats}
      headerActions={[
        {
          label: "Dashboard",
          path: "/service-management/dashboard",
          icon: "📊",
        },
      ]}
      sections={sections}
      features={serviceManagementFeatures}
    />
  );
}

export default function ServiceManagementHome() {
  return (
    <Routes>
      <Route path="/" element={<ServiceManagementLanding />} />
      <Route
        path="dashboard"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(() => import("./ServiceDashboardPage.jsx")),
            )}
          </React.Suspense>
        }
      />
      <Route path="service-requests" element={<ServiceRequestsList />} />
      <Route path="service-requests/new" element={<ServiceRequestForm />} />
      <Route path="service-orders" element={<ServiceOrdersList />} />
      <Route path="service-orders/new" element={<ServiceOrderForm />} />
      <Route path="service-orders/:id" element={<ServiceOrderForm />} />
      <Route path="service-executions" element={<ServiceExecutionsList />} />
      <Route path="service-executions/:id" element={<ServiceExecutionView />} />
      <Route path="service-execution" element={<ServiceExecutionForm />} />
      <Route
        path="service-confirmation"
        element={<ServiceConfirmationsList />}
      />
      <Route
        path="service-confirmation/:id"
        element={<ServiceConfirmationForm />}
      />
      <Route path="service-bills" element={<ServiceBillsList />} />
      <Route path="setup" element={<ServiceParametersPage />} />
      <Route
        path="reports/service-request-summary"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(
                () => import("./reports/ServiceRequestSummaryReport.jsx"),
              ),
            )}
          </React.Suspense>
        }
      />
      <Route
        path="reports/service-order-status"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(
                () => import("./reports/ServiceOrderStatusReport.jsx"),
              ),
            )}
          </React.Suspense>
        }
      />
      <Route
        path="reports/execution-performance"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(
                () => import("./reports/ServiceExecutionPerformanceReport.jsx"),
              ),
            )}
          </React.Suspense>
        }
      />
      <Route
        path="reports/sla-compliance"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(() => import("./reports/SLAComplianceReport.jsx")),
            )}
          </React.Suspense>
        }
      />
      <Route
        path="reports/service-revenue"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(() => import("./reports/ServiceRevenueReport.jsx")),
            )}
          </React.Suspense>
        }
      />
      <Route
        path="reports/outstanding-bills"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(
                () => import("./reports/OutstandingServiceBillsReport.jsx"),
              ),
            )}
          </React.Suspense>
        }
      />
      <Route
        path="reports/service-confirmation"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(
                () => import("./reports/ServiceConfirmationReport.jsx"),
              ),
            )}
          </React.Suspense>
        }
      />
      <Route
        path="reports/technician-utilization"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(
                () => import("./reports/TechnicianUtilizationReport.jsx"),
              ),
            )}
          </React.Suspense>
        }
      />
      <Route
        path="reports/service-cost-analysis"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(
                () => import("./reports/ServiceCostAnalysisReport.jsx"),
              ),
            )}
          </React.Suspense>
        }
      />
      <Route
        path="reports/repeat-requests"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(
                () => import("./reports/RepeatServiceRequestReport.jsx"),
              ),
            )}
          </React.Suspense>
        }
      />
      <Route
        path="reports/service-type-performance"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(
                () => import("./reports/ServiceTypePerformanceReport.jsx"),
              ),
            )}
          </React.Suspense>
        }
      />
    </Routes>
  );
}

export const serviceManagementFeatures = [
  {
    module_key: "service-management",
    label: "Service Requests",
    path: "/service-management/service-requests",
    type: "feature",
  },
  {
    module_key: "service-management",
    label: "Service Orders",
    path: "/service-management/service-orders",
    type: "feature",
  },
  {
    module_key: "service-management",
    label: "Service Execution",
    path: "/service-management/service-executions",
    type: "feature",
  },
  {
    module_key: "service-management",
    label: "Service Confirmation",
    path: "/service-management/service-confirmation",
    type: "feature",
  },
  {
    module_key: "service-management",
    label: "Service Bills",
    path: "/service-management/service-bills",
    type: "feature",
  },
  {
    module_key: "service-management",
    label: "Service Setup",
    path: "/service-management/setup",
    type: "feature",
  },
];
