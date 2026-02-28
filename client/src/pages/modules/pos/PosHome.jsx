import React, { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";

import PosReports from "./reports/PosReports.jsx";
import PosSetup from "./setup/PosSetup.jsx";
import PosReturnForm from "./returns/PosReturnForm.jsx";
import PosRegister from "./register/PosRegister.jsx";
import PosSalesEntry from "./entry/PosSalesEntry.jsx";
import CashCollectionDetails from "./cash/CashCollectionDetails.jsx";
import PosInvoiceList from "./invoices/PosInvoiceList.jsx";
import PosPostToFinance from "./finance/PosPostToFinance.jsx";
import ModuleDashboard from "../../../components/ModuleDashboard.jsx";
import api from "../../../api/client.js";
import PosDayManagement from "./day/PosDayManagement.jsx";
import PosDashboard from "./dashboard/PosDashboard.jsx";
import { useAuth } from "../../../auth/AuthContext.jsx";

function PosLanding() {
  const [overview, setOverview] = useState(null);
  const [now, setNow] = useState(new Date());
  const { token } = useAuth();

  useEffect(() => {
    let cancelled = false;
    api
      .get("/pos/analytics/overview")
      .then((res) => {
        if (cancelled) return;
        setOverview(res.data || null);
      })
      .catch(() => {
        if (cancelled) return;
        setOverview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (n) =>
    `GH₵${Number(n || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const stats = [
    {
      rbac_key: "today-sales",
      icon: "💵",
      value: fmt(overview?.todaySales || 0),
      label: "Today Sales",
      path: "/pos/reports",
    },
    {
      rbac_key: "total-customers",
      icon: "👥",
      value: String(overview?.totalCustomers ?? 0),
      label: "Total Customers",
      path: "/sales/customers",
    },
    {
      rbac_key: "average-order",
      icon: "🧾",
      value: fmt(overview?.averageOrder || 0),
      label: "Average Order",
      path: "/pos/reports",
    },
    {
      rbac_key: "monthly-revenue",
      icon: "📊",
      value: fmt(overview?.monthlyRevenue || 0),
      label: "Monthly Revenue",
      path: "/finance/reports",
    },
  ];

  const sections = [
    {
      title: "Transactions",
      features: [
        {
          name: "Sales Entry",
          path: "/pos/sales-entry",
          description: "Quick sales entry",
          icon: "🛒",
        },
        {
          name: "Start/End Business Day",
          path: "/pos/day-management",
          description: "Open/close POS business day and reconciliation",
          icon: "📅",
        },
        {
          name: "Cash Collection",
          path: "/pos/cash-collection",
          description: "Invoices list and collection summary",
          icon: "💵",
        },
        {
          name: "POS Invoices",
          path: "/pos/invoices",
          description: "All invoices created from sales entry",
          icon: "🧾",
        },
        {
          name: "Post to Finance",
          path: "/pos/post-to-finance",
          description: "Post POS sales as finance sales vouchers",
          icon: "🏦",
        },
        {
          name: "POS Returns",
          path: "/pos/returns",
          description: "Process sales returns and refunds",
          icon: "↩️",
        },
        {
          name: "POS Register",
          path: "/pos/register",
          description: "Transactions listing and details",
          icon: "📒",
        },
      ],
    },
    {
      title: "Setup",
      features: [
        {
          name: "POS Setup",
          path: "/pos/setup",
          description: "Configure terminals, shifts, payments, and settings",
          icon: "⚙️",
        },
      ],
    },
    {
      title: "Reports",
      features: [
        {
          name: "POS Reports",
          path: "/pos/reports",
          description: "Daily sales and performance reports",
          icon: "📊",
        },
        {
          name: "Dashboard",
          path: "/pos/dashboard",
          description: "Charts and analytics for POS",
          icon: "📈",
        },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <a href="/pos/dashboard" className="btn-primary">
          Dashboard
        </a>
      </div>
      <ModuleDashboard
        title="Point of Sale"
        description="Retail sales and transaction management"
        stats={stats}
        sections={sections}
        features={posFeatures}
      />
    </div>
  );
}

export default function PosHome() {
  return (
    <Routes>
      <Route path="/" element={<PosLanding />} />

      <Route path="/returns" element={<PosReturnForm />} />
      <Route path="/returns/new" element={<PosReturnForm />} />
      <Route path="/register" element={<PosRegister />} />
      <Route path="/sales-entry" element={<PosSalesEntry />} />
      <Route path="/cash-collection" element={<CashCollectionDetails />} />
      <Route path="/invoices" element={<PosInvoiceList />} />
      <Route path="/post-to-finance" element={<PosPostToFinance />} />
      <Route path="/day-management" element={<PosDayManagement />} />

      <Route path="/reports" element={<PosReports />} />
      <Route path="/setup" element={<PosSetup />} />
      <Route path="/dashboard" element={<PosDashboard />} />
    </Routes>
  );
}

export const posFeatures = [
  { module_key: "pos", label: "Sales Entry", path: "/pos/sales-entry", type: "feature" },
  { module_key: "pos", label: "Start/End Business Day", path: "/pos/day-management", type: "feature" },
  { module_key: "pos", label: "Cash Collection", path: "/pos/cash-collection", type: "feature" },
  { module_key: "pos", label: "POS Invoices", path: "/pos/invoices", type: "feature" },
  { module_key: "pos", label: "Post to Finance", path: "/pos/post-to-finance", type: "feature" },
  { module_key: "pos", label: "POS Returns", path: "/pos/returns", type: "feature" },
  { module_key: "pos", label: "POS Register", path: "/pos/register", type: "feature" },
  { module_key: "pos", label: "POS Setup", path: "/pos/setup", type: "feature" },
  { module_key: "pos", label: "POS Reports", path: "/pos/reports", type: "dashboard" },
  { module_key: "pos", label: "Dashboard", path: "/pos/dashboard", type: "dashboard" },
];
