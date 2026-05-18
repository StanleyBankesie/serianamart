import React from 'react';
import { Route, Routes } from 'react-router-dom';

import DashboardList from './dashboards/DashboardList.jsx';
import DashboardForm from './dashboards/DashboardForm.jsx';
import ModuleDashboard from '../../../components/ModuleDashboard.jsx';
import { api } from '../../../api/client.js';

function BusinessIntelligenceLanding() {
  const [stats, setStats] = React.useState([
    { rbac_key: 'active-dashboards', icon: '📊', value: '0', label: 'Active Dashboards', change: 'Manage visualizations', changeType: 'positive', path: '/business-intelligence/dashboards' }
  ]);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const resp = await api.get('/bi/dashboards');
        const dashboards = Number(resp?.data?.summary?.bi?.active_dashboards || 0);
        if (mounted) {
          setStats((prev) => {
            const next = [...prev];
            next[0] = { ...next[0], value: String(dashboards) };
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
      title: 'Dashboards & Visualizations Builder',
      features: [
        { name: 'Dashboard Workspace', path: '/business-intelligence/dashboards', description: 'Interactive dashboard & visualization board', icon: '📊' },
        { name: 'Create Custom Visualization', path: '/business-intelligence/dashboards/new', description: 'Build self-service dashboards and charts', icon: '➕' },
      ],
    },
  ];

  return (
    <ModuleDashboard
      title="Business Intelligence Hub"
      description="Self-Service KPI Builder, interactive charts, and business metrics"
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
    </Routes>
  );
}

export const businessIntelligenceFeatures = [
  { module_key: "business-intelligence", label: "Dashboard Workspace", path: "/business-intelligence/dashboards", type: "dashboard" },
  { module_key: "business-intelligence", label: "New Dashboard", path: "/business-intelligence/dashboards/new", type: "dashboard" },
];
