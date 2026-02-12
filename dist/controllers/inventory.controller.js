import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";

export const listItems = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const rows = await query(
      `
      SELECT i.id,
             i.item_code,
             i.item_name,
             i.uom,
             i.item_type,
             t.type_name AS item_type_name,
             i.barcode,
             i.cost_price,
             i.selling_price,
             i.currency_id,
             i.price_type_id,
             i.image_url,
             i.vat_on_purchase_id,
             i.vat_on_sales_id,
             i.purchase_account_id,
             i.sales_account_id,
             i.is_active,
             COALESCE(sb.qty, 0) AS avail_qty
      FROM inv_items i
      LEFT JOIN inv_item_types t
        ON t.company_id = i.company_id
       AND t.type_code = i.item_type
      LEFT JOIN (
        SELECT company_id, branch_id, item_id, SUM(qty) AS qty
        FROM inv_stock_balances
        GROUP BY company_id, branch_id, item_id
      ) sb
        ON sb.company_id = i.company_id
       AND sb.branch_id = :branchId
       AND sb.item_id = i.id
      WHERE i.company_id = :companyId
      ORDER BY i.item_name ASC
      `,
      { companyId, branchId },
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
};

export const listWarehouses = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const rows = await query(
      `
      SELECT w.id, w.warehouse_code, w.warehouse_name, w.location, w.is_active, w.branch_id
      FROM inv_warehouses w
      WHERE w.company_id = :companyId AND w.branch_id = :branchId
      ORDER BY w.warehouse_name ASC
      `,
      { companyId, branchId },
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
};

export const getItemById = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const rows = await query(
      `
      SELECT i.*
      FROM inv_items i
      WHERE i.id = :id AND i.company_id = :companyId
      LIMIT 1
      `,
      { id, companyId },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Item not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
};

export const createItem = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const body = req.body || {};
    const itemCode = String(body.item_code || "").trim();
    const itemName = String(body.item_name || "").trim();
    const uom = String(body.uom || "PCS").trim() || "PCS";
    const itemType = body.item_type ? String(body.item_type).trim() : null;
    const barcode = body.barcode ? String(body.barcode).trim() : null;
    const costPrice = Number(body.cost_price || 0);
    const sellingPrice = Number(body.selling_price || 0);
    const currencyId = Number(body.currency_id || 0) || null;
    const priceTypeId = Number(body.price_type_id || 0) || null;
    const imageUrl = body.image_url ? String(body.image_url).trim() : null;
    const vatOnPurchaseId = Number(body.vat_on_purchase_id || 0) || null;
    const vatOnSalesId = Number(body.vat_on_sales_id || 0) || null;
    const purchaseAccountId = Number(body.purchase_account_id || 0) || null;
    const salesAccountId = Number(body.sales_account_id || 0) || null;
    const isActive =
      body.is_active === undefined ? 1 : Number(Boolean(body.is_active));
    if (!itemCode || !itemName)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "item_code and item_name are required",
      );
    const result = await query(
      `
      INSERT INTO inv_items (company_id, item_code, item_name, uom, item_type, barcode, cost_price, selling_price, currency_id, price_type_id, image_url, vat_on_purchase_id, vat_on_sales_id, purchase_account_id, sales_account_id, is_active)
      VALUES (:companyId, :itemCode, :itemName, :uom, :itemType, :barcode, :costPrice, :sellingPrice, :currencyId, :priceTypeId, :imageUrl, :vatOnPurchaseId, :vatOnSalesId, :purchaseAccountId, :salesAccountId, :isActive)
      `,
      {
        companyId,
        itemCode,
        itemName,
        uom,
        itemType,
        barcode,
        costPrice,
        sellingPrice,
        currencyId,
        priceTypeId,
        imageUrl,
        vatOnPurchaseId,
        vatOnSalesId,
        purchaseAccountId,
        salesAccountId,
        isActive,
      },
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
};

