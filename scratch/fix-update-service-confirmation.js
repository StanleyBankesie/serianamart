const fs = require('fs');
const file = 'server/controllers/purchase.controller.js';
let code = fs.readFileSync(file, 'utf8');

const anchor1 = `    const executionId = toNumber(body.execution_id) || null;
    const status = body.status || "DRAFT";
    const remarks = body.remarks || null;`;
const rep1 = `    const executionId = toNumber(body.execution_id) || null;
    const status = body.status || "DRAFT";
    const remarks = body.remarks || null;
    let createdBy = null;
    let extraUpdate = "";
    if (status === "APPROVED") {
      createdBy = req.user?.sub ? Number(req.user.sub) : null;
      extraUpdate = ", created_by = :createdBy, created_at = CURRENT_TIMESTAMP";
    }`;
code = code.replace(anchor1, rep1);

const anchor2 = `      UPDATE inv_service_confirmations
      SET sc_date = :scDate,
          supplier_id = :supplierId,
          order_id = :orderId,
          execution_id = :executionId,
          total_amount = :totalAmount,
          status = :status,
          remarks = :remarks
      WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
      \`,
      {
        id,
        companyId,
        branchId, branchIdsStr,
        scDate,
        supplierId,
        orderId,
        executionId,
        totalAmount,
        status,
        remarks,
      },`;
const rep2 = `      UPDATE inv_service_confirmations
      SET sc_date = :scDate,
          supplier_id = :supplierId,
          order_id = :orderId,
          execution_id = :executionId,
          total_amount = :totalAmount,
          status = :status,
          remarks = :remarks
          \${extraUpdate}
      WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
      \`,
      {
        id,
        companyId,
        branchId, branchIdsStr,
        scDate,
        supplierId,
        orderId,
        executionId,
        totalAmount,
        status,
        remarks,
        createdBy,
      },`;
code = code.replace(anchor2, rep2);

fs.writeFileSync(file, code);
console.log("Updated updateServiceConfirmation in purchase.controller.js");
