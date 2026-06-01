import express from "express";
import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { query } from "../db/pool.js";
import * as hrController from "../controllers/hr.controller.js";
import * as perfController from "../controllers/performance.controller.js";
import * as trainController from "../controllers/training.controller.js";

const router = express.Router();

// Employees
router.get(
  "/employees",
  requireAuth,
  requireCompanyScope,
  hrController.listEmployees,
);
router.get(
  "/employees/:id",
  requireAuth,
  requireCompanyScope,
  hrController.getEmployeeById,
);
router.post(
  "/employees",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  hrController.saveEmployee,
);
router.post(
  "/employees/bulk",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  hrController.saveEmployeesBulk,
);

// Departments & Positions
router.get(
  "/departments",
  requireAuth,
  requireCompanyScope,
  hrController.listDepartments,
);
router.post(
  "/departments",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  hrController.saveDepartment,
);
router.get(
  "/positions",
  requireAuth,
  requireCompanyScope,
  hrController.listPositions,
);
router.post(
  "/positions",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  hrController.savePosition,
);

// Locations
router.get(
  "/setup/locations",
  requireAuth,
  requireCompanyScope,
  hrController.listLocations,
);
router.post(
  "/setup/locations",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  hrController.saveLocation,
);

router.get(
  "/setup/employment-types",
  requireAuth,
  requireCompanyScope,
  hrController.listEmploymentTypes,
);
router.post(
  "/setup/employment-types",
  requireAuth,
  requireCompanyScope,
  hrController.saveEmploymentType,
);
router.get(
  "/setup/employee-categories",
  requireAuth,
  requireCompanyScope,
  hrController.listEmployeeCategories,
);
router.post(
  "/setup/employee-categories",
  requireAuth,
  requireCompanyScope,
  hrController.saveEmployeeCategory,
);
router.get(
  "/setup/allowance-types",
  requireAuth,
  requireCompanyScope,
  hrController.listAllowanceTypes,
);
router.post(
  "/setup/allowance-types",
  requireAuth,
  requireCompanyScope,
  hrController.saveAllowanceType,
);
router.get(
  "/setup/parameters",
  requireAuth,
  requireCompanyScope,
  hrController.listParameters,
);
router.post(
  "/setup/parameters",
  requireAuth,
  requireCompanyScope,
  hrController.saveParameters,
);

// Recruitment
router.get(
  "/requisitions/next-req-no",
  requireAuth,
  requireCompanyScope,
  hrController.getNextRequisitionNo,
);
router.get(
  "/requisitions",
  requireAuth,
  requireCompanyScope,
  hrController.listRequisitions,
);
router.post(
  "/requisitions",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  hrController.saveRequisition,
);
router.get(
  "/requisitions/:id",
  requireAuth,
  requireCompanyScope,
  hrController.getRequisitionById,
);
router.post(
  "/requisitions/:id/submit",
  requireAuth,
  requireCompanyScope,
  hrController.submitRequisition,
);
router.get(
  "/candidates",
  requireAuth,
  requireCompanyScope,
  hrController.listCandidates,
);
router.post(
  "/candidates",
  requireAuth,
  requireCompanyScope,
  hrController.saveCandidate,
);
router.get(
  "/candidates/:id",
  requireAuth,
  requireCompanyScope,
  hrController.getCandidate,
);

// Promotions
router.get(
  "/promotions",
  requireAuth,
  requireCompanyScope,
  hrController.listPromotions,
);
router.post(
  "/promotions",
  requireAuth,
  requireCompanyScope,
  hrController.savePromotion,
);

// Interviews
router.get(
  "/interviews",
  requireAuth,
  requireCompanyScope,
  hrController.listInterviews,
);
router.post(
  "/interviews",
  requireAuth,
  requireCompanyScope,
  hrController.saveInterview,
);
router.get(
  "/offers",
  requireAuth,
  requireCompanyScope,
  hrController.listOffers,
);
router.post(
  "/offers",
  requireAuth,
  requireCompanyScope,
  hrController.saveOffer,
);

// Onboarding
router.get(
  "/onboarding/assignments",
  requireAuth,
  requireCompanyScope,
  hrController.listOnboardingAssignments,
);
router.post(
  "/onboarding/assign",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  hrController.assignOnboardingChecklist,
);
router.post(
  "/onboarding/task-update",
  requireAuth,
  requireCompanyScope,
  hrController.updateOnboardingTask,
);

// Attendance
router.get(
  "/shifts",
  requireAuth,
  requireCompanyScope,
  hrController.listShifts,
);
router.post(
  "/shifts",
  requireAuth,
  requireCompanyScope,
  hrController.saveShift,
);

