import { query } from "./server/db/pool.js";

async function testUpdate() {
  const companyId = 1;
  const branchId = 1;
  const id = 16; // The Salary Slip id we found
  const newHtml = "<!-- TEST UPDATE " + new Date().toISOString() + " -->\n" + "<div>Updated Content Test</div>";
  
  try {
    const result = await query(
      "UPDATE document_templates SET html_content = :newHtml, updated_at = NOW() WHERE id = :id AND company_id = :companyId AND branch_id = :branchId",
      { newHtml, id, companyId, branchId }
    );
    console.log("Update result:", JSON.stringify(result, null, 2));
    
    const [row] = await query("SELECT id, LEFT(html_content, 100) as snippet, updated_at FROM document_templates WHERE id = :id", { id });
    console.log("After update:", JSON.stringify(row, null, 2));
  } catch (e) {
    console.error("Update failed:", e);
  } finally {
    process.exit(0);
  }
}

testUpdate();
