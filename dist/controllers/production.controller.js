import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";

function toNumber(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const listWorkOrders = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const items = await query(`SELECT id, work_order_no, work_order_date, status, created_at,
          created_at,
          u.username AS created_by_name
         FROM prod_work_orders
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND branch_id = :branchId ORDER BY work_order_date DESC LIMIT 100`,
      { companyId, branchId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const getWorkOrderById = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

    const items = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM prod_work_orders
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId LIMIT 1`,
      { id, companyId, branchId },
    );
    if (!items.length) throw httpError(404, "NOT_FOUND", "Work order not found");
    res.json({ item: items[0] });
  } catch (err) {
    next(err);
  }
};

export const createWorkOrder = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const { work_order_no, work_order_date, status, remarks } = req.body || {};

    if (!work_order_no || !work_order_date)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "work_order_no and work_order_date are required",
      );

    const result = await query(`INSERT INTO prod_work_orders (company_id, branch_id, work_order_no, work_order_date, status, remarks)
       VALUES (:companyId, :branchId, :work_order_no, :work_order_date, :status, :remarks)`,
      {
        companyId,
        branchId,
        work_order_no,
        work_order_date,
        status: status || "DRAFT",
        remarks: remarks || null,
      },
    );

    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
};