// Work Schedules
router.get(
  "/work-schedules",
  requireAuth,
  requireCompanyScope,
  hrController.listWorkSchedules,
);
router.post(
  "/work-schedules",
  requireAuth,
  requireCompanyScope,
  hrController.saveWorkSchedule,
);
router.post(
  "/attendance/clock-in",
  requireAuth,
  requireCompanyScope,
  hrController.clockIn,
);
router.post(
  "/attendance/clock-out",
  requireAuth,
  requireCompanyScope,
  hrController.clockOut,
);
router.get(
  "/attendance",
  requireAuth,
  requireCompanyScope,
  hrController.listAttendance,
);
router.get("/attendance/bulk", requireAuth, requireCompanyScope, (req, res) =>
  res.json({ ok: true }),
);
router.post(
  "/attendance/bulk",
  requireAuth,
  requireCompanyScope,
  hrController.saveBulkAttendance,
);
router.post(
  "/timesheets",
  requireAuth,
  requireCompanyScope,
  hrController.saveTimesheet,
);
router.get(
  "/timesheets",
  requireAuth,
  requireCompanyScope,
  hrController.listTimesheets,
);
router.post(
  "/attendance/biometric",
  requireAuth,
  requireCompanyScope,
  hrController.biometricWebhook,
);

// Leave Management
router.get(
  "/leave/types",
  requireAuth,
  requireCompanyScope,
  hrController.listLeaveTypes,
);
router.get(
  "/leave/types/:id",
  requireAuth,
  requireCompanyScope,
  hrController.getLeaveType,
);
router.post(
  "/leave/types",
  requireAuth,
  requireCompanyScope,
  hrController.saveLeaveType,
);
// --- NEW LEAVE ERP ROUTES ---
router.get(
  "/leave/dashboard",
  requireAuth,
  requireCompanyScope,
  hrController.getLeaveDashboard,
);
router.post(
  "/leave/apply",
  requireAuth,
  requireCompanyScope,
  hrController.applyLeave,
);
router.post(
  "/leave/schedule",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  hrController.scheduleLeave,
);
router.post(
  "/leave/roster",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  hrController.saveLeaveRoster,
);
router.get(
  "/leave/records",
  requireAuth,
  requireCompanyScope,
  hrController.listLeaveRecords,
);
router.delete(
  "/leave/records/:id",
  requireAuth,
  requireCompanyScope,
  hrController.deleteLeaveRecord,
);
router.put(
  "/leave/records/:id",
  requireAuth,
  requireCompanyScope,
  hrController.updateLeave,
);
router.get(
  "/leave/calendar",
  requireAuth,
  requireCompanyScope,
  hrController.leaveCalendar,
);
router.get(
  "/leave/balances",
  requireAuth,
  requireCompanyScope,
  hrController.listLeaveBalances,
);

// Salary Configuration
router.get(
  "/salary-structures",
  requireAuth,
  requireCompanyScope,
  hrController.listSalaryStructures,
);
router.post(
  "/salary-structures",
  requireAuth,
  requireCompanyScope,
  hrController.saveSalaryStructure,
);
router.get(
  "/salary-structure/active",
  requireAuth,
  requireCompanyScope,
  hrController.getActiveSalaryStructure,
);
router.get(
  "/salary/base-salaries",
  requireAuth,
  requireCompanyScope,
  hrController.listBaseSalaries,
);
router.post(
  "/salary/base-salaries",
  requireAuth,
  requireCompanyScope,
  hrController.saveBaseSalary,
);
router.post(
  "/salary/base-salaries/bulk",
  requireAuth,
  requireCompanyScope,
  hrController.saveBaseSalariesBulk,
);

// Tax Configuration
router.get(
  "/tax-configs",
  requireAuth,
  requireCompanyScope,
  hrController.listTaxConfigs,
);
router.post(
  "/tax-configs",
  requireAuth,
  requireCompanyScope,
  hrController.saveTaxConfig,
);

// Allowances
router.get(
  "/allowances",
  requireAuth,
  requireCompanyScope,
  hrController.listAllowances,
);
router.post(
  "/allowances",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  hrController.saveAllowance,
);

// Loans
router.get("/loans", requireAuth, requireCompanyScope, hrController.listLoans);
router.post(
  "/loans",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  hrController.saveLoan,
);

