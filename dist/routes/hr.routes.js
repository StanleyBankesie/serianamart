import express from "express";

import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { query, pool } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import {
  listEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  listAttendance,
  createAttendance,
  listLeave,
  createLeave,
  listLeaveTypes,
} from "../controllers/hr.controller.js";

const router = express.Router();

function toNumber(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ===== EMPLOYEES =====

router.get(
  "/employees",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("HR.EMPLOYEE.VIEW"),
  (req, res, next) => listEmployees(req, res, next),
);

router.get(
  "/employees/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("HR.EMPLOYEE.VIEW"),
  (req, res, next) => getEmployeeById(req, res, next),
);

router.post(
  "/employees",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("HR.EMPLOYEE.MANAGE"),
  (req, res, next) => createEmployee(req, res, next),
);

router.put(
  "/employees/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("HR.EMPLOYEE.MANAGE"),
  (req, res, next) => updateEmployee(req, res, next),
);

// ===== ATTENDANCE =====

router.get(
  "/attendance",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("HR.ATTENDANCE.VIEW"),
  (req, res, next) => listAttendance(req, res, next),
);

router.post(
  "/attendance",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("HR.ATTENDANCE.MANAGE"),
  (req, res, next) => createAttendance(req, res, next),
);

// ===== LEAVE =====

router.get(
  "/leave",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("HR.LEAVE.VIEW"),
  (req, res, next) => listLeave(req, res, next),
);

router.post(
  "/leave",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("HR.LEAVE.MANAGE"),
  (req, res, next) => createLeave(req, res, next),
);

router.get(
  "/leave-types",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("HR.LEAVE.VIEW"),
  (req, res, next) => listLeaveTypes(req, res, next),
);

export default router;
