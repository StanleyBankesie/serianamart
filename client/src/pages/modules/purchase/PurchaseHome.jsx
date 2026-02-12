import React from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import ModuleDashboard from "../../../components/ModuleDashboard";
import { api } from "../../../api/client.js";

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
import ServiceBillForm from "../service-management/service-bills/ServiceBillForm.jsx";
import ServiceConfirmationsList from "../service-management/service-confirmations/ServiceConfirmationsList.jsx";
import ServiceConfirmationForm from "../service-management/service-confirmations/ServiceConfirmationForm.jsx";

const purchaseMenuItems = [
  {
    title: "Request for Quotation",
    description: "Create and send RFQs to suppliers",
    path: "/purchase/rfqs",
    icon: "📨",
    actions: [
      {
        label: "View RFQs",
        path: "/purchase/rfqs",
        type: "outline",
      },
      {
        label: "New RFQ",
        path: "/purchase/rfqs/new",
        type: "primary",
      },
    ],
  },
  {
    title: "Supplier Quotations",
    description: "Receive and manage supplier quotations",
    path: "/purchase/supplier-quotations",
    icon: "📋",
    actions: [
      {
        label: "View List",
        path: "/purchase/supplier-quotations",
        type: "outline",
      },
      {
        label: "New Quote",
        path: "/purchase/supplier-quotations/new",
        type: "primary",
      },
    ],
  },
  {
    title: "Quotation Analysis",
    description: "Compare quotations from multiple suppliers",
    path: "/purchase/quotation-analysis",
    icon: "📊",
    actions: [
      {
        label: "Analyze",
        path: "/purchase/quotation-analysis",
        type: "primary",
      },
    ],
  },
  {
    title: "Purchase Order - Local",
    description: "Create and manage local purchase orders",
    path: "/purchase/purchase-orders-local",
    icon: "📝",
    actions: [
      {
        label: "View Orders",
        path: "/purchase/purchase-orders-local",
        type: "outline",
      },
      {
        label: "Create PO",
        path: "/purchase/purchase-orders-local/new",
        type: "primary",
      },
    ],
  },
  {
    title: "Purchase Order - Import",
    description: "Create and manage import purchase orders",
    path: "/purchase/purchase-orders-import",
    icon: "🌍",
    actions: [
      {
        label: "View Orders",
        path: "/purchase/purchase-orders-import",
        type: "outline",
      },
      {
        label: "Create PO",
        path: "/purchase/purchase-orders-import/new",
        type: "primary",
      },
    ],
  },
  {
    title: "Shipping Advice",
    description: "Track shipments and vessel information",
    path: "/purchase/shipping-advice",
    icon: "🚢",
    actions: [
      {
        label: "View List",
        path: "/purchase/shipping-advice",
        type: "outline",
      },
      {
        label: "New Advice",
        path: "/purchase/shipping-advice/new",
        type: "primary",
      },
    ],
  },
  {
    title: "Clearing at Port",
    description: "Manage customs and port clearances",
    path: "/purchase/port-clearances",
    icon: "🏢",
    actions: [
      {
        label: "View List",
        path: "/purchase/port-clearances",
        type: "outline",
      },
      {
        label: "New Clearance",
        path: "/purchase/port-clearances/new",
        type: "primary",
      },
    ],
  },
  {
    title: "Purchase Bill - Local",
    description: "Record and manage local supplier bills",
    path: "/purchase/purchase-bills-local",
    icon: "🧾",
    actions: [
      {
        label: "View Bills",
        path: "/purchase/purchase-bills-local",
        type: "outline",
      },
      {
        label: "Record Bill",
        path: "/purchase/purchase-bills-local/new",
        type: "primary",
      },
    ],
  },
  {
    title: "Purchase Bill - Import",
    description: "Record and manage import supplier bills",
    path: "/purchase/purchase-bills-import",
    icon: "📄",
    actions: [
      {
        label: "View Bills",
        path: "/purchase/purchase-bills-import",
        type: "outline",
      },
      {
        label: "Record Bill",
        path: "/purchase/purchase-bills-import/new",
        type: "primary",
      },
    ],
  },
  {
    title: "Supplier Details Setup",
    description: "Add and manage supplier information",
    path: "/purchase/suppliers",
    icon: "👥",
    actions: [
      { label: "View Suppliers", path: "/purchase/suppliers", type: "outline" },
      {
        label: "Add Supplier",
        path: "/purchase/suppliers/new",
        type: "primary",
      },
    ],
  },
  {
    title: "Purchase Reports",
    description: "View purchase analytics and reports",
    path: "/purchase/reports",
    icon: "📈",
    actions: [
      { label: "View Reports", path: "/purchase/reports", type: "primary" },
    ],
  },
];

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
  const [stats, setStats] = React.useState([
    {
      icon: "💰",
      value: "GHS 2.5M",
      label: "Total Purchases (YTD)",
      change: "↑ 15.3% from last year",
      changeType: "positive",
      path: "/purchase/reports",
    },
    {
      icon: "📝",
      value: "156",
      label: "Active Purchase Orders",
      change: "↑ 12 this month",
      changeType: "positive",
      path: "/purchase/purchase-orders-local",
    },
    {
      icon: "👥",
      value: "48",
      label: "Active Suppliers",
      change: "↑ 3 new this month",
      changeType: "positive",
      path: "/purchase/suppliers",
    },
    {
      icon: "⏳",
      value: "23",
      label: "Pending Approvals",
      change: "Requires attention",
      changeType: "neutral",
      path: "/purchase/purchase-orders-local",
    },
    {
      icon: "💵",
      value: "GHS 450K",
      label: "Outstanding Payables",
      change: "25 pending invoices",
      changeType: "neutral",
      path: "/purchase/purchase-bills-local",
    },
  ]);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const resp = await api.get("/bi/dashboards");
        const total = Number(resp?.data?.summary?.purchase?.total || 0);
        if (mounted) {
          setStats((prev) => {
            const next = [...prev];
            next[0] = {
              ...next[0],
              value: `GHS ${Number(total).toLocaleString()}`,
              label: "Total Purchases (Last 30 Days)",
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
      title: "RFQ & Quotations",
      items: [
        {
          title: "Request for Quotation",
          description: "Create and send RFQs to suppliers",
          path: "/purchase/rfqs",
          icon: "📨",
        },
        {
          title: "Supplier Quotations",
          description: "Receive and manage supplier quotations",
          path: "/purchase/supplier-quotations",
          icon: "📋",
        },
        {
          title: "Quotation Analysis",
          description: "Compare quotations from multiple suppliers",
          path: "/purchase/quotation-analysis",
          icon: "📊",
        },
      ],
    },
    {
      title: "Purchase Orders",
      items: [
        {
          title: "Purchase Order - Local",
          description: "Create and manage local purchase orders",
          path: "/purchase/purchase-orders-local",
          icon: "📝",
        },
        {
          title: "Purchase Order - Import",
          description: "Create and manage import purchase orders",
          path: "/purchase/purchase-orders-import",
          icon: "🌍",
        },
      ],
    },
    {
      title: "Shipping & Clearing",
      items: [
        {
          title: "Shipping Advice",
          description: "Track shipments and vessel information",
          path: "/purchase/shipping-advice",
          icon: "🚢",
        },
        {
          title: "Clearing at Port",
          description: "Manage customs and port clearances",
          path: "/purchase/port-clearances",
          icon: "🏢",
        },
      ],
    },
    {
      title: "Billing",
      items: [
        {
          title: "Purchase Bill - Local",
          description: "Record and manage local supplier bills",
          path: "/purchase/purchase-bills-local",
          icon: "🧾",
        },
        {
          title: "Purchase Bill - Import",
          description: "Record and manage import supplier bills",
          path: "/purchase/purchase-bills-import",
          icon: "📄",
        },
      ],
    },
    {
      title: "Service Procurement",
      items: [
        {
          title: "Service Bill",
          description: "Prepare and issue service bills",
          path: "/purchase/service-bills",
          icon: "🧾",
        },
        {
          title: "Service Confirmation",
          description: "Confirm received services",
          path: "/purchase/service-confirmation",
          icon: "✅",
        },
      ],
    },
    {
      title: "Suppliers",
      items: [
        {
          title: "Supplier Details Setup",
          description: "Add and manage supplier information",
          path: "/purchase/suppliers",
          icon: "👥",
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
        },
        {
          title: "Import Order Tracking",
          description: "Track import PO status and shipments",
          path: "/purchase/reports/import-order-tracking",
          icon: "🌍",
        },
        {
          title: "Local Order Tracking",
          description: "Track local PO status and deliveries",
          path: "/purchase/reports/local-order-tracking",
          icon: "📝",
        },
        {
          title: "Purchase Tracking",
          description: "Track end-to-end procurement stages",
          path: "/purchase/reports/purchase-tracking",
          icon: "🔎",
        },
      ],
    },
  ];

  return (
    <ModuleDashboard
      title="🛒 Purchase Management Module"
      description="Comprehensive procurement solution for local and import purchases, supplier management, and service procurement"
      stats={stats}
      sections={sections}
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
      <Route path="service-bills" element={<ServiceBillForm />} />
      <Route path="service-bills/new" element={<ServiceBillForm />} />
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
      <Route path="*" element={<Navigate to="/purchase" replace />} />
    </Routes>
  );
}
