import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { api } from "../../../api/client.js";

import EmployeeList from "./employees/EmployeeList.jsx";
import EmployeeForm from "./employees/EmployeeForm.jsx";
import HRSetup from "./HRSetup.jsx";
import LeaveSetupList from "./leave-setup/LeaveSetupList.jsx";
import LeaveSetupForm from "./leave-setup/LeaveSetupForm.jsx";
import ShiftList from "./shifts/ShiftList.jsx";
import ShiftForm from "./shifts/ShiftForm.jsx";
import WorkScheduleManagement from "./work-schedules/WorkScheduleManagement.jsx";
import RosterManagement from "./roster/RosterManagement.jsx";
import AttendanceList from "./attendance/AttendanceList.jsx";
import AttendanceForm from "./attendance/AttendanceForm.jsx";
import SalaryConfigList from "./salary-config/SalaryConfigList.jsx";
import SalaryConfigForm from "./salary-config/SalaryConfigForm.jsx";
import BaseSalariesPage from "./salary-config/BaseSalariesPage.jsx";
import SalaryStructurePage from "./salary-config/SalaryStructurePage.jsx";
import TaxConfigList from "./tax-config/TaxConfigList.jsx";
import TaxConfigForm from "./tax-config/TaxConfigForm.jsx";
import AllowanceList from "./allowances/AllowanceList.jsx";
import AllowanceForm from "./allowances/AllowanceForm.jsx";
import LoanList from "./loans/LoanList.jsx";
import LoanForm from "./loans/LoanForm.jsx";
import PayslipList from "./payslips/PayslipList.jsx";
import PayslipForm from "./payslips/PayslipForm.jsx";
import PromotionList from "./promotions/PromotionList.jsx";
import PromotionForm from "./promotions/PromotionForm.jsx";
import RequisitionList from "./recruitment/RequisitionList.jsx";
import RequisitionForm from "./recruitment/RequisitionForm.jsx";
import CandidatesList from "./recruitment/CandidatesList.jsx";
import CandidateForm from "./recruitment/CandidateForm.jsx";
import InterviewsList from "./recruitment/InterviewsList.jsx";
import InterviewForm from "./recruitment/InterviewForm.jsx";
import OffersList from "./recruitment/OffersList.jsx";
import OfferForm from "./recruitment/OfferForm.jsx";
import PayrollDashboard from "./payroll/PayrollDashboard.jsx";
import SalaryProcessing from "./payroll/SalaryProcessing.jsx";
import SalaryPostingPage from "./payroll/SalaryPostingPage.jsx";
import LeaveRequestForm from "./leave/LeaveRequestForm.jsx"; // Keeping file loosely to not break anything
import LeaveApprovals from "./leave/LeaveApprovals.jsx";
import LeaveCalendar from "./leave/LeaveCalendar.jsx";
import LeaveManagementDashboard from "./leave/LeaveManagementDashboard.jsx";
import LeaveScheduling from "./leave/LeaveScheduling.jsx";
import LeaveRoster from "./leave/LeaveRoster.jsx";
import LeaveBalances from "./leave/LeaveBalances.jsx";
import LeaveApplication from "./leave/LeaveApplication.jsx";
import LeaveRecords from "./leave/LeaveRecords.jsx";
import KPISetup from "./performance/KPISetup.jsx";
import AppraisalForm from "./performance/AppraisalForm.jsx";
import SubmitAppraisals from "./performance/SubmitAppraisals.jsx";
import TrainingPrograms from "./training/TrainingPrograms.jsx";
import TrainingHistory from "./training/TrainingHistory.jsx";
import PolicyList from "./compliance/PolicyList.jsx";
import PolicyForm from "./compliance/PolicyForm.jsx";
import PolicyViewer from "./compliance/PolicyViewer.jsx";
import ExitRequest from "./exit/ExitRequest.jsx";
import ClearanceTracking from "./exit/ClearanceTracking.jsx";
import AttendanceDashboard from "./attendance/AttendanceDashboard.jsx";
import BulkAttendance from "./attendance/BulkAttendance.jsx";
import TimesheetView from "./attendance/TimesheetView.jsx";
import MedicalPolicyList from "./medical-policies/MedicalPolicyList.jsx";
import MedicalPolicyForm from "./medical-policies/MedicalPolicyForm.jsx";
import HRReports from "./reports/HRReports.jsx";
import ModuleDashboard from "../../../components/ModuleDashboard.jsx";

