import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import { usePermission } from "../../../auth/PermissionContext";
import ModuleDashboard from "../../../components/ModuleDashboard";
import { api } from "../../../api/client.js";

// Import list pages
import QuotationList from "./quotations/QuotationList.jsx";
import QuotationForm from "./quotations/QuotationForm.jsx";
import SalesOrderList from "./sales-orders/SalesOrderList.jsx";
import SalesOrderForm from "./sales-orders/SalesOrderForm.jsx";
import InvoiceList from "./invoices/InvoiceList.jsx";
import InvoiceForm from "./invoices/InvoiceForm.jsx";
import DeliveryList from "./delivery/DeliveryList.jsx";
import DeliveryForm from "./delivery/DeliveryForm.jsx";
import PriceSetup from "./price-setup/PriceSetup.jsx";
import DiscountSchemeList from "./discount-schemes/DiscountSchemeList.jsx";
import CustomerCreditList from "./customer-credit/CustomerCreditList.jsx";
import CustomerCreditForm from "./customer-credit/CustomerCreditForm.jsx";
import CustomerList from "./customers/CustomerList.jsx";
import CustomerForm from "./customers/CustomerForm.jsx";
import BulkCustomerUpload from "./bulk-upload/BulkCustomerUpload.jsx";
import SalesReports from "./reports/SalesReports.jsx";
import SalesReturnList from "./returns/SalesReturnList.jsx";
import SalesReturnReportPage from "./reports/SalesReturnReportPage.jsx";
import SalesRegisterReportPage from "./reports/SalesRegisterReportPage.jsx";
import DeliveryRegisterReportPage from "./reports/DeliveryRegisterReportPage.jsx";
import DebtorsBalanceReportPage from "./reports/DebtorsBalanceReportPage.jsx";
import SalesProfitabilityReportPage from "./reports/SalesProfitabilityReportPage.jsx";
import SalesTrackingReportPage from "./reports/SalesTrackingReportPage.jsx";

const ActionButton = ({ label, path, type, featureKey, action }) => {
  const { canPerformAction } = usePermission();
  const hasPermission = canPerformAction(featureKey, action);
  
  if (!hasPermission) return null;
  
  const baseClasses = type === "primary" 
    ? "btn btn-primary btn-sm" 
    : "btn btn-outline btn-sm";
    
  return (
    <Link to={path} className={baseClasses}>
      {label}
    </Link>
  );
};