// Payroll
router.get(
  "/payroll/periods",
  requireAuth,
  requireCompanyScope,
  hrController.listPayrollPeriods,
);
router.post(
  "/payroll/periods",
  requireAuth,
  requireCompanyScope,
  hrController.savePayrollPeriod,
);
router.post(
  "/payroll/generate",
  requireAuth,
  requireCompanyScope,
  hrController.generatePayroll,
);
router.post(
  "/payroll/close",
  requireAuth,
  requireCompanyScope,
  hrController.closePayroll,
);
router.get(
  "/payroll/breakdown",
  requireAuth,
  requireCompanyScope,
  hrController.getPayrollBreakdown,
);
router.post(
  "/payroll/backfill-tier3",
  requireAuth,
  requireCompanyScope,
  hrController.backfillTier3,
);

// Loan Types (Setup)
router.get(
  "/loan-types",
  requireAuth,
  requireCompanyScope,
  hrController.listLoanTypes,
);
router.post(
  "/loan-types",
  requireAuth,
  requireCompanyScope,
  hrController.saveLoanType,
);

// Salary Components Registry
router.get(
  "/salary-components",
  requireAuth,
  requireCompanyScope,
  hrController.listSalaryComponents,
);
router.post(
  "/salary-components/map-account",
  requireAuth,
  requireCompanyScope,
  hrController.mapSalaryComponentAccount,
);


// Payslips
router.get(
  "/payslips",
  requireAuth,
  requireCompanyScope,
  hrController.listPayslips,
);
router.post(
  "/payslips/send-email-bulk",
  requireAuth,
  requireCompanyScope,
  hrController.sendEmailBulk,
);
router.post(
  "/payslips/send-email",
  requireAuth,
  requireCompanyScope,
  hrController.sendPayslipEmail,
);

// ============ PERFORMANCE MANAGEMENT ============

// KPI Categories
router.get("/performance/kpi-categories", requireAuth, requireCompanyScope, perfController.listKpiCategories);
router.post("/performance/kpi-categories", requireAuth, requireCompanyScope, perfController.saveKpiCategory);
router.delete("/performance/kpi-categories/:id", requireAuth, requireCompanyScope, perfController.deleteKpiCategory);

// KPI Management
router.get("/performance/kpis", requireAuth, requireCompanyScope, perfController.listKpis);
router.get("/performance/kpis/:id", requireAuth, requireCompanyScope, perfController.getKpi);
router.post("/performance/kpis", requireAuth, requireCompanyScope, perfController.saveKpi);
router.delete("/performance/kpis/:id", requireAuth, requireCompanyScope, perfController.deleteKpi);
router.post("/performance/kpis/clone", requireAuth, requireCompanyScope, perfController.cloneKpi);

// KPI Assignments
router.get("/performance/kpi-assignments", requireAuth, requireCompanyScope, perfController.listKpiAssignments);
router.post("/performance/kpi-assignments", requireAuth, requireCompanyScope, perfController.saveKpiAssignment);
router.delete("/performance/kpi-assignments/:id", requireAuth, requireCompanyScope, perfController.deleteKpiAssignment);

// Appraisals
router.get("/performance/appraisals", requireAuth, requireCompanyScope, perfController.listAppraisals);
router.get("/performance/appraisals/:id", requireAuth, requireCompanyScope, perfController.getAppraisal);
router.post("/performance/appraisals", requireAuth, requireCompanyScope, perfController.saveAppraisal);
router.post("/performance/appraisals/:id/action", requireAuth, requireCompanyScope, perfController.submitAppraisal);
router.get("/performance/dashboard", requireAuth, requireCompanyScope, perfController.getAppraisalDashboard);
router.post("/performance/attachments", requireAuth, requireCompanyScope, perfController.uploadAttachment);

// ============ TRAINING MANAGEMENT ============

// Training Programs
router.get("/training/programs", requireAuth, requireCompanyScope, trainController.listTrainingPrograms);
router.get("/training/programs/:id", requireAuth, requireCompanyScope, trainController.getTrainingProgram);
router.post("/training/programs", requireAuth, requireCompanyScope, trainController.saveTrainingProgram);
router.delete("/training/programs/:id", requireAuth, requireCompanyScope, trainController.deleteTrainingProgram);

// Training Assignments
router.get("/training/assignments", requireAuth, requireCompanyScope, trainController.listTrainingAssignments);
router.post("/training/assignments", requireAuth, requireCompanyScope, trainController.saveTrainingAssignment);
router.delete("/training/assignments/:id", requireAuth, requireCompanyScope, trainController.deleteTrainingAssignment);

