import React from 'react';
import { Route, Routes } from 'react-router-dom';

import BomList from './bom/BomList.jsx';
import BomForm from './bom/BomForm.jsx';
import WorkOrderList from './work-orders/WorkOrderList.jsx';
import WorkOrderForm from './work-orders/WorkOrderForm.jsx';
import ProductionReports from './reports/ProductionReports.jsx';
import ModuleDashboard from '../../../components/ModuleDashboard.jsx';

function ProductionLanding() {
  const stats = [
    { icon: '🏭', value: '12', label: 'Active Work Orders', change: '3 due today', changeType: 'neutral', path: '/production/work-orders' },
    { icon: '⚙', value: '94%', label: 'Efficiency', change: '↑ 2% this week', changeType: 'positive', path: '/production/reports' },
    { icon: '🧩', value: '45', label: 'Active BOMs', change: '5 new this month', changeType: 'neutral', path: '/production/bom' }
  ];

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







