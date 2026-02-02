import React from 'react';
import { Route, Routes } from 'react-router-dom';

import DashboardList from './dashboards/DashboardList.jsx';
import DashboardForm from './dashboards/DashboardForm.jsx';
import ReportList from './reports/ReportList.jsx';
import ReportForm from './reports/ReportForm.jsx';
import BiReportsPage from './reports/BiReportsPage.jsx';
import ModuleDashboard from '../../../components/ModuleDashboard.jsx';

function BusinessIntelligenceLanding() {
  const stats = [
    { icon: '📊', value: '15', label: 'Active Dashboards', change: '2 created this week', changeType: 'positive', path: '/business-intelligence/dashboards' },
    { icon: '🧾', value: '8', label: 'Scheduled Reports', change: 'Running daily', changeType: 'neutral', path: '/business-intelligence/reports' },
    { icon: '💾', value: 'Connected', label: 'Data Sources', change: 'All systems online', changeType: 'positive', path: '/business-intelligence/bi-reports' }
  ];

  const sections = [
    {
      title: 'Dashboards',
      features: [
        { name: 'Dashboard List', path: '/business-intelligence/dashboards', description: 'Manage KPI dashboards', icon: '📊' },
        { name: 'New Dashboard', path: '/business-intelligence/dashboards/new', description: 'Create a new dashboard', icon: '➕' },
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
    </Routes>
  );
}







