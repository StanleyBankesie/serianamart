import React from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";

import StockAdjustmentList from "./StockAdjustmentList.jsx";
import StockAdjustmentForm from "./StockAdjustmentForm.jsx";
import StockTransferList from "./StockTransferList.jsx";
import StockTransferForm from "./StockTransferForm.jsx";
import MaterialRequisitionList from "./MaterialRequisitionList.jsx";
import MaterialRequisitionForm from "./MaterialRequisitionForm.jsx";
import ItemsList from "./ItemsList.jsx";
import ItemForm from "./ItemForm.jsx";
import WarehousesList from "./WarehousesList.jsx";
import WarehouseForm from "./WarehouseForm.jsx";
import GRNLocalList from "./GRNLocalList.jsx";
import GRNLocalForm from "./GRNLocalForm.jsx";
import GRNImportList from "./GRNImportList.jsx";
import GRNImportForm from "./GRNImportForm.jsx";
import TransferAcceptanceList from "./TransferAcceptanceList.jsx";
import TransferAcceptanceForm from "./TransferAcceptanceForm.jsx";
import StockTakeList from "./StockTakeList.jsx";
import StockTakeForm from "./StockTakeForm.jsx";
import ItemGroupsList from "./ItemGroupsList.jsx";
import ItemGroupForm from "./ItemGroupForm.jsx";
import UnitConversionsList from "./UnitConversionsList.jsx";
import UnitConversionForm from "./UnitConversionForm.jsx";
import ItemBatchesList from "./ItemBatchesList.jsx";

import StockUpdationList from "./StockUpdationList.jsx";
import StockUpdationForm from "./StockUpdationForm.jsx";
import StockVerificationList from "./StockVerificationList.jsx";
import StockVerificationForm from "./StockVerificationForm.jsx";
import ReturnToStoresList from "./ReturnToStoresList.jsx";
import ReturnToStoresForm from "./ReturnToStoresForm.jsx";
import IssueToRequirementList from "./IssueToRequirementList.jsx";
import IssueToRequirementForm from "./IssueToRequirementForm.jsx";
import ModuleDashboard from "../../../components/ModuleDashboard.jsx";
import { api } from "../../../api/client.js";
import StockReorderPage from "./StockReorderPage.jsx";
import StockUploadPage from "./StockUploadPage.jsx";
import InventoryHealthMonitorPage from "./reports/InventoryHealthMonitorPage.jsx";
import PeriodicalStockSummaryPage from "./reports/PeriodicalStockSummaryPage.jsx";
import PeriodicalStockStatementPage from "./reports/PeriodicalStockStatementPage.jsx";
import IssueRegisterReportPage from "./reports/IssueRegisterReportPage.jsx";
import StockTransferRegisterReportPage from "./reports/StockTransferRegisterReportPage.jsx";
import StockVerificationReportPage from "./reports/StockVerificationReportPage.jsx";
import StockAgingAnalysisReportPage from "./reports/StockAgingAnalysisReportPage.jsx";
import SlowMovingReportPage from "./reports/SlowMovingReportPage.jsx";
import FastMovingReportPage from "./reports/FastMovingReportPage.jsx";
import NonMovingReportPage from "./reports/NonMovingReportPage.jsx";
import StockBalancesReportPage from "./reports/StockBalancesReportPage.jsx";
import MaterialReturnReportPage from "./reports/MaterialReturnReportPage.jsx";
import StockAdjustmentReportPage from "./reports/StockAdjustmentReportPage.jsx";
import LowStockNotificationsPage from "./LowStockNotificationsPage.jsx";
// Removed Sales Return from Inventory, and moved Purchase Return to Purchase module

function InventoryFeaturePage({ title, description }) {
  return (
    <div className="card">
      <div className="card-header bg-brand text-white rounded-t-lg">
        <h1 className="text-2xl font-bold dark:text-brand-300">{title}</h1>
        {description ? <p className="text-sm mt-1">{description}</p> : null}
      </div>
      <div className="card-body">
        <div className="text-sm">This page is ready to be implemented.</div>
      </div>
    </div>
  );
}

