import React, { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ModuleDashboard from "../../../components/ModuleDashboard";
import api from "../../../api/client.js";
import { useAuth } from "../../../auth/AuthContext.jsx";

import RequestForQuotationList from "./rfq/RequestForQuotationList.jsx";
import RequestForQuotationForm from "./rfq/RequestForQuotationForm.jsx";
import SupplierQuotationsList from "./supplier-quotations/SupplierQuotationsList.jsx";
import SupplierQuotationForm from "./supplier-quotations/SupplierQuotationForm.jsx";
import QuotationAnalysis from "./quotation-analysis/QuotationAnalysis.jsx";
import PurchaseOrdersLocalList from "./purchase-orders-local/PurchaseOrdersLocalList.jsx";
import PurchaseOrdersLocalForm from "./purchase-orders-local/PurchaseOrdersLocalForm.jsx";
import PurchaseOrdersImportList from "./purchase-orders-import/PurchaseOrdersImportList.jsx";
import PurchaseOrdersImportForm from "./purchase-orders-import/PurchaseOrdersImportForm.jsx";
import ShippingAdviceList from "./shipping-advice/ShippingAdviceList.jsx";
import ShippingAdviceForm from "./shipping-advice/ShippingAdviceForm.jsx";
import PortClearancesList from "./port-clearances/PortClearancesList.jsx";
import PortClearancesForm from "./port-clearances/PortClearancesForm.jsx";
import PurchaseBillsList from "./purchase-bills/PurchaseBillsList.jsx";
import PurchaseBillsForm from "./purchase-bills/PurchaseBillsForm.jsx";
import SuppliersList from "./suppliers/SuppliersList.jsx";
import SupplierForm from "./suppliers/SupplierForm.jsx";
import ImportOrderTrackingReportPage from "./reports/ImportOrderTrackingReportPage.jsx";
import LocalOrderTrackingReportPage from "./reports/LocalOrderTrackingReportPage.jsx";
import PurchaseTrackingReportPage from "./reports/PurchaseTrackingReportPage.jsx";
import SupplierQuotationAnalysisReportPage from "./reports/SupplierQuotationAnalysisReportPage.jsx";
import PendingGrnToBillLocalReportPage from "./reports/PendingGrnToBillLocalReportPage.jsx";
import PendingGrnToBillImportReportPage from "./reports/PendingGrnToBillImportReportPage.jsx";
import ImportOrderListReportPage from "./reports/ImportOrderListReportPage.jsx";
import PendingShipmentDetailsReportPage from "./reports/PendingShipmentDetailsReportPage.jsx";
import PurchaseRegisterReportPage from "./reports/PurchaseRegisterReportPage.jsx";
import ServiceBillsList from "../service-management/service-bills/ServiceBillsList.jsx";
import ServiceBillForm from "../service-management/service-bills/ServiceBillForm.jsx";
import ServiceConfirmationsList from "../service-management/service-confirmations/ServiceConfirmationsList.jsx";
import ServiceConfirmationForm from "../service-management/service-confirmations/ServiceConfirmationForm.jsx";
import DirectPurchase from "./direct-purchase/DirectPurchase.jsx";
import DirectPurchaseList from "./direct-purchase/DirectPurchaseList.jsx";
import PurchaseReturnList from "../inventory/purchase-returns/PurchaseReturnList.jsx";
import PurchaseReturnForm from "../inventory/purchase-returns/PurchaseReturnForm.jsx";

function PurchaseFeaturePage({ title, description }) {
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

function PurchaseHomeIndex() {
  const { token } = useAuth();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get("/purchase/analytics/overview")
      .then((res) => {
        if (cancelled) return;
        setOverview(res.data || null);
      })
      .catch(() => {
        if (cancelled) return;
        setOverview(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const fmt = (n) =>
    `GH₵${Number(n || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const stats = [
    {
      rbac_key: "total-purchases",
      icon: "🧾",
      value: loading ? "..." : fmt(overview?.totalPurchases || 0),
      label: "Total Purchases",
      change: loading
        ? ""
        : `${Number(overview?.totalPurchaseOrders || 0)} orders`,
      path: "/purchase/reports",
    },
    {
      rbac_key: "active-purchase-orders",
      icon: "📦",
      value: loading ? "..." : String(overview?.activePurchaseOrders ?? 0),
      label: "Active Purchase Orders",
      path: "/purchase/purchase-orders-local",
    },
    {
      rbac_key: "active-suppliers",
      icon: "🏭",
      value: loading ? "..." : String(overview?.activeSuppliers ?? 0),
      label: "Active Suppliers",
      path: "/purchase/suppliers",
    },
    {
      rbac_key: "pending-approvals",
      icon: "⏳",
      value: loading ? "..." : String(overview?.pendingApprovals ?? 0),
      label: "Pending Approvals",
      path: "/administration/workflows/approvals",
    },
    {
      rbac_key: "outstanding-payables",
      icon: "💳",
      value: loading ? "..." : fmt(overview?.outstandingPayables || 0),
      label: "Outstanding Payables",
      path: "/purchase/purchase-bills-local",
    },
  ];

  const sections = [
    {
      title: "Quick Purchase",
      items: [
        {
          title: "Direct Purchase",
          description: "Create quick single-step purchases",
          path: "/purchase/direct-purchase",
          icon: "⚡",
        },
      ],
    },
    {
      title: "Procurement",
      items: [
        {
          title: "Request for Quotation",
          description: "Create and manage RFQs",
          path: "/purchase/rfqs",
          icon: "📝",
        },
        {
          title: "Supplier Quotations",
          description: "Capture and compare supplier quotations",
          path: "/purchase/supplier-quotations",
          icon: "📨",
        },
        {
          title: "Quotation Analysis",
          description: "Analyze quotation options and decisions",
          path: "/purchase/quotation-analysis",
          icon: "📊",
        },
      ],
    },
    {
      title: "Purchase Orders",
      items: [
        {
          title: "Local Purchase Orders",
          description: "Manage local POs",
          path: "/purchase/purchase-orders-local",
          icon: "📦",
        },
        {
          title: "Import Purchase Orders",
          description: "Manage import POs",
          path: "/purchase/purchase-orders-import",
          icon: "🚢",
        },
      ],
    },
    {
      title: "Logistics",
      items: [
        {
          title: "Shipping Advice",
          description: "Manage shipping advice documents",
          path: "/purchase/shipping-advice",
          icon: "🚚",
        },
        {
          title: "Port Clearances",
          description: "Track port clearance records",
          path: "/purchase/port-clearances",
          icon: "🛃",
        },
      ],
    },
    {
      title: "Billing",
      items: [
        {
          title: "Local Purchase Bills",
          description: "Create and manage local purchase bills",
          path: "/purchase/purchase-bills-local",
          icon: "🧾",
        },
        {
          title: "Import Purchase Bills",
          description: "Create and manage import purchase bills",
          path: "/purchase/purchase-bills-import",
          icon: "🧾",
        },
      ],
    },
    {
      title: "Master Data",
      items: [
        {
          title: "Suppliers",
          description: "Manage suppliers and contacts",
          path: "/purchase/suppliers",
          icon: "🏭",
        },
      ],
    },
    {
      title: "Reports",
      items: [
        {
          title: "Supplier Quotation Analysis",
          description: "Compare supplier quotations for RFQs",
          path: "/purchase/reports/supplier-quotation-analysis",
          icon: "📑",
        },
        {
          title: "Import Purchase Order Tracking",
          description: "Monitor import purchase orders",
          path: "/purchase/reports/import-order-tracking",
          icon: "🚢",
        },
        {
          title: "Local Purchase Order Tracking",
          description: "Monitor local purchase orders",
          path: "/purchase/reports/local-order-tracking",
          icon: "📦",
        },
        {
          title: "Pending GRN → Purchase Bill (Local)",
          description: "Local goods receipts pending to bill",
          path: "/purchase/reports/pending-grn-to-bill-local",
          icon: "⏳",
        },
        {
          title: "Pending GRN → Purchase Bill (Import)",
          description: "Import goods receipts pending to bill",
          path: "/purchase/reports/pending-grn-to-bill-import",
          icon: "⏳",
        },
        {
          title: "Import Order List",
          description: "List of import purchase orders",
          path: "/purchase/reports/import-order-list",
          icon: "📋",
        },
        {
          title: "Pending Shipment Details",
          description: "Outstanding shipments and ETAs",
          path: "/purchase/reports/pending-shipments",
          icon: "🚚",
        },
        {
          title: "Purchase Register",
          description: "Posted purchase bills summary",
          path: "/purchase/reports/purchase-register",
          icon: "📒",
        },
        {
          title: "Department Purchase Analysis",
          description: "Spending by department",
          path: "/purchase/reports/department-analysis",
          icon: "🏷️",
        },
        {
          title: "Import Cost Breakdown",
          description: "Landed cost transparency",
          path: "/purchase/reports/import-cost-breakdown",
          icon: "🧮",
        },
        {
          title: "Lead Time Analysis",
          description: "Procurement efficiency",
          path: "/purchase/reports/lead-time-analysis",
          icon: "⏱️",
        },
        {
          title: "Cancelled / Rejected POs",
          description: "Procurement wastage",
          path: "/purchase/reports/cancelled-pos",
          icon: "🛑",
        },
        {
          title: "Purchase Returns Analysis",
          description: "Quality issues analysis",
          path: "/purchase/reports/purchase-returns-analysis",
          icon: "↩️",
        },
        {
          title: "Item Purchase History",
          description: "Procurement per item",
          path: "/purchase/reports/item-purchase-history",
          icon: "📦",
        },
        {
          title: "Price Variance",
          description: "Detect price fluctuations",
          path: "/purchase/reports/price-variance",
          icon: "💹",
        },
        {
          title: "Supplier Performance",
          description: "Evaluate supplier reliability",
          path: "/purchase/reports/supplier-performance",
          icon: "🏭",
        },
        {
          title: "Supplier Outstanding Payables",
          description: "Accounts payable control",
          path: "/purchase/reports/supplier-outstanding-payables",
          icon: "💳",
        },
        {
          title: "Purchase Aging",
          description: "Overdue purchase bills",
          path: "/purchase/reports/purchase-aging",
          icon: "📈",
        },
      ],
    },
  ];

  return (
    <ModuleDashboard
      title="🛒 Purchase"
      description="Purchase management and procurement workflows"
      stats={stats}
      headerActions={[]}
      sections={sections}
      features={purchaseFeatures}
    />
  );
}

export default function PurchaseHome() {
  return (
    <Routes>
      <Route index element={<PurchaseHomeIndex />} />
      <Route path="rfqs" element={<RequestForQuotationList />} />
      <Route path="rfqs/new" element={<RequestForQuotationForm />} />
      <Route path="rfqs/:id" element={<RequestForQuotationForm />} />
      <Route path="rfqs/:id/edit" element={<RequestForQuotationForm />} />
      <Route path="supplier-quotations" element={<SupplierQuotationsList />} />
      <Route
        path="supplier-quotations/new"
        element={<SupplierQuotationForm />}
      />
      <Route
        path="supplier-quotations/:id"
        element={<SupplierQuotationForm />}
      />
      <Route
        path="supplier-quotations/:id/edit"
        element={<SupplierQuotationForm />}
      />
      <Route path="quotation-analysis" element={<QuotationAnalysis />} />
      <Route
        path="purchase-orders-local"
        element={<PurchaseOrdersLocalList />}
      />
      <Route
        path="purchase-orders-local/new"
        element={<PurchaseOrdersLocalForm />}
      />
      <Route
        path="purchase-orders-local/:id"
        element={<PurchaseOrdersLocalForm />}
      />
      <Route
        path="purchase-orders-local/:id/edit"
        element={<PurchaseOrdersLocalForm />}
      />
      <Route
        path="purchase-orders-import"
        element={<PurchaseOrdersImportList />}
      />
      <Route
        path="purchase-orders-import/new"
        element={<PurchaseOrdersImportForm />}
      />
      <Route
        path="purchase-orders-import/:id"
        element={<PurchaseOrdersImportForm />}
      />
      <Route
        path="purchase-orders-import/:id/edit"
        element={<PurchaseOrdersImportForm />}
      />

      <Route path="shipping-advice" element={<ShippingAdviceList />} />
      <Route path="shipping-advice/new" element={<ShippingAdviceForm />} />
      <Route path="shipping-advice/:id" element={<ShippingAdviceForm />} />

      <Route path="port-clearances" element={<PortClearancesList />} />
      <Route path="port-clearances/new" element={<PortClearancesForm />} />
      <Route path="port-clearances/:id" element={<PortClearancesForm />} />

      <Route path="purchase-bills-local" element={<PurchaseBillsList />} />
      <Route path="purchase-bills-local/new" element={<PurchaseBillsForm />} />
      <Route path="purchase-bills-local/:id" element={<PurchaseBillsForm />} />

      <Route path="purchase-bills-import" element={<PurchaseBillsList />} />
      <Route path="purchase-bills-import/new" element={<PurchaseBillsForm />} />
      <Route path="purchase-bills-import/:id" element={<PurchaseBillsForm />} />
      <Route path="direct-purchase" element={<DirectPurchaseList />} />
      <Route path="direct-purchase/new" element={<DirectPurchase />} />
      <Route path="direct-purchase/:id" element={<DirectPurchase />} />
      <Route path="direct-purchase/:id/edit" element={<DirectPurchase />} />
      <Route
        path="direct-purchases"
        element={<Navigate to="/purchase/direct-purchase" replace />}
      />
      <Route path="service-bills" element={<ServiceBillsList />} />
      <Route path="service-bills/new" element={<ServiceBillForm />} />
      <Route path="service-bills/:id" element={<ServiceBillForm />} />
      <Route path="service-bills/:id/edit" element={<ServiceBillForm />} />
      <Route
        path="service-confirmation"
        element={<ServiceConfirmationsList />}
      />
      <Route
        path="service-confirmation/new"
        element={<ServiceConfirmationForm />}
      />
      <Route
        path="service-confirmation/:id"
        element={<ServiceConfirmationForm />}
      />
      <Route path="suppliers" element={<SuppliersList />} />
      <Route path="suppliers/new" element={<SupplierForm />} />
      <Route path="suppliers/:id" element={<SupplierForm />} />
      <Route
        path="suppliers/mass-upload"
        element={
          <PurchaseFeaturePage
            title="Mass Suppliers Upload"
            description="Import suppliers in bulk from file"
          />
        }
      />
      <Route
        path="reports/import-order-tracking"
        element={<ImportOrderTrackingReportPage />}
      />
      <Route
        path="reports/local-order-tracking"
        element={<LocalOrderTrackingReportPage />}
      />
      <Route
        path="reports/purchase-tracking"
        element={<PurchaseTrackingReportPage />}
      />
      <Route
        path="reports/supplier-quotation-analysis"
        element={<SupplierQuotationAnalysisReportPage />}
      />
      <Route
        path="reports/pending-grn-to-bill-local"
        element={<PendingGrnToBillLocalReportPage />}
      />
      <Route
        path="reports/pending-grn-to-bill-import"
        element={<PendingGrnToBillImportReportPage />}
      />
      <Route
        path="reports/import-order-list"
        element={<ImportOrderListReportPage />}
      />
      <Route
        path="reports/pending-shipments"
        element={<PendingShipmentDetailsReportPage />}
      />
      <Route
        path="reports/purchase-register"
        element={<PurchaseRegisterReportPage />}
      />
      <Route
        path="reports/department-analysis"
        element={React.createElement(
          React.lazy(
            () => import("./reports/DepartmentPurchaseAnalysisReportPage.jsx"),
          ),
        )}
      />
      <Route
        path="reports/import-cost-breakdown"
        element={React.createElement(
          React.lazy(
            () => import("./reports/ImportCostBreakdownReportPage.jsx"),
          ),
        )}
      />
      <Route
        path="reports/lead-time-analysis"
        element={React.createElement(
          React.lazy(() => import("./reports/LeadTimeAnalysisReportPage.jsx")),
        )}
      />
      <Route
        path="reports/cancelled-pos"
        element={React.createElement(
          React.lazy(
            () => import("./reports/CancelledPurchaseOrdersReportPage.jsx"),
          ),
        )}
      />
      <Route
        path="reports/purchase-returns-analysis"
        element={React.createElement(
          React.lazy(
            () => import("./reports/PurchaseReturnsAnalysisReportPage.jsx"),
          ),
        )}
      />
      <Route
        path="reports/item-purchase-history"
        element={React.createElement(
          React.lazy(
            () => import("./reports/ItemPurchaseHistoryReportPage.jsx"),
          ),
        )}
      />
      <Route
        path="reports/price-variance"
        element={React.createElement(
          React.lazy(() => import("./reports/PriceVarianceReportPage.jsx")),
        )}
      />
      <Route
        path="reports/supplier-performance"
        element={React.createElement(
          React.lazy(
            () => import("./reports/SupplierPerformanceReportPage.jsx"),
          ),
        )}
      />
      <Route
        path="reports/supplier-outstanding-payables"
        element={React.createElement(
          React.lazy(
            () => import("./reports/SupplierOutstandingPayablesReportPage.jsx"),
          ),
        )}
      />
      <Route
        path="reports/purchase-aging"
        element={React.createElement(
          React.lazy(() => import("./reports/PurchaseAgingReportPage.jsx")),
        )}
      />
      <Route
        path="dashboard"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(() => import("./PurchaseDashboardPage.jsx")),
            )}
          </React.Suspense>
        }
      />
      <Route path="purchase-returns" element={<PurchaseReturnList />} />
      <Route path="purchase-returns/new" element={<PurchaseReturnForm />} />
      <Route
        path="procurement-overview"
        element={
          <PurchaseFeaturePage
            title="Procurement Overview"
            description="Procurement overview dashboard"
          />
        }
      />
      <Route
        path="supplier-analytics"
        element={
          <PurchaseFeaturePage
            title="Supplier Analytics"
            description="Supplier analytics dashboard"
          />
        }
      />
      <Route path="*" element={<Navigate to="/purchase" replace />} />
    </Routes>
  );
}

export const purchaseFeatures = [
  {
    module_key: "purchase",
    label: "Purchase Returns",
    path: "/purchase/purchase-returns",
    type: "feature",
    icon: "↩",
  },
  {
    module_key: "purchase",
    label: "Direct Purchase",
    path: "/purchase/direct-purchase",
    type: "feature",
    icon: "⚡",
  },
  {
    module_key: "purchase",
    label: "Request for Quotation",
    path: "/purchase/rfqs",
    type: "feature",
    icon: "📝",
  },
  {
    module_key: "purchase",
    label: "Supplier Quotations",
    path: "/purchase/supplier-quotations",
    type: "feature",
    icon: "📨",
  },
  {
    module_key: "purchase",
    label: "Quotation Analysis",
    path: "/purchase/quotation-analysis",
    type: "feature",
    icon: "📊",
  },
  {
    module_key: "purchase",
    label: "Local Purchase Orders",
    path: "/purchase/purchase-orders-local",
    type: "feature",
    icon: "📦",
  },
  {
    module_key: "purchase",
    label: "Import Purchase Orders",
    path: "/purchase/purchase-orders-import",
    type: "feature",
    icon: "🚢",
  },
  {
    module_key: "purchase",
    label: "Shipping Advice",
    path: "/purchase/shipping-advice",
    type: "feature",
    icon: "🚚",
  },
  {
    module_key: "purchase",
    label: "Port Clearances",
    path: "/purchase/port-clearances",
    type: "feature",
    icon: "🛃",
  },
  {
    module_key: "purchase",
    label: "Local Purchase Bills",
    path: "/purchase/purchase-bills-local",
    type: "feature",
    icon: "🧾",
  },
  {
    module_key: "purchase",
    label: "Import Purchase Bills",
    path: "/purchase/purchase-bills-import",
    type: "feature",
    icon: "🧾",
  },
  {
    module_key: "purchase",
    label: "Suppliers",
    path: "/purchase/suppliers",
    type: "feature",
    icon: "🏭",
  },
  {
    module_key: "purchase",
    label: "Purchase Reports",
    path: "/purchase/reports",
    type: "feature",
    icon: "📈",
  },
  {
    module_key: "purchase",
    label: "Procurement Overview",
    path: "/purchase/procurement-overview",
    type: "dashboard",
    icon: "📊",
  },
  {
    module_key: "purchase",
    label: "Supplier Analytics",
    path: "/purchase/supplier-analytics",
    type: "dashboard",
    icon: "📈",
  },
];