export const updateItem = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const body = req.body || {};
    const itemCode = String(body.item_code || "").trim();
    const itemName = String(body.item_name || "").trim();
    const uom = String(body.uom || "PCS").trim() || "PCS";
    const itemType = body.item_type ? String(body.item_type).trim() : null;
    const barcode = body.barcode ? String(body.barcode).trim() : null;
    const costPrice = Number(body.cost_price || 0);
    const sellingPrice = Number(body.selling_price || 0);
    const currencyId = Number(body.currency_id || 0) || null;
    const priceTypeId = Number(body.price_type_id || 0) || null;
    const imageUrl = body.image_url ? String(body.image_url).trim() : null;
    const vatOnPurchaseId = Number(body.vat_on_purchase_id || 0) || null;
    const vatOnSalesId = Number(body.vat_on_sales_id || 0) || null;
    const purchaseAccountId = Number(body.purchase_account_id || 0) || null;
    const salesAccountId = Number(body.sales_account_id || 0) || null;
    const isActive =
      body.is_active === undefined ? 1 : Number(Boolean(body.is_active));
    if (!itemCode || !itemName)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "item_code and item_name are required",
      );
    const upd = await query(
      `
      UPDATE inv_items
      SET item_code = :itemCode,
          item_name = :itemName,
          uom = :uom,
          item_type = :itemType,
          barcode = :barcode,
          cost_price = :costPrice,
          selling_price = :sellingPrice,
          currency_id = :currencyId,
          price_type_id = :priceTypeId,
          image_url = :imageUrl,
          vat_on_purchase_id = :vatOnPurchaseId,
          vat_on_sales_id = :vatOnSalesId,
          purchase_account_id = :purchaseAccountId,
          sales_account_id = :salesAccountId,
          is_active = :isActive
      WHERE id = :id AND company_id = :companyId
      `,
      {
        id,
        companyId,
        itemCode,
        itemName,
        uom,
        itemType,
        barcode,
        costPrice,
        sellingPrice,
        currencyId,
        priceTypeId,
        imageUrl,
        vatOnPurchaseId,
        vatOnSalesId,
        purchaseAccountId,
        salesAccountId,
        isActive,
      },
    );
    if (!upd.affectedRows) throw httpError(404, "NOT_FOUND", "Item not found");
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

export const getWarehouseById = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const rows = await query(
      `
      SELECT w.*
      FROM inv_warehouses w
      WHERE w.id = :id AND w.company_id = :companyId AND w.branch_id = :branchId
      LIMIT 1
      `,
      { id, companyId, branchId },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Warehouse not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
};

export const createWarehouse = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const body = req.body || {};
    const warehouseCode = String(body.warehouse_code || "").trim();
    const warehouseName = String(body.warehouse_name || "").trim();
    const location = body.location ? String(body.location).trim() : null;
    const isActive =
      body.is_active === undefined ? 1 : Number(Boolean(body.is_active));
    if (!warehouseCode || !warehouseName)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "warehouse_code and warehouse_name are required",
      );
    const result = await query(
      `
      INSERT INTO inv_warehouses (company_id, branch_id, warehouse_code, warehouse_name, location, is_active)
      VALUES (:companyId, :branchId, :warehouseCode, :warehouseName, :location, :isActive)
      `,
      {
        companyId,
        branchId,
        warehouseCode,
        warehouseName,
        location,
        isActive,
      },
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
};

export const updateWarehouse = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const body = req.body || {};
    const warehouseCode = String(body.warehouse_code || "").trim();
    const warehouseName = String(body.warehouse_name || "").trim();
    const location = body.location ? String(body.location).trim() : null;
    const isActive =
      body.is_active === undefined ? 1 : Number(Boolean(body.is_active));
    if (!warehouseCode || !warehouseName)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "warehouse_code and warehouse_name are required",
      );
    const upd = await query(
      `
      UPDATE inv_warehouses
      SET warehouse_code = :warehouseCode,
          warehouse_name = :warehouseName,
          location = :location,
          is_active = :isActive
      WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
      `,
      {
        id,
        companyId,
        branchId,
        warehouseCode,
        warehouseName,
        location,
        isActive,
      },
    );
    if (!upd.affectedRows)
      throw httpError(404, "NOT_FOUND", "Warehouse not found");
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

