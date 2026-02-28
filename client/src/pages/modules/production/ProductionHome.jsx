import React from 'react';
import { Route, Routes } from 'react-router-dom';

import BomList from './bom/BomList.jsx';
import BomForm from './bom/BomForm.jsx';
import WorkOrderList from './work-orders/WorkOrderList.jsx';
import WorkOrderForm from './work-orders/WorkOrderForm.jsx';
import ProductionReports from './reports/ProductionReports.jsx';
import ModuleDashboard from '../../../components/ModuleDashboard.jsx';
import { api } from '../../../api/client.js';

function ProductionLanding() {
  const [stats, setStats] = React.useState([
    { rbac_key: 'active-work-orders', icon: '🏭', value: '12', label: 'Active Work Orders', change: '3 due today', changeType: 'neutral', path: '/production/work-orders' },
    { rbac_key: 'efficiency', icon: '⚙', value: '94%', label: 'Efficiency', change: '↑ 2% this week', changeType: 'positive', path: '/production/reports' },
    { rbac_key: 'active-boms', icon: '🧩', value: '45', label: 'Active BOMs', change: '5 new this month', changeType: 'neutral', path: '/production/bom' }
  ]);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const resp = await api.get('/bi/dashboards');
        const workOrders = Number(resp?.data?.summary?.production?.active_work_orders || 0);
        const efficiency = Number(resp?.data?.summary?.production?.efficiency_percent || 0);
        const boms = Number(resp?.data?.summary?.production?.active_boms || 0);
        if (mounted) {
          setStats((prev) => {
            const next = [...prev];
            next[0] = { ...next[0], value: String(workOrders) };
            next[1] = { ...next[1], value: `${efficiency}%` };
            next[2] = { ...next[2], value: String(boms) };
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
        { name: 'Bills of Materials', path: '/production/bom', description: 'Define BOMs and components', icon: '🧩' },
        { name: 'New BOM', path: '/production/bom/new', description: 'Create a new BOM', icon: '➕' },
      ],
    },
    {
      title: 'Execution',
      features: [
        { name: 'Work Orders', path: '/production/work-orders', description: 'Create and track work orders', icon: '🏭' },
        { name: 'New Work Order', path: '/production/work-orders/new', description: 'Start a work order', icon: '⚙' },
      ],
    },
    {
      title: 'Reports',
      features: [
        { name: 'Production Reports', path: '/production/reports', description: 'Manufacturing analytics', icon: '📊' },
      ],
    },
  ];

  return (
    <ModuleDashboard
      title="Production"
      description="Manufacturing and production planning"
      stats={stats}
      sections={sections}
      features={productionFeatures}
    />
  );
}

export default function ProductionHome() {
  return (
    <Routes>
      <Route path="/" element={<ProductionLanding />} />

      <Route path="/bom" element={<BomList />} />
      <Route path="/bom/new" element={<BomForm />} />
      <Route path="/bom/:id" element={<BomForm />} />

      <Route path="/work-orders" element={<WorkOrderList />} />
      <Route path="/work-orders/new" element={<WorkOrderForm />} />
      <Route path="/work-orders/:id" element={<WorkOrderForm />} />

      <Route path="/reports" element={<ProductionReports />} />
    </Routes>
  );
}

export const productionFeatures = [
  { module_key: "production", label: "Bills of Materials", path: "/production/bom", type: "feature" },
  { module_key: "production", label: "New BOM", path: "/production/bom/new", type: "feature" },
  { module_key: "production", label: "Work Orders", path: "/production/work-orders", type: "feature" },
  { module_key: "production", label: "New Work Order", path: "/production/work-orders/new", type: "feature" },
  { module_key: "production", label: "Production Reports", path: "/production/reports", type: "dashboard" },
];




