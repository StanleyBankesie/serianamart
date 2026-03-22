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
import PotentialCustomerList from "./potential-customers/PotentialCustomerList.jsx";
import PotentialCustomerForm from "./potential-customers/PotentialCustomerForm.jsx";
import ProspectConversion from "./potential-customers/ProspectConversion.jsx";
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

  const baseClasses =
    type === "primary" ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm";

  return (
    <Link to={path} className={baseClasses}>
      {label}
    </Link>
  );
};

const SalesModuleHome = () => {
  const [stats, setStats] = React.useState([
    {
      rbac_key: "sales-this-month",
      icon: "🟢",
      value: "GHS 0",
      label: "Total Sales This Month",
      change: "",
      changeType: "neutral",
      path: "/sales/reports/invoice-summary",
    },
    {
      rbac_key: "open-quotations",
      icon: "🔵",
      value: "0",
      label: "Open Quotations",
      change: "",
      changeType: "neutral",
      path: "/sales/reports/quotation-summary",
    },
    {
      rbac_key: "pending-deliveries",
      icon: "🟠",
      value: "0",
      label: "Pending Deliveries",
      change: "",
      changeType: "neutral",
      path: "/sales/reports/delivery-register",
    },
    {
      rbac_key: "overdue-invoices",
      icon: "🔴",
      value: "0",
      label: "Overdue Invoices",
      change: "",
      changeType: "neutral",
      path: "/sales/reports/ar-aging",
    },
    {
      rbac_key: "total-revenue",
      icon: "💰",
      value: "GHS 0",
      label: "Total Revenue",
      change: "",
      changeType: "neutral",
      path: "/sales/reports/invoice-summary",
    },
    {
      rbac_key: "sales-growth",
      icon: "📈",
      value: "0%",
      label: "Sales Growth %",
      change: "",
      changeType: "neutral",
      path: "/sales/reports/monthly-sales-trend",
    },
  ]);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const to = now.toISOString().slice(0, 10);
        const from = firstOfMonth.toISOString().slice(0, 10);
        const [dash, invoices, openQuotes, deliveries, prevMonthInvoices] =
          await Promise.all([
            api.get("/bi/dashboards").catch(() => ({ data: {} })),
            api
              .get("/sales/reports/invoice-summary", {
                params: { from, to },
              })
              .catch(() => ({ data: {} })),
            api
              .get("/sales/reports/quotation-summary", {
                params: { status: "OPEN" },
              })
              .catch(() => ({ data: {} })),
            api.get("/sales/reports/delivery-register").catch(() => ({
              data: {},
            })),
            (async () => {
              const prevFrom = new Date(
                now.getFullYear(),
                now.getMonth() - 1,
                1,
              )
                .toISOString()
                .slice(0, 10);
              const prevTo = new Date(now.getFullYear(), now.getMonth(), 0)
                .toISOString()
                .slice(0, 10);
              return api
                .get("/sales/reports/invoice-summary", {
                  params: { from: prevFrom, to: prevTo },
                })
                .catch(() => ({ data: {} }));
            })(),
          ]);
        const invoiceItems = Array.isArray(invoices?.data?.items)
          ? invoices.data.items
          : [];
        const totalThisMonth = invoiceItems.reduce(
          (a, r) => a + Number(r.total_amount || 0),
          0,
        );
        const totalRevenue =
          Number(dash?.data?.summary?.sales?.total || 0) || totalThisMonth;
        const openQuotationsCount = Array.isArray(openQuotes?.data?.items)
          ? openQuotes.data.items.length
          : 0;
        const pendingDelivs = Array.isArray(deliveries?.data?.items)
          ? deliveries.data.items.filter(
              (d) => String(d.status || "").toUpperCase() !== "DELIVERED",
            ).length
          : 0;
        const overdueInvoices = invoiceItems.filter((r) => {
          const dt = r.invoice_date ? new Date(r.invoice_date) : null;
          const overdue =
            dt &&
            (now - dt) / (1000 * 60 * 60 * 24) > 30 &&
            Number(r.balance_amount || 0) > 0;
          return overdue;
        }).length;
        const prevItems = Array.isArray(prevMonthInvoices?.data?.items)
          ? prevMonthInvoices.data.items
          : [];
        const totalPrevMonth = prevItems.reduce(
          (a, r) => a + Number(r.total_amount || 0),
          0,
        );
        const growth =
          totalPrevMonth > 0
            ? Math.round(
                ((totalThisMonth - totalPrevMonth) * 100) / totalPrevMonth,
              )
            : 0;
        if (mounted) {
          setStats((prev) => {
            const next = [...prev];
            next[0] = {
              ...next[0],
              value: `GHS ${totalThisMonth.toLocaleString()}`,
            };
            next[1] = { ...next[1], value: String(openQuotationsCount) };
            next[2] = { ...next[2], value: String(pendingDelivs) };
            next[3] = { ...next[3], value: String(overdueInvoices) };
            next[4] = {
              ...next[4],
              value: `GHS ${totalRevenue.toLocaleString()}`,
            };
            next[5] = { ...next[5], value: `${growth}%` };
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
            <ActionButton
              key="view"
              label="View"
              path="/sales/quotations"
              type="outline"
              featureKey="sales:quotations"
              action="view"
            />,
            <ActionButton
              key="new"
              label="New"
              path="/sales/quotations/new"
              type="primary"
              featureKey="sales:quotations"
              action="create"
            />,
          ],
        },
        {
          title: "Sales Orders",
          path: "/sales/sales-orders",
          description: "Process customer orders and track fulfillment",
          icon: "🛒",
          actions: [
            <ActionButton
              key="view"
              label="View"
              path="/sales/sales-orders"
              type="outline"
              featureKey="sales:sales-orders"
              action="view"
            />,
            <ActionButton
              key="new"
              label="New"
              path="/sales/sales-orders/new"
              type="primary"
              featureKey="sales:sales-orders"
              action="create"
            />,
          ],
        },
        {
          title: "Invoices",
          path: "/sales/invoices",
          description: "Generate and manage sales invoices",
          icon: "🧾",
          actions: [
            <ActionButton
              key="view"
              label="View"
              path="/sales/invoices"
              type="outline"
              featureKey="sales:invoices"
              action="view"
            />,
            <ActionButton
              key="new"
              label="New"
              path="/sales/invoices/new"
              type="primary"
              featureKey="sales:invoices"
              action="create"
            />,
          ],
        },
        {
          title: "Delivery Notes",
          path: "/sales/delivery",
          description: "Track product deliveries to customers",
          icon: "🚚",
          actions: [
            <ActionButton
              key="view"
              label="View"
              path="/sales/delivery"
              type="outline"
              featureKey="sales:delivery"
              action="view"
            />,
            <ActionButton
              key="new"
              label="New"
              path="/sales/delivery/new"
              type="primary"
              featureKey="sales:delivery"
              action="create"
            />,
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
            <ActionButton
              key="view"
              label="View"
              path="/sales/customers"
              type="outline"
              featureKey="sales:customers"
              action="view"
            />,
            <ActionButton
              key="add"
              label="Add"
              path="/sales/customers/new"
              type="primary"
              featureKey="sales:customers"
              action="create"
            />,
          ],
        },
        {
          title: "Prospective Customers",
          path: "/sales/prospect-customers",
          description: "Manage prospective customer (leads) information",
          icon: "🔮",
          actions: [
            <ActionButton
              key="view"
              label="View"
              path="/sales/prospect-customers"
              type="outline"
              featureKey="sales:prospect-customers"
              action="view"
            />,
            <ActionButton
              key="add"
              label="Add"
              path="/sales/prospect-customers/new"
              type="primary"
              featureKey="sales:prospect-customers"
              action="create"
            />,
          ],
        },
        {
          title: "Prospect Conversion",
          path: "/sales/prospect-conversion",
          description:
            "Convert prospective customers into full customer accounts",
          icon: "🔄",
          actions: [
            <ActionButton
              key="convert"
              label="Convert"
              path="/sales/prospect-conversion"
              type="primary"
              featureKey="sales:customers"
              action="create"
            />,
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
        {
          title: "Customer List",
          path: "/sales/reports/customer-list",
          description: "Export all active customers to Excel",
          icon: "👥",
        },
        {
          title: "Prospective Customer List",
          path: "/sales/reports/prospect-customer-list",
          description: "Export all prospective customers to Excel",
          icon: "🔮",
        },
        {
          title: "Quotation Summary",
          path: "/sales/reports/quotation-summary",
          description: "Track quotes",
          icon: "📋",
        },
        {
          title: "Quotation Conversion",
          path: "/sales/reports/quotation-conversion",
          description: "Sales effectiveness",
          icon: "✅",
        },
        {
          title: "Sales Order Status",
          path: "/sales/reports/sales-order-status",
          description: "Monitor active orders",
          icon: "📦",
        },
        {
          title: "Invoice Summary",
          path: "/sales/reports/invoice-summary",
          description: "Revenue tracking",
          icon: "🧾",
        },
        {
          title: "A/R Aging",
          path: "/sales/reports/ar-aging",
          description: "Overdue payments",
          icon: "⏱️",
        },
        {
          title: "Revenue by Customer",
          path: "/sales/reports/revenue-by-customer",
          description: "Top customers",
          icon: "👥",
        },
        {
          title: "Revenue by Product",
          path: "/sales/reports/revenue-by-product",
          description: "Best sellers",
          icon: "📦",
        },
        {
          title: "Discount Utilization",
          path: "/sales/reports/discount-utilization",
          description: "Discount control",
          icon: "🏷️",
        },
        {
          title: "Price List",
          path: "/sales/reports/price-list",
          description: "Monitor pricing",
          icon: "💰",
        },
        {
          title: "Monthly Sales Trend",
          path: "/sales/reports/monthly-sales-trend",
          description: "Executive overview",
          icon: "📈",
        },
        {
          title: "Customer Order History",
          path: "/sales/reports/customer-order-history",
          description: "Per-customer timeline",
          icon: "🗂️",
        },
        {
          title: "Cancelled / Rejected Orders",
          path: "/sales/reports/cancelled-orders",
          description: "Identify revenue loss",
          icon: "🛑",
        },
      ],
    },
  ];

  return (
    <ModuleDashboard
      title="Sales Module"
      description="Customer orders, quotations, invoicing, and sales analytics"
      stats={stats}
      headerActions={[
        { label: "Dashboard", path: "/sales/dashboard", icon: "📊" },
      ]}
      sections={sections}
      features={salesFeatures}
    />
  );
};

