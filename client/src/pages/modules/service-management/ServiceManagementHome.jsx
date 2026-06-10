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
      rbac_key: "service-requests",
      value: "—",
      label: "Service Requests",
      change: "Loading…",
      changeType: "neutral",
      path: "/service-management/service-requests",
    },
    {
      rbac_key: "open-orders",
      value: "—",
      label: "Open Orders",
      change: "Loading…",
      changeType: "neutral",
      path: "/service-management/service-orders",
    },
    {
      rbac_key: "executions",
      value: "—",
      label: "Executions",
      change: "Loading…",
      changeType: "neutral",
      path: "/service-management/service-executions",
    },
    {
      rbac_key: "confirmed-services",
      value: "—",
      label: "Confirmed Services",
      change: "Loading…",
      changeType: "neutral",
      path: "/service-management/service-confirmation",
    },
  ]);

  React.useEffect(() => {
    let mounted = true;
    let timer;
    async function load() {
      try {
        const resp = await api.get("/purchase/service/dashboard/metrics");
        const c = resp?.data?.cards;
        if (c && mounted) {
          setStats((prev) => {
            const next = [...prev];
            next[0] = {
              ...next[0],
              value: String(c.ytd_requests ?? "—"),
              change: `${c.mtd_requests ?? 0} this month`,
              changeType: c.ytd_requests > 0 ? "positive" : "neutral",
            };
            next[1] = {
              ...next[1],
              value: String(c.ytd_orders ?? "—"),
              change: `${c.wtd_orders ?? 0} this week`,
              changeType: c.ytd_orders > 0 ? "positive" : "neutral",
            };
            next[2] = {
              ...next[2],
              value: String(c.ytd_executions ?? "—"),
              change: `${c.mtd_executions ?? 0} this month`,
              changeType: c.ytd_executions > 0 ? "positive" : "neutral",
            };
            next[3] = {
              ...next[3],
              value: String(c.ytd_confirmations ?? "—"),
              change: `${c.mtd_confirmations ?? 0} this month`,
              changeType: c.ytd_confirmations > 0 ? "positive" : "neutral",
            };
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
        },
        {
          title: "Service Orders",
          description: "Create internal/external service orders",
          path: "/service-management/service-orders",
          icon: "🧾",
        },
        {
          title: "Service Execution",
          description: "Execute, verify and close service orders",
          path: "/service-management/service-executions",
          icon: "⚙️",
        },
        {
          title: "Service Confirmation",
          description: "Confirm delivered services from suppliers",
          path: "/service-management/service-confirmation",
          icon: "✅",
        },
        {
          title: "Service Bills",
          description: "Prepare and issue service bills",
          path: "/service-management/service-bills",
          icon: "💵",
        },
        {
          title: "Service Setup",
          description: "Configure work locations, service types, categories",
          path: "/service-management/setup",
          icon: "⚙️",
        },
        {
          title: "Visitors Log Book",
          description: "Track and manage visitor records",
          path: "/service-management/visitors-log",
          icon: "📝",
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
        {
          title: "Visitors Log Report",
          description: "Summary of visitor activity and statistics",
          path: "/service-management/reports/visitors-log",
          icon: "📋",
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
        path="visitors-log"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(() => import("./visitors-log/VisitorsLogList.jsx")),
            )}
          </React.Suspense>
        }
      />
      <Route
        path="visitors-log/new"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(() => import("./visitors-log/VisitorLogForm.jsx")),
            )}
          </React.Suspense>
        }
      />
      <Route
        path="visitors-log/:id/edit"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(() => import("./visitors-log/VisitorLogForm.jsx")),
            )}
          </React.Suspense>
        }
      />
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
      <Route
        path="reports/visitors-log"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(() => import("./reports/VisitorsLogReport.jsx")),
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
  {
    module_key: "service-management",
    label: "Visitors Log Book",
    path: "/service-management/visitors-log",
    type: "feature",
  },
];
