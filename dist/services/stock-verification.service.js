import { query } from "../db/pool.js";

async function insertLedgerRow(conn, params) {
  const {
    companyId,
    branchId,
    warehouseId,
    itemId,
    qtyChange,
    verificationId,
    createdBy = null,
  } = params;

  if (!Number.isFinite(Number(qtyChange)) || Number(qtyChange) === 0) return;

  await conn.execute(
    `
    INSERT INTO inv_stock_ledger
      (company_id, branch_id, warehouse_id, item_id, transaction_type, qty_change, source_ref, created_by)
    VALUES
      (:companyId, :branchId, :warehouseId, :itemId, 'STOCK_VERIFICATION', :qtyChange, :sourceRef, :createdBy)
    `,
    {
      companyId,
      branchId,
      warehouseId,
      itemId,
      qtyChange: Number(qtyChange),
      sourceRef: String(verificationId),
      createdBy,
    },
  );
}

export async function applyStockVerificationApprovalTx(
  conn,
  { companyId, branchId, verificationId, warehouseId, createdBy = null },
) {
  const [details] = await conn.execute(
    `
    SELECT
      item_id,
      COALESCE(verified_qty, counted_qty, 0) AS verified_qty
    FROM inv_stock_verification_details
    WHERE verification_id = :verificationId
    ORDER BY id ASC
    `,
    { verificationId },
  );

  for (const detail of details || []) {
    const itemId = Number(detail.item_id || 0);
    const verifiedQty = Number(detail.verified_qty || 0);
    if (!itemId) continue;

    const [rows] = await conn.execute(
      `
      SELECT id, qty
      FROM inv_stock_balances
      WHERE company_id = :companyId
        AND warehouse_id = :warehouseId
        AND item_id = :itemId
      ORDER BY id ASC
      `,
      { companyId, warehouseId, itemId },
    );

    const existingRows = Array.isArray(rows) ? rows : [];
    const existingTotalQty = existingRows.reduce(
      (sum, row) => sum + Number(row.qty || 0),
      0,
    );

    if (existingRows.length > 0) {
      const firstRowId = Number(existingRows[0].id);
      await conn.execute(
        `UPDATE inv_stock_balances SET qty = 0 WHERE company_id = :companyId AND warehouse_id = :warehouseId AND item_id = :itemId`,
        { companyId, warehouseId, itemId },
      );
      await conn.execute(
        `UPDATE inv_stock_balances SET qty = :verifiedQty WHERE id = :id`,
        { verifiedQty, id: firstRowId },
      );
    } else {
      await conn.execute(
        `
        INSERT INTO inv_stock_balances
          (company_id, branch_id, warehouse_id, item_id, qty, reserved_qty, source_type, source_id, entry_date)
        VALUES
          (:companyId, :branchId, :warehouseId, :itemId, :verifiedQty, 0, 'STOCK_VERIFICATION', :sourceId, NOW())
        `,
        {
          companyId,
          branchId,
          warehouseId,
          itemId,
          verifiedQty,
          sourceId: verificationId,
        },
      );
    }

    await insertLedgerRow(conn, {
      companyId,
      branchId,
      warehouseId,
      itemId,
      qtyChange: verifiedQty - existingTotalQty,
      verificationId,
      createdBy,
    });
  }
}

export async function ensureStockVerificationDetailColumns() {
  const columns = await query(
    `
    SELECT COLUMN_NAME
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'inv_stock_verification_details'
    `,
  ).catch(() => []);

  const existing = new Set((columns || []).map((column) => column.COLUMN_NAME));

  if (!existing.has("verified_qty")) {
    await query(
      `ALTER TABLE inv_stock_verification_details ADD COLUMN verified_qty DECIMAL(18,3) NULL AFTER counted_qty`,
    ).catch(() => {});
  }
}