export default function SalesHome() {
  return (
    <Routes>
      <Route path="/" element={<SalesModuleHome />} />
      <Route
        path="/dashboard"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(() => import("./SalesDashboardPage.jsx")),
            )}
          </React.Suspense>
        }
      />
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
      <Route path="/prospect-customers" element={<PotentialCustomerList />} />
      <Route
        path="/prospect-customers/new"
        element={<PotentialCustomerForm />}
      />
      <Route
        path="/prospect-customers/:id"
        element={<PotentialCustomerForm />}
      />
      <Route path="/prospect-conversion" element={<ProspectConversion />} />
      <Route path="/bulk-upload" element={<BulkCustomerUpload />} />
      {/* Additional sales report routes */}
      <Route
        path="/reports/prospect-customer-list"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(
                () => import("./reports/ProspectiveCustomerListReportPage.jsx"),
              ),
            )}
          </React.Suspense>
        }
      />
      <Route
        path="/reports/customer-list"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(() => import("./reports/CustomerListReportPage.jsx")),
            )}
          </React.Suspense>
        }
      />
      <Route
        path="/reports/quotation-summary"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(
                () => import("./reports/QuotationSummaryReportPage.jsx"),
              ),
            )}
          </React.Suspense>
        }
      />
      <Route
        path="/reports/quotation-conversion"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(
                () => import("./reports/QuotationConversionReportPage.jsx"),
              ),
            )}
          </React.Suspense>
        }
      />
      <Route
        path="/reports/sales-order-status"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(
                () => import("./reports/SalesOrderStatusReportPage.jsx"),
              ),
            )}
          </React.Suspense>
        }
      />
      <Route
        path="/reports/invoice-summary"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(
                () => import("./reports/InvoiceSummaryReportPage.jsx"),
              ),
            )}
          </React.Suspense>
        }
      />
      <Route
        path="/reports/ar-aging"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(
                () => import("./reports/AccountsReceivableAgingReportPage.jsx"),
              ),
            )}
          </React.Suspense>
        }
      />
      <Route
        path="/reports/revenue-by-customer"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(
                () => import("./reports/RevenueByCustomerReportPage.jsx"),
              ),
            )}
          </React.Suspense>
        }
      />
      <Route
        path="/reports/revenue-by-product"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(
                () => import("./reports/RevenueByProductReportPage.jsx"),
              ),
            )}
          </React.Suspense>
        }
      />
      <Route
        path="/reports/discount-utilization"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(
                () => import("./reports/DiscountUtilizationReportPage.jsx"),
              ),
            )}
          </React.Suspense>
        }
      />
      <Route
        path="/reports/price-list"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(() => import("./reports/PriceListReportPage.jsx")),
            )}
          </React.Suspense>
        }
      />
      <Route
        path="/reports/monthly-sales-trend"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(
                () => import("./reports/MonthlySalesTrendReportPage.jsx"),
              ),
            )}
          </React.Suspense>
        }
      />
      <Route
        path="/reports/customer-order-history"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(
                () => import("./reports/CustomerOrderHistoryReportPage.jsx"),
              ),
            )}
          </React.Suspense>
        }
      />
      <Route
        path="/reports/cancelled-orders"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(
                () => import("./reports/CancelledOrdersReportPage.jsx"),
              ),
            )}
          </React.Suspense>
        }
      />
      <Route path="/reports/sales-return" element={<SalesReturnReportPage />} />
      <Route
        path="/reports/sales-register"
        element={<SalesRegisterReportPage />}
      />
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
      <Route
        path="/reports/sales-tracking"
        element={<SalesTrackingReportPage />}
      />
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