export const linkWarehouseBranch = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const body = req.body || {};
    const targetBranchId = Number(body.branch_id);
    if (!Number.isFinite(targetBranchId) || targetBranchId <= 0)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "branch_id is required to link warehouse",
      );
    const branchRow = await query(
      `
      SELECT id, company_id
      FROM adm_branches
      WHERE id = :branchId
      LIMIT 1
      `,
      { branchId: targetBranchId },
    );
    const branch = branchRow?.[0];
    if (!branch) throw httpError(404, "NOT_FOUND", "Target branch not found");
    if (Number(branch.company_id) !== Number(companyId))
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "Branch belongs to a different company",
      );
    const whRow = await query(
      `
      SELECT id, company_id, branch_id
      FROM inv_warehouses
      WHERE id = :id AND company_id = :companyId
      LIMIT 1
      `,
      { id, companyId },
    );
    const warehouse = whRow?.[0];
    if (!warehouse) throw httpError(404, "NOT_FOUND", "Warehouse not found");
    const allowedBranches = Array.isArray(req.user?.branchIds)
      ? req.user.branchIds.map(Number)
      : [];
    if (allowedBranches.length && !allowedBranches.includes(targetBranchId))
      throw httpError(403, "FORBIDDEN", "Branch access denied");
    const upd = await query(
      `
      UPDATE inv_warehouses
      SET branch_id = :branchId
      WHERE id = :id AND company_id = :companyId
      `,
      { id, companyId, branchId: targetBranchId },
    );
    if (!upd.affectedRows)
      throw httpError(404, "NOT_FOUND", "Warehouse not found");
    res.json({ ok: true, branch_id: targetBranchId });
  } catch (err) {
    next(err);
  }
};

export const getNextItemCode = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const rows = await query(
      `
      SELECT item_code
      FROM inv_items
      WHERE company_id = :companyId AND item_code REGEXP '^[0-9]+$'
      ORDER BY CAST(item_code AS UNSIGNED) DESC
      LIMIT 1
      `,
      { companyId },
    );
    let nextNum = 1;
    if (rows.length > 0) nextNum = parseInt(rows[0].item_code, 10) + 1;
    const nextCode = String(nextNum).padStart(6, "0");
    res.json({ nextCode });
  } catch (err) {
    next(err);
  }
};

export const listItemGroups = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const rows = await query(
      `
      SELECT g.id,
             g.group_code,
             g.group_name,
             g.parent_group_id,
             pg.group_name AS parent_group_name,
             g.is_active
      FROM inv_item_groups g
      LEFT JOIN inv_item_groups pg ON pg.id = g.parent_group_id
      WHERE g.company_id = :companyId
      ORDER BY g.group_name ASC, g.id ASC
      `,
      { companyId },
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
};

export const getItemGroupById = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const rows = await query(
      `
      SELECT g.*
      FROM inv_item_groups g
      WHERE g.id = :id AND g.company_id = :companyId
      LIMIT 1
      `,
      { id, companyId },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Item group not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
};

export const createItemGroup = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const body = req.body || {};
    const groupCode = String(body.group_code || "").trim();
    const groupName = String(body.group_name || "").trim();
    const parentGroupId = Number(body.parent_group_id || 0) || null;
    const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;
    if (!groupCode || !groupName)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "group_code and group_name are required",
      );
    const ins = await query(
      `
      INSERT INTO inv_item_groups (company_id, group_code, group_name, parent_group_id, is_active)
      VALUES (:companyId, :groupCode, :groupName, :parentGroupId, :isActive)
      `,
      { companyId, groupCode, groupName, parentGroupId, isActive },
    );
    res.status(201).json({ id: ins.insertId });
  } catch (err) {
    next(err);
  }
};

export const updateItemGroup = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const body = req.body || {};
    const groupCode = String(body.group_code || "").trim();
    const groupName = String(body.group_name || "").trim();
    const parentGroupId = Number(body.parent_group_id || 0) || null;
    const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;
    if (!groupCode || !groupName)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "group_code and group_name are required",
      );
    if (parentGroupId && parentGroupId === id)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "parent_group_id cannot be the same as id",
      );
    const upd = await query(
      `
      UPDATE inv_item_groups
      SET group_code = :groupCode,
          group_name = :groupName,
          parent_group_id = :parentGroupId,
          is_active = :isActive
      WHERE id = :id AND company_id = :companyId
      `,
      { id, companyId, groupCode, groupName, parentGroupId, isActive },
    );
    if (!upd.affectedRows)
      throw httpError(404, "NOT_FOUND", "Item group not found");
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

