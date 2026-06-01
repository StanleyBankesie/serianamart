import React, { useState, useEffect } from "react";
import { Link, Route, Routes, Navigate } from "react-router-dom";
import ModuleDashboard from "../../../components/ModuleDashboard.jsx";
import { api } from "api/client";
import { FileText, Layers, Calendar, Clock } from "lucide-react";

import BomList from "./bom/BomList";
import BomForm from "./bom/BomForm";
import WorkOrderList from "./work-orders/WorkOrderList";
import WorkOrderForm from "./work-orders/WorkOrderForm";

import ProcessList from "./setup/ProcessList";
import MachineList from "./setup/MachineList";
import ShiftList from "./setup/ShiftList";

import RoutingList from "./routings/RoutingList";
import RoutingForm from "./routings/RoutingForm";

import DailyPlanList from "./planning/DailyPlanList";
import DailyPlanForm from "./planning/DailyPlanForm";

import JobCardList from "./execution/JobCardList";
import JobCardExecution from "./execution/JobCardExecution";

import MaterialReceiptList from "./execution/MaterialReceiptList";
import MaterialReceiptForm from "./execution/MaterialReceiptForm";

import MaterialRequisitionList from "./execution/MaterialRequisitionList";
import MaterialRequisitionForm from "./execution/MaterialRequisitionForm";

import ProductionTransferList from "./execution/ProductionTransferList";
import ProductionTransferForm from "./execution/ProductionTransferForm";

import ProductionReports from "./reports/ProductionReports";
import EfficiencyReport from "./reports/EfficiencyReport";

import StockJournalList from "./inventory/StockJournalList";
import StockJournalForm from "./inventory/StockJournalForm";

import ProductionSetup from "./setup/ProductionSetup";