const SalesModuleHome = () => {
  const [stats, setStats] = React.useState([
    {
      icon: "💰",
      value: "GHS 5.2M",
      label: "Total Sales (YTD)",
      change: "↑ 21.5% from last year",
      changeType: "positive",
      path: "/sales/reports",
    },
    {
      icon: "🛒",
      value: "45",
      label: "Open Orders",
      change: "5 new today",
      changeType: "positive",
      path: "/sales/sales-orders",
    },
    {
      icon: "🚚",
      value: "12",
      label: "Pending Deliveries",
      change: "2 delayed",
      changeType: "negative",
      path: "/sales/delivery",
    },
  ]);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const resp = await api.get("/bi/dashboards");
        const total = Number(resp?.data?.summary?.sales?.total || 0);
        const openOrders = Number(resp?.data?.summary?.sales?.open_orders || 0);
        const pendingDeliveries = Number(
          resp?.data?.summary?.sales?.pending_deliveries || 0,
        );
        if (mounted) {
          setStats((prev) => {
            const next = [...prev];
            next[0] = {
              ...next[0],
              value: `GHS ${Number(total).toLocaleString()}`,
              label: "Total Sales (Last 30 Days)",
            };
            next[1] = { ...next[1], value: String(openOrders) };
            next[2] = { ...next[2], value: String(pendingDeliveries) };
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
      title: "Sales Transactions",
      badge: "Operations",
      items: [
        {
          title: "Quotations",
          path: "/sales/quotations",
          description: "Create and manage customer quotations",
          icon: "📋",
          actions: [
            <ActionButton key="view" label="View" path="/sales/quotations" type="outline" featureKey="sales:quotations" action="view" />,
            <ActionButton key="new" label="New" path="/sales/quotations/new" type="primary" featureKey="sales:quotations" action="create" />,
          ],
        },
        {
          title: "Sales Orders",
          path: "/sales/sales-orders",
          description: "Process customer orders and track fulfillment",
          icon: "🛒",
          actions: [
            <ActionButton key="view" label="View" path="/sales/sales-orders" type="outline" featureKey="sales:sales-orders" action="view" />,
            <ActionButton key="new" label="New" path="/sales/sales-orders/new" type="primary" featureKey="sales:sales-orders" action="create" />,
          ],
        },
        {
          title: "Invoices",
          path: "/sales/invoices",
          description: "Generate and manage sales invoices",
          icon: "🧾",
          actions: [
            <ActionButton key="view" label="View" path="/sales/invoices" type="outline" featureKey="sales:invoices" action="view" />,
            <ActionButton key="new" label="New" path="/sales/invoices/new" type="primary" featureKey="sales:invoices" action="create" />,
          ],
        },
        {
          title: "Delivery Notes",
          path: "/sales/delivery",
          description: "Track product deliveries to customers",
          icon: "🚚",
          actions: [
            <ActionButton key="view" label="View" path="/sales/delivery" type="outline" featureKey="sales:delivery" action="view" />,
            <ActionButton key="new" label="New" path="/sales/delivery/new" type="primary" featureKey="sales:delivery" action="create" />,
          ],
        },
      ],
    },
    {
      title: "Pricing & Discounts",
      badge: "Configuration",
      items: [
        {
          title: "Price Setup",
          path: "/sales/price-setup",
          description: "Manage standard and customer pricing",
          icon: "💰",
          actions: [
            { label: "Manage", path: "/sales/price-setup", type: "primary" },
          ],
        },
        {
          title: "Discount Schemes",
          path: "/sales/discount-schemes",
          description: "Configure discount rules and promotions",
          icon: "🏷️",
          actions: [
            {
              label: "Manage",
              path: "/sales/discount-schemes",
              type: "primary",
            },
          ],
        },
      ],
    },
    {
      title: "Customer Management",
      items: [
        {
          title: "Customers",
          path: "/sales/customers",
          description: "Manage customer information and credit limits",
          icon: "👥",
          actions: [
            <ActionButton key="view" label="View" path="/sales/customers" type="outline" featureKey="sales:customers" action="view" />,
            <ActionButton key="add" label="Add" path="/sales/customers/new" type="primary" featureKey="sales:customers" action="create" />,
          ],
        },
        {
          title: "Bulk Upload",
          path: "/sales/bulk-upload",
          description: "Import customers in bulk",
          icon: "📤",
          actions: [
            { label: "Upload", path: "/sales/bulk-upload", type: "primary" },
          ],
        },
      ],
    },
    {
      title: "Analytics & Reports",
      items: [
        {
          title: "Sales Reports",
          path: "/sales/reports",
          description: "View sales analytics and reports",
          icon: "📊",
          actions: [
            { label: "View Reports", path: "/sales/reports", type: "primary" },
          ],
        },
        {
          title: "Sales Register",
          path: "/sales/reports/sales-register",
          description: "Invoices within the selected period",
          icon: "🧾",
        },
        {
          title: "Delivery Register",
          path: "/sales/reports/delivery-register",
          description: "Deliveries made to customers",
          icon: "🚚",
        },
        {
          title: "Sales Return Report",
          path: "/sales/reports/sales-return",
          description: "Items returned by customers",
          icon: "↩️",
        },
        {
          title: "Debtors Balance",
          path: "/sales/reports/debtors-balance",
          description: "Customer balances and outstanding",
          icon: "👤",
        },
        {
          title: "Sales Profitability",
          path: "/sales/reports/sales-profitability",
          description: "Margins and profitability by invoice",
          icon: "💹",
        },
        {
          title: "Sales Tracking",
          path: "/sales/reports/sales-tracking",
          description: "Track quotations → orders → deliveries → invoices",
          icon: "🔎",
        },
      ],
    },
  ];

  return (
    <ModuleDashboard
      title="Sales Module"
      description="Customer orders, quotations, invoicing, and sales analytics"
      stats={stats}
      sections={sections}
      features={salesFeatures}
    />
  );
};

export default function SalesHome() {
  return (
    <Routes>
      <Route path="/" element={<SalesModuleHome />} />
      <Route path="/quotations" element={<QuotationList />} />
      <Route path="/quotations/new" element={<QuotationForm />} />
      <Route path="/quotations/:id" element={<QuotationForm />} />
      <Route path="/sales-orders" element={<SalesOrderList />} />
      <Route path="/sales-orders/new" element={<SalesOrderForm />} />
      <Route path="/sales-orders/:id" element={<SalesOrderForm />} />
      <Route path="/invoices" element={<InvoiceList />} />
      <Route path="/invoices/new" element={<InvoiceForm />} />
      <Route path="/invoices/:id" element={<InvoiceForm />} />
      <Route path="delivery" element={<DeliveryList />} />
      <Route path="delivery/new" element={<DeliveryForm />} />
      <Route path="delivery/:id" element={<DeliveryForm />} />
      <Route path="/price-setup" element={<PriceSetup />} />
      <Route path="/discount-schemes" element={<DiscountSchemeList />} />
      <Route path="/customer-credit" element={<CustomerCreditList />} />
      <Route path="/customer-credit/:id" element={<CustomerCreditForm />} />
      <Route path="/customers" element={<CustomerList />} />
      <Route path="/customers/new" element={<CustomerForm />} />
      <Route path="/customers/:id" element={<CustomerForm />} />
      <Route path="/bulk-upload" element={<BulkCustomerUpload />} />
      <Route path="/reports" element={<SalesReports />} />
      <Route path="/reports/sales-return" element={<SalesReturnReportPage />} />
      <Route path="/reports/sales-register" element={<SalesRegisterReportPage />} />
      <Route
        path="/reports/delivery-register"
        element={<DeliveryRegisterReportPage />}
      />
      <Route
        path="/reports/debtors-balance"
        element={<DebtorsBalanceReportPage />}
      />
      <Route
        path="/reports/sales-profitability"
        element={<SalesProfitabilityReportPage />}
      />
      <Route path="/reports/sales-tracking" element={<SalesTrackingReportPage />} />
      <Route path="/returns" element={<SalesReturnList />} />
    </Routes>
  );
}

export const salesFeatures = [
  {
    module_key: "sales",
    label: "Quotations",
    path: "/sales/quotations",
    type: "feature",
  },
  {
    module_key: "sales",
    label: "Sales Orders",
    path: "/sales/sales-orders",
    type: "feature",
  },
  {
    module_key: "sales",
    label: "Invoices",
    path: "/sales/invoices",
    type: "feature",
  },
  {
    module_key: "sales",
    label: "Delivery Notes",
    path: "/sales/delivery",
    type: "feature",
  },
  {
    module_key: "sales",
    label: "Price Setup",
    path: "/sales/price-setup",
    type: "feature",
  },
  {
    module_key: "sales",
    label: "Discount Schemes",
    path: "/sales/discount-schemes",
    type: "feature",
  },
  {
    module_key: "sales",
    label: "Customer Setup",
    path: "/sales/customers",
    type: "feature",
  },
  {
    module_key: "sales",
    label: "Bulk Upload",
    path: "/sales/bulk-upload",
    type: "feature",
  },
  {
    module_key: "sales",
    label: "Sales Reports",
    path: "/sales/reports",
    type: "dashboard",
  },
  {
    module_key: "sales",
    label: "Sales Register",
    path: "/sales/reports/sales-register",
    type: "dashboard",
  },
  {
    module_key: "sales",
    label: "Delivery Register",
    path: "/sales/reports/delivery-register",
    type: "dashboard",
  },
  {
    module_key: "sales",
    label: "Sales Return Report",
    path: "/sales/reports/sales-return",
    type: "dashboard",
  },
  {
    module_key: "sales",
    label: "Debtors Balance",
    path: "/sales/reports/debtors-balance",
    type: "dashboard",
  },
  {
    module_key: "sales",
    label: "Sales Profitability",
    path: "/sales/reports/sales-profitability",
    type: "dashboard",
  },
  {
    module_key: "sales",
    label: "Sales Tracking",
    path: "/sales/reports/sales-tracking",
    type: "dashboard",
  },
  {
    module_key: "sales",
    label: "Sales Returns",
    path: "/sales/returns",
    type: "feature",
  },
];