export const listItemCategories = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const rows = await query(
      `
      SELECT c.id,
             c.category_code,
             c.category_name,
             c.parent_category_id,
             pc.category_name AS parent_category_name,
             c.is_active
      FROM inv_item_categories c
      LEFT JOIN inv_item_categories pc ON pc.id = c.parent_category_id
      WHERE c.company_id = :companyId
      ORDER BY c.category_name ASC, c.id ASC
      `,
      { companyId },
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
};

export const getItemCategoryById = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const rows = await query(
      `
      SELECT c.*
      FROM inv_item_categories c
      WHERE c.id = :id AND c.company_id = :companyId
      LIMIT 1
      `,
      { id, companyId },
    );
    if (!rows.length)
      throw httpError(404, "NOT_FOUND", "Item category not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
};

export const createItemCategory = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const body = req.body || {};
    const categoryCode = String(body.category_code || "").trim();
    const categoryName = String(body.category_name || "").trim();
    const parentCategoryId = Number(body.parent_category_id || 0) || null;
    const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;
    if (!categoryCode || !categoryName)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "category_code and category_name are required",
      );
    const ins = await query(
      `
      INSERT INTO inv_item_categories (company_id, category_code, category_name, parent_category_id, is_active)
      VALUES (:companyId, :categoryCode, :categoryName, :parentCategoryId, :isActive)
      `,
      { companyId, categoryCode, categoryName, parentCategoryId, isActive },
    );
    res.status(201).json({ id: ins.insertId });
  } catch (err) {
    next(err);
  }
};

export const updateItemCategory = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const body = req.body || {};
    const categoryCode = String(body.category_code || "").trim();
    const categoryName = String(body.category_name || "").trim();
    const parentCategoryId = Number(body.parent_category_id || 0) || null;
    const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;
    if (!categoryCode || !categoryName)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "category_code and category_name are required",
      );
    if (parentCategoryId && parentCategoryId === id)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "parent_category_id cannot be the same as id",
      );
    const upd = await query(
      `
      UPDATE inv_item_categories
      SET category_code = :categoryCode,
          category_name = :categoryName,
          parent_category_id = :parentCategoryId,
          is_active = :isActive
      WHERE id = :id AND company_id = :companyId
      `,
      { id, companyId, categoryCode, categoryName, parentCategoryId, isActive },
    );
    if (!upd.affectedRows)
      throw httpError(404, "NOT_FOUND", "Item category not found");
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

export const deleteItemCategory = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    try {
      const del = await query(
        `DELETE FROM inv_item_categories WHERE id = :id AND company_id = :companyId`,
        { id, companyId },
      );
      if (!del.affectedRows)
        throw httpError(404, "NOT_FOUND", "Item category not found");
      res.json({ ok: true });
    } catch (err) {
      if (err.code === "ER_ROW_IS_REFERENCED_2") {
        return next(
          httpError(
            400,
            "CONSTRAINT_ERROR",
            "Cannot delete Category because it is in use.",
          ),
        );
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
};

export const listItemTypes = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const rows = await query(
      `
      SELECT t.id, t.type_code, t.type_name, t.is_active
      FROM inv_item_types t
      WHERE t.company_id = :companyId
      ORDER BY t.type_name ASC, t.id ASC
      `,
      { companyId },
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
};

export const getItemTypeById = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const rows = await query(
      `
      SELECT t.*
      FROM inv_item_types t
      WHERE t.id = :id AND t.company_id = :companyId
      LIMIT 1
      `,
      { id, companyId },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Item type not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
};

export const createItemType = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const body = req.body || {};
    const typeCode = String(body.type_code || "").trim();
    const typeName = String(body.type_name || "").trim();
    const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;
    if (!typeCode || !typeName)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "type_code and type_name are required",
      );
    const ins = await query(
      `
      INSERT INTO inv_item_types (company_id, type_code, type_name, is_active)
      VALUES (:companyId, :typeCode, :typeName, :isActive)
      `,
      { companyId, typeCode, typeName, isActive },
    );
    res.status(201).json({ id: ins.insertId });
  } catch (err) {
    next(err);
  }
};

export const updateItemType = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const body = req.body || {};
    const typeCode = String(body.type_code || "").trim();
    const typeName = String(body.type_name || "").trim();
    const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;
    if (!typeCode || !typeName)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "type_code and type_name are required",
      );
    const upd = await query(
      `
      UPDATE inv_item_types
      SET type_code = :typeCode,
          type_name = :typeName,
          is_active = :isActive
      WHERE id = :id AND company_id = :companyId
      `,
      { id, companyId, typeCode, typeName, isActive },
    );
    if (!upd.affectedRows)
      throw httpError(404, "NOT_FOUND", "Item type not found");
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