function InventoryHomeIndex() {
  const [stats, setStats] = React.useState([
    {
      rbac_key: "items-tracked",
      // icon: "📦",
      value: "45",
      label: "Items Tracked",
      change: "5 critical",
      changeType: "negative",
      path: "/inventory/reports",
    },
    {
      rbac_key: "pending-requisitions",
      // icon: "📝",
      value: "12",
      label: "Pending Requisitions",
      change: "3 urgent",
      changeType: "neutral",
      path: "/inventory/material-requisitions",
    },
    {
      rbac_key: "incoming-transfers",
      // icon: "🚚",
      value: "8",
      label: "Incoming Transfers",
      change: "Expected today",
      changeType: "positive",
      path: "/inventory/transfer-acceptance",
    },
  ]);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const resp = await api.get("/bi/dashboards");
        const items = Number(resp?.data?.summary?.inventory?.items || 0);
        const reqs = Number(
          resp?.data?.summary?.inventory?.pending_requisitions || 0,
        );
        const transfers = Number(
          resp?.data?.summary?.inventory?.incoming_transfers || 0,
        );
        if (mounted) {
          setStats((prev) => {
            const next = [...prev];
            next[0] = { ...next[0], value: String(items) };
            next[1] = { ...next[1], value: String(reqs) };
            next[2] = { ...next[2], value: String(transfers) };
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
      title: "Stock Operations",
      features: [
        {
          name: "Material Requisition",
          path: "/inventory/material-requisitions",
          description: "Request materials from warehouse",
          icon: "📝",
        },
        {
          name: "Stock Upload",
          path: "/inventory/stock-upload",
          description: "Bulk update stock via Excel",
          icon: "⬆️",
        },
        {
          name: "Stock Updation",
          path: "/inventory/stock-updation",
          description: "Update stock levels",
          icon: "🧮",
        },
        {
          name: "Stock Verification",
          path: "/inventory/stock-verification",
          description: "Verify stock balances",
          icon: "✅",
        },
        {
          name: "Stock Updation & Verification",
          path: "/inventory/stock-ops",
          description: "Updation and verification dashboard",
          icon: "🧾",
        },
        {
          name: "Return to Stores Advice",
          path: "/inventory/return-to-stores",
          description: "Return unused materials",
          icon: "↩",
        },
        {
          name: "Stock Adjustment",
          path: "/inventory/stock-adjustments",
          description: "Adjust stock quantities",
          icon: "🛠",
        },
        {
          name: "Issue to Requirement Area",
          path: "/inventory/issue-to-requirement",
          description: "Issue materials to departments",
          icon: "📤",
        },
      ],
    },
    {
      title: "Stock Movements",
      features: [
        {
          name: "Warehouse Stock Transfer",
          path: "/inventory/stock-transfers",
          description: "Transfer stock between warehouses/branches",
          icon: "🚚",
        },
        {
          name: "Transfer Acceptance",
          path: "/inventory/transfer-acceptance",
          description: "Receive transferred stock",
          icon: "📥",
        },
        {
          name: "Stock Reorder",
          path: "/inventory/stock-reorder",
          description: "Manage reorder points",
          icon: "🔁",
        },
      ],
    },
    {
      title: "Stock Count",
      features: [
        {
          name: "Daily Stock Take",
          path: "/inventory/stock-take",
          description: "Perform physical stock counts",
          icon: "📋",
        },
      ],
    },
    {
      title: "Goods Receipt",
      features: [
        {
          name: "Material Receipt (GRN) - Local",
          path: "/inventory/grn-local",
          description: "Receive local purchases",
          icon: "📦",
        },
        {
          name: "Material Receipt (GRN) - Import",
          path: "/inventory/grn-import",
          description: "Receive import purchases",
          icon: "🚢",
        },
      ],
    },
    // Returns section removed from Inventory (Sales Return hidden, Purchase Return moved to Purchase)
    {
      title: "Master Data Setup",
      features: [
        {
          name: "Items Setup",
          path: "/inventory/items",
          description: "Configure items with barcodes",
          icon: "🏷",
        },
        {
          name: "Item Groups & Sub Groups",
          path: "/inventory/item-groups",
          description: "Organize items by categories",
          icon: "🗂",
        },
        {
          name: "Unit Conversion",
          path: "/inventory/unit-conversions",
          description: "Define unit conversions",
          icon: "🔀",
        },
        {
          name: "Warehouse Setup",
          path: "/inventory/warehouses",
          description: "Configure warehouses",
          icon: "🏭",
        },
        {
          name: "Item Batches Tracking",
          path: "/inventory/batches",
          description: "Track items by batch, expiry, and warehouse",
          icon: "🧾",
        },
      ],
    },
    {
      title: "Reports",
      features: [
        {
          name: "Health Monitor",
          path: "/inventory/reports/health-monitor",
          description: "Low stock and coverage analysis",
          icon: "🩺",
        },
        {
          name: "Stock Summary",
          path: "/inventory/reports/periodical-stock-summary",
          description: "Summary of movements by period",
          icon: "🗓️",
        },
        {
          name: "Stock Statement",
          path: "/inventory/reports/periodical-stock-statement",
          description: "Detailed item movements by period",
          icon: "🧾",
        },
        {
          name: "Issue Register",
          path: "/inventory/reports/issue-register",
          description: "Issued items to departments/projects",
          icon: "📤",
        },
        {
          name: "Stock Transfer Register",
          path: "/inventory/reports/stock-transfer-register",
          description: "Transfers between warehouses",
          icon: "🔁",
        },
        {
          name: "Stock Balances",
          path: "/inventory/reports/stock-balances",
          description: "Available stock by warehouse",
          icon: "📦",
        },
        {
          name: "Stock Adjustment Report",
          path: "/inventory/reports/stock-adjustments",
          description: "Movements via stock adjustments",
          icon: "🛠",
        },
        {
          name: "Material Return Report",
          path: "/inventory/reports/material-returns",
          description: "Returns recorded in Return to Stores",
          icon: "↩",
        },
        {
          name: "Stock Verification",
          path: "/inventory/reports/stock-verification",
          description: "Verification variances by item",
          icon: "✅",
        },
        {
          name: "Stock Aging Analysis",
          path: "/inventory/reports/stock-aging-analysis",
          description: "Age buckets and holding",
          icon: "⏳",
        },
        {
          name: "Slow Moving Items",
          path: "/inventory/reports/slow-moving",
          description: "Low turnover items",
          icon: "🐢",
        },
        {
          name: "Fast Moving Items",
          path: "/inventory/reports/fast-moving",
          description: "High turnover items",
          icon: "⚡",
        },
        {
          name: "Non Moving Items",
          path: "/inventory/reports/non-moving",
          description: "No movement in period",
          icon: "🛑",
        },
      ],
    },
  ];

  return (
    <ModuleDashboard
      title="Inventory Management"
      description="Stock management, warehouse operations, and inventory control"
      stats={stats}
      headerActions={[
        { label: "Dashboard", path: "/inventory/dashboard", icon: "📊" },
      ]}
      sections={sections}
      features={inventoryFeatures}
      showAll={true}
    />
  );
}

function StockUpdationAndVerificationPage() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [updations, setUpdations] = React.useState([]);
  const [verifications, setVerifications] = React.useState([]);

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    Promise.all([
      api
        .get("/inventory/stock-updation")
        .catch(() => ({ data: { items: [] } })),
      api
        .get("/inventory/stock-verification")
        .catch(() => ({ data: { items: [] } })),
    ])
      .then(([updRes, verRes]) => {
        if (!mounted) return;
        const upd = Array.isArray(updRes.data?.items) ? updRes.data.items : [];
        const ver = Array.isArray(verRes.data?.items) ? verRes.data.items : [];
        setUpdations(upd.slice(0, 8));
        setVerifications(ver.slice(0, 8));
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load data");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
            Stock Operations
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Select a module to manage inventory additions or perform stock
            verifications and adjustments.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Stock Updation Card */}
          <Link
            to="/inventory/stock-updation"
            className="group relative bg-white rounded-2xl shadow-sm border border-slate-200 p-8 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-colors" />
            <div className="flex flex-col h-full space-y-6">
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 transition-colors duration-300">
                <svg
                  className="w-8 h-8 text-indigo-600 group-hover:text-white transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                  Stock Updation
                </h2>
                <p className="text-slate-600 leading-relaxed">
                  Fast-track stock increases and manual inventory additions.
                  Update balances directly for incoming items.
                </p>
              </div>
              <div className="pt-4 flex items-center text-indigo-600 font-semibold group-hover:translate-x-2 transition-transform">
                Go to Updation List
                <svg
                  className="w-5 h-5 ml-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </div>
            </div>
          </Link>

          {/* Stock Verification Card */}
          <Link
            to="/inventory/stock-verification"
            className="group relative bg-white rounded-2xl shadow-sm border border-slate-200 p-8 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-colors" />
            <div className="flex flex-col h-full space-y-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center group-hover:bg-emerald-600 transition-colors duration-300">
                <svg
                  className="w-8 h-8 text-emerald-600 group-hover:text-white transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                  Stock Verification
                </h2>
                <p className="text-slate-600 leading-relaxed">
                  Audit physical inventory against system records. Record
                  variances and reconcile stock levels.
                </p>
              </div>
              <div className="pt-4 flex items-center text-emerald-600 font-semibold group-hover:translate-x-2 transition-transform">
                Go to Verification List
                <svg
                  className="w-5 h-5 ml-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </div>
            </div>
          </Link>
        </div>

        <div className="flex justify-center pt-6">
          <Link
            to="/inventory"
            className="inline-flex items-center px-6 py-3 border border-slate-300 shadow-sm text-base font-medium rounded-xl text-slate-700 bg-white hover:bg-slate-50 transition-colors"
          >
            <svg
              className="mr-2 -ml-1 h-5 w-5 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Return to Inventory Menu
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function InventoryHome() {
  return (
    <Routes>
      <Route index element={<InventoryHomeIndex />} />
      <Route path="stock-ops" element={<StockUpdationAndVerificationPage />} />
      <Route
        path="dashboard"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(() => import("./InventoryDashboardPage.jsx")),
            )}
          </React.Suspense>
        }
      />
      <Route
        path="material-requisitions"
        element={<MaterialRequisitionList />}
      />
      <Route
        path="material-requisitions/:id"
        element={<MaterialRequisitionForm />}
      />
      <Route path="stock-updation" element={<StockUpdationList />} />
      <Route path="stock-verification" element={<StockVerificationList />} />
      <Route path="stock-updation/:id" element={<StockUpdationForm />} />
      <Route
        path="stock-verification/:id"
        element={<StockVerificationForm />}
      />
      <Route path="return-to-stores" element={<ReturnToStoresList />} />
      <Route path="return-to-stores/new" element={<ReturnToStoresForm />} />
      <Route path="return-to-stores/:id" element={<ReturnToStoresForm />} />
      <Route path="stock-adjustments" element={<StockAdjustmentList />} />
      <Route path="stock-adjustments/new" element={<StockAdjustmentForm />} />
      <Route path="stock-adjustments/:id" element={<StockAdjustmentForm />} />
      <Route path="issue-to-requirement" element={<IssueToRequirementList />} />
      <Route
        path="issue-to-requirement/new"
        element={<IssueToRequirementForm />}
      />
      <Route
        path="issue-to-requirement/:id"
        element={<IssueToRequirementForm />}
      />
      <Route path="stock-transfers" element={<StockTransferList />} />
      <Route path="stock-transfers/:id" element={<StockTransferForm />} />
      <Route path="transfer-acceptance" element={<TransferAcceptanceList />} />
      <Route
        path="transfer-acceptance/:id"
        element={<TransferAcceptanceForm />}
      />
      <Route path="stock-reorder" element={<StockReorderPage />} />
      <Route path="stock-upload" element={<StockUploadPage />} />
      <Route path="alerts/low-stock" element={<LowStockNotificationsPage />} />
      <Route path="stock-take" element={<StockTakeList />} />
      <Route path="stock-take/:id" element={<StockTakeForm />} />
      <Route path="grn-local" element={<GRNLocalList />} />
      <Route path="grn-local/:id" element={<GRNLocalForm />} />
      <Route path="grn-import" element={<GRNImportList />} />
      <Route path="grn-import/:id" element={<GRNImportForm />} />
      {/* Sales Return and Purchase Return routes removed from Inventory */}
      <Route path="batches" element={<ItemBatchesList />} />
      <Route path="items" element={<ItemsList />} />

      <Route path="items/:id" element={<ItemForm />} />
      <Route path="item-groups" element={<ItemGroupsList />} />
      <Route path="item-groups/:id" element={<ItemGroupForm />} />
      <Route path="unit-conversions" element={<UnitConversionsList />} />
      <Route path="unit-conversions/:id" element={<UnitConversionForm />} />
      <Route path="warehouses" element={<WarehousesList />} />
      <Route path="warehouses/:id" element={<WarehouseForm />} />

      <Route
        path="reports/health-monitor"
        element={<InventoryHealthMonitorPage />}
      />
      <Route
        path="reports/periodical-stock-summary"
        element={<PeriodicalStockSummaryPage />}
      />
      <Route
        path="reports/periodical-stock-statement"
        element={<PeriodicalStockStatementPage />}
      />
      <Route
        path="reports/issue-register"
        element={<IssueRegisterReportPage />}
      />
      <Route
        path="reports/stock-transfer-register"
        element={<StockTransferRegisterReportPage />}
      />
      <Route
        path="reports/stock-balances"
        element={<StockBalancesReportPage />}
      />
      <Route
        path="reports/stock-adjustments"
        element={<StockAdjustmentReportPage />}
      />
      <Route
        path="reports/material-returns"
        element={<MaterialReturnReportPage />}
      />
      <Route
        path="reports/stock-verification"
        element={<StockVerificationReportPage />}
      />
      <Route
        path="reports/stock-aging-analysis"
        element={<StockAgingAnalysisReportPage />}
      />
      <Route path="reports/slow-moving" element={<SlowMovingReportPage />} />
      <Route path="reports/fast-moving" element={<FastMovingReportPage />} />
      <Route path="reports/non-moving" element={<NonMovingReportPage />} />
      <Route path="*" element={<Navigate to="/inventory" replace />} />
    </Routes>
  );
}

