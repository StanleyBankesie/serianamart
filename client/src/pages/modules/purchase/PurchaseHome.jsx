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
import ServiceBillsList from "../service-management/service-bills/ServiceBillsList.jsx";
import ServiceBillForm from "../service-management/service-bills/ServiceBillForm.jsx";
import ServiceConfirmationsList from "../service-management/service-confirmations/ServiceConfirmationsList.jsx";
import ServiceConfirmationForm from "../service-management/service-confirmations/ServiceConfirmationForm.jsx";
import DirectPurchase from "./direct-purchase/DirectPurchase.jsx";
import DirectPurchaseList from "./direct-purchase/DirectPurchaseList.jsx";

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
      icon: "🧾",
      value: loading ? "..." : fmt(overview?.totalPurchases || 0),
      label: "Total Purchases",
      change: loading
        ? ""
        : `${Number(overview?.totalPurchaseOrders || 0)} orders`,
      path: "/purchase/reports",
    },
    {
      icon: "📦",
      value: loading ? "..." : String(overview?.activePurchaseOrders ?? 0),
      label: "Active Purchase Orders",
      path: "/purchase/purchase-orders-local",
    },
    {
      icon: "🏭",
      value: loading ? "..." : String(overview?.activeSuppliers ?? 0),
      label: "Active Suppliers",
      path: "/purchase/suppliers",
    },
    {
      icon: "⏳",
      value: loading ? "..." : String(overview?.pendingApprovals ?? 0),
      label: "Pending Approvals",
      path: "/administration/workflows/approvals",
    },
    {
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
          title: "Purchase Reports",
          description: "View purchase analytics and reports",
          path: "/purchase/reports",
          icon: "📈",
          module_key: "purchase",
          feature_key: "reports",
        },
      ],
    },
    {
      title: "Dashboards",
      items: [
        {
          title: "Procurement Overview",
          description: "Key procurement KPIs and summaries",
          path: "/purchase/procurement-overview",
          icon: "📊",
          module_key: "purchase",
          feature_key: "procurement-overview",
        },
        {
          title: "Supplier Analytics",
          description: "Supplier performance and trend analysis",
          path: "/purchase/supplier-analytics",
          icon: "📈",
          module_key: "purchase",
          feature_key: "supplier-analytics",
        },
      ],
    },
  ];

  return (
    <ModuleDashboard
      title="🛒 Purchase"
      description="Purchase management and procurement workflows"
      stats={stats}
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
        path="reports"
        element={
          <PurchaseFeaturePage
            title="Purchase Reports"
            description="View purchase analytics and reports"
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
