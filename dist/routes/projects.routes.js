import express from "express";

import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import * as projectsController from "../controllers/projects.controller.js";

const router = express.Router();

function toNumber(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ===== PROJECTS =====

router.get(
  "/projects",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PM.PROJECT.VIEW"),
  projectsController.listProjects
);

router.get(
  "/projects/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PM.PROJECT.VIEW"),
  projectsController.getProjectById
);

router.post(
  "/projects",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PM.PROJECT.MANAGE"),
  projectsController.createProject
);

router.put(
  "/projects/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PM.PROJECT.MANAGE"),
  projectsController.updateProject
);

// ===== TASKS =====
router.get(
  "/tasks",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.listTasks
);

router.get(
  "/tasks/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.getTaskById
);

router.post(
  "/tasks",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.createOrUpdateTask
);

router.put(
  "/tasks/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.createOrUpdateTask
);

router.delete(
  "/tasks/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.deleteTask
);

router.delete(
  "/projects/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.deleteProject
);

// ===== TIMESHEETS =====
router.get(
  "/timesheets",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.listTimesheets
);

router.post(
  "/timesheets",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.createTimesheet
);

router.put(
  "/timesheets/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.updateTimesheet
);

router.delete(
  "/timesheets/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.deleteTimesheet
);

// ===== TASK DEPENDENCIES =====
router.get(
  "/task-dependencies",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.listTaskDependencies
);

router.post(
  "/task-dependencies",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.createTaskDependency
);

router.delete(
  "/task-dependencies/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.deleteTaskDependency
);

// ===== EXPENSES =====
router.get(
  "/expenses",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.listExpenses
);

router.post(
  "/expenses",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.createExpense
);

router.put(
  "/expenses/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.updateExpense
);

router.delete(
  "/expenses/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.deleteExpense
);

// ===== DASHBOARD DETAIL =====
router.get(
  "/dashboard/detail",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.getPMDashboardDetail
);

// ===== PM MATERIAL REQUISITIONS =====
router.get(
  "/material-requisitions",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.listPMMaterialRequisitions
);
router.get(
  "/material-requisitions/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.getPMMaterialRequisitionById
);
router.post(
  "/material-requisitions",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.createPMMaterialRequisition
);
router.put(
  "/material-requisitions/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.updatePMMaterialRequisition
);
router.post(
  "/material-requisitions/:id/submit",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.submitPMMaterialRequisition
);

// ===== PM MATERIAL UTILIZATIONS =====
router.get(
  "/material-utilizations",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.listPMMaterialUtilizations
);
router.get(
  "/material-utilizations/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.getPMMaterialUtilizationById
);
router.post(
  "/material-utilizations",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.createPMMaterialUtilization
);
router.put(
  "/material-utilizations/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.updatePMMaterialUtilization
);

// ===== PM MATERIALS RECEIPTS =====
router.get(
  "/material-receipts",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.listPMMaterialReceipts
);
router.get(
  "/material-receipts/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.getPMMaterialReceiptById
);
router.post(
  "/material-receipts",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.createPMMaterialReceipt
);
router.put(
  "/material-receipts/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.updatePMMaterialReceipt
);

// ===== ISSUE TO REQUIREMENT (for PM materials receipt auto-populate) =====
router.get(
  "/issue-to-requirement/pm",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.getPendingIssueToRequirement
);
router.get(
  "/issue-to-requirement/pm/:issueId",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.getIssueToRequirementDetail
);

// ===== PROJECT STATUS REPORT =====
router.get(
  "/reports/project-status",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.getProjectStatusReport
);

// ===== DASHBOARD =====
router.get(
  "/dashboard/stats",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.getPMDashboardStats
);

// ===== BUDGET VS ACTUAL =====
router.get(
  "/budget-vs-actual",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.getBudgetVsActual
);

// ===== PROJECT DETAIL DASHBOARD =====
router.get(
  "/projects/:id/detail",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.getProjectDetail
);

export default router;
