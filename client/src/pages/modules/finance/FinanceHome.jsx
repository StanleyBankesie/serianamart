import React from "react";
import ModuleDashboard from "../../../components/ModuleDashboard.jsx";
import { api } from "../../../api/client.js";

/**
 * Finance Module Home Page
 * Provides navigation to all finance features including vouchers, accounting setup, and reports
 */
function fmt(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `₵${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function FinanceHome() {
  const [stats, setStats] = React.useState([
    {
      rbac_key: "cash-balance",
      value: "—",
      label: "Cash on Hand",
      change: "Loading…",
      changeType: "neutral",
      path: "/finance/reports",
    },
    {
      rbac_key: "bank-balance",
      value: "—",
      label: "Bank Balance",
      change: "Loading…",
      changeType: "neutral",
      path: "/finance/reports",
    },
    {
      rbac_key: "pending-vouchers",
      value: "—",
      label: "Pending Vouchers",
      change: "Loading…",
      changeType: "neutral",
      path: "/finance/journal-voucher",
    },
    {
      rbac_key: "net-income",
      value: "—",
      label: "Net Income (MTD)",
      change: "Loading…",
      changeType: "neutral",
      path: "/finance/reports/profit-and-loss",
    },
  ]);

  React.useEffect(() => {
    let mounted = true;
    let timer;
    async function load() {
      try {
        const resp = await api.get("/finance/dashboard-stats");
        const d = resp?.data?.data;
        if (d && mounted) {
          setStats((prev) => {
            const next = [...prev];
            next[0] = {
              ...next[0],
              value: fmt(d.cashBalance),
              change: `Bank: ${fmt(d.bankBalance)}`,
              changeType: "positive",
            };
            next[1] = {
              ...next[1],
              value: fmt(d.bankBalance),
              label: "Liquidity Total",
              change: fmt(d.totalLiquidity),
              changeType: "positive",
            };
            next[2] = {
              ...next[2],
              value: String(d.pendingVouchers ?? "—"),
              change: d.pendingVouchers > 0 ? "Awaiting posting" : "All posted",
              changeType: d.pendingVouchers > 0 ? "warning" : "positive",
            };
            next[3] = {
              ...next[3],
              value: fmt(d.netIncome),
              change: `Expenses: ${fmt(d.monthlyExpenses)}`,
              changeType: d.netIncome >= 0 ? "positive" : "negative",
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
      title: "Voucher Management",
      features: [
        {
          name: "Journal Entry",
          path: "/finance/journal-voucher",
          description: "General ledger journal entries",
          icon: "📒",
        },
        {
          name: "Make Payment",
          path: "/finance/payment-voucher",
          description: "Record outgoing payments",
          icon: "💸",
        },
        {
          name: "Receive Payment",
          path: "/finance/receipt-voucher",
          description: "Record incoming payments",
          icon: "💰",
        },
        {
          name: "Credit Note",
          path: "/finance/credit-note",
          description: "Customer credit notes",
          icon: "🧾",
        },
        {
          name: "Debit Note",
          path: "/finance/debit-note",
          description: "Supplier debit notes",
          icon: "🧾",
        },
        {
          name: "Sales Voucher",
          path: "/finance/sales-voucher",
          description: "Sales transaction vouchers",
          icon: "🛍",
        },
        {
          name: "Purchase Voucher",
          path: "/finance/purchase-voucher",
          description: "Purchase transaction vouchers",
          icon: "🧺",
        },
        {
          name: "Account Transfer",
          path: "/finance/contra-voucher",
          description: "Bank or ledger transfers",
          icon: "🔁",
        },
        {
          name: "Voucher Register Report",
          path: "/finance/reports",
          description: "Voucher listing with filters (report)",
          icon: "📊",
        },
      ],
    },
    {
      title: "Accounting Setup",
      features: [
        {
          name: "Chart of Account Groups",
          path: "/finance/account-groups",
          description: "Setup account group hierarchy",
          icon: "🗂",
        },
        {
          name: "Accounts Creation",
          path: "/finance/accounts",
          description: "Create and manage accounts",
          icon: "🏦",
        },
        {
          name: "Cost Centers",
          path: "/finance/cost-centers",
          description: "Define and manage cost centers",
          icon: "🏷️",
        },
        {
          name: "Tax Codes & Deductions",
          path: "/finance/tax-codes",
          description: "Configure tax and deduction codes",
          icon: "🧮",
        },
        {
          name: "Currencies",
          path: "/finance/currencies",
          description: "Manage currencies and base currency",
          icon: "💱",
        },
        {
          name: "Fiscal Years",
          path: "/finance/fiscal-years",
          description: "Open/close fiscal periods",
          icon: "📅",
        },
        {
          name: "Opening Balances",
          path: "/finance/opening-balances",
          description: "Set beginning balances for all accounts",
          icon: "🧮",
        },
      ],
    },
    {
      title: "Reports & Analysis",
      features: [
        {
          name: "Voucher Register",
          path: "/finance/reports/voucher-register",
          description: "Voucher listing with filters",
          icon: "📊",
        },
        {
          name: "Payment Due",
          path: "/finance/reports/payment-due",
          description: "Upcoming and overdue payables",
          icon: "⏰",
        },
        {
          name: "Outstanding Receivable",
          path: "/finance/reports/outstanding-receivable",
          description: "Upcoming and overdue receivables",
          icon: "📆",
        },
        {
          name: "Customer Outstanding",
          path: "/finance/reports/customer-outstanding",
          description: "Receivables outstanding by customer",
          icon: "👤",
        },
        {
          name: "Trial Balance",
          path: "/finance/reports/trial-balance",
          description: "Debits and credits summary",
          icon: "⚖️",
        },
        {
          name: "Audit Trail",
          path: "/finance/reports/audit-trail",
          description: "System activity on finance transactions",
          icon: "🕵️",
        },
        {
          name: "Journal Report",
          path: "/finance/reports/journals",
          description: "Journal entries by range",
          icon: "📒",
        },
        {
          name: "Bank Reconciliation Detailed",
          path: "/finance/reports/bank-reconciliation-transactions",
          description: "Reconciled vs Unreconciled transactions",
          icon: "🏦",
        },
        {
          name: "Bank Reconciliations Summary",
          path: "/finance/reports/bank-reconciliations",
          description: "Summary of completed reconciliations",
          icon: "📄",
        },
        {
          name: "General Ledger",
          path: "/finance/reports/general-ledger",
          description: "Account ledger movements",
          icon: "📘",
        },
        {
          name: "Debtors Ledger",
          path: "/finance/reports/debtors-ledger",
          description: "Customer ledger with running balance",
          icon: "📗",
        },
        {
          name: "Creditors Ledger",
          path: "/finance/reports/creditors-ledger",
          description: "Supplier ledger with running balance",
          icon: "📕",
        },
        {
          name: "Supplier Outstanding",
          path: "/finance/reports/supplier-outstanding",
          description: "Payables outstanding by supplier",
          icon: "🏷️",
        },
        {
          name: "Profit & Loss",
          path: "/finance/reports/profit-and-loss",
          description: "Income vs. expenses summary",
          icon: "💹",
        },
        {
          name: "Balance Sheet",
          path: "/finance/reports/balance-sheet",
          description: "Assets, liabilities, and equity",
          icon: "🧮",
        },
        {
          name: "Cash Flow",
          path: "/finance/reports/cash-flow",
          description: "Operating, investing, financing flows",
          icon: "💵",
        },
        {
          name: "Ratio Analysis",
          path: "/finance/reports/ratio-analysis",
          description: "Key performance ratios",
          icon: "📈",
        },
        {
          name: "Graphical Chart of Accounts",
          path: "/finance/reports/chart-of-accounts-graphical",
          description: "Hierarchical visual view of accounts",
          icon: "🌳",
        },
      ],
    },
    {
      title: "Banking",
      features: [
        {
          name: "Bank Reconciliation",
          path: "/finance/bank-reconciliation",
          description: "Match bank statements with ledger, mark cleared",
          icon: "🏦",
        },
        {
          name: "Post-Dated Cheques (PDC)",
          path: "/finance/pdc-postings",
          description: "Register instruments and track status",
          icon: "🧾",
        },
      ],
    },
  ];

  return (
    <ModuleDashboard
      title="Finance Module"
      description="Comprehensive accounting, budgeting, and financial reporting system"
      stats={stats}
      headerActions={[
        { label: "Dashboard", path: "/finance/dashboard", icon: "📊" },
      ]}
      sections={sections}
      features={financeFeatures}
    />
  );
}

export const financeFeatures = [
  {
    module_key: "finance",
    label: "Journal Entry",
    path: "/finance/journal-voucher",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Make Payment",
    path: "/finance/payment-voucher",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Receive Payment",
    path: "/finance/receipt-voucher",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Credit Note",
    path: "/finance/credit-note",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Debit Note",
    path: "/finance/debit-note",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Sales Voucher",
    path: "/finance/sales-voucher",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Purchase Voucher",
    path: "/finance/purchase-voucher",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Account Transfer",
    path: "/finance/contra-voucher",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Voucher Register Report",
    path: "/finance/reports",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Chart of Account Groups",
    path: "/finance/account-groups",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Accounts Creation",
    path: "/finance/accounts",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Cost Centers",
    path: "/finance/cost-centers",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Tax Codes & Deductions",
    path: "/finance/tax-codes",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Currencies",
    path: "/finance/currencies",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Fiscal Years",
    path: "/finance/fiscal-years",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Opening Balances",
    path: "/finance/opening-balances",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Voucher Register",
    path: "/finance/reports/voucher-register",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Payment Due",
    path: "/finance/reports/payment-due",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Outstanding Receivable",
    path: "/finance/reports/outstanding-receivable",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Customer Outstanding",
    path: "/finance/reports/customer-outstanding",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Trial Balance",
    path: "/finance/reports/trial-balance",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Audit Trail",
    path: "/finance/reports/audit-trail",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Journal Report",
    path: "/finance/reports/journals",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "General Ledger",
    path: "/finance/reports/general-ledger",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Debtors Ledger",
    path: "/finance/reports/debtors-ledger",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Creditors Ledger",
    path: "/finance/reports/creditors-ledger",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Supplier Outstanding",
    path: "/finance/reports/supplier-outstanding",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Profit & Loss",
    path: "/finance/reports/profit-and-loss",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Balance Sheet",
    path: "/finance/reports/balance-sheet",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Cash Flow",
    path: "/finance/reports/cash-flow",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Ratio Analysis",
    path: "/finance/reports/ratio-analysis",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Graphical Chart of Accounts",
    path: "/finance/reports/chart-of-accounts-graphical",
    type: "dashboard",
  },
  {
    module_key: "finance",
    label: "Bank Reconciliation",
    path: "/finance/bank-reconciliation",
    type: "feature",
  },
  {
    module_key: "finance",
    label: "Post-Dated Cheques (PDC)",
    path: "/finance/pdc-postings",
    type: "feature",
  },
];
