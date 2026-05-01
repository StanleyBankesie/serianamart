import { query } from "./pool.js";

async function checkTemplate() {
  try {
    const rows = await query("SELECT id, name, document_type FROM document_templates WHERE name = 'Default payment-voucher'");
    console.log("Templates found:", rows);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}

checkTemplate();
