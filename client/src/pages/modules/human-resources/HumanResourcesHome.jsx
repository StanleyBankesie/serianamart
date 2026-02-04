import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { api } from '../../../api/client.js';

import EmployeeList from './employees/EmployeeList.jsx';
import EmployeeForm from './employees/EmployeeForm.jsx';
import LeaveSetupList from './leave-setup/LeaveSetupList.jsx';
import LeaveSetupForm from './leave-setup/LeaveSetupForm.jsx';
import ShiftList from './shifts/ShiftList.jsx';
import ShiftForm from './shifts/ShiftForm.jsx';
import AttendanceList from './attendance/AttendanceList.jsx';
import AttendanceForm from './attendance/AttendanceForm.jsx';
import SalaryConfigList from './salary-config/SalaryConfigList.jsx';
import SalaryConfigForm from './salary-config/SalaryConfigForm.jsx';
import TaxConfigList from './tax-config/TaxConfigList.jsx';
import TaxConfigForm from './tax-config/TaxConfigForm.jsx';
import AllowanceList from './allowances/AllowanceList.jsx';
import AllowanceForm from './allowances/AllowanceForm.jsx';
import LoanList from './loans/LoanList.jsx';
import LoanForm from './loans/LoanForm.jsx';
import PayslipList from './payslips/PayslipList.jsx';
import PayslipForm from './payslips/PayslipForm.jsx';
import PromotionList from './promotions/PromotionList.jsx';
import PromotionForm from './promotions/PromotionForm.jsx';
import MedicalPolicyList from './medical-policies/MedicalPolicyList.jsx';
import MedicalPolicyForm from './medical-policies/MedicalPolicyForm.jsx';
import HRReports from './reports/HRReports.jsx';
import ModuleDashboard from '../../../components/ModuleDashboard.jsx';

function HRDashboard() {
  const [stats, setStats] = React.useState([
    { icon: '👥', value: '142', label: 'Active Employees', change: '5 new this month', changeType: 'positive', path: '/human-resources/employees' },
    { icon: '📅', value: '8', label: 'On Leave', change: 'Today', changeType: 'neutral', path: '/human-resources/leave-setup' },
    { icon: '💰', value: 'Pending', label: 'Payroll Status', change: 'Due in 3 days', changeType: 'negative', path: '/human-resources/payslips' }
  ]);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const resp = await api.get('/bi/dashboards');
        const employees = Number(resp?.data?.summary?.hr?.employees || 0);
        const onLeave = Number(resp?.data?.summary?.hr?.on_leave || 0);
        const payrollStatus = String(resp?.data?.summary?.hr?.payroll_status || '').trim();
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
      title: 'Employee Management',
      features: [
        { name: 'Employee Setup', path: '/human-resources/employees', description: 'Manage employee records and information', icon: '👥' },
        { name: 'Promotions', path: '/human-resources/promotions', description: 'Record employee promotions and salary changes', icon: '⬆' },
      ]
    },
    {
      title: 'Leave & Attendance',
      features: [
        { name: 'Leave Setup', path: '/human-resources/leave-setup', description: 'Configure leave types and employee leave balances', icon: '📅' },
        { name: 'Shift Management', path: '/human-resources/shifts', description: 'Setup and manage work shifts', icon: '🕐' },
        { name: 'Attendance', path: '/human-resources/attendance', description: 'Track employee attendance and check-ins', icon: '✓' },
      ]
    },
    {
      title: 'Payroll & Compensation',
      features: [
        { name: 'Salary Configuration', path: '/human-resources/salary-config', description: 'Setup salary components and structures', icon: '💰' },
        { name: 'Tax & Deductions', path: '/human-resources/tax-config', description: 'Configure income tax, tier 3, and social security', icon: '📊' },
        { name: 'Employee Allowances', path: '/human-resources/allowances', description: 'Manage employee allowances and benefits', icon: '💵' },
        { name: 'Employee Loans', path: '/human-resources/loans', description: 'Track and manage employee loans', icon: '🏦' },
        { name: 'Payslips', path: '/human-resources/payslips', description: 'Generate and manage employee payslips', icon: '📄' },
      ]
    },
    {
      title: 'Policies & Reports',
      features: [
        { name: 'Medical Policies', path: '/human-resources/medical-policies', description: 'Setup employee medical insurance policies', icon: '🏥' },
        { name: 'HR Reports', path: '/human-resources/reports', description: 'View attendance, payroll, and leave reports', icon: '📈' },
      ]
    }
  ];

  return (
    <ModuleDashboard
      title="Human Resources"
      description="Employee management and payroll processing"
      stats={stats}
      sections={sections}
    />
  );
}

export default function HumanResourcesHome() {
  return (
    <Routes>
      <Route index element={<HRDashboard />} />
      <Route path="employees" element={<EmployeeList />} />
      <Route path="employees/new" element={<EmployeeForm />} />
      <Route path="employees/:id" element={<EmployeeForm />} />
      <Route path="leave-setup" element={<LeaveSetupList />} />
      <Route path="leave-setup/new" element={<LeaveSetupForm />} />
      <Route path="leave-setup/:id" element={<LeaveSetupForm />} />
      <Route path="shifts" element={<ShiftList />} />
      <Route path="shifts/new" element={<ShiftForm />} />
      <Route path="shifts/:id" element={<ShiftForm />} />
      <Route path="attendance" element={<AttendanceList />} />
      <Route path="attendance/new" element={<AttendanceForm />} />
      <Route path="attendance/:id" element={<AttendanceForm />} />
      <Route path="salary-config" element={<SalaryConfigList />} />
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