// Training Attendance
router.get("/training/attendance", requireAuth, requireCompanyScope, trainController.listTrainingAttendance);
router.post("/training/attendance", requireAuth, requireCompanyScope, trainController.saveTrainingAttendance);

// Training History
router.get("/training/history", requireAuth, requireCompanyScope, trainController.listTrainingHistory);

// Certifications
router.get("/training/certifications", requireAuth, requireCompanyScope, trainController.listCertifications);
router.post("/training/certifications", requireAuth, requireCompanyScope, trainController.saveCertification);
router.delete("/training/certifications/:id", requireAuth, requireCompanyScope, trainController.deleteCertification);

// Training Dashboard
router.get("/training/dashboard", requireAuth, requireCompanyScope, trainController.getTrainingDashboard);

// Compliance
router.get(
  "/policies",
  requireAuth,
  requireCompanyScope,
  hrController.listPolicies,
);
router.post(
  "/policies",
  requireAuth,
  requireCompanyScope,
  hrController.savePolicy,
);
router.get(
  "/medical-policies",
  requireAuth,
  requireCompanyScope,
  hrController.listMedicalPolicies,
);
router.post(
  "/medical-policies",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  hrController.saveMedicalPolicy,
);
router.get(
  "/medical-policies/:id",
  requireAuth,
  requireCompanyScope,
  hrController.getMedicalPolicy,
);
router.post(
  "/policies/acknowledge",
  requireAuth,
  requireCompanyScope,
  hrController.acknowledgePolicy,
);

// Exit & Clearance
router.get("/exits", requireAuth, requireCompanyScope, hrController.listExits);
router.post("/exits", requireAuth, requireCompanyScope, hrController.saveExit);
router.get(
  "/clearance",
  requireAuth,
  requireCompanyScope,
  hrController.listClearance,
);
router.post(
  "/clearance/update",
  requireAuth,
  requireCompanyScope,
  hrController.updateClearance,
);

// HR Reports
router.get(
  "/reports/employees",
  requireAuth,
  requireCompanyScope,
  hrController.reportEmployees,
);
router.get(
  "/reports/ssf",
  requireAuth,
  requireCompanyScope,
  hrController.reportSSF,
);
router.get(
  "/reports/paye",
  requireAuth,
  requireCompanyScope,
  hrController.reportPAYE,
);
router.get(
  "/reports/loans",
  requireAuth,
  requireCompanyScope,
  hrController.reportEmployeeLoans,
);
router.get(
  "/reports/allowances",
  requireAuth,
  requireCompanyScope,
  hrController.reportEmployeeAllowances,
);

// ===== DASHBOARD STATS =====
router.get("/dashboard-stats", requireAuth, requireCompanyScope, requireBranchScope, async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const [employees] = await query(
      "SELECT COUNT(*) as count FROM hr_employees WHERE company_id = :companyId AND branch_id = :branchId AND status IN ('ACTIVE','PROBATION') AND deleted_at IS NULL",
      { companyId, branchId },
    ).catch(() => [{ count: 0 }]);
    const [onLeave] = await query(
      "SELECT COUNT(*) as count FROM hr_attendance WHERE company_id = :companyId AND attendance_date = CURDATE() AND status = 'ON_LEAVE'",
      { companyId },
    ).catch(() => [{ count: 0 }]);
    const [attendance] = await query(
      "SELECT COUNT(*) as count FROM hr_attendance WHERE company_id = :companyId AND attendance_date = CURDATE() AND status IN ('PRESENT','LATE')",
      { companyId },
    ).catch(() => [{ count: 0 }]);
    const [pendingLeave] = await query(
      "SELECT COUNT(*) as count FROM hr_leave_requests WHERE company_id = :companyId AND status IN ('PENDING','SUBMITTED')",
      { companyId },
    ).catch(() => [{ count: 0 }]);
    const [depts] = await query(
      "SELECT COUNT(*) as count FROM hr_departments WHERE company_id = :companyId AND is_active = 1",
      { companyId },
    ).catch(() => [{ count: 0 }]);
    let payrollStatus = "None";
    try {
      const [pr] = await query(
        `SELECT pp.status FROM hr_payroll_periods pp
         WHERE pp.company_id = :companyId
         ORDER BY pp.start_date DESC LIMIT 1`,
        { companyId },
      );
      if (pr) payrollStatus = pr.status;
    } catch {}
    res.json({
      success: true,
      data: {
        activeEmployees: employees.count,
        onLeaveToday: onLeave.count,
        presentToday: attendance.count,
        pendingLeaveRequests: pendingLeave.count,
        departmentsCount: depts.count,
        payrollStatus,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
