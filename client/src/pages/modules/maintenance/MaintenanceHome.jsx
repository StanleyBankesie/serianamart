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

function MaintenanceLanding() {
  const [stats, setStats] = React.useState([
    { icon: '🛠', value: '8', label: 'Open Work Orders', change: '2 critical', changeType: 'negative', path: '/maintenance/work-orders' },
    { icon: '🗓', value: '4', label: 'Overdue PMs', change: 'Needs attention', changeType: 'negative', path: '/maintenance/pm-schedules' },
    { icon: '🏷', value: '98%', label: 'Asset Health', change: '↑ 1% this month', changeType: 'positive', path: '/maintenance/assets' }
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
      ],
    },
    {
      title: 'Execution',
      features: [
        { name: 'Work Orders', path: '/maintenance/work-orders', description: 'Corrective and preventive work orders', icon: '🛠' },
        { name: 'New Work Order', path: '/maintenance/work-orders/new', description: 'Create a maintenance work order', icon: '📝' },
      ],
    },
    {
      title: 'Preventive Maintenance',
      features: [
        { name: 'PM Schedules', path: '/maintenance/pm-schedules', description: 'Define preventive schedules', icon: '🗓' },
        { name: 'New Schedule', path: '/maintenance/pm-schedules/new', description: 'Create a new PM schedule', icon: '➕' },
      ],
    },
    {
      title: 'Reports',
      features: [
        { name: 'Maintenance Reports', path: '/maintenance/reports', description: 'Asset and maintenance KPIs', icon: '📊' },
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

      <Route path="/pm-schedules" element={<PmScheduleList />} />
      <Route path="/pm-schedules/new" element={<PmScheduleForm />} />
      <Route path="/pm-schedules/:id" element={<PmScheduleForm />} />

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
];





