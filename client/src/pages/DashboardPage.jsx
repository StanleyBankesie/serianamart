import React from "react";

import { useAuth } from "../auth/AuthContext.jsx";
import { api } from "../api/client.js";

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = React.useState({
    sales: { total: 0, documents: 0 },
    purchase: { total: 0, documents: 0 },
    inventory: { items: 0, quantity: 0 },
    hr: { employees: 0 },
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError("");
        const resp = await api.get("/bi/dashboards");
        const data = resp?.data?.summary || {};
        if (mounted) {
          setSummary({
            sales: {
              total: Number(data?.sales?.total || 0),
              documents: Number(data?.sales?.documents || 0),
            },
            purchase: {
              total: Number(data?.purchase?.total || 0),
              documents: Number(data?.purchase?.documents || 0),
            },
            inventory: {
              items: Number(data?.inventory?.items || 0),
              quantity: Number(data?.inventory?.quantity || 0),
            },
            hr: {
              employees: Number(data?.hr?.employees || 0),
            },
          });
        }
      } catch (e) {
        setError(e?.response?.data?.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const currency = (n) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "GHS",
      maximumFractionDigits: 0,
    }).format(Number(n || 0));

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h1 className="text-2xl font-bold text-brand dark:text-brand-300">
            Dashboard
          </h1>
        </div>
        <div className="card-body">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Welcome,{" "}
            <span className="font-semibold text-brand dark:text-brand-300">
              {user?.email}
            </span>
            . This is the OmniSuite ERP starter shell.
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Start by enabling permissions in MySQL and then calling module
            endpoints from the UI.
          </p>
          {error ? <p className="text-sm text-red-600 mt-3">{error}</p> : null}
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Sales (30 Days)
              </h3>
              <span className="badge-success">
                {loading ? "Loading" : "Updated"}
              </span>
            </div>
            <p className="text-2xl font-bold text-brand dark:text-brand-300">
              {currency(summary.sales.total)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {summary.sales.documents} invoices
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Purchases (30 Days)
              </h3>
              <span className="badge-success">
                {loading ? "Loading" : "Updated"}
              </span>
            </div>
            <p className="text-2xl font-bold text-brand dark:text-brand-300">
              {currency(summary.purchase.total)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {summary.purchase.documents} POs
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Inventory
              </h3>
              <span className="badge-info">
                {loading ? "Loading" : "Updated"}
              </span>
            </div>
            <p className="text-2xl font-bold text-brand dark:text-brand-300">
              {summary.inventory.items}
            </p>
            <p className="text-xs text-slate-500 mt-1">Items tracked</p>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Employees
              </h3>
              <span className="badge-info">
                {loading ? "Loading" : "Updated"}
              </span>
            </div>
            <p className="text-2xl font-bold text-brand dark:text-brand-300">
              {summary.hr.employees}
            </p>
            <p className="text-xs text-slate-500 mt-1">Active</p>
          </div>
        </div>
      </div>
    </div>
  );
}
