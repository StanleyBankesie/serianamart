/**
 * @fileoverview Production module routes.
 * Provides endpoints for managing production data, including Bill of Materials (BOM),
 * work orders, routings, setup processes, and execution tracking.
 */
import express from "express";

import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import * as productionController from "../controllers/production.controller.js";

const router = express.Router();

async function hasTable(tableName) {
  const rows = await query(
    `SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :tableName`,
    { tableName }
  );
  return Number(rows?.[0]?.c || 0) > 0;
}

async function ensureProductionTables() {
  if (!(await hasTable("prod_boms"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_boms (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        bom_name VARCHAR(150) NOT NULL,
        output_qty DECIMAL(18,3) NOT NULL DEFAULT 1,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_bom_scope (company_id),
        KEY idx_bom_item (item_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_bom_items"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_bom_items (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        bom_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        qty DECIMAL(18,3) NOT NULL,
        uom VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_bom_items_bom (bom_id),
        KEY idx_bom_items_item (item_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_work_orders"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_work_orders (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        work_order_no VARCHAR(50) NOT NULL,
        work_order_date DATE NOT NULL,
        bom_id BIGINT UNSIGNED NOT NULL,
        qty_to_produce DECIMAL(18,3) NOT NULL,
        warehouse_id BIGINT UNSIGNED NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
        remarks TEXT NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_wo_no (company_id, branch_id, work_order_no),
        KEY idx_wo_scope (company_id, branch_id),
        KEY idx_wo_bom (bom_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_work_order_items"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_work_order_items (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        work_order_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        planned_qty DECIMAL(18,3) NOT NULL,
        actual_qty DECIMAL(18,3) DEFAULT 0,
        uom VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_wo_items_wo (work_order_id),
        KEY idx_wo_items_item (item_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_processes"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_processes (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        process_name VARCHAR(100) NOT NULL,
        description TEXT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_proc_scope (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_machines"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_machines (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        machine_name VARCHAR(100) NOT NULL,
        machine_code VARCHAR(50) NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_mac_scope (company_id, branch_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_shifts"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_shifts (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        shift_name VARCHAR(50) NOT NULL,
        start_time TIME NULL,
        end_time TIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_shift_scope (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_routings"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_routings (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        routing_name VARCHAR(150) NOT NULL,
        is_default TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_rout_scope (company_id),
        KEY idx_rout_item (item_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_routing_steps"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_routing_steps (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        routing_id BIGINT UNSIGNED NOT NULL,
        process_id BIGINT UNSIGNED NOT NULL,
        step_order INT NOT NULL DEFAULT 1,
        setup_time_mins INT DEFAULT 0,
        cycle_time_mins INT DEFAULT 0,
        KEY idx_rs_rout (routing_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_daily_plans"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_daily_plans (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        plan_no VARCHAR(50) NOT NULL,
        plan_date DATE NOT NULL,
        status VARCHAR(30) DEFAULT 'DRAFT',
        remarks TEXT NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_plan_no (company_id, branch_id, plan_no),
        KEY idx_plan_scope (company_id, branch_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_daily_plan_items"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_daily_plan_items (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        plan_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        bom_id BIGINT UNSIGNED NULL,
        qty_to_produce DECIMAL(18,3) NOT NULL,
        status VARCHAR(30) DEFAULT 'PENDING',
        KEY idx_dpi_plan (plan_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_job_cards"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_job_cards (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        plan_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        process_id BIGINT UNSIGNED NOT NULL,
        machine_id BIGINT UNSIGNED NULL,
        shift_id BIGINT UNSIGNED NULL,
        planned_qty DECIMAL(18,3) NOT NULL,
        actual_qty DECIMAL(18,3) DEFAULT 0,
        status VARCHAR(30) DEFAULT 'PENDING',
        start_time TIMESTAMP NULL,
        end_time TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_jc_scope (company_id, branch_id),
        KEY idx_jc_plan (plan_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_material_receipts"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_material_receipts (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        receipt_no VARCHAR(50) NOT NULL,
        receipt_date DATE NOT NULL,
        plan_id BIGINT UNSIGNED NULL,
        requisition_id BIGINT UNSIGNED NULL,
        source_warehouse_id BIGINT UNSIGNED NULL,
        remarks TEXT NULL,
        status VARCHAR(30) DEFAULT 'DRAFT',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_mr_scope (company_id, branch_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_material_requisitions"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_material_requisitions (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        requisition_no VARCHAR(50) NOT NULL,
        plan_id BIGINT UNSIGNED NULL,
        requisition_date DATE NOT NULL,
        status VARCHAR(30) DEFAULT 'DRAFT',
        remarks TEXT NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_req_no (company_id, branch_id, requisition_no),
        KEY idx_req_scope (company_id, branch_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_material_requisition_items"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_material_requisition_items (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        requisition_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        qty_requested DECIMAL(18,3) NOT NULL,
        qty_received DECIMAL(18,3) DEFAULT 0,
        uom VARCHAR(50) NULL,
        KEY idx_mri_req (requisition_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_transfers"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_transfers (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        transfer_no VARCHAR(50) NOT NULL,
        plan_id BIGINT UNSIGNED NULL,
        target_warehouse_id BIGINT UNSIGNED NOT NULL,
        transfer_date DATE NOT NULL,
        remarks TEXT NULL,
        status VARCHAR(30) DEFAULT 'COMPLETED',
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_tr_no (company_id, branch_id, transfer_no),
        KEY idx_tr_scope (company_id, branch_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_transfer_items"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_transfer_items (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        transfer_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        qty DECIMAL(18,3) NOT NULL,
        uom VARCHAR(50) NULL,
        KEY idx_ti_tr (transfer_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await hasTable("prod_stock_journals"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS prod_stock_journals (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        journal_no VARCHAR(50) NOT NULL,
        journal_date DATE NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        qty DECIMAL(18,3) NOT NULL,
        type ENUM('IN', 'OUT') NOT NULL,
        reason VARCHAR(150) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_psj_scope (company_id, branch_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }
}

// Ensure tables on first request
router.use(async (req, res, next) => {
  try {
    await ensureProductionTables();
    next();
  } catch (err) {
    next(err);
  }
});

// ===== BILL OF MATERIALS (BOM) =====
router.get("/boms", requireAuth, requireCompanyScope, requirePermission("PROD.BOM.VIEW"), productionController.listBoms);
router.get("/boms/:id", requireAuth, requireCompanyScope, requirePermission("PROD.BOM.VIEW"), productionController.getBomById);
router.post("/boms", requireAuth, requireCompanyScope, requirePermission("PROD.BOM.MANAGE"), productionController.createBom);
router.put("/boms/:id", requireAuth, requireCompanyScope, requirePermission("PROD.BOM.MANAGE"), productionController.updateBom);
router.delete("/boms/:id", requireAuth, requireCompanyScope, requirePermission("PROD.BOM.MANAGE"), productionController.deleteBom);

// ===== WORK ORDERS =====
router.get("/work-orders", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.WORK_ORDER.VIEW"), productionController.listWorkOrders);
router.get("/work-orders/:id", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.WORK_ORDER.VIEW"), productionController.getWorkOrderById);
router.post("/work-orders", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.WORK_ORDER.MANAGE"), productionController.createWorkOrder);
router.put("/work-orders/:id/status", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.WORK_ORDER.MANAGE"), productionController.updateWorkOrderStatus);

// ===== SETUP MASTERS =====
router.get("/setup/processes", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.listProcesses);
router.post("/setup/processes", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.createProcess);
router.put("/setup/processes/:id", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.updateProcess);
router.delete("/setup/processes/:id", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.deleteProcess);

router.get("/setup/machines", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.SETUP.MANAGE"), productionController.listMachines);
router.post("/setup/machines", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.SETUP.MANAGE"), productionController.createMachine);
router.put("/setup/machines/:id", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.SETUP.MANAGE"), productionController.updateMachine);
router.delete("/setup/machines/:id", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.SETUP.MANAGE"), productionController.deleteMachine);

router.get("/setup/shifts", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.listShifts);
router.post("/setup/shifts", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.createShift);
router.put("/setup/shifts/:id", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.updateShift);
router.delete("/setup/shifts/:id", requireAuth, requireCompanyScope, requirePermission("PROD.SETUP.MANAGE"), productionController.deleteShift);

// ===== PLANNING & EXECUTION =====
router.get("/routings", requireAuth, requireCompanyScope, requirePermission("PROD.ROUTING.VIEW"), productionController.listRoutings);
router.get("/routings/:id", requireAuth, requireCompanyScope, requirePermission("PROD.ROUTING.VIEW"), productionController.getRoutingById);
router.post("/routings", requireAuth, requireCompanyScope, requirePermission("PROD.ROUTING.MANAGE"), productionController.createRouting);
router.put("/routings/:id", requireAuth, requireCompanyScope, requirePermission("PROD.ROUTING.MANAGE"), productionController.updateRouting);

router.get("/planning/daily", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.PLANNING.VIEW"), productionController.listDailyPlans);
router.get("/planning/daily/:id", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.PLANNING.VIEW"), productionController.getDailyPlanById);
router.post("/planning/daily", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.PLANNING.MANAGE"), productionController.createDailyPlan);
router.put("/planning/daily/:id", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.PLANNING.MANAGE"), productionController.updateDailyPlan);

router.get("/execution/job-cards", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.VIEW"), productionController.listJobCards);
router.get("/execution/job-cards/:id", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.VIEW"), productionController.getJobCardById);
router.post("/execution/job-cards/generate", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.MANAGE"), productionController.generateJobCards);
router.put("/execution/job-cards/:id", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.MANAGE"), productionController.updateJobCard);

router.get("/execution/material-receipt", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.VIEW"), productionController.listMaterialReceipts);
router.post("/execution/material-receipt", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.MANAGE"), productionController.createMaterialReceipt);

router.get("/execution/material-requisition", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.VIEW"), productionController.listMaterialRequisitions);
router.get("/execution/material-requisition/:id", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.VIEW"), productionController.getMaterialRequisitionById);
router.post("/execution/material-requisition", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.MANAGE"), productionController.createMaterialRequisition);
router.put("/execution/material-requisition/:id/status", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.MANAGE"), productionController.updateMaterialRequisitionStatus);

router.get("/execution/transfer", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.VIEW"), productionController.listProductionTransfers);
router.post("/execution/transfer", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.EXECUTION.MANAGE"), productionController.createProductionTransfer);

// ===== INVENTORY & REPORTS =====
router.get("/inventory/stock-journal", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.INVENTORY.VIEW"), productionController.listStockJournals);
router.post("/inventory/stock-journal", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.INVENTORY.MANAGE"), productionController.createStockJournal);

router.get("/reports/efficiency", requireAuth, requireCompanyScope, requireBranchScope, requirePermission("PROD.REPORT.VIEW"), productionController.getEfficiencyReport);

router.get("/dashboard/stats", requireAuth, requireCompanyScope, requireBranchScope, productionController.getProductionStats);

// Warm up production schema checks without crashing startup when DB is offline.
ensureProductionTables().catch((err) => {
  console.warn("Failed to ensure production tables during startup:", err);
});

export default router;
