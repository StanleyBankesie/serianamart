import React from 'react';
import { Route, Routes } from 'react-router-dom';

import AssetList from './assets/AssetList.jsx';
import AssetForm from './assets/AssetForm.jsx';
import MaintenanceWorkOrderList from './work-orders/MaintenanceWorkOrderList.jsx';
import MaintenanceWorkOrderForm from './work-orders/MaintenanceWorkOrderForm.jsx';
import PmScheduleList from './pm-schedules/PmScheduleList.jsx';
import PmScheduleForm from './pm-schedules/PmScheduleForm.jsx';
import MaintenanceReports from './reports/MaintenanceReports.jsx';
import ModuleDashboard from '../../../components/ModuleDashboard.jsx';
import { api } from '../../../api/client.js';
import MaintenanceRequestsList from './maintenance-requests/MaintenanceRequestsList.jsx';
import MaintenanceRequestForm from './maintenance-requests/MaintenanceRequestForm.jsx';
import MaintenanceJobOrdersList from './job-orders/MaintenanceJobOrdersList.jsx';
import MaintenanceJobOrderForm from './job-orders/MaintenanceJobOrderForm.jsx';
import JobExecutionList from './job-execution/JobExecutionList.jsx';
import JobExecutionForm from './job-execution/JobExecutionForm.jsx';
import MaintenanceRFQList from './rfq/MaintenanceRFQList.jsx';
import MaintenanceRFQForm from './rfq/MaintenanceRFQForm.jsx';
import SupplierQuotationsList from './supplier-quotations/SupplierQuotationsList.jsx';
import SupplierQuotationForm from './supplier-quotations/SupplierQuotationForm.jsx';
import MaintenanceBillList from './maintenance-bills/MaintenanceBillList.jsx';
import MaintenanceBillForm from './maintenance-bills/MaintenanceBillForm.jsx';
import MaintenanceScheduleList from './schedules/MaintenanceScheduleList.jsx';
import MaintenanceScheduleForm from './schedules/MaintenanceScheduleForm.jsx';
import MaintenanceRosterList from './rosters/MaintenanceRosterList.jsx';
import MaintenanceRosterForm from './rosters/MaintenanceRosterForm.jsx';
import EquipmentList from './equipment/EquipmentList.jsx';
import EquipmentForm from './equipment/EquipmentForm.jsx';
import MaintenanceContractList from './contracts/MaintenanceContractList.jsx';
import MaintenanceContractForm from './contracts/MaintenanceContractForm.jsx';
import MaintenanceSetupPage from './setup/MaintenanceSetupPage.jsx';

