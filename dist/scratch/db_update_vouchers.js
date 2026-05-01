import { query } from '../db/pool.js';

async function run() {
  try {
    console.log("Checking for balanced_amount column...");
    const cols = await query("SHOW COLUMNS FROM fin_vouchers LIKE 'balanced_amount'");
    if (cols.length === 0) {
      console.log("Adding balanced_amount column to fin_vouchers...");
      await query("ALTER TABLE fin_vouchers ADD COLUMN balanced_amount DECIMAL(18,4) DEFAULT 0");
      await query("UPDATE fin_vouchers SET balanced_amount = total_debit");
    } else {
      console.log("balanced_amount column already exists.");
    }

    console.log("Updating voucher types for SV, PV, and PUV...");
    
    // 1. Rename existing 'PV' (Payment Voucher) to 'PAYV' if it's currently 'PV'
    // This avoids the duplicate entry when we rename 'PUV' to 'PV'
    await query("UPDATE fin_voucher_types SET code = 'PAYV' WHERE code = 'PV'");
    
    // 2. Rename 'PUV' to 'PV'
    await query("UPDATE fin_voucher_types SET code = 'PV', prefix = 'PV', next_number = 1 WHERE code = 'PUV'");

    // 3. Update 'SV'
    await query("UPDATE fin_voucher_types SET prefix = 'SV', next_number = 1 WHERE code = 'SV'");

    console.log("Database updates completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Database update failed:", err);
    process.exit(1);
  }
}

run();
