import { query, pool } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import { consumeStockFIFOTx, recordMovementTx } from "../services/stock.service.js";

function toNumber(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ===== BILL OF MATERIALS (BOM) =====

export const listBoms = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const items = await query(
      `SELECT b.*, i.item_name, i.item_code, u.username AS created_by_name
       FROM prod_boms b
       JOIN inv_items i ON i.id = b.item_id
       LEFT JOIN adm_users u ON u.id = b.created_by
       WHERE b.company_id = :companyId
       ORDER BY b.created_at DESC`,
      { companyId }
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const getBomById = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

    const [bom] = await query(
      `SELECT b.*, i.item_name, i.item_code
       FROM prod_boms b
       JOIN inv_items i ON i.id = b.item_id
       WHERE b.id = :id AND b.company_id = :companyId`,
      { id, companyId }
    );
    if (!bom) throw httpError(404, "NOT_FOUND", "BOM not found");

    const components = await query(
      `SELECT bi.*, i.item_name, i.item_code
       FROM prod_bom_items bi
       JOIN inv_items i ON i.id = bi.item_id
       WHERE bi.bom_id = :id`,
      { id }
    );

    res.json({ item: { ...bom, components } });
  } catch (err) {
    next(err);
  }
};

export const createBom = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId } = req.scope;
    const userId = req.user?.sub || req.user?.id;
    const { item_id, bom_name, output_qty, components } = req.body || {};

    if (!item_id || !bom_name || !output_qty) {
      throw httpError(400, "VALIDATION_ERROR", "Missing required fields");
    }

    await conn.beginTransaction();

    const [result] = await conn.execute(
      `INSERT INTO prod_boms (company_id, item_id, bom_name, output_qty, created_by)
       VALUES (:companyId, :item_id, :bom_name, :output_qty, :userId)`,
      { companyId, item_id, bom_name, output_qty, userId }
    );
    const bomId = result.insertId;

    if (Array.isArray(components)) {
      for (const comp of components) {
        await conn.execute(
          `INSERT INTO prod_bom_items (bom_id, item_id, qty, uom)
           VALUES (:bomId, :item_id, :qty, :uom)`,
          { bomId, item_id: comp.item_id, qty: comp.qty, uom: comp.uom }
        );
      }
    }

    await conn.commit();
    res.status(201).json({ id: bomId });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

export const updateBom = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId } = req.scope;
    const id = toNumber(req.params.id);
    const { item_id, bom_name, output_qty, is_active, components } = req.body || {};

    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

    await conn.beginTransaction();

    await conn.execute(
      `UPDATE prod_boms 
       SET item_id = :item_id, bom_name = :bom_name, output_qty = :output_qty, is_active = :is_active
       WHERE id = :id AND company_id = :companyId`,
      { id, companyId, item_id, bom_name, output_qty, is_active: is_active ? 1 : 0 }
    );

    await conn.execute(`DELETE FROM prod_bom_items WHERE bom_id = :id`, { id });

    if (Array.isArray(components)) {
      for (const comp of components) {
        await conn.execute(
          `INSERT INTO prod_bom_items (bom_id, item_id, qty, uom)
           VALUES (:bomId, :item_id, :qty, :uom)`,
          { bomId: id, item_id: comp.item_id, qty: comp.qty, uom: comp.uom }
        );
      }
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

export const deleteBom = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const id = toNumber(req.params.id);
    await query(`DELETE FROM prod_boms WHERE id = :id AND company_id = :companyId`, { id, companyId });
    await query(`DELETE FROM prod_bom_items WHERE bom_id = :id`, { id });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ===== WORK ORDERS =====

export const listWorkOrders = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const items = await query(
      `SELECT wo.*, b.bom_name, i.item_name, i.item_code, u.username AS created_by_name
       FROM prod_work_orders wo
       JOIN prod_boms b ON b.id = wo.bom_id
       JOIN inv_items i ON i.id = b.item_id
       LEFT JOIN adm_users u ON u.id = wo.created_by
       WHERE wo.company_id = :companyId AND wo.branch_id = :branchId
       ORDER BY wo.work_order_date DESC, wo.id DESC`,
      { companyId, branchId }
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

    const [wo] = await query(
      `SELECT wo.*, b.bom_name, i.item_name, i.item_code
       FROM prod_work_orders wo
       JOIN prod_boms b ON b.id = wo.bom_id
       JOIN inv_items i ON i.id = b.item_id
       WHERE wo.id = :id AND wo.company_id = :companyId AND wo.branch_id = :branchId`,
      { id, companyId, branchId }
    );
    if (!wo) throw httpError(404, "NOT_FOUND", "Work order not found");

    const items = await query(
      `SELECT woi.*, i.item_name, i.item_code
       FROM prod_work_order_items woi
       JOIN inv_items i ON i.id = woi.item_id
       WHERE woi.work_order_id = :id`,
      { id }
    );

    res.json({ item: { ...wo, items } });
  } catch (err) {
    next(err);
  }
};