export const inventoryFeatures = [
  {
    module_key: "inventory",
    label: "Material Requisition",
    path: "/inventory/material-requisitions",
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Stock Upload",
    path: "/inventory/stock-upload",
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Stock Updation",
    path: "/inventory/stock-updation",
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Stock Verification",
    path: "/inventory/stock-verification",
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Stock Updation & Verification",
    path: "/inventory/stock-ops",
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Return to Stores Advice",
    path: "/inventory/return-to-stores",
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Stock Adjustment",
    path: "/inventory/stock-adjustments",
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Issue to Requirement Area",
    path: "/inventory/issue-to-requirement",
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Warehouse Stock Transfer",
    path: "/inventory/stock-transfers",
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Transfer Acceptance",
    path: "/inventory/transfer-acceptance",
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Stock Reorder",
    path: "/inventory/stock-reorder",
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Daily Stock Take",
    path: "/inventory/stock-take",
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Material Receipt (GRN) - Local",
    path: "/inventory/grn-local",
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Material Receipt (GRN) - Import",
    path: "/inventory/grn-import",
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Items Setup",
    path: "/inventory/items",
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Item Groups & Sub Groups",
    path: "/inventory/item-groups",
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Unit Conversion",
    path: "/inventory/unit-conversions",
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Warehouse Setup",
    path: "/inventory/warehouses",
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Item Batches",
    path: "/inventory/batches",
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Health Monitor",
    path: "/inventory/reports/health-monitor",
    type: "dashboard",
  },
  {
    module_key: "inventory",
    label: "Stock Summary",
    path: "/inventory/reports/periodical-stock-summary",
    type: "dashboard",
  },
  {
    module_key: "inventory",
    label: "Stock Statement",
    path: "/inventory/reports/periodical-stock-statement",
    type: "dashboard",
  },
  {
    module_key: "inventory",
    label: "Issue Register",
    path: "/inventory/reports/issue-register",
    type: "dashboard",
  },
  {
    module_key: "inventory",
    label: "Stock Transfer Register",
    path: "/inventory/reports/stock-transfer-register",
    type: "dashboard",
  },
  {
    module_key: "inventory",
    label: "Stock Verification",
    path: "/inventory/reports/stock-verification",
    type: "dashboard",
  },
  {
    module_key: "inventory",
    label: "Stock Aging Analysis",
    path: "/inventory/reports/stock-aging-analysis",
    type: "dashboard",
  },
  {
    module_key: "inventory",
    label: "Slow Moving Items",
    path: "/inventory/reports/slow-moving",
    type: "dashboard",
  },
  {
    module_key: "inventory",
    label: "Fast Moving Items",
    path: "/inventory/reports/fast-moving",
    type: "dashboard",
  },
  {
    module_key: "inventory",
    label: "Non Moving Items",
    path: "/inventory/reports/non-moving",
    type: "dashboard",
  },
];
