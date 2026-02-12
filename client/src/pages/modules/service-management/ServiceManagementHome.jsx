import React from "react";
import { Route, Routes } from "react-router-dom";
import ModuleDashboard from "../../../components/ModuleDashboard";
import { api } from "../../../api/client.js";

import ServiceRequestForm from "./service-requests/ServiceRequestForm.jsx";
import ServiceOrderForm from "./service-orders/ServiceOrderForm.jsx";
import ServiceExecutionForm from "./service-execution/ServiceExecutionForm.jsx";
import ServiceBillForm from "./service-bills/ServiceBillForm.jsx";
import ServiceConfirmationsList from "./service-confirmations/ServiceConfirmationsList.jsx";
import ServiceConfirmationForm from "./service-confirmations/ServiceConfirmationForm.jsx";
import { useAuth } from "../../../auth/AuthContext.jsx";

function ServiceManagementLanding() {
  const [stats, setStats] = React.useState([
    {
      icon: "🔧",
      value: "12",
      label: "Open Requests",
      change: "↑ 3 new today",
      changeType: "positive",
      path: "/service-management/service-requests",
    },
    {
      icon: "🧾",
      value: "7",
      label: "Pending Bills",
      change: "↔ stable",
      changeType: "neutral",
      path: "/service-management/service-bills",
    },
    {
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
              path: "/service-management/service-orders",
              type: "primary",
            },
          ],
        },
        {
          title: "Service Execution",
          description: "Execute, verify and close service orders",
          path: "/service-management/service-execution",
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
      ],
    },
  ];

  return (
    <ModuleDashboard
      title="Service Management"
      description="End-to-end service request, confirmation, and billing"
      stats={stats}
      sections={sections}
    />
  );
}

export default function ServiceManagementHome() {
  const { hasModuleAccess, hasAccess } = useAuth();
  const NoAccess = () => (
    <div className="p-6">
      <div className="card">
        <div className="card-body">
          <div className="text-center text-slate-600">
            You do not have permission to view this page.
          </div>
        </div>
      </div>
    </div>
  );

  if (!hasModuleAccess("Service Management")) {
    return (
      <div className="p-6">
        <div className="card">
          <div className="card-body">
            <div className="text-center text-slate-600">
              You do not have access to the Service Management module.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<ServiceManagementLanding />} />
      <Route
        path="service-requests"
        element={
          hasAccess("/service-management/service-requests", "view") ? (
            <ServiceRequestForm />
          ) : (
            <NoAccess />
          )
        }
      />
      <Route
        path="service-requests/new"
        element={
          hasAccess("/service-management/service-requests/new", "create") ? (
            <ServiceRequestForm />
          ) : (
            <NoAccess />
          )
        }
      />
      <Route
        path="service-orders"
        element={
          hasAccess("/service-management/service-orders", "view") ? (
            <ServiceOrderForm />
          ) : (
            <NoAccess />
          )
        }
      />
      <Route
        path="service-execution"
        element={
          hasAccess("/service-management/service-execution", "view") ? (
            <ServiceExecutionForm />
          ) : (
            <NoAccess />
          )
        }
      />
      <Route
        path="service-confirmation"
        element={
          hasAccess("/service-management/service-confirmation", "view") ? (
            <ServiceConfirmationsList />
          ) : (
            <NoAccess />
          )
        }
      />
      <Route
        path="service-confirmation/:id"
        element={
          hasAccess("/service-management/service-confirmation/:id", "edit") ? (
            <ServiceConfirmationForm />
          ) : (
            <NoAccess />
          )
        }
      />
      <Route
        path="service-bills"
        element={
          hasAccess("/service-management/service-bills", "view") ? (
            <ServiceBillForm />
          ) : (
            <NoAccess />
          )
        }
      />
    </Routes>
  );
}