export const createWorkOrder = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId, branchId } = req.scope;
    const userId = req.user?.sub || req.user?.id;
    const { work_order_no, work_order_date, bom_id, qty_to_produce, warehouse_id, remarks } = req.body || {};

    if (!work_order_no || !work_order_date || !bom_id || !qty_to_produce) {
      throw httpError(400, "VALIDATION_ERROR", "Missing required fields");
    }

    await conn.beginTransaction();

    const [result] = await conn.execute(
      `INSERT INTO prod_work_orders (company_id, branch_id, work_order_no, work_order_date, bom_id, qty_to_produce, warehouse_id, status, remarks, created_by)
       VALUES (:companyId, :branchId, :work_order_no, :work_order_date, :bom_id, :qty_to_produce, :warehouse_id, 'DRAFT', :remarks, :userId)`,
      { companyId, branchId, work_order_no, work_order_date, bom_id, qty_to_produce, warehouse_id, remarks, userId }
    );
    const woId = result.insertId;

    // Pull components from BOM
    const [bomItems] = await conn.execute(
      `SELECT item_id, qty, uom FROM prod_bom_items WHERE bom_id = :bom_id`,
      { bom_id }
    );

    const [bomHdr] = await conn.execute(
      `SELECT output_qty FROM prod_boms WHERE id = :bom_id`,
      { bom_id }
    );
    const outputQty = Number(bomHdr[0]?.output_qty || 1);
    const ratio = qty_to_produce / outputQty;

    for (const bi of bomItems) {
      await conn.execute(
        `INSERT INTO prod_work_order_items (work_order_id, item_id, planned_qty, actual_qty, uom)
         VALUES (:woId, :item_id, :planned_qty, :planned_qty, :uom)`,
        { woId, item_id: bi.item_id, planned_qty: bi.qty * ratio, uom: bi.uom }
      );
    }

    await conn.commit();
    res.status(201).json({ id: woId });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

