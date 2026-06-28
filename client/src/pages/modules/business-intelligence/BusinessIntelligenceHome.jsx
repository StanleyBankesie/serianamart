/**
 * @fileoverview BusinessIntelligenceHome component.
 * Provides functionality for BusinessIntelligenceHome.
 */

import React from "react";
import { Route, Routes } from "react-router-dom";

import DashboardList from "./dashboards/DashboardList.jsx";
import DashboardForm from "./dashboards/DashboardForm.jsx";
import ModuleDashboard from "../../../components/ModuleDashboard.jsx";
import { api } from "../../../api/client.js";

function fmt(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `₵${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function BusinessIntelligenceLanding() {
  const [stats, setStats] = React.useState([
    {
      rbac_key: "active-dashboards",
      value: "—",
      label: "Active Dashboards",
      change: "Loading…",
      changeType: "neutral",
      path: "/business-intelligence/dashboards",
    },
    {
      rbac_key: "sales-30d",
      value: "—",
      label: "Sales (30d)",
      change: "Loading…",
      changeType: "neutral",
      path: "/business-intelligence/dashboards",
    },
    {
      rbac_key: "purchase-30d",
      value: "—",
      label: "Purchases (30d)",
      change: "Loading…",
      changeType: "neutral",
      path: "/business-intelligence/dashboards",
    },
    {
      rbac_key: "overview",
      value: "—",
      label: "Items / Employees",
      change: "Loading…",
      changeType: "neutral",
      path: "/business-intelligence/dashboards",
    },
  ]);

  React.useEffect(() => {
    let mounted = true;
    let timer;
    async function load() {
      try {
        const resp = await api.get("/bi/dashboard-stats");
        const d = resp?.data?.data;
        if (d && mounted) {
          setStats((prev) => {
            const next = [...prev];
            next[0] = {
              ...next[0],
              value: String(d.activeDashboards ?? "—"),
              change: `${d.reportTypes ?? 0} report types`,
              changeType: "positive",
            };
            next[1] = {
              ...next[1],
              value: fmt(d.sales30d),
              change: "Last 30 days",
              changeType: d.sales30d > 0 ? "positive" : "neutral",
            };
            next[2] = {
              ...next[2],
              value: fmt(d.purchase30d),
              change: "Last 30 days",
              changeType: d.purchase30d > 0 ? "warning" : "neutral",
            };
            next[3] = {
              ...next[3],
              value: `${d.inventoryItems ?? 0} / ${d.hrEmployees ?? 0}`,
              change: "Stock / Headcount",
              changeType: "positive",
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
      title: "Dashboards & Visualizations Builder",
      features: [
        {
          name: "Dashboard Workspace",
          path: "/business-intelligence/dashboards",
          description: "Interactive dashboard & visualization board",
          icon: "📊",
        },
        {
          name: "Create Custom Visualization",
          path: "/business-intelligence/dashboards/new",
          description: "Build self-service dashboards and charts",
          icon: "➕",
        },
      ],
    },
  ];

  return (
    <ModuleDashboard
      title="Business Intelligence Hub"
      description="Self-Service KPI Builder, interactive charts, and business metrics"
      stats={stats}
      sections={sections}
      features={businessIntelligenceFeatures}
    />
  );
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function BusinessIntelligenceHome() {
  return (
    <Routes>
      <Route path="/" element={<BusinessIntelligenceLanding />} />
      <Route path="/dashboards" element={<DashboardList />} />
      <Route path="/dashboards/new" element={<DashboardForm />} />
      <Route path="/dashboards/:id" element={<DashboardForm />} />
    </Routes>
  );
}

export const businessIntelligenceFeatures = [
  {
    module_key: "business-intelligence",
    label: "Dashboard Workspace",
    path: "/business-intelligence/dashboards",
    type: "dashboard",
  },
  {
    module_key: "business-intelligence",
    label: "New Dashboard",
    path: "/business-intelligence/dashboards/new",
    type: "dashboard",
  },
];
