import { 
  voucherRegisterReport, paymentDueReport, outstandingReceivableReport,
  trialBalanceReport, auditTrailReport, journalsReport, customerOutstandingReport
} from "../controllers/finance.controller.js";

const mockReq = {
  scope: { companyId: 1, branchId: 1 },
  query: { from: "2000-01-01", to: "2030-12-31" }
};

const mockRes = {
  json: (data) => {
    console.log("Response:", JSON.stringify(data, null, 2));
  }
};

const mockNext = (err) => {
  console.error("Error:", err);
};

async function test() {
  console.log("--- Testing Voucher Register Report ---");
  await voucherRegisterReport(mockReq, mockRes, mockNext);

  console.log("\n--- Testing Payment Due Report ---");
  await paymentDueReport(mockReq, mockRes, mockNext);

  console.log("\n--- Testing Outstanding Receivable Report ---");
  await outstandingReceivableReport(mockReq, mockRes, mockNext);

  console.log("\n--- Testing Trial Balance Report ---");
  await trialBalanceReport(mockReq, mockRes, mockNext);

  console.log("\n--- Testing Audit Trail Report ---");
  await auditTrailReport(mockReq, mockRes, mockNext);

  console.log("\n--- Testing Journals Report ---");
  await journalsReport(mockReq, mockRes, mockNext);

  console.log("\n--- Testing Customer Outstanding Report ---");
  await customerOutstandingReport(mockReq, mockRes, mockNext);
}

test().then(() => process.exit());