export const updateWorkOrderStatus = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId, branchId } = req.scope;
    const userId = req.user?.sub || req.user?.id;
    const id = toNumber(req.params.id);
    const { status, actual_items } = req.body || {};

    if (!id || !status) throw httpError(400, "VALIDATION_ERROR", "Missing required fields");

    const [wo] = await query(
      `SELECT * FROM prod_work_orders WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
      { id, companyId, branchId }
    );
    if (!wo) throw httpError(404, "NOT_FOUND", "Work order not found");

    if (wo.status === "COMPLETED") {
      throw httpError(400, "BAD_REQUEST", "Completed work orders cannot be modified");
    }

    await conn.beginTransaction();

    await conn.execute(
      `UPDATE prod_work_orders SET status = :status WHERE id = :id`,
      { status, id }
    );

    // If actual items provided, update them
    if (Array.isArray(actual_items)) {
      for (const item of actual_items) {
        await conn.execute(
          `UPDATE prod_work_order_items SET actual_qty = :actual_qty WHERE work_order_id = :id AND item_id = :itemId`,
          { actual_qty: item.actual_qty, id, itemId: item.item_id }
        );
      }
    }

    // IF COMPLETED -> Inventory integration
    if (status === "COMPLETED") {
      // 1. Consume components
      const [items] = await conn.execute(
        `SELECT item_id, actual_qty FROM prod_work_order_items WHERE work_order_id = :id`,
        { id }
      );

      for (const item of items) {
        if (Number(item.actual_qty) > 0) {
          await consumeStockFIFOTx(conn, {
            companyId,
            branchId,
            warehouseId: wo.warehouse_id,
            itemId: item.item_id,
            transactionType: "PRODUCTION_CONSUMPTION",
            qtyToConsume: item.actual_qty,
            sourceRef: wo.work_order_no,
            createdBy: userId
          });
        }
      }

      // 2. Add finished goods
      const [bom] = await conn.execute(
        `SELECT item_id FROM prod_boms WHERE id = :bom_id`,
        { bom_id: wo.bom_id }
      );
      if (bom[0]) {
        await recordMovementTx(conn, {
          companyId,
          branchId,
          warehouseId: wo.warehouse_id,
          itemId: bom[0].item_id,
          transactionType: "PRODUCTION_OUTPUT",
          qtyChange: wo.qty_to_produce,
          sourceRef: wo.work_order_no,
          createdBy: userId,
          sourceType: "WORK_ORDER",
          sourceId: id
        });
      }
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// ===== PROCESSES MASTER =====

export const listProcesses = async (req, res) => {
  try {
    const { company_id } = req.user;
    const items = await query(
      "SELECT * FROM prod_processes WHERE company_id = :company_id ORDER BY process_name ASC",
      { company_id }
    );
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createProcess = async (req, res) => {
  try {
    const { company_id } = req.user;
    const { process_name, description, is_active } = req.body;
    const result = await query(
      "INSERT INTO prod_processes (company_id, process_name, description, is_active) VALUES (:company_id, :process_name, :description, :is_active)",
      { company_id, process_name, description, is_active: is_active ? 1 : 0 }
    );
    res.json({ id: result.insertId, message: "Process created successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProcess = async (req, res) => {
  try {
    const { id } = req.params;
    const { process_name, description, is_active } = req.body;
    await query(
      "UPDATE prod_processes SET process_name = :process_name, description = :description, is_active = :is_active WHERE id = :id",
      { id, process_name, description, is_active: is_active ? 1 : 0 }
    );
    res.json({ message: "Process updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteProcess = async (req, res) => {
  try {
    const { id } = req.params;
    await query("DELETE FROM prod_processes WHERE id = :id", { id });
    res.json({ message: "Process deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===== MACHINES MASTER =====

export const listMachines = async (req, res) => {
  try {
    const { company_id, branch_id } = req.user;
    const items = await query(
      "SELECT * FROM prod_machines WHERE company_id = :company_id AND branch_id = :branch_id ORDER BY machine_name ASC",
      { company_id, branch_id }
    );
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createMachine = async (req, res) => {
  try {
    const { company_id, branch_id } = req.user;
    const { machine_name, machine_code, is_active } = req.body;
    const result = await query(
      "INSERT INTO prod_machines (company_id, branch_id, machine_name, machine_code, is_active) VALUES (:company_id, :branch_id, :machine_name, :machine_code, :is_active)",
      { company_id, branch_id, machine_name, machine_code, is_active: is_active ? 1 : 0 }
    );
    res.json({ id: result.insertId, message: "Machine created successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateMachine = async (req, res) => {
  try {
    const { id } = req.params;
    const { machine_name, machine_code, is_active } = req.body;
    await query(
      "UPDATE prod_machines SET machine_name = :machine_name, machine_code = :machine_code, is_active = :is_active WHERE id = :id",
      { id, machine_name, machine_code, is_active: is_active ? 1 : 0 }
    );
    res.json({ message: "Machine updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteMachine = async (req, res) => {
  try {
    const { id } = req.params;
    await query("DELETE FROM prod_machines WHERE id = :id", { id });
    res.json({ message: "Machine deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===== SHIFTS MASTER =====

export const listShifts = async (req, res) => {
  try {
    const { company_id } = req.user;
    const items = await query(
      "SELECT * FROM prod_shifts WHERE company_id = :company_id ORDER BY start_time ASC",
      { company_id }
    );
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createShift = async (req, res) => {
  try {
    const { company_id } = req.user;
    const { shift_name, start_time, end_time } = req.body;
    const result = await query(
      "INSERT INTO prod_shifts (company_id, shift_name, start_time, end_time) VALUES (:company_id, :shift_name, :start_time, :end_time)",
      { company_id, shift_name, start_time, end_time }
    );
    res.json({ id: result.insertId, message: "Shift created successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateShift = async (req, res) => {
  try {
    const { id } = req.params;
    const { shift_name, start_time, end_time } = req.body;
    await query(
      "UPDATE prod_shifts SET shift_name = :shift_name, start_time = :start_time, end_time = :end_time WHERE id = :id",
      { id, shift_name, start_time, end_time }
    );
    res.json({ message: "Shift updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteShift = async (req, res) => {
  try {
    const { id } = req.params;
    await query("DELETE FROM prod_shifts WHERE id = :id", { id });
    res.json({ message: "Shift deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===== ROUTINGS =====

export const listRoutings = async (req, res) => {
  try {
    const { company_id } = req.user;
    const items = await query(
      `SELECT r.*, i.item_name, i.item_code 
       FROM prod_routings r
       JOIN inv_items i ON r.item_id = i.id
       WHERE r.company_id = :company_id 
       ORDER BY i.item_name ASC`,
      { company_id }
    );
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getRoutingById = async (req, res) => {
  try {
    const { id } = req.params;
    const routing = await query("SELECT * FROM prod_routings WHERE id = :id", { id });
    if (!routing?.[0]) return res.status(404).json({ message: "Routing not found" });

    const steps = await query(
      `SELECT rs.*, p.process_name 
       FROM prod_routing_steps rs
       JOIN prod_processes p ON rs.process_id = p.id
       WHERE rs.routing_id = :id
       ORDER BY rs.step_order ASC`,
      { id }
    );

    res.json({ ...routing[0], steps });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createRouting = async (req, res) => {
  const conn = await query("getConnection");
  try {
    await conn.beginTransaction();
    const { company_id } = req.user;
    const { item_id, routing_name, is_default, steps } = req.body;

    const [result] = await conn.execute(
      "INSERT INTO prod_routings (company_id, item_id, routing_name, is_default) VALUES (?, ?, ?, ?)",
      [company_id, item_id, routing_name, is_default ? 1 : 0]
    );
    const routing_id = result.insertId;

    if (Array.isArray(steps)) {
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        await conn.execute(
          "INSERT INTO prod_routing_steps (routing_id, process_id, step_order, setup_time_mins, cycle_time_mins) VALUES (?, ?, ?, ?, ?)",
          [routing_id, s.process_id, i + 1, s.setup_time_mins || 0, s.cycle_time_mins || 0]
        );
      }
    }

    await conn.commit();
    res.json({ id: routing_id, message: "Routing created successfully" });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};

export const updateRouting = async (req, res) => {
  const conn = await query("getConnection");
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { routing_name, is_default, steps } = req.body;

    await conn.execute(
      "UPDATE prod_routings SET routing_name = ?, is_default = ? WHERE id = ?",
      [routing_name, is_default ? 1 : 0, id]
    );

    await conn.execute("DELETE FROM prod_routing_steps WHERE routing_id = ?", [id]);

    if (Array.isArray(steps)) {
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        await conn.execute(
          "INSERT INTO prod_routing_steps (routing_id, process_id, step_order, setup_time_mins, cycle_time_mins) VALUES (?, ?, ?, ?, ?)",
          [id, s.process_id, i + 1, s.setup_time_mins || 0, s.cycle_time_mins || 0]
        );
      }
    }

    await conn.commit();
    res.json({ message: "Routing updated successfully" });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};

// ===== DAILY PRODUCTION PLANS =====

export const listDailyPlans = async (req, res) => {
  try {
    const { company_id, branch_id } = req.user;
    const items = await query(
      `SELECT * FROM prod_daily_plans 
       WHERE company_id = :company_id AND branch_id = :branch_id 
       ORDER BY plan_date DESC, plan_no DESC`,
      { company_id, branch_id }
    );
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getDailyPlanById = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await query("SELECT * FROM prod_daily_plans WHERE id = :id", { id });
    if (!plan?.[0]) return res.status(404).json({ message: "Plan not found" });

    const items = await query(
      `SELECT dpi.*, i.item_name, i.item_code, b.bom_name
       FROM prod_daily_plan_items dpi
       JOIN inv_items i ON dpi.item_id = i.id
       LEFT JOIN prod_boms b ON dpi.bom_id = b.id
       WHERE dpi.plan_id = :id`,
      { id }
    );

    res.json({ ...plan[0], items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createDailyPlan = async (req, res) => {
  const conn = await query("getConnection");
  try {
    await conn.beginTransaction();
    const { company_id, branch_id, id: user_id } = req.user;
    const { plan_date, remarks, items } = req.body;

    const plan_no = `PLAN-${Date.now().toString().slice(-6)}`;

    const [result] = await conn.execute(
      "INSERT INTO prod_daily_plans (company_id, branch_id, plan_no, plan_date, remarks, created_by) VALUES (?, ?, ?, ?, ?, ?)",
      [company_id, branch_id, plan_no, plan_date, remarks, user_id]
    );
    const plan_id = result.insertId;

    if (Array.isArray(items)) {
      for (const item of items) {
        await conn.execute(
          "INSERT INTO prod_daily_plan_items (plan_id, item_id, bom_id, qty_to_produce) VALUES (?, ?, ?, ?)",
          [plan_id, item.item_id, item.bom_id, item.qty_to_produce]
        );
      }
    }

    await conn.commit();
    res.json({ id: plan_id, plan_no, message: "Daily plan created successfully" });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};

export const updateDailyPlan = async (req, res) => {
  const conn = await query("getConnection");
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { plan_date, remarks, items, status } = req.body;

    await conn.execute(
      "UPDATE prod_daily_plans SET plan_date = ?, remarks = ?, status = ? WHERE id = ?",
      [plan_date, remarks, status || 'DRAFT', id]
    );

    await conn.execute("DELETE FROM prod_daily_plan_items WHERE plan_id = ?", [id]);

    if (Array.isArray(items)) {
      for (const item of items) {
        await conn.execute(
          "INSERT INTO prod_daily_plan_items (plan_id, item_id, bom_id, qty_to_produce) VALUES (?, ?, ?, ?)",
          [id, item.item_id, item.bom_id, item.qty_to_produce]
        );
      }
    }

    await conn.commit();
    res.json({ message: "Daily plan updated successfully" });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};

// ===== JOB CARDS =====

export const listJobCards = async (req, res) => {
  try {
    const { company_id, branch_id } = req.user;
    const items = await query(
      `SELECT jc.*, i.item_name, p.process_name, m.machine_name, s.shift_name
       FROM prod_job_cards jc
       JOIN inv_items i ON jc.item_id = i.id
       JOIN prod_processes p ON jc.process_id = p.id
       LEFT JOIN prod_machines m ON jc.machine_id = m.id
       LEFT JOIN prod_shifts s ON jc.shift_id = s.id
       WHERE jc.company_id = :company_id AND jc.branch_id = :branch_id 
       ORDER BY jc.created_at DESC`,
      { company_id, branch_id }
    );
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getJobCardById = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await query(
      `SELECT jc.*, i.item_name, i.item_code, p.process_name, m.machine_name, s.shift_name
       FROM prod_job_cards jc
       JOIN inv_items i ON jc.item_id = i.id
       JOIN prod_processes p ON jc.process_id = p.id
       LEFT JOIN prod_machines m ON jc.machine_id = m.id
       LEFT JOIN prod_shifts s ON jc.shift_id = s.id
       WHERE jc.id = :id`,
      { id }
    );
    if (!item?.[0]) return res.status(404).json({ message: "Job card not found" });
    res.json(item[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const generateJobCards = async (req, res) => {
  const conn = await query("getConnection");
  try {
    await conn.beginTransaction();
    const { plan_id } = req.body;
    const { company_id, branch_id } = req.user;

    const planItems = await query(
      `SELECT dpi.*, r.id as routing_id
       FROM prod_daily_plan_items dpi
       LEFT JOIN prod_routings r ON dpi.item_id = r.item_id AND r.is_default = 1
       WHERE dpi.plan_id = :plan_id`,
      { plan_id }
    );

    for (const pi of planItems) {
      if (!pi.routing_id) continue;

      const routingSteps = await query(
        "SELECT * FROM prod_routing_steps WHERE routing_id = :routing_id ORDER BY step_order ASC",
        { routing_id: pi.routing_id }
      );

      for (const step of routingSteps) {
        await conn.execute(
          "INSERT INTO prod_job_cards (company_id, branch_id, plan_id, item_id, process_id, planned_qty) VALUES (?, ?, ?, ?, ?, ?)",
          [company_id, branch_id, plan_id, pi.item_id, step.process_id, pi.qty_to_produce]
        );
      }
    }

    await conn.commit();
    res.json({ message: "Job cards generated successfully" });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};

export const updateJobCard = async (req, res) => {
  try {
    const { id } = req.params;
    const { machine_id, shift_id, actual_qty, status, start_time, end_time } = req.body;
    
    await query(
      `UPDATE prod_job_cards 
       SET machine_id = :machine_id, shift_id = :shift_id, actual_qty = :actual_qty, 
           status = :status, start_time = :start_time, end_time = :end_time 
       WHERE id = :id`,
      { id, machine_id, shift_id, actual_qty, status, start_time, end_time }
    );
    
    res.json({ message: "Job card updated" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===== MATERIAL RECEIPTS =====

export const listMaterialReceipts = async (req, res) => {
  try {
    const { company_id, branch_id } = req.user;
    const items = await query(
      `SELECT mr.*, dp.plan_no 
       FROM prod_material_receipts mr
       LEFT JOIN prod_daily_plans dp ON mr.plan_id = dp.id
       WHERE mr.company_id = :company_id AND mr.branch_id = :branch_id 
       ORDER BY mr.receipt_date DESC`,
      { company_id, branch_id }
    );
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createMaterialReceipt = async (req, res) => {
  const conn = await query("getConnection");
  try {
    await conn.beginTransaction();
    const { company_id, branch_id, id: user_id } = req.user;
    const { plan_id, requisition_id, receipt_date, remarks, items } = req.body;

    const receipt_no = `MR-${Date.now().toString().slice(-6)}`;

    const [result] = await conn.execute(
      "INSERT INTO prod_material_receipts (company_id, branch_id, receipt_no, plan_id, requisition_id, receipt_date, remarks, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [company_id, branch_id, receipt_no, plan_id, requisition_id || null, receipt_date, remarks, user_id]
    );
    const receipt_id = result.insertId;

    if (requisition_id) {
      await conn.execute("UPDATE prod_material_requisitions SET status = 'FULFILLED' WHERE id = ?", [requisition_id]);
    }

    if (Array.isArray(items)) {
      for (const item of items) {
        await conn.execute(
          "INSERT INTO prod_material_receipt_items (receipt_id, item_id, qty_received, uom) VALUES (?, ?, ?, ?)",
          [receipt_id, item.item_id, item.qty_received, item.uom]
        );
      }
    }

    await conn.commit();
    res.json({ id: receipt_id, receipt_no, message: "Material receipt recorded" });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};

// ===== STOCK JOURNALS =====

export const listStockJournals = async (req, res) => {
  try {
    const { company_id, branch_id } = req.user;
    const items = await query(
      `SELECT sj.*, dp.plan_no 
       FROM prod_stock_journals sj
       LEFT JOIN prod_daily_plans dp ON sj.plan_id = dp.id
       WHERE sj.company_id = :company_id AND sj.branch_id = :branch_id 
       ORDER BY sj.journal_date DESC`,
      { company_id, branch_id }
    );
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createStockJournal = async (req, res) => {
  const conn = await query("getConnection");
  try {
    await conn.beginTransaction();
    const { company_id, branch_id, id: user_id } = req.user;
    const { plan_id, journal_date, remarks, items } = req.body;

    const journal_no = `SJ-${Date.now().toString().slice(-6)}`;

    const [result] = await conn.execute(
      "INSERT INTO prod_stock_journals (company_id, branch_id, journal_no, plan_id, journal_date, remarks, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [company_id, branch_id, journal_no, plan_id, journal_date, remarks, user_id]
    );
    const journal_id = result.insertId;

    if (Array.isArray(items)) {
      for (const item of items) {
        await conn.execute(
          "INSERT INTO prod_stock_journal_items (journal_id, item_id, type, qty, uom) VALUES (?, ?, ?, ?, ?)",
          [journal_id, item.item_id, item.type, item.qty, item.uom]
        );
      }
    }

    await conn.commit();
    res.json({ id: journal_id, journal_no, message: "Stock journal posted" });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};

// ===== DASHBOARD STATS =====

export const getProductionStats = async (req, res) => {
  try {
    const { company_id, branch_id } = req.user;
    
    const [boms] = await query("SELECT COUNT(*) as count FROM prod_boms WHERE company_id = :company_id", { company_id });
    const [orders] = await query("SELECT COUNT(*) as count FROM prod_work_orders WHERE company_id = :company_id AND branch_id = :branch_id AND status != 'COMPLETED'", { company_id, branch_id });
    const [plans] = await query("SELECT COUNT(*) as count FROM prod_daily_plans WHERE company_id = :company_id AND branch_id = :branch_id", { company_id, branch_id });
    const [jobs] = await query("SELECT COUNT(*) as count FROM prod_job_cards WHERE company_id = :company_id AND branch_id = :branch_id AND status = 'PENDING'", { company_id, branch_id });

    res.json({
      boms: boms.count,
      activeOrders: orders.count,
      dailyPlans: plans.count,
      pendingJobs: jobs.count
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===== MATERIAL REQUISITIONS =====

export const listMaterialRequisitions = async (req, res) => {
  try {
    const { company_id, branch_id } = req.user;
    const items = await query(
      `SELECT mr.*, dp.plan_no 
       FROM prod_material_requisitions mr
       LEFT JOIN prod_daily_plans dp ON mr.plan_id = dp.id
       WHERE mr.company_id = :company_id AND mr.branch_id = :branch_id 
       ORDER BY mr.requisition_date DESC`,
      { company_id, branch_id }
    );
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMaterialRequisitionById = async (req, res) => {
  try {
    const { id } = req.params;
    const requisition = await query("SELECT * FROM prod_material_requisitions WHERE id = :id", { id });
    if (!requisition?.[0]) return res.status(404).json({ message: "Requisition not found" });

    const items = await query(
      `SELECT mri.*, i.item_name, i.item_code 
       FROM prod_material_requisition_items mri
       JOIN inv_items i ON mri.item_id = i.id
       WHERE mri.requisition_id = :id`,
      { id }
    );

    res.json({ ...requisition[0], items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createMaterialRequisition = async (req, res) => {
  const conn = await query("getConnection");
  try {
    await conn.beginTransaction();
    const { company_id, branch_id, id: user_id } = req.user;
    const { plan_id, requisition_date, remarks, items } = req.body;

    const requisition_no = `REQ-${Date.now().toString().slice(-6)}`;

    const [result] = await conn.execute(
      "INSERT INTO prod_material_requisitions (company_id, branch_id, requisition_no, plan_id, requisition_date, remarks, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [company_id, branch_id, requisition_no, plan_id, requisition_date, remarks, user_id]
    );
    const requisition_id = result.insertId;

    if (Array.isArray(items)) {
      for (const item of items) {
        await conn.execute(
          "INSERT INTO prod_material_requisition_items (requisition_id, item_id, qty_requested, uom) VALUES (?, ?, ?, ?)",
          [requisition_id, item.item_id, item.qty_requested, item.uom]
        );
      }
    }

    await conn.commit();
    res.json({ id: requisition_id, requisition_no, message: "Material requisition created" });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};

export const updateMaterialRequisitionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await query("UPDATE prod_material_requisitions SET status = :status WHERE id = :id", { id, status });
    res.json({ message: "Requisition status updated" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===== PRODUCTION TRANSFERS =====

export const listProductionTransfers = async (req, res) => {
  try {
    const { company_id, branch_id } = req.user;
    const items = await query(
      `SELECT pt.*, dp.plan_no, w.name as target_warehouse_name
       FROM prod_transfers pt
       LEFT JOIN prod_daily_plans dp ON pt.plan_id = dp.id
       LEFT JOIN inv_warehouses w ON pt.target_warehouse_id = w.id
       WHERE pt.company_id = :company_id AND pt.branch_id = :branch_id 
       ORDER BY pt.transfer_date DESC`,
      { company_id, branch_id }
    );
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createProductionTransfer = async (req, res) => {
  const conn = await query("getConnection");
  try {
    await conn.beginTransaction();
    const { company_id, branch_id, id: user_id } = req.user;
    const { plan_id, target_warehouse_id, transfer_date, remarks, items } = req.body;

    const transfer_no = `TR-${Date.now().toString().slice(-6)}`;

    const [result] = await conn.execute(
      "INSERT INTO prod_transfers (company_id, branch_id, transfer_no, plan_id, target_warehouse_id, transfer_date, remarks, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [company_id, branch_id, transfer_no, plan_id || null, target_warehouse_id, transfer_date, remarks, user_id]
    );
    const transfer_id = result.insertId;

    if (Array.isArray(items)) {
      for (const item of items) {
        await conn.execute(
          "INSERT INTO prod_transfer_items (transfer_id, item_id, qty, uom) VALUES (?, ?, ?, ?)",
          [transfer_id, item.item_id, item.qty, item.uom]
        );
      }
    }

    await conn.commit();
    res.json({ id: transfer_id, transfer_no, message: "Production transfer completed" });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};

// ===== REPORTS =====

export const getEfficiencyReport = async (req, res) => {
  try {
    const { company_id, branch_id } = req.user;
    const { start_date, end_date } = req.query;

    const data = await query(
      `SELECT 
        i.item_name, 
        i.item_code,
        SUM(dpi.qty_to_produce) as planned_qty,
        COALESCE((SELECT SUM(actual_qty) FROM prod_job_cards WHERE item_id = dpi.item_id AND status = 'COMPLETED'), 0) as actual_qty
       FROM prod_daily_plan_items dpi
       JOIN prod_daily_plans dp ON dpi.plan_id = dp.id
       JOIN inv_items i ON dpi.item_id = i.id
       WHERE dp.company_id = :company_id AND dp.branch_id = :branch_id
       ${start_date && end_date ? 'AND dp.plan_date BETWEEN :start_date AND :end_date' : ''}
       GROUP BY dpi.item_id`,
      { company_id, branch_id, start_date, end_date }
    );

    res.json({ data });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