export const deleteItemType = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const del = await query(
      `DELETE FROM inv_item_types WHERE id = :id AND company_id = :companyId`,
      { id, companyId },
    );
    if (!del.affectedRows)
      throw httpError(404, "NOT_FOUND", "Item type not found");
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

export const listUnitConversions = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const rows = await query(
      `
      SELECT c.id,
             c.item_id,
             i.item_code,
             i.item_name,
             c.from_uom,
             c.to_uom,
             c.conversion_factor,
             c.is_active
      FROM inv_unit_conversions c
      JOIN inv_items i ON i.id = c.item_id
      WHERE c.company_id = :companyId
      ORDER BY i.item_name ASC, c.from_uom ASC, c.to_uom ASC, c.id ASC
      `,
      { companyId },
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
};

export const getUnitConversionById = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const rows = await query(
      `
      SELECT c.*
      FROM inv_unit_conversions c
      WHERE c.id = :id AND c.company_id = :companyId
      LIMIT 1
      `,
      { id, companyId },
    );
    if (!rows.length)
      throw httpError(404, "NOT_FOUND", "Unit conversion not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
};

export const createUnitConversion = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const body = req.body || {};
    const itemId = Number(body.item_id || 0);
    const fromUom = String(body.from_uom || "").trim();
    const toUom = String(body.to_uom || "").trim();
    const conversionFactor = Number(body.conversion_factor);
    const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;
    if (
      !itemId ||
      !fromUom ||
      !toUom ||
      !Number.isFinite(conversionFactor) ||
      conversionFactor <= 0
    ) {
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "item_id, from_uom, to_uom, conversion_factor (positive number) are required",
      );
    }
    const ins = await query(
      `
      INSERT INTO inv_unit_conversions (company_id, item_id, from_uom, to_uom, conversion_factor, is_active)
      VALUES (:companyId, :itemId, :fromUom, :toUom, :conversionFactor, :isActive)
      `,
      { companyId, itemId, fromUom, toUom, conversionFactor, isActive },
    );
    res.status(201).json({ id: ins.insertId });
  } catch (err) {
    next(err);
  }
};

export const updateUnitConversion = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const body = req.body || {};
    const itemId = Number(body.item_id || 0);
    const fromUom = String(body.from_uom || "").trim();
    const toUom = String(body.to_uom || "").trim();
    const conversionFactor = Number(body.conversion_factor);
    const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;
    if (
      !itemId ||
      !fromUom ||
      !toUom ||
      !Number.isFinite(conversionFactor) ||
      conversionFactor <= 0
    ) {
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "item_id, from_uom, to_uom, conversion_factor (positive number) are required",
      );
    }
    const upd = await query(
      `
      UPDATE inv_unit_conversions
      SET item_id = :itemId,
          from_uom = :fromUom,
          to_uom = :toUom,
          conversion_factor = :conversionFactor,
          is_active = :isActive
      WHERE id = :id AND company_id = :companyId
      `,
      { id, companyId, itemId, fromUom, toUom, conversionFactor, isActive },
    );
    if (!upd.affectedRows)
      throw httpError(404, "NOT_FOUND", "Unit conversion not found");
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

export const listUoms = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const rows = await query(
      `
      SELECT u.*
      FROM inv_uoms u
      WHERE u.company_id = :companyId
      ORDER BY u.uom_name ASC
      `,
      { companyId },
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
};

export const createUom = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const body = req.body || {};
    const uomCode = String(body.uom_code || "").trim();
    const uomName = String(body.uom_name || "").trim();
    const uomType = String(body.uom_type || "COUNT").trim();
    const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;
    if (!uomCode || !uomName)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "uom_code and uom_name are required",
      );
    const ins = await query(
      `
      INSERT INTO inv_uoms (company_id, uom_code, uom_name, uom_type, is_active)
      VALUES (:companyId, :uomCode, :uomName, :uomType, :isActive)
      `,
      { companyId, uomCode, uomName, uomType, isActive },
    );
    res.status(201).json({ id: ins.insertId });
  } catch (err) {
    next(err);
  }
};
