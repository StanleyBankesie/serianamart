import React from "react";
import { Routes, Route } from "react-router-dom";
import ModuleDashboard from "../../../components/ModuleDashboard";
import { api } from "../../../api/client.js";
import { useAuth } from "../../../auth/AuthContext.jsx";

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
            { label: "View", path: "/sales/quotations", type: "outline" },
            { label: "New", path: "/sales/quotations/new", type: "primary" },
          ],
        },
        {
          title: "Sales Orders",
          path: "/sales/sales-orders",
          description: "Process customer orders and track fulfillment",
          icon: "🛒",
          actions: [
            { label: "View", path: "/sales/sales-orders", type: "outline" },
            { label: "New", path: "/sales/sales-orders/new", type: "primary" },
          ],
        },
        {
          title: "Invoices",
          path: "/sales/invoices",
          description: "Generate and manage sales invoices",
          icon: "🧾",
          actions: [
            { label: "View", path: "/sales/invoices", type: "outline" },
            { label: "New", path: "/sales/invoices/new", type: "primary" },
          ],
        },
        {
          title: "Delivery Notes",
          path: "/sales/delivery",
          description: "Track product deliveries to customers",
          icon: "🚚",
          actions: [
            { label: "View", path: "/sales/delivery", type: "outline" },
            { label: "New", path: "/sales/delivery/new", type: "primary" },
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
          title: "Customer Setup",
          path: "/sales/customers",
          description: "Manage customer information",
          icon: "👥",
          actions: [
            { label: "View", path: "/sales/customers", type: "outline" },
            { label: "Add", path: "/sales/customers/new", type: "primary" },
          ],
        },
        // {
        //   title: "Credit Limits",
        //   path: "/sales/customer-credit",
        //   description: "Configure customer credit limits",
        //   icon: "💳",
        //   actions: [
        //     {
        //       label: "Manage",
        //       path: "/sales/customer-credit",
        //       type: "primary",
        //     },
        //   ],
        // },
        // {
        //   title: "Bulk Upload",
        //   path: "/sales/bulk-upload",
        //   description: "Import customers in bulk",
        //   icon: "📤",
        //   actions: [
        //     { label: "Upload", path: "/sales/bulk-upload", type: "primary" },
        //   ],
        // },
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

  const { hasModuleAccess } = useAuth();

  if (!hasModuleAccess("Sales")) {
    return (
      <div className="p-6">
        <div className="card">
          <div className="card-body">
            <div className="text-center text-slate-600">
              You do not have access to the Sales module.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ModuleDashboard
      title="Sales Module"
      description="Customer orders, quotations, invoicing, and sales analytics"
      stats={stats}
      sections={sections}
    />
  );
};

export default function SalesHome() {
  const { hasAccess } = useAuth();
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

  return (
    <Routes>
      <Route path="/" element={<SalesModuleHome />} />
      <Route
        path="/quotations"
        element={hasAccess("/sales/quotations", "view") ? <QuotationList /> : <NoAccess />}
      />
      <Route
        path="/quotations/new"
        element={hasAccess("/sales/quotations/new", "create") ? <QuotationForm /> : <NoAccess />}
      />
      <Route
        path="/quotations/:id"
        element={hasAccess("/sales/quotations/:id", "edit") ? <QuotationForm /> : <NoAccess />}
      />
      <Route
        path="/sales-orders"
        element={hasAccess("/sales/sales-orders", "view") ? <SalesOrderList /> : <NoAccess />}
      />
      <Route
        path="/sales-orders/new"
        element={hasAccess("/sales/sales-orders/new", "create") ? <SalesOrderForm /> : <NoAccess />}
      />
      <Route
        path="/sales-orders/:id"
        element={hasAccess("/sales/sales-orders/:id", "edit") ? <SalesOrderForm /> : <NoAccess />}
      />
      <Route
        path="/invoices"
        element={hasAccess("/sales/invoices", "view") ? <InvoiceList /> : <NoAccess />}
      />
      <Route
        path="/invoices/new"
        element={hasAccess("/sales/invoices/new", "create") ? <InvoiceForm /> : <NoAccess />}
      />
      <Route
        path="/invoices/:id"
        element={hasAccess("/sales/invoices/:id", "edit") ? <InvoiceForm /> : <NoAccess />}
      />
      <Route
        path="delivery"
        element={hasAccess("/sales/delivery", "view") ? <DeliveryList /> : <NoAccess />}
      />
      <Route
        path="delivery/new"
        element={hasAccess("/sales/delivery/new", "create") ? <DeliveryForm /> : <NoAccess />}
      />
      <Route
        path="delivery/:id"
        element={hasAccess("/sales/delivery/:id", "edit") ? <DeliveryForm /> : <NoAccess />}
      />
      <Route
        path="/price-setup"
        element={hasAccess("/sales/price-setup", "view") ? <PriceSetup /> : <NoAccess />}
      />
      <Route
        path="/discount-schemes"
        element={hasAccess("/sales/discount-schemes", "view") ? <DiscountSchemeList /> : <NoAccess />}
      />
      <Route
        path="/customer-credit"
        element={hasAccess("/sales/customer-credit", "view") ? <CustomerCreditList /> : <NoAccess />}
      />
      <Route
        path="/customer-credit/:id"
        element={hasAccess("/sales/customer-credit/:id", "edit") ? <CustomerCreditForm /> : <NoAccess />}
      />
      <Route
        path="/customers"
        element={hasAccess("/sales/customers", "view") ? <CustomerList /> : <NoAccess />}
      />
      <Route
        path="/customers/new"
        element={hasAccess("/sales/customers/new", "create") ? <CustomerForm /> : <NoAccess />}
      />
      <Route
        path="/customers/:id"
        element={hasAccess("/sales/customers/:id", "edit") ? <CustomerForm /> : <NoAccess />}
      />
      <Route
        path="/bulk-upload"
        element={hasAccess("/sales/bulk-upload", "view") ? <BulkCustomerUpload /> : <NoAccess />}
      />
      <Route
        path="/reports"
        element={hasAccess("/sales/reports", "view") ? <SalesReports /> : <NoAccess />}
      />
      <Route
        path="/reports/sales-return"
        element={hasAccess("/sales/reports/sales-return", "view") ? <SalesReturnReportPage /> : <NoAccess />}
      />
      <Route
        path="/reports/sales-register"
        element={hasAccess("/sales/reports/sales-register", "view") ? <SalesRegisterReportPage /> : <NoAccess />}
      />
      <Route
        path="/reports/delivery-register"
        element={hasAccess("/sales/reports/delivery-register", "view") ? <DeliveryRegisterReportPage /> : <NoAccess />}
      />
      <Route
        path="/reports/debtors-balance"
        element={hasAccess("/sales/reports/debtors-balance", "view") ? <DebtorsBalanceReportPage /> : <NoAccess />}
      />
      <Route
        path="/reports/sales-profitability"
        element={hasAccess("/sales/reports/sales-profitability", "view") ? <SalesProfitabilityReportPage /> : <NoAccess />}
      />
      <Route
        path="/reports/sales-tracking"
        element={hasAccess("/sales/reports/sales-tracking", "view") ? <SalesTrackingReportPage /> : <NoAccess />}
      />
      <Route
        path="/returns"
        element={hasAccess("/sales/returns", "view") ? <SalesReturnList /> : <NoAccess />}
      />
    </Routes>
  );
}
