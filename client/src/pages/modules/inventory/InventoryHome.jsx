import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

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
import SalesReturnList from "../sales/returns/SalesReturnList.jsx";
import SalesReturnForm from "../sales/returns/SalesReturnForm.jsx";
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
import LowStockNotificationsPage from "./LowStockNotificationsPage.jsx";
import PurchaseReturnList from "./purchase-returns/PurchaseReturnList.jsx";
import PurchaseReturnForm from "./purchase-returns/PurchaseReturnForm.jsx";

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
    {
      title: "Returns",
      features: [
        {
          name: "Sales Return",
          path: "/inventory/sales-returns",
          description: "Process customer returns",
          icon: "↩",
        },
        {
          name: "Purchase Return",
          path: "/inventory/purchase-returns",
          description: "Return goods to suppliers",
          icon: "↩",
        },
      ],
    },
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
      ],
    },
    {
      title: "Reports",
      features: [
        {
          name: "Inventory Reports",
          path: "/inventory/reports",
          description: "Stock reports and analytics",
          icon: "📊",
        },
        {
          name: "Health Monitor",
          path: "/inventory/reports/health-monitor",
          description: "Low stock and coverage analysis",
          icon: "🩺",
        },
        {
          name: "Periodical Stock Summary",
          path: "/inventory/reports/periodical-stock-summary",
          description: "Summary of movements by period",
          icon: "🗓️",
        },
        {
          name: "Periodical Stock Statement",
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
      sections={sections}
      features={inventoryFeatures}
    />
  );
}

export default function InventoryHome() {
  return (
    <Routes>
      <Route index element={<InventoryHomeIndex />} />
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
      <Route path="sales-returns" element={<SalesReturnList />} />
      <Route path="sales-returns/new" element={<SalesReturnForm />} />
      <Route path="purchase-returns" element={<PurchaseReturnList />} />
      <Route path="purchase-returns/new" element={<PurchaseReturnForm />} />
      <Route path="items" element={<ItemsList />} />
      <Route path="items/:id" element={<ItemForm />} />
      <Route path="item-groups" element={<ItemGroupsList />} />
      <Route path="item-groups/:id" element={<ItemGroupForm />} />
      <Route path="unit-conversions" element={<UnitConversionsList />} />
      <Route path="unit-conversions/:id" element={<UnitConversionForm />} />
      <Route path="warehouses" element={<WarehousesList />} />
      <Route path="warehouses/:id" element={<WarehouseForm />} />
      <Route
        path="reports"
        element={
          <InventoryFeaturePage
            title="Inventory Reports"
            description="Stock reports and analytics"
          />
        }
      />
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
  { module_key: "inventory", label: "Material Requisition", path: "/inventory/material-requisitions", type: "feature" },
  { module_key: "inventory", label: "Stock Upload", path: "/inventory/stock-upload", type: "feature" },
  { module_key: "inventory", label: "Stock Updation", path: "/inventory/stock-updation", type: "feature" },
  { module_key: "inventory", label: "Stock Verification", path: "/inventory/stock-verification", type: "feature" },
  { module_key: "inventory", label: "Return to Stores Advice", path: "/inventory/return-to-stores", type: "feature" },
  { module_key: "inventory", label: "Stock Adjustment", path: "/inventory/stock-adjustments", type: "feature" },
  { module_key: "inventory", label: "Issue to Requirement Area", path: "/inventory/issue-to-requirement", type: "feature" },
  { module_key: "inventory", label: "Warehouse Stock Transfer", path: "/inventory/stock-transfers", type: "feature" },
  { module_key: "inventory", label: "Transfer Acceptance", path: "/inventory/transfer-acceptance", type: "feature" },
  { module_key: "inventory", label: "Stock Reorder", path: "/inventory/stock-reorder", type: "feature" },
  { module_key: "inventory", label: "Daily Stock Take", path: "/inventory/stock-take", type: "feature" },
  { module_key: "inventory", label: "Material Receipt (GRN) - Local", path: "/inventory/grn-local", type: "feature" },
  { module_key: "inventory", label: "Material Receipt (GRN) - Import", path: "/inventory/grn-import", type: "feature" },
  { module_key: "inventory", label: "Sales Return", path: "/inventory/sales-returns", type: "feature" },
  { module_key: "inventory", label: "Purchase Return", path: "/inventory/purchase-returns", type: "feature" },
  { module_key: "inventory", label: "Items Setup", path: "/inventory/items", type: "feature" },
  { module_key: "inventory", label: "Item Groups & Sub Groups", path: "/inventory/item-groups", type: "feature" },
  { module_key: "inventory", label: "Unit Conversion", path: "/inventory/unit-conversions", type: "feature" },
  { module_key: "inventory", label: "Warehouse Setup", path: "/inventory/warehouses", type: "feature" },
  { module_key: "inventory", label: "Inventory Reports", path: "/inventory/reports", type: "dashboard" },
  { module_key: "inventory", label: "Health Monitor", path: "/inventory/reports/health-monitor", type: "dashboard" },
  { module_key: "inventory", label: "Periodical Stock Summary", path: "/inventory/reports/periodical-stock-summary", type: "dashboard" },
  { module_key: "inventory", label: "Periodical Stock Statement", path: "/inventory/reports/periodical-stock-statement", type: "dashboard" },
  { module_key: "inventory", label: "Issue Register", path: "/inventory/reports/issue-register", type: "dashboard" },
  { module_key: "inventory", label: "Stock Transfer Register", path: "/inventory/reports/stock-transfer-register", type: "dashboard" },
  { module_key: "inventory", label: "Stock Verification", path: "/inventory/reports/stock-verification", type: "dashboard" },
  { module_key: "inventory", label: "Stock Aging Analysis", path: "/inventory/reports/stock-aging-analysis", type: "dashboard" },
  { module_key: "inventory", label: "Slow Moving Items", path: "/inventory/reports/slow-moving", type: "dashboard" },
  { module_key: "inventory", label: "Fast Moving Items", path: "/inventory/reports/fast-moving", type: "dashboard" },
  { module_key: "inventory", label: "Non Moving Items", path: "/inventory/reports/non-moving", type: "dashboard" },
];
