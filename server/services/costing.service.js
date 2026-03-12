import { pool } from "../db/pool.js";

function isYes(v) {
  if (v == null) return false;
  const s = String(v).trim().toUpperCase();
  return s === "Y" || s === "1" || s === "YES" || s === "TRUE";
}

export async function updateItemAverageCostTx(conn, params) {
  const {
    companyId,
    branchId,
    warehouseId,
    itemId,
    purchaseQty,
    purchaseUnitCost,
  } = params || {};
  const qty = Number(purchaseQty || 0);
  if (!(Number.isFinite(qty) && qty > 0)) return { updated: false };
  const unitCost = Number(purchaseUnitCost || 0);
  const [itemRows] = await conn.execute(
    `
    SELECT id, cost_price, is_stockable, service_item
    FROM inv_items
    WHERE company_id = :companyId AND id = :itemId
    LIMIT 1
    FOR UPDATE
    `,
    { companyId, itemId },
  );
  if (!itemRows.length) return { updated: false };
  const item = itemRows[0];
  if (!isYes(item.is_stockable) || isYes(item.service_item)) {
    return { updated: false };
  }
  const [sbRows] = await conn.execute(
    `
    SELECT warehouse_id, qty
    FROM inv_stock_balances
    WHERE company_id = :companyId AND branch_id = :branchId AND item_id = :itemId
    FOR UPDATE
    `,
    { companyId, branchId, itemId },
  );
  let currentQty = 0;
  for (const r of sbRows || []) {
    currentQty += Number(r.qty || 0);
  }
  const currentCost = Number(item.cost_price || 0);
  let newCost = currentCost;
  if (currentQty <= 0) {
    newCost = unitCost;
  } else {
    newCost = (currentQty * currentCost + qty * unitCost) / (currentQty + qty);
  }
  const roundedCost = Number(newCost.toFixed(2));
  await conn.execute(
    `
    UPDATE inv_items
    SET cost_price = :roundedCost
    WHERE company_id = :companyId AND id = :itemId
    `,
    { roundedCost, companyId, itemId },
  );
  await conn.execute(
    `
    INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
    VALUES (:companyId, :branchId, :warehouseId, :itemId, :qty)
    ON DUPLICATE KEY UPDATE qty = qty + :qty
    `,
    { companyId, branchId, warehouseId, itemId, qty },
  );
  return { updated: true, newCost: roundedCost };
}

export async function updateItemAverageCost(params) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const res = await updateItemAverageCostTx(conn, params);
    await conn.commit();
    return res;
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    throw e;
  } finally {
    conn.release();
  }
}
