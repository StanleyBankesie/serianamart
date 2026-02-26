import React from 'react';
import { Route, Routes } from 'react-router-dom';

import DashboardList from './dashboards/DashboardList.jsx';
import DashboardForm from './dashboards/DashboardForm.jsx';
import ReportList from './reports/ReportList.jsx';
import ReportForm from './reports/ReportForm.jsx';
import BiReportsPage from './reports/BiReportsPage.jsx';
import ModuleDashboard from '../../../components/ModuleDashboard.jsx';
import { api } from '../../../api/client.js';

function BusinessIntelligenceLanding() {
  const [stats, setStats] = React.useState([
    { icon: '📊', value: '15', label: 'Active Dashboards', change: '2 created this week', changeType: 'positive', path: '/business-intelligence/dashboards' },
    { icon: '🧾', value: '8', label: 'Scheduled Reports', change: 'Running daily', changeType: 'neutral', path: '/business-intelligence/reports' },
    { icon: '💾', value: 'Connected', label: 'Data Sources', change: 'All systems online', changeType: 'positive', path: '/business-intelligence/bi-reports' }
  ]);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const resp = await api.get('/bi/dashboards');
        const dashboards = Number(resp?.data?.summary?.bi?.active_dashboards || 0);
        const scheduled = Number(resp?.data?.summary?.bi?.scheduled_reports || 0);
        const dataSources = String(resp?.data?.summary?.bi?.data_sources_status || '').trim();
        if (mounted) {
          setStats((prev) => {
            const next = [...prev];
            next[0] = { ...next[0], value: String(dashboards) };
            next[1] = { ...next[1], value: String(scheduled) };
            next[2] = { ...next[2], value: dataSources || next[2].value };
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
      title: 'Dashboards',
      features: [
        { name: 'Dashboard List', path: '/business-intelligence/dashboards', description: 'Manage KPI dashboards', icon: '📊' },
        { name: 'New Dashboard', path: '/business-intelligence/dashboards/new', description: 'Create a new dashboard', icon: '➕' },
        { name: 'Analytics', path: '/business-intelligence/analytics', description: 'Interactive analytics workspace', icon: '📈' },
      ],
    },
    {
      title: 'Reports',
      features: [
        { name: 'Saved Reports', path: '/business-intelligence/reports', description: 'Report definitions and schedules', icon: '🧾' },
        { name: 'New Report', path: '/business-intelligence/reports/new', description: 'Create a new report definition', icon: '📝' },
        { name: 'BI Reports', path: '/business-intelligence/bi-reports', description: 'Quick report shortcuts', icon: '📈' },
      ],
    },
  ];

  return (
    <ModuleDashboard
      title="Business Intelligence"
      description="Analytics, reporting, and data insights"
      stats={stats}
      sections={sections}
      features={businessIntelligenceFeatures}
    />
  );
}

export default function BusinessIntelligenceHome() {
  return (
    <Routes>
      <Route path="/" element={<BusinessIntelligenceLanding />} />

      <Route path="/dashboards" element={<DashboardList />} />
      <Route path="/dashboards/new" element={<DashboardForm />} />
      <Route path="/dashboards/:id" element={<DashboardForm />} />

      <Route path="/reports" element={<ReportList />} />
      <Route path="/reports/new" element={<ReportForm />} />
      <Route path="/reports/:id" element={<ReportForm />} />

      <Route path="/bi-reports" element={<BiReportsPage />} />
      <Route path="/analytics" element={<BiReportsPage />} />
    </Routes>
  );
}

export const businessIntelligenceFeatures = [
  { module_key: "business-intelligence", label: "Dashboard List", path: "/business-intelligence/dashboards", type: "dashboard" },
  { module_key: "business-intelligence", label: "New Dashboard", path: "/business-intelligence/dashboards/new", type: "dashboard" },
  { module_key: "business-intelligence", label: "Analytics", path: "/business-intelligence/analytics", type: "dashboard" },
  { module_key: "business-intelligence", label: "Saved Reports", path: "/business-intelligence/reports", type: "dashboard" },
  { module_key: "business-intelligence", label: "New Report", path: "/business-intelligence/reports/new", type: "dashboard" },
  { module_key: "business-intelligence", label: "BI Reports", path: "/business-intelligence/bi-reports", type: "dashboard" },
];




