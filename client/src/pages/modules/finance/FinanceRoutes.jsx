import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import FinanceHome from "./FinanceHome.jsx";
import VoucherListPage from "./vouchers/VoucherListPage.jsx";
import VoucherFormPage from "./vouchers/VoucherFormPage.jsx";
import VoucherRegisterReportPage from "./reports/VoucherRegisterReportPage.jsx";
import TrialBalanceReportPage from "./reports/TrialBalanceReportPage.jsx";
import JournalReportPage from "./reports/JournalReportPage.jsx";
import GeneralLedgerReportPage from "./reports/GeneralLedgerReportPage.jsx";
import CreditorsLedgerReportPage from "./reports/CreditorsLedgerReportPage.jsx";
import SupplierOutstandingReportPage from "./reports/SupplierOutstandingReportPage.jsx";
import ProfitAndLossReportPage from "./reports/ProfitAndLossReportPage.jsx";
import BalanceSheetReportPage from "./reports/BalanceSheetReportPage.jsx";
import ChartOfAccountsReportPage from "./reports/ChartOfAccountsReportPage.jsx";
import CashFlowReportPage from "./reports/CashFlowReportPage.jsx";
import PaymentDueReportPage from "./reports/PaymentDueReportPage.jsx";
import OutstandingReceivableReportPage from "./reports/OutstandingReceivableReportPage.jsx";
import CustomerOutstandingReportPage from "./reports/CustomerOutstandingReportPage.jsx";
import AuditTrailReportPage from "./reports/AuditTrailReportPage.jsx";
import DebtorsLedgerReportPage from "./reports/DebtorsLedgerReportPage.jsx";
import RatioAnalysisReportPage from "./reports/RatioAnalysisReportPage.jsx";
import GraphicalChartOfAccountsPage from "./reports/GraphicalChartOfAccountsPage.jsx";
import AccountGroupsPage from "./setup/AccountGroupsPage.jsx";
import AccountsPage from "./setup/AccountsPage.jsx";
import TaxCodesPage from "./setup/TaxCodesPage.jsx";
import CurrenciesPage from "./setup/CurrenciesPage.jsx";
import FiscalYearsPage from "./setup/FiscalYearsPage.jsx";
import CostCentersPage from "./setup/CostCentersPage.jsx";
import OpeningBalancesPage from "./setup/OpeningBalancesPage.jsx";
import BankReconciliationList from "./banking/BankReconciliationList.jsx";
import BankReconciliationForm from "./banking/BankReconciliationForm.jsx";
import PdcPostingsList from "./banking/PdcPostingsList.jsx";
import PdcPostingForm from "./banking/PdcPostingForm.jsx";
import FinanceDashboardPage from "./FinanceDashboardPage.jsx";
import BankReconciliationsReportPage from "./banking/reports/BankReconciliationsReportPage.jsx";
import BankReconciliationTransactionReportPage from "./banking/reports/BankReconciliationTransactionReportPage.jsx";