function MaintenanceLanding() {
  const [stats, setStats] = React.useState([
    { rbac_key: 'open-work-orders', icon: '🛠', value: '8', label: 'Open Work Orders', change: '2 critical', changeType: 'negative', path: '/maintenance/work-orders' },
    { rbac_key: 'overdue-pms', icon: '🗓', value: '4', label: 'Overdue PMs', change: 'Needs attention', changeType: 'negative', path: '/maintenance/pm-schedules' },
    { rbac_key: 'asset-health', icon: '🏷', value: '98%', label: 'Asset Health', change: '↑ 1% this month', changeType: 'positive', path: '/maintenance/assets' }
  ]);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const resp = await api.get('/bi/dashboards');
        const openWos = Number(resp?.data?.summary?.maintenance?.open_work_orders || 0);
        const overdue = Number(resp?.data?.summary?.maintenance?.overdue_pms || 0);
        const health = Number(resp?.data?.summary?.maintenance?.asset_health_percent || 0);
        if (mounted) {
          setStats((prev) => {
            const next = [...prev];
            next[0] = { ...next[0], value: String(openWos) };
            next[1] = { ...next[1], value: String(overdue) };
            next[2] = { ...next[2], value: `${health}%` };
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
      title: 'Master Data',
      features: [
        { name: 'Assets', path: '/maintenance/assets', description: 'Register and manage assets', icon: '🏷' },
        { name: 'New Asset', path: '/maintenance/assets/new', description: 'Add an asset', icon: '➕' },
        { name: 'Equipment', path: '/maintenance/equipment', description: 'Equipment setup', icon: '🧰' },
        { name: 'New Equipment', path: '/maintenance/equipment/new', description: 'Add equipment', icon: '➕' },
        { name: 'Maintenance Contracts', path: '/maintenance/contracts', description: 'Manage service contracts', icon: '📄' },
        { name: 'New Contract', path: '/maintenance/contracts/new', description: 'Create contract', icon: '➕' },
      ],
    },
    {
      title: 'Requests & Orders',
      features: [
        { name: 'Maintenance Requests', path: '/maintenance/maintenance-requests', description: 'Log maintenance requests', icon: '📝' },
        { name: 'New Request', path: '/maintenance/maintenance-requests/new', description: 'Create a request', icon: '➕' },
        { name: 'Job Orders', path: '/maintenance/job-orders', description: 'Create and track job orders', icon: '🛠' },
        { name: 'New Job Order', path: '/maintenance/job-orders/new', description: 'Create a job order', icon: '➕' },
      ],
    },
    {
      title: 'External Service',
      features: [
        { name: 'RFQs', path: '/maintenance/rfq', description: 'Request for quotation to suppliers', icon: '📣' },
        { name: 'New RFQ', path: '/maintenance/rfq/new', description: 'Create RFQ', icon: '➕' },
        { name: 'Supplier Quotations', path: '/maintenance/supplier-quotations', description: 'Record quotations received', icon: '📑' },
        { name: 'New Supplier Quotation', path: '/maintenance/supplier-quotations/new', description: 'Record a quotation', icon: '➕' },
      ],
    },
    {
      title: 'Execution & Billing',
      features: [
        { name: 'Job Executions', path: '/maintenance/job-executions', description: 'Record execution and completion', icon: '⚙️' },
        { name: 'New Execution', path: '/maintenance/job-executions/new', description: 'Start an execution', icon: '➕' },
        { name: 'Maintenance Bills', path: '/maintenance/bills', description: 'Raise bills for finance', icon: '💳' },
        { name: 'New Bill', path: '/maintenance/bills/new', description: 'Create a bill', icon: '➕' },
      ],
    },
    {
      title: 'Preventive Maintenance',
      features: [
        { name: 'PM Schedules', path: '/maintenance/pm-schedules', description: 'Define preventive schedules', icon: '🗓' },
        { name: 'New Schedule', path: '/maintenance/pm-schedules/new', description: 'Create a new PM schedule', icon: '➕' },
        { name: 'Maintenance Schedules', path: '/maintenance/schedules', description: 'Ad-hoc schedules', icon: '🗓' },
        { name: 'New Maintenance Schedule', path: '/maintenance/schedules/new', description: 'Create schedule', icon: '➕' },
        { name: 'Maintenance Rosters', path: '/maintenance/rosters', description: 'Roster planning', icon: '📋' },
        { name: 'New Roster', path: '/maintenance/rosters/new', description: 'Create roster', icon: '➕' },
      ],
    },
    {
      title: 'Reports',
      features: [
        { name: 'Maintenance Reports', path: '/maintenance/reports', description: 'Asset and maintenance KPIs', icon: '📊' },
        { name: 'Setup', path: '/maintenance/setup', description: 'Configure maintenance parameters', icon: '🛠️' },
      ],
    },
  ];

  return (
    <ModuleDashboard
      title="Maintenance"
      description="Asset maintenance and work order management"
      stats={stats}
      sections={sections}
      features={maintenanceFeatures}
    />
  );
}

export default function MaintenanceHome() {
  return (
    <Routes>
      <Route path="/" element={<MaintenanceLanding />} />

      <Route path="/assets" element={<AssetList />} />
      <Route path="/assets/new" element={<AssetForm />} />
      <Route path="/assets/:id" element={<AssetForm />} />

      <Route path="/work-orders" element={<MaintenanceWorkOrderList />} />
      <Route path="/work-orders/new" element={<MaintenanceWorkOrderForm />} />
      <Route path="/work-orders/:id" element={<MaintenanceWorkOrderForm />} />

      <Route path="/maintenance-requests" element={<MaintenanceRequestsList />} />
      <Route path="/maintenance-requests/new" element={<MaintenanceRequestForm />} />
      <Route path="/maintenance-requests/:id" element={<MaintenanceRequestForm />} />

      <Route path="/job-orders" element={<MaintenanceJobOrdersList />} />
      <Route path="/job-orders/new" element={<MaintenanceJobOrderForm />} />
      <Route path="/job-orders/:id" element={<MaintenanceJobOrderForm />} />

      <Route path="/job-executions" element={<JobExecutionList />} />
      <Route path="/job-executions/new" element={<JobExecutionForm />} />
      <Route path="/job-executions/:id" element={<JobExecutionForm />} />

      <Route path="/rfq" element={<MaintenanceRFQList />} />
      <Route path="/rfq/new" element={<MaintenanceRFQForm />} />
      <Route path="/rfq/:id" element={<MaintenanceRFQForm />} />

      <Route path="/supplier-quotations" element={<SupplierQuotationsList />} />
      <Route path="/supplier-quotations/new" element={<SupplierQuotationForm />} />
      <Route path="/supplier-quotations/:id" element={<SupplierQuotationForm />} />

      <Route path="/bills" element={<MaintenanceBillList />} />
      <Route path="/bills/new" element={<MaintenanceBillForm />} />
      <Route path="/bills/:id" element={<MaintenanceBillForm />} />

      <Route path="/schedules" element={<MaintenanceScheduleList />} />
      <Route path="/schedules/new" element={<MaintenanceScheduleForm />} />
      <Route path="/schedules/:id" element={<MaintenanceScheduleForm />} />

      <Route path="/rosters" element={<MaintenanceRosterList />} />
      <Route path="/rosters/new" element={<MaintenanceRosterForm />} />
      <Route path="/rosters/:id" element={<MaintenanceRosterForm />} />

      <Route path="/equipment" element={<EquipmentList />} />
      <Route path="/equipment/new" element={<EquipmentForm />} />
      <Route path="/equipment/:id" element={<EquipmentForm />} />

      <Route path="/contracts" element={<MaintenanceContractList />} />
      <Route path="/contracts/new" element={<MaintenanceContractForm />} />
      <Route path="/contracts/:id" element={<MaintenanceContractForm />} />

      <Route path="/pm-schedules" element={<PmScheduleList />} />
      <Route path="/pm-schedules/new" element={<PmScheduleForm />} />
      <Route path="/pm-schedules/:id" element={<PmScheduleForm />} />

      <Route path="/setup" element={<MaintenanceSetupPage />} />

      <Route path="/reports" element={<MaintenanceReports />} />
    </Routes>
  );
}

export const maintenanceFeatures = [
  { module_key: "maintenance", label: "Assets", path: "/maintenance/assets", type: "feature" },
  { module_key: "maintenance", label: "New Asset", path: "/maintenance/assets/new", type: "feature" },
  { module_key: "maintenance", label: "Work Orders", path: "/maintenance/work-orders", type: "feature" },
  { module_key: "maintenance", label: "New Work Order", path: "/maintenance/work-orders/new", type: "feature" },
  { module_key: "maintenance", label: "PM Schedules", path: "/maintenance/pm-schedules", type: "feature" },
  { module_key: "maintenance", label: "New Schedule", path: "/maintenance/pm-schedules/new", type: "feature" },
  { module_key: "maintenance", label: "Maintenance Reports", path: "/maintenance/reports", type: "dashboard" },
  { module_key: "maintenance", label: "Maintenance Requests", path: "/maintenance/maintenance-requests", type: "feature" },
  { module_key: "maintenance", label: "Job Orders", path: "/maintenance/job-orders", type: "feature" },
  { module_key: "maintenance", label: "Job Executions", path: "/maintenance/job-executions", type: "feature" },
  { module_key: "maintenance", label: "RFQs", path: "/maintenance/rfq", type: "feature" },
  { module_key: "maintenance", label: "Supplier Quotations", path: "/maintenance/supplier-quotations", type: "feature" },
  { module_key: "maintenance", label: "Maintenance Bills", path: "/maintenance/bills", type: "feature" },
  { module_key: "maintenance", label: "Maintenance Schedules", path: "/maintenance/schedules", type: "feature" },
  { module_key: "maintenance", label: "Maintenance Rosters", path: "/maintenance/rosters", type: "feature" },
  { module_key: "maintenance", label: "Equipment", path: "/maintenance/equipment", type: "feature" },
  { module_key: "maintenance", label: "Maintenance Contracts", path: "/maintenance/contracts", type: "feature" },
  { module_key: "maintenance", label: "Setup", path: "/maintenance/setup", type: "feature" },
];