function HRDashboard() {
  const [stats, setStats] = React.useState([
    {
      rbac_key: "active-employees",
      value: "—",
      label: "Active Employees",
      change: "Loading…",
      changeType: "neutral",
      path: "/human-resources/employees",
    },
    {
      rbac_key: "today-attendance",
      value: "—",
      label: "Present Today",
      change: "Loading…",
      changeType: "neutral",
      path: "/human-resources/attendance",
    },
    {
      rbac_key: "on-leave",
      value: "—",
      label: "On Leave Today",
      change: "Loading…",
      changeType: "neutral",
      path: "/human-resources/leave/request",
    },
    {
      rbac_key: "payroll-status",
      value: "—",
      label: "Payroll Status",
      change: "Loading…",
      changeType: "neutral",
      path: "/human-resources/payslips",
    },
  ]);

  React.useEffect(() => {
    let mounted = true;
    let timer;
    async function load() {
      try {
        const resp = await api.get("/hr/dashboard-stats");
        const d = resp?.data?.data;
        if (d && mounted) {
          setStats((prev) => {
            const next = [...prev];
            next[0] = {
              ...next[0],
              value: String(d.activeEmployees ?? "—"),
              change: `${d.departmentsCount ?? 0} departments`,
              changeType: "positive",
            };
            next[1] = {
              ...next[1],
              value: String(d.presentToday ?? "—"),
              change: `${d.onLeaveToday ?? 0} on leave`,
              changeType: d.presentToday > 0 ? "positive" : "neutral",
            };
            next[2] = {
              ...next[2],
              value: String(d.onLeaveToday ?? "—"),
              change: `${d.pendingLeaveRequests ?? 0} leave requests`,
              changeType: d.pendingLeaveRequests > 0 ? "warning" : "positive",
            };
            next[3] = {
              ...next[3],
              value: String(d.payrollStatus ?? "—"),
              change: d.payrollStatus === "None"
                ? "No active period"
                : `Period: ${d.payrollStatus}`,
              changeType:
                d.payrollStatus === "CLOSED"
                  ? "positive"
                  : d.payrollStatus === "None"
                    ? "neutral"
                    : "warning",
            };
            return next;
          });
        }
      } catch {}
    }
    load();
    timer = setInterval(load, 15000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const sections = [
    {
      title: "Employee Management",
      features: [
        {
          name: "Employee Setup",
          path: "/human-resources/employees",
          description: "Manage employee records and information",
          icon: "👥",
        },
        {
          name: "Promotions",
          path: "/human-resources/promotions",
          description: "Record employee promotions and salary changes",
          icon: "⬆",
        },
      ],
    },
    {
      title: "Recruitment",
      features: [
        {
          name: "Job Requisitions",
          path: "/human-resources/requisitions",
          description: "Manage job openings and staffing requests",
          icon: "📢",
        },
        {
          name: "Candidates",
          path: "/human-resources/candidates",
          description: "Manage applicants and candidate pipeline",
          icon: "👤",
        },
        {
          name: "Interviews",
          path: "/human-resources/interviews",
          description: "Schedule and track interviews",
          icon: "🗓️",
        },
        {
          name: "Offers",
          path: "/human-resources/offers",
          description: "Create and manage offer letters",
          icon: "📄",
        },
      ],
    },
    {
      title: "Leave & Attendance",
      features: [
        {
          name: "Leave Management",
          path: "/human-resources/leave",
          description: "Apply, schedule, roster, calendar, and balances",
          icon: "📅",
        },
        {
          name: "Leave Request",
          path: "/human-resources/leave/request",
          description: "Request and schedule employee leave",
          icon: "📝",
        },
        {
          name: "Work Schedule Management",
          path: "/human-resources/work-schedules",
          description: "Assign shifts and off days to employees",
          icon: "📋",
        },
        {
          name: "Roster Management",
          path: "/human-resources/roster",
          description: "Generate monthly work rosters for employees",
          icon: "🗓️",
        },
        {
          name: "Attendance",
          path: "/human-resources/attendance",
          description: "Daily attendance overview and management",
          icon: "📊",
        },
        {
          name: "Timesheet",
          path: "/human-resources/attendance/timesheet",
          description: "Enter daily work hours",
          icon: "🕒",
        },
      ],
    },
    {
      title: "Payroll & Benefits",
      features: [
        {
          name: "Process Salaries",
          path: "/human-resources/payroll/process",
          description: "Generate and process monthly payroll",
          icon: "⚙️",
        },
        {
          name: "Salary Posting",
          path: "/human-resources/payroll/salary-posting",
          description: "Pass salary journals to the general ledger",
          icon: "📓",
        },
        {
          name: "Payslips",
          path: "/human-resources/payslips",
          description: "Generate and view employee payslips",
          icon: "💰",
        },
        {
          name: "Salary Configurations",
          path: "/human-resources/salary-config",
          description: "Configure employee base pay and structures",
          icon: "💵",
        },
        {
          name: "Statutory Contributions",
          path: "/human-resources/tax-config",
          description: "Configure payroll deductions and statutory taxes",
          icon: "📜",
        },
        {
          name: "Allowances",
          path: "/human-resources/allowances",
          description: "Manage employee recurring allowances",
          icon: "➕",
        },
        {
          name: "Employee Loans",
          path: "/human-resources/loans",
          description: "Track and manage staff loans",
          icon: "🏦",
        },
      ],
    },
    {
      title: "Settings & Setup",
      features: [
        {
          name: "HR Setup",
          path: "/human-resources/setup",
          description: "Configure departments, positions, and parameters",
          icon: "🛠️",
        },
      ],
    },
    {
      title: "Policies & Reports",
      features: [
        {
          name: "Policies",
          path: "/human-resources/policies",
          description: "Manage and view company policies",
          icon: "📄",
        },
        {
          name: "View Policies",
          path: "/human-resources/policies/view",
          description: "Acknowledge and read policies",
          icon: "👁️",
        },
        {
          name: "Leave Calendar",
          path: "/human-resources/leave/calendar",
          description: "Monthly overview of ACTIVE leave",
          icon: "🗓️",
        },
        {
          name: "Leave Balances",
          path: "/human-resources/leave/balances",
          description: "Remaining vs Used balances",
          icon: "⚖️",
        },
        {
          name: "Leave Records",
          path: "/human-resources/leave/records",
          description: "Audit trail of all leave entries",
          icon: "🗄️",
        },
        {
          name: "HR Reports",
          path: "/human-resources/reports",
          description: "View attendance, payroll, and leave reports",
          icon: "📈",
        },
      ],
    },
    {
      title: "Performance & Training",
      features: [
        {
          name: "KPI Setup",
          path: "/human-resources/performance/kpis",
          description: "Define and manage KPIs",
          icon: "🎯",
        },
        {
          name: "Appraisal Form",
          path: "/human-resources/performance/appraisal",
          description: "Create employee appraisals",
          icon: "📝",
        },
        {
          name: "Submit Appraisals",
          path: "/human-resources/performance/submit",
          description: "Workflow approval management",
          icon: "✅",
        },
        {
          name: "Training Programs",
          path: "/human-resources/training",
          description: "Manage training programs",
          icon: "🎓",
        },
        {
          name: "Training History",
          path: "/human-resources/training/history",
          description: "Employee training records",
          icon: "📚",
        },
      ],
    },
    {
      title: "Exit Management",
      features: [
        {
          name: "Exit Request",
          path: "/human-resources/exit/request",
          description: "Submit resignation/termination",
          icon: "🚪",
        },
        {
          name: "Clearance",
          path: "/human-resources/exit/clearance",
          description: "Department clearance tracking",
          icon: "✅",
        },
      ],
    },
  ];

  return (
    <ModuleDashboard
      title="Human Resources"
      description="Employee management and payroll processing"
      stats={stats}
      headerActions={[
        { label: "Dashboard", path: "/human-resources/dashboard", icon: "📊" },
      ]}
      sections={sections}
      features={humanResourcesFeatures}
    />
  );
}

export default function HumanResourcesHome() {
  return (
    <Routes>
      <Route index element={<HRDashboard />} />
      <Route
        path="dashboard"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(() => import("./HRDashboardPage.jsx")),
            )}
          </React.Suspense>
        }
      />
      <Route path="employees" element={<EmployeeList />} />
      <Route path="employees/new" element={<EmployeeForm />} />
      <Route path="employees/:id" element={<EmployeeForm />} />
      <Route path="setup" element={<HRSetup />} />
      <Route path="work-schedules" element={<WorkScheduleManagement />} />
      <Route path="roster" element={<RosterManagement />} />
      <Route path="requisitions" element={<RequisitionList />} />
      <Route path="requisitions/new" element={<RequisitionForm />} />
      <Route path="requisitions/:id" element={<RequisitionForm />} />
      <Route path="candidates" element={<CandidatesList />} />
      <Route path="candidates/new" element={<CandidateForm />} />
      <Route path="candidates/:id" element={<CandidateForm />} />
      <Route path="interviews" element={<InterviewsList />} />
      <Route path="interviews/new" element={<InterviewForm />} />
      <Route path="interviews/:id" element={<InterviewForm />} />
      <Route path="offers" element={<OffersList />} />
      <Route path="offers/new" element={<OfferForm />} />
      <Route path="offers/:id" element={<OfferForm />} />
      <Route path="payroll" element={<PayrollDashboard />} />
      <Route path="payroll/process" element={<SalaryProcessing />} />
      <Route path="payroll/salary-posting" element={<SalaryPostingPage />} />
      <Route path="leave" element={<LeaveManagementDashboard />} />
      <Route path="leave/request" element={<LeaveApplication />} />
      <Route path="leave/scheduling" element={<LeaveScheduling />} />
      <Route path="leave/roster" element={<LeaveRoster />} />
      <Route path="leave/records" element={<LeaveRecords />} />
      <Route path="leave/calendar" element={<LeaveCalendar />} />
      <Route path="leave/balances" element={<LeaveBalances />} />
      <Route path="performance/kpis" element={<KPISetup />} />
      <Route path="performance/appraisal" element={<AppraisalForm />} />
      <Route path="performance/appraisal/:id" element={<AppraisalForm />} />
      <Route path="performance/submit" element={<SubmitAppraisals />} />
      <Route path="training" element={<TrainingPrograms />} />
      <Route path="training/history" element={<TrainingHistory />} />
      <Route path="policies" element={<PolicyList />} />
      <Route path="policies/new" element={<PolicyForm />} />
      <Route path="policies/view" element={<PolicyViewer />} />
      <Route path="policies/:id" element={<PolicyForm />} />
      <Route path="exit/request" element={<ExitRequest />} />
      <Route path="exit/clearance" element={<ClearanceTracking />} />
      <Route path="leave-setup" element={<LeaveSetupList />} />

      <Route path="leave-setup/new" element={<LeaveSetupForm />} />
      <Route path="leave-setup/:id" element={<LeaveSetupForm />} />
      <Route path="shifts" element={<ShiftList />} />
      <Route path="shifts/new" element={<ShiftForm />} />
      <Route path="shifts/:id" element={<ShiftForm />} />
      <Route path="work-schedules" element={<WorkScheduleManagement />} />
      <Route path="roster" element={<RosterManagement />} />
      {/* merged routes above */}
      <Route path="attendance" element={<AttendanceDashboard />} />
      <Route path="attendance/new" element={<AttendanceForm />} />
      <Route path="attendance/list" element={<AttendanceList />} />
      <Route path="attendance/bulk" element={<BulkAttendance />} />
      <Route path="attendance/timesheet" element={<TimesheetView />} />
      <Route path="attendance/:id" element={<AttendanceForm />} />
      <Route path="salary-config" element={<SalaryConfigList />} />
      <Route
        path="salary-config/base-salaries"
        element={<BaseSalariesPage />}
      />
      <Route path="salary-config/structure" element={<SalaryStructurePage />} />
      <Route path="salary-config/new" element={<SalaryConfigForm />} />
      <Route path="salary-config/:id" element={<SalaryConfigForm />} />
      <Route path="tax-config" element={<TaxConfigList />} />
      <Route path="tax-config/new" element={<TaxConfigForm />} />
      <Route path="tax-config/:id" element={<TaxConfigForm />} />
      <Route path="allowances" element={<AllowanceList />} />
      <Route path="allowances/new" element={<AllowanceForm />} />
      <Route path="allowances/:id" element={<AllowanceForm />} />
      <Route path="loans" element={<LoanList />} />
      <Route path="loans/new" element={<LoanForm />} />
      <Route path="loans/:id" element={<LoanForm />} />
      <Route path="payslips" element={<PayslipList />} />
      <Route path="payslips/new" element={<PayslipForm />} />
      <Route path="payslips/:id" element={<PayslipForm />} />
      <Route path="promotions" element={<PromotionList />} />
      <Route path="promotions/new" element={<PromotionForm />} />
      <Route path="promotions/:id" element={<PromotionForm />} />
      <Route path="medical-policies" element={<MedicalPolicyList />} />
      <Route path="medical-policies/new" element={<MedicalPolicyForm />} />
      <Route path="medical-policies/:id" element={<MedicalPolicyForm />} />
      <Route path="reports" element={<HRReports />} />
      <Route path="*" element={<Navigate to="/human-resources" replace />} />
    </Routes>
  );
}

export const humanResourcesFeatures = [
  {
    module_key: "human-resources",
    label: "Employee Setup",
    path: "/human-resources/employees",
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Promotions",
    path: "/human-resources/promotions",
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "KPI Setup",
    path: "/human-resources/performance/kpis",
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Appraisal Form",
    path: "/human-resources/performance/appraisal",
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Submit Appraisals",
    path: "/human-resources/performance/submit",
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Training Programs",
    path: "/human-resources/training",
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Training History",
    path: "/human-resources/training/history",
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Attendance",
    path: "/human-resources/attendance",
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Work Schedule Management",
    path: "/human-resources/work-schedules",
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Roster Management",
    path: "/human-resources/roster",
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Salary Configuration",
    path: "/human-resources/salary-config",
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Tax & Deductions",
    path: "/human-resources/tax-config",
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Employee Allowances",
    path: "/human-resources/allowances",
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Employee Loans",
    path: "/human-resources/loans",
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Payslips",
    path: "/human-resources/payslips",
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Salary Posting",
    path: "/human-resources/payroll/salary-posting",
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "HR Reports",
    path: "/human-resources/reports",
    type: "dashboard",
  },
];