export default function FinanceRoutes() {
  return (
    <Routes>
      <Route index element={<FinanceHome />} />
      <Route path="dashboard" element={<FinanceDashboardPage />} />

      <Route
        path="journal-voucher"
        element={<VoucherListPage voucherTypeCode="JV" title="Journal Entry" />}
      />
      <Route
        path="journal-voucher/create"
        element={
          <VoucherFormPage voucherTypeCode="JV" title="New Journal Entry" />
        }
      />
      <Route
        path="journal-voucher/:id"
        element={<VoucherFormPage voucherTypeCode="JV" title="Journal Entry" />}
      />

      <Route
        path="payment-voucher"
        element={<VoucherListPage voucherTypeCode="PAYV" title="Make Payment" />}
      />
      <Route
        path="payment-voucher/create"
        element={<VoucherFormPage voucherTypeCode="PAYV" title="Make Payment" />}
      />
      <Route
        path="payment-voucher/:id"
        element={<VoucherFormPage voucherTypeCode="PAYV" title="Make Payment" />}
      />

      <Route
        path="receipt-voucher"
        element={
          <VoucherListPage voucherTypeCode="RV" title="Receive Payment" />
        }
      />
      <Route
        path="receipt-voucher/create"
        element={
          <VoucherFormPage voucherTypeCode="RV" title="Receive Payment" />
        }
      />
      <Route
        path="receipt-voucher/:id"
        element={
          <VoucherFormPage voucherTypeCode="RV" title="Receive Payment" />
        }
      />

      <Route
        path="contra-voucher"
        element={
          <VoucherListPage voucherTypeCode="CV" title="Account Transfer" />
        }
      />
      <Route
        path="contra-voucher/create"
        element={
          <VoucherFormPage voucherTypeCode="CV" title="Account Transfer" />
        }
      />
      <Route
        path="contra-voucher/:id"
        element={
          <VoucherFormPage voucherTypeCode="CV" title="Account Transfer" />
        }
      />

      <Route
        path="sales-voucher"
        element={
          <VoucherListPage voucherTypeCode="SV" title="Sales Vouchers" />
        }
      />
      <Route
        path="sales-voucher/create"
        element={
          <VoucherFormPage voucherTypeCode="SV" title="New Sales Voucher" />
        }
      />
      <Route
        path="sales-voucher/:id"
        element={
          <VoucherFormPage voucherTypeCode="SV" title="Sales Vouchers" />
        }
      />

      <Route
        path="purchase-voucher"
        element={
          <VoucherListPage voucherTypeCode="PV" title="Purchase Vouchers" />
        }
      />
      <Route
        path="purchase-voucher/create"
        element={
          <VoucherFormPage voucherTypeCode="PV" title="New Purchase Voucher" />
        }
      />
      <Route
        path="purchase-voucher/:id"
        element={
          <VoucherFormPage voucherTypeCode="PV" title="Purchase Vouchers" />
        }
      />

      <Route
        path="debit-note"
        element={<VoucherListPage voucherTypeCode="DN" title="Debit Notes" />}
      />
      <Route
        path="debit-note/create"
        element={
          <VoucherFormPage voucherTypeCode="DN" title="New Debit Note" />
        }
      />
      <Route
        path="debit-note/:id"
        element={<VoucherFormPage voucherTypeCode="DN" title="Debit Notes" />}
      />

      <Route
        path="credit-note"
        element={<VoucherListPage voucherTypeCode="CN" title="Credit Notes" />}
      />
      <Route
        path="credit-note/create"
        element={
          <VoucherFormPage voucherTypeCode="CN" title="New Credit Note" />
        }
      />
      <Route
        path="credit-note/:id"
        element={<VoucherFormPage voucherTypeCode="CN" title="Credit Notes" />}
      />

      <Route path="account-groups" element={<AccountGroupsPage />} />
      <Route path="accounts" element={<AccountsPage />} />
      <Route path="coa" element={<AccountsPage />} />
      <Route path="tax-codes" element={<TaxCodesPage />} />
      <Route path="cost-centers" element={<CostCentersPage />} />
      <Route path="currencies" element={<CurrenciesPage />} />
      <Route path="fiscal-years" element={<FiscalYearsPage />} />
      <Route path="opening-balances" element={<OpeningBalancesPage />} />
      <Route path="bank-reconciliation" element={<BankReconciliationList />} />
      <Route
        path="bank-reconciliation/:id"
        element={<BankReconciliationForm />}
      />
      <Route path="pdc-postings" element={<PdcPostingsList />} />
      <Route path="pdc-postings/:id" element={<PdcPostingForm />} />
      <Route
        path="reports/bank-reconciliations"
        element={<BankReconciliationsReportPage />}
      />
      <Route
        path="reports/bank-reconciliation-transactions"
        element={<BankReconciliationTransactionReportPage />}
      />

      <Route path="reports" element={<VoucherRegisterReportPage />} />
      <Route
        path="reports/voucher-register"
        element={<VoucherRegisterReportPage />}
      />
      <Route
        path="reports/trial-balance"
        element={<TrialBalanceReportPage />}
      />
      <Route path="reports/journals" element={<JournalReportPage />} />
      <Route
        path="reports/general-ledger"
        element={<GeneralLedgerReportPage />}
      />
      <Route path="reports/payment-due" element={<PaymentDueReportPage />} />
      <Route path="reports/outstanding-receivable" element={<OutstandingReceivableReportPage />} />
      <Route
        path="reports/customer-outstanding"
        element={<CustomerOutstandingReportPage />}
      />
      <Route path="reports/audit-trail" element={<AuditTrailReportPage />} />
      <Route
        path="reports/debtors-ledger"
        element={<DebtorsLedgerReportPage />}
      />
      <Route
        path="reports/creditors-ledger"
        element={<CreditorsLedgerReportPage />}
      />
      <Route
        path="reports/supplier-outstanding"
        element={<SupplierOutstandingReportPage />}
      />
      <Route
        path="reports/ratio-analysis"
        element={<RatioAnalysisReportPage />}
      />
      <Route
        path="reports/profit-and-loss"
        element={<ProfitAndLossReportPage />}
      />
      <Route
        path="reports/balance-sheet"
        element={<BalanceSheetReportPage />}
      />
      <Route path="reports/cash-flow" element={<CashFlowReportPage />} />
      <Route
        path="reports/chart-of-accounts"
        element={<ChartOfAccountsReportPage />}
      />
      <Route
        path="reports/chart-of-accounts-graphical"
        element={<GraphicalChartOfAccountsPage />}
      />

      <Route path="*" element={<Navigate to="/finance" replace />} />
    </Routes>
  );
}
