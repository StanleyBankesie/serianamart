import React from "react";
import ModuleDashboard from "../../../components/ModuleDashboard.jsx";

/**
 * Finance Module Home Page
 * Provides navigation to all finance features including vouchers, accounting setup, and reports
 */
export default function FinanceHome() {
  const stats = [
    {
      icon: "💰",
      value: "$245,000",
      label: "Cash Balance",
      change: "↑ 5% this month",
      changeType: "positive",
      path: "/finance/reports",
    },
    {
      icon: "🧾",
      value: "12",
      label: "Pending Vouchers",
      change: "3 urgent",
      changeType: "neutral",
      path: "/finance/journal-voucher",
    },
    {
      icon: "📉",
      value: "$32,000",
      label: "Monthly Expenses",
      change: "↓ 2% vs last month",
      changeType: "positive",
      path: "/finance/reports",
    },
  ];

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
      sections={sections}
    />
  );
}
