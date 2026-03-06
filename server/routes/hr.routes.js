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

// ===== HR DASHBOARD METRICS =====
router.get(
  "/dashboard/metrics",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const year = toNumber(req.query.year, new Date().getFullYear());
      const yStart = `${year}-01-01`;
      const yEnd = `${year}-12-31`;
      const safeQuery = async (sql, params) => {
        try {
          const rows = await query(sql, params);
          return rows || [];
        } catch (e) {
          return [];
        }
      };
      const totalRows = await safeQuery(
        `SELECT COUNT(*) AS c FROM hr_employees WHERE company_id = :companyId AND branch_id = :branchId`,
        { companyId, branchId },
      );
      const newRows = await safeQuery(
        `SELECT COUNT(*) AS c FROM hr_employees 
         WHERE company_id = :companyId AND branch_id = :branchId 
           AND date_joined IS NOT NULL 
           AND date_joined BETWEEN :from AND :to`,
        { companyId, branchId, from: yStart, to: yEnd },
      );
      // Confirmations: attempt using confirmation_date if present, else 0
      let confirmations = 0;
      const confRows = await safeQuery(
        `SELECT COUNT(*) AS c FROM hr_employees 
         WHERE company_id = :companyId AND branch_id = :branchId 
           AND confirmation_date BETWEEN :from AND :to`,
        { companyId, branchId, from: yStart, to: yEnd },
      );
      if (confRows.length) confirmations = Number(confRows[0]?.c || 0);
      // Gender counts if gender column exists
      let male = 0;
      let female = 0;
      const gRows = await safeQuery(
        `SELECT gender, COUNT(*) AS c 
           FROM hr_employees 
          WHERE company_id = :companyId AND branch_id = :branchId 
          GROUP BY gender`,
        { companyId, branchId },
      );
      for (const r of gRows) {
        const g = String(r.gender || "").toUpperCase();
        if (g.includes("MALE") || g === "M") male += Number(r.c || 0);
        if (g.includes("FEMALE") || g === "F") female += Number(r.c || 0);
      }
      // Category-wise (use employment_type)
      const categoryPie = await safeQuery(
        `SELECT COALESCE(employment_type,'UNSPECIFIED') AS label, COUNT(*) AS value
           FROM hr_employees
          WHERE company_id = :companyId AND branch_id = :branchId
          GROUP BY COALESCE(employment_type,'UNSPECIFIED')
          ORDER BY value DESC`,
        { companyId, branchId },
      );
      // Location-wise (try location column)
      const locationPie = await safeQuery(
        `SELECT COALESCE(location,'UNSPECIFIED') AS label, COUNT(*) AS value
           FROM hr_employees
          WHERE company_id = :companyId AND branch_id = :branchId
          GROUP BY COALESCE(location,'UNSPECIFIED')
          ORDER BY value DESC`,
        { companyId, branchId },
      );
      // Employee type bar (same as employment_type)
      const employeeTypeBar = await safeQuery(
        `SELECT COALESCE(employment_type,'UNSPECIFIED') AS label, COUNT(*) AS value
           FROM hr_employees
          WHERE company_id = :companyId AND branch_id = :branchId
          GROUP BY COALESCE(employment_type,'UNSPECIFIED')
          ORDER BY value DESC`,
        { companyId, branchId },
      );
      // Department-wise
      const departmentBar = await safeQuery(
        `SELECT COALESCE(department,'UNSPECIFIED') AS label, COUNT(*) AS value
           FROM hr_employees
          WHERE company_id = :companyId AND branch_id = :branchId
          GROUP BY COALESCE(department,'UNSPECIFIED')
          ORDER BY value DESC`,
        { companyId, branchId },
      );
      // Status-wise (Active/Inactive)
      const statusBar = await safeQuery(
        `SELECT CASE WHEN is_active=1 THEN 'Active' ELSE 'Inactive' END AS label, COUNT(*) AS value
           FROM hr_employees
          WHERE company_id = :companyId AND branch_id = :branchId
          GROUP BY CASE WHEN is_active=1 THEN 'Active' ELSE 'Inactive' END`,
        { companyId, branchId },
      );
      // Average tenure in years (active employees with date_joined)
      let avgTenureYears = 0;
      const tenureRows = await safeQuery(
        `SELECT AVG(TIMESTAMPDIFF(DAY, date_joined, CURRENT_DATE)) AS avg_days
           FROM hr_employees
          WHERE company_id = :companyId AND branch_id = :branchId
            AND is_active = 1 AND date_joined IS NOT NULL`,
        { companyId, branchId },
      );
      if (tenureRows.length) {
        const days = Number(tenureRows[0]?.avg_days || 0);
        avgTenureYears = days / 365.25;
      }
      // Attrition rate for the year = (terminations in year) / (total at start of year)
      let attritionRate = 0;
      const termRows = await safeQuery(
        `SELECT COUNT(*) AS c
           FROM hr_employees
          WHERE company_id = :companyId AND branch_id = :branchId
            AND termination_date BETWEEN :from AND :to`,
        { companyId, branchId, from: yStart, to: yEnd },
      );
      const startCountRows = await safeQuery(
        `SELECT COUNT(*) AS c
           FROM hr_employees
          WHERE company_id = :companyId AND branch_id = :branchId
            AND (date_joined IS NULL OR date_joined < :from)`,
        { companyId, branchId, from: yStart },
      );
      const terminations = Number(termRows?.[0]?.c || 0);
      const startHeadcount = Math.max(1, Number(startCountRows?.[0]?.c || 0));
      attritionRate = (terminations / startHeadcount) * 100;
      // Confirmations by department for the year
      const confirmationsByDept = await safeQuery(
        `SELECT COALESCE(department,'UNSPECIFIED') AS label, COUNT(*) AS value
           FROM hr_employees
          WHERE company_id = :companyId AND branch_id = :branchId
            AND confirmation_date BETWEEN :from AND :to
          GROUP BY COALESCE(department,'UNSPECIFIED')
          ORDER BY value DESC`,
        { companyId, branchId, from: yStart, to: yEnd },
      );
      // Monthly joiners for the selected year
      const monthlyJoinersRows = await safeQuery(
        `SELECT DATE_FORMAT(date_joined, '%Y-%m-01') AS ym, COUNT(*) AS c
           FROM hr_employees
          WHERE company_id = :companyId AND branch_id = :branchId
            AND date_joined BETWEEN :from AND :to
          GROUP BY DATE_FORMAT(date_joined, '%Y-%m-01')
          ORDER BY ym ASC`,
        { companyId, branchId, from: yStart, to: yEnd },
      );
      const monthlyJoiners = monthlyJoinersRows.map((r) => ({
        label: r.ym?.slice(0, 7) || "",
        value: Number(r.c || 0),
      }));
      res.json({
        cards: {
          total_employees: Number(totalRows?.[0]?.c || 0),
          new_employees_year: Number(newRows?.[0]?.c || 0),
          confirmations_year: confirmations,
          male_count: male,
          female_count: female,
          average_tenure_years: avgTenureYears,
          attrition_rate: attritionRate,
        },
        category_pie: categoryPie,
        location_pie: locationPie,
        employee_type_bar: employeeTypeBar,
        department_bar: departmentBar,
        status_bar: statusBar,
        confirmations_by_department: confirmationsByDept,
        monthly_joiners_trend: monthlyJoiners,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
