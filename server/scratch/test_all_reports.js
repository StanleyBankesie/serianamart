import { 
  voucherRegisterReport, paymentDueReport, outstandingReceivableReport,
  trialBalanceReport, auditTrailReport, journalsReport, customerOutstandingReport,
  cashFlowReport, balanceSheetReport, profitAndLossReport, ratioAnalysisReport,
  chartOfAccountsGraphical, listBankAccounts, listPdcPostings,
  supplierOutstandingReport, creditorsLedgerReport
} from "../controllers/finance.controller.js";

const mockReq = {
  scope: { companyId: 1, branchId: 1 },
  query: { from: "2026-01-01", to: "2026-12-31" }
};

const mockRes = {
  json: (data) => console.log(JSON.stringify(data, null, 2).substring(0, 500) + "..."),
  status: (code) => ({ json: (data) => console.log(`Status ${code}:`, data) })
};

const mockNext = (err) => console.error("Error in controller:", err);

async function test() {
  console.log("\n--- Testing Cash Flow Report ---");
  await cashFlowReport(mockReq, mockRes, mockNext);

  console.log("\n--- Testing Balance Sheet Report ---");
  await balanceSheetReport(mockReq, mockRes, mockNext);

  console.log("\n--- Testing P&L Report ---");
  await profitAndLossReport(mockReq, mockRes, mockNext);

  console.log("\n--- Testing Ratio Analysis Report ---");
  await ratioAnalysisReport(mockReq, mockRes, mockNext);

  console.log("\n--- Testing Graphical COA ---");
  await chartOfAccountsGraphical(mockReq, mockRes, mockNext);

  console.log("\n--- Testing Bank Accounts List ---");
  await listBankAccounts(mockReq, mockRes, mockNext);

  console.log("\n--- Testing PDC Postings List ---");
  await listPdcPostings(mockReq, mockRes, mockNext);

  console.log("\n--- Testing Supplier Outstanding Report ---");
  await supplierOutstandingReport(mockReq, mockRes, mockNext);

  console.log("\n--- Testing Creditors Ledger Report ---");
  await creditorsLedgerReport({ ...mockReq, query: { ...mockReq.query, accountId: 1 } }, mockRes, mockNext);
}

test().then(() => process.exit());