function ProductionHomeIndex() {
  const [stats, setStats] = useState([
    {
      label: "Active Production Orders",
      value: "0",
      change: "Execution",
      icon: "📋",
      path: "/production/work-orders",
      color: "from-blue-600 to-blue-700"
    },
    {
      label: "Open Job Cards",
      value: "0",
      change: "Shop Floor",
      icon: "🏷️",
      path: "/production/execution/job-cards",
      color: "from-indigo-600 to-indigo-700"
    },
    {
      label: "Pending Requisitions",
      value: "0",
      change: "Materials",
      icon: "📝",
      path: "/production/execution/material-requisition",
      color: "from-amber-600 to-amber-700"
    },
    {
      label: "BOM Master Records",
      value: "0",
      change: "Masters",
      icon: "📜",
      path: "/production/boms",
      color: "from-emerald-600 to-emerald-700"
    }
  ]);

  useEffect(() => {
    let mounted = true;
    let timer;
    async function load() {
      try {
        const res = await api.get("/production/dashboard/stats");
        const d = res.data;
        if (mounted) {
          setStats(prev => {
            const next = [...prev];
            next[0] = { ...next[0], value: String(d.activeOrders ?? "—") };
            next[1] = { ...next[1], value: String(d.jobCards ?? "—") };
            next[2] = { ...next[2], value: String(d.pendingRequisitions ?? "—") };
            next[3] = { ...next[3], value: String(d.boms ?? "—") };
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
      title: "Manufacturing Masters",
      features: [
        {
          name: "Bill of Materials (BOM)",
          path: "/production/boms",
          description: "Define multi-level product recipes, assembly structures, and scrap factors",
          icon: "📜",
        },
        {
          name: "Routing & Operations",
          path: "/production/routings",
          description: "Standardize process sequences and detailed operation instructions",
          icon: "🔄",
        },
        {
          name: "Work Centers & Machines",
          path: "/production/setup/machines",
          description: "Register factory assets, production lines, and monitor equipment status",
          icon: "⚙️",
        },
        {
          name: "Manufacturing Setup",
          path: "/production/setup",
          description: "Global manufacturing parameters, processes, and shift configurations",
          icon: "🛠️",
        }
      ]
    },
    {
      title: "Planning & Control",
      features: [
        {
          name: "Work Orders",
          path: "/production/work-orders",
          description: "Generate and track manufacturing orders through the entire lifecycle",
          icon: "📋",
        },
        {
          name: "Daily Production Plan",
          path: "/production/planning/daily",
          description: "Manage daily manufacturing targets and shop floor schedules",
          icon: "📅",
        },
        {
          name: "Production Timeline",
          path: "/production/planning/schedule",
          description: "Visual scheduling and resource allocation for production runs",
          icon: "⏳",
        }
      ]
    },
    {
      title: "Shop Floor Execution",
      features: [
        {
          name: "Job Cards Execution",
          path: "/production/execution/job-cards",
          description: "Real-time labor tracking and progress monitoring by work center",
          icon: "🏷️",
        },
        {
          name: "Material Requisition",
          path: "/production/execution/material-requisition",
          description: "Request raw materials from warehouse based on production demand",
          icon: "📝",
        },
        {
          name: "Finished Goods Receipt",
          path: "/production/execution/material-receipt",
          description: "Record production output and move finished items to inventory",
          icon: "📥",
        },
        {
          name: "Production Transfers",
          path: "/production/execution/transfer",
          description: "Internal movement of WIP materials between production zones",
          icon: "🚚",
        }
      ]
    },
    {
      title: "Inventory & Journaling",
      features: [
        {
          name: "Stock Journal",
          path: "/production/inventory/journal",
          description: "Adjust stock levels for production waste, scrap, or consumption",
          icon: "📒",
        },
        {
          name: "Quality Inspections",
          path: "/production/execution/quality",
          description: "Implement rigorous quality control checks for materials and products",
          icon: "🛡️",
        },
        {
          name: "Inventory Reconciliation",
          path: "/production/inventory/updation",
          description: "Verify and update production floor physical stock levels",
          icon: "🧮",
        }
      ]
    },
    {
      title: "Intelligence & Analytics",
      features: [
        {
          name: "Production Dashboard",
          path: "/production/reports",
          description: "Comprehensive manufacturing report repository and KPIs",
          icon: "📊",
        },
        {
          name: "Efficiency Analysis",
          path: "/production/reports/efficiency",
          description: "Monitor planned vs actual performance and throughput",
          icon: "📈",
        },
        {
          name: "Variance Reports",
          path: "/production/reports/variance",
          description: "Track differences between estimated and actual material usage",
          icon: "📉",
        }
      ]
    }
  ];

  return (
    <ModuleDashboard
      title="Production Management"
      description="Modern industrial suite for end-to-end manufacturing control, from design and planning to shop floor execution."
      stats={stats}
      sections={sections}
      features={productionFeatures}
      showAll={true}
    />
  );
}

function ProductionPlaceholder({ title }) {
  return (
    <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 max-w-2xl mx-auto mt-10">
      <div className="w-20 h-20 bg-indigo-50 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
        <span className="text-3xl">🏗️</span>
      </div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{title}</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-6">This module is currently being initialized. Full industrial-grade features for this section are coming online.</p>
      <Link to="/production" className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all">
        Return to Dashboard
      </Link>
    </div>
  );
}

export default function ProductionHome() {
  return (
    <Routes>
      <Route index element={<ProductionHomeIndex />} />
      
      {/* Existing Modules */}
      <Route path="boms" element={<BomList />} />
      <Route path="boms/new" element={<BomForm />} />
      <Route path="boms/edit/:id" element={<BomForm />} />
      <Route path="work-orders" element={<WorkOrderList />} />
      <Route path="work-orders/new" element={<WorkOrderForm />} />
      <Route path="work-orders/:id" element={<WorkOrderForm />} />

      {/* New Planning Routes */}
      <Route path="planning/daily" element={<DailyPlanList />} />
      <Route path="planning/daily/new" element={<DailyPlanForm />} />
      <Route path="planning/daily/edit/:id" element={<DailyPlanForm />} />
      <Route path="planning/schedule" element={<ProductionPlaceholder title="Production Schedule" />} />
      <Route path="routings" element={<RoutingList />} />
      <Route path="routings/new" element={<RoutingForm />} />
      <Route path="routings/edit/:id" element={<RoutingForm />} />

      {/* New Execution Routes */}
      <Route path="execution/job-cards" element={<JobCardList />} />
      <Route path="execution/job-cards/:id" element={<JobCardExecution />} />
      <Route path="execution/material-receipt" element={<MaterialReceiptList />} />
      <Route path="execution/material-receipt/new" element={<MaterialReceiptForm />} />
      <Route path="execution/material-requisition" element={<MaterialRequisitionList />} />
      <Route path="execution/material-requisition/new" element={<MaterialRequisitionForm />} />
      <Route path="execution/transfer" element={<ProductionTransferList />} />
      <Route path="execution/transfer/new" element={<ProductionTransferForm />} />
      <Route path="execution/quality" element={<ProductionPlaceholder title="Quality Inspections" />} />

      {/* Reports Routes */}
      <Route path="reports" element={<ProductionReports />} />
      <Route path="reports/efficiency" element={<EfficiencyReport />} />
      <Route path="reports/variance" element={<ProductionPlaceholder title="Material Usage Variance" />} />
      <Route path="reports/bom-explosion" element={<ProductionPlaceholder title="BOM Explosion Analysis" />} />
      <Route path="reports/machines" element={<ProductionPlaceholder title="Machine Utilization" />} />

      {/* New Inventory & Setup Routes */}
      <Route path="inventory/journal" element={<StockJournalList />} />
      <Route path="inventory/journal/new" element={<StockJournalForm />} />
      <Route path="inventory/updation" element={<ProductionPlaceholder title="Inventory Updation" />} />
      <Route path="setup" element={<ProductionSetup />} />
      <Route path="setup/processes" element={<ProcessList />} />
      <Route path="setup/machines" element={<MachineList />} />
      <Route path="setup/shifts" element={<ShiftList />} />

      <Route path="*" element={<Navigate to="/production" replace />} />
    </Routes>
  );
}

export const productionFeatures = [
  {
    module_key: "production",
    label: "Work Orders",
    path: "/production/work-orders",
    type: "feature",
    icon: "📋"
  },
  {
    module_key: "production",
    label: "Bill of Materials",
    path: "/production/boms",
    type: "feature",
    icon: "📜"
  }
];
