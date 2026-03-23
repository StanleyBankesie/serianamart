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
import LeaveRequestForm from "./leave/LeaveRequestForm.jsx";
import LeaveApprovals from "./leave/LeaveApprovals.jsx";
import LeaveCalendar from "./leave/LeaveCalendar.jsx";
import KPISetup from "./performance/KPISetup.jsx";
import AppraisalForm from "./performance/AppraisalForm.jsx";
import TrainingList from "./training/TrainingList.jsx";
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
      icon: "👥",
      value: "142",
      label: "Active Employees",
      change: "5 new this month",
      changeType: "positive",
      path: "/human-resources/employees",
    },
    {
      rbac_key: "on-leave",
      icon: "📅",
      value: "8",
      label: "On Leave",
      change: "Today",
      changeType: "neutral",
      path: "/human-resources/leave-setup",
    },
    {
      rbac_key: "payroll-status",
      icon: "💰",
      value: "Pending",
      label: "Payroll Status",
      change: "Due in 3 days",
      changeType: "negative",
      path: "/human-resources/payslips",
    },
  ]);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const resp = await api.get("/bi/dashboards");
        const employees = Number(resp?.data?.summary?.hr?.employees || 0);
        const onLeave = Number(resp?.data?.summary?.hr?.on_leave || 0);
        const payrollStatus = String(
          resp?.data?.summary?.hr?.payroll_status || "",
        ).trim();
        if (mounted) {
          setStats((prev) => {
            const next = [...prev];
            next[0] = {
              ...next[0],
              value: String(employees),
            };
            next[1] = {
              ...next[1],
              value: String(onLeave),
            };
            next[2] = {
              ...next[2],
              value: payrollStatus || next[2].value,
            };
            return next;
          });
        }
      } catch {}
    }
    load();
    return () => {
      mounted = false;
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
          name: "Leave Setup",
          path: "/human-resources/leave-setup",
          description: "Configure leave types and employee leave balances",
          icon: "📅",
        },
        {
          name: "Shift Management",
          path: "/human-resources/shifts",
          description: "Setup and manage work shifts",
          icon: "🕐",
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
          name: "Medical Policies",
          path: "/human-resources/medical-policies",
          description: "Setup employee medical insurance policies",
          icon: "🏥",
        },
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
          description: "Define KPIs",
          icon: "🎯",
        },
        {
          name: "Appraisal Form",
          path: "/human-resources/performance/appraisal",
          description: "Submit appraisals",
          icon: "📝",
        },
        {
          name: "Training Programs",
          path: "/human-resources/training",
          description: "List training programs",
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
      <Route path="leave/request" element={<LeaveRequestForm />} />
      <Route path="leave/approvals" element={<LeaveApprovals />} />
      <Route path="leave/calendar" element={<LeaveCalendar />} />
      <Route path="performance/kpis" element={<KPISetup />} />
      <Route path="performance/appraisal" element={<AppraisalForm />} />
      <Route path="training" element={<TrainingList />} />
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
      <Route path="attendance" element={<AttendanceDashboard />} />
      <Route path="attendance/new" element={<AttendanceForm />} />
      <Route path="attendance/timesheet" element={<TimesheetView />} />
      <Route path="attendance/:id" element={<AttendanceForm />} />
      <Route path="salary-config" element={<SalaryConfigList />} />
      <Route path="salary-config/base-salaries" element={<BaseSalariesPage />} />
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
    label: "Leave Setup",
    path: "/human-resources/leave-setup",
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Shift Management",
    path: "/human-resources/shifts",
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
    label: "Medical Policies",
    path: "/human-resources/medical-policies",
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "HR Reports",
    path: "/human-resources/reports",
    type: "dashboard",
  },
];
