/**
 * @fileoverview ProjectManagementHome component.
 * Provides functionality for ProjectManagementHome.
 */

import React from "react";
import { Link, Route, Routes } from "react-router-dom";
import ModuleDashboard from "../../../components/ModuleDashboard";
import { api } from "../../../api/client.js";

import ProjectList from "./projects/ProjectList.jsx";
import ProjectForm from "./projects/ProjectForm.jsx";
import ProjectDetailDashboard from "./projects/ProjectDetailDashboard.jsx";
import TaskList from "./tasks/TaskList.jsx";
import TaskForm from "./tasks/TaskForm.jsx";
import ProjectReports from "./reports/ProjectReports.jsx";
import TimesheetList from "./timesheets/TimesheetList.jsx";
import ExpenseList from "./expenses/ExpenseList.jsx";
import PMSetup from "./setup/Setup.jsx";
import PMMaterialRequisitionList from "./material-requisition/MaterialRequisitionList.jsx";
import PMMaterialRequisitionForm from "./material-requisition/MaterialRequisitionForm.jsx";
import PMMaterialUtilizationList from "./material-utilization/MaterialUtilizationList.jsx";
import PMMaterialUtilizationForm from "./material-utilization/MaterialUtilizationForm.jsx";
import PMMaterialReceiptList from "./material-receipt/MaterialReceiptList.jsx";
import PMMaterialReceiptForm from "./material-receipt/MaterialReceiptForm.jsx";
import ProjectOrderList from "./project-orders/ProjectOrderList.jsx";
import ProjectOrderForm from "./project-orders/ProjectOrderForm.jsx";
import ProjectStatusReport from "./reports/ProjectStatusReport.jsx";
import PMPurchaseRequisitionList from "./purchase-requisitions/PMPurchaseRequisitionList.jsx";
import PMPurchaseRequisitionForm from "./purchase-requisitions/PMPurchaseRequisitionForm.jsx";
import ProjectIncomeReport from "./reports/ProjectIncomeReport.jsx";
import ProjectExpenseReport from "./reports/ProjectExpenseReport.jsx";
import ProjectManagementDashboardPage from "./ProjectManagementDashboardPage.jsx";

function ProjectManagementLanding() {
  const [stats, setStats] = React.useState([
    {
      rbac_key: "active-projects",
      value: "—",
      label: "Total Projects",
      change: "Loading…",
      changeType: "neutral",
      path: "/project-management/projects",
    },
    {
      rbac_key: "active-tasks",
      value: "—",
      label: "Active Tasks",
      change: "Loading…",
      changeType: "neutral",
      path: "/project-management/tasks",
    },
    {
      rbac_key: "total-budget",
      value: "—",
      label: "Total Budget",
      change: "Loading…",
      changeType: "neutral",
      path: "/project-management/reports",
    },
    {
      rbac_key: "logged-hours",
      value: "—",
      label: "Logged Hours",
      change: "Loading…",
      changeType: "neutral",
      path: "/project-management/reports",
    },
  ]);

  React.useEffect(() => {
    let mounted = true;
    let timer;
    async function load() {
      try {
        const resp = await api.get("/projects/dashboard/stats");
        const d = resp.data;
        if (mounted) {
          setStats((prev) => [
            {
              ...prev[0],
              value: String(d.totalProjects ?? "—"),
              change: `${d.completedProjects ?? 0} completed`,
              changeType: "positive",
            },
            {
              ...prev[1],
              value: String(d.activeTasks ?? "—"),
              change: `${d.completedTasks ?? 0} done`,
              changeType: d.activeTasks > 0 ? "warning" : "positive",
            },
            {
              ...prev[2],
              value: `GHS ${Number(d.totalBudget || 0).toLocaleString()}`,
              change: `${d.totalExpenses ?? 0} spent`,
              changeType: "positive",
            },
            {
              ...prev[3],
              value: `${Number(d.totalLoggedHours || 0).toFixed(1)}h`,
              change: `${d.totalDays ?? 0} days`,
              changeType: "positive",
            },
          ]);
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
      title: "Portfolio",
      badge: "Planning",
      items: [
        {
          title: "Projects",
          path: "/project-management/projects",
          description: "Manage end-to-end project lifecycles",
          icon: "📁",
        },
        {
          title: "Project Setup",
          path: "/project-management/setup",
          description: "Configure project managers and settings",
          icon: "⚙️",
        },
      ],
    },
    {
      title: "Execution",
      badge: "Tracking",
      items: [
        {
          title: "Task Board",
          path: "/project-management/tasks",
          description: "WBS and task assignment",
          icon: "✅",
        },
        {
          title: "Project Timeline",
          path: "/project-management/timesheets",
          description: "Log and track work hours",
          icon: "⏱️",
        },
        {
          title: "Material Requisition",
          path: "/project-management/material-requisitions",
          description: "Request materials with approval workflow",
          icon: "📋",
        },
        {
          title: "Material Utilization",
          path: "/project-management/material-utilizations",
          description: "Track material consumption",
          icon: "📦",
        },
        {
          title: "Materials Receipt",
          path: "/project-management/material-receipts",
          description: "Receive materials from inventory",
          icon: "📥",
        },
        {
          title: "Project Orders",
          path: "/project-management/project-orders",
          description: "Order materials with approval workflow",
          icon: "📋",
        },
        {
          title: "Purchase Requisition",
          path: "/project-management/purchase-requisitions",
          description: "Request materials for procurement",
          icon: "📋",
        },
      ],
    },
    {
      title: "Finance",
      items: [
        {
          title: "Project Expenses",
          path: "/project-management/expenses",
          description: "Track project-related costs",
          icon: "💵",
        },
      ],
    },
    {
      title: "Reporting",
      items: [
        {
          title: "Analytics",
          path: "/project-management/reports",
          description: "Project profitability and KPIs",
          icon: "📊",
        },
        {
          title: "Project Status Report",
          path: "/project-management/reports/project-status",
          description: "Completion metrics and task breakdown",
          icon: "📈",
        },
        {
          title: "Project Income Report",
          path: "/project-management/reports/project-income",
          description: "Receipt vouchers linked to projects",
          icon: "💰",
        },
        {
          title: "Project Expense Report",
          path: "/project-management/reports/project-expense",
          description: "Payment vouchers linked to projects",
          icon: "💳",
        },
      ],
    },
  ];

  return (
    <ModuleDashboard
      title="Project Management"
      description="Strategic project planning and operational execution"
      stats={stats}
      moduleKey="project-management"
      headerActions={[
        {
          label: "Dashboard",
          path: "/project-management/dashboard",
          icon: "📊",
        },
      ]}
      sections={sections}
      features={projectManagementFeatures}
    />
  );
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ProjectManagementHome() {
  return (
    <Routes>
      <Route path="/" element={<ProjectManagementLanding />} />
      <Route path="dashboard" element={<ProjectManagementDashboardPage />} />

      <Route path="/projects" element={<ProjectList />} />
      <Route path="/projects/new" element={<ProjectForm />} />
      <Route path="/projects/:id/edit" element={<ProjectForm />} />
      <Route path="/projects/:id" element={<ProjectForm />} />
      <Route
        path="/projects/:id/dashboard"
        element={<ProjectDetailDashboard />}
      />

      <Route path="/tasks" element={<TaskList />} />
      <Route path="/tasks/new" element={<TaskForm />} />
      <Route path="/tasks/:id" element={<TaskForm />} />

      <Route path="/timesheets" element={<TimesheetList />} />
      <Route path="/expenses" element={<ExpenseList />} />

      <Route path="/reports" element={<ProjectReports />} />
      <Route path="/reports/project-status" element={<ProjectStatusReport />} />
      <Route path="/reports/project-income" element={<ProjectIncomeReport />} />
      <Route path="/reports/project-expense" element={<ProjectExpenseReport />} />

      <Route path="/setup" element={<PMSetup />} />

      <Route
        path="/material-requisitions"
        element={<PMMaterialRequisitionList />}
      />
      <Route
        path="/material-requisitions/new"
        element={<PMMaterialRequisitionForm />}
      />
      <Route
        path="/material-requisitions/:id"
        element={<PMMaterialRequisitionForm />}
      />

      <Route
        path="/material-utilizations"
        element={<PMMaterialUtilizationList />}
      />
      <Route
        path="/material-utilizations/new"
        element={<PMMaterialUtilizationForm />}
      />
      <Route
        path="/material-utilizations/:id"
        element={<PMMaterialUtilizationForm />}
      />

      <Route path="/material-receipts" element={<PMMaterialReceiptList />} />
      <Route
        path="/material-receipts/new"
        element={<PMMaterialReceiptForm />}
      />
      <Route
        path="/material-receipts/:id"
        element={<PMMaterialReceiptForm />}
      />

      <Route path="/project-orders" element={<ProjectOrderList />} />
      <Route path="/project-orders/new" element={<ProjectOrderForm />} />
      <Route path="/project-orders/:id" element={<ProjectOrderForm />} />

      <Route path="/purchase-requisitions" element={<PMPurchaseRequisitionList />} />
      <Route path="/purchase-requisitions/new" element={<PMPurchaseRequisitionForm />} />
      <Route path="/purchase-requisitions/:id" element={<PMPurchaseRequisitionForm />} />
    </Routes>
  );
}

export const projectManagementFeatures = [
  {
    module_key: "project-management",
    label: "Projects",
    path: "/project-management/projects",
    type: "feature",
  },
  {
    module_key: "project-management",
    label: "Tasks",
    path: "/project-management/tasks",
    type: "feature",
  },
  {
    module_key: "project-management",
    label: "Project Timeline",
    path: "/project-management/timesheets",
    type: "feature",
  },
  {
    module_key: "project-management",
    label: "Expenses",
    path: "/project-management/expenses",
    type: "feature",
  },
  {
    module_key: "project-management",
    label: "Project Setup",
    path: "/project-management/setup",
    type: "feature",
  },
  {
    module_key: "project-management",
    label: "Material Requisition",
    path: "/project-management/material-requisitions",
    type: "feature",
  },
  {
    module_key: "project-management",
    label: "Material Utilization",
    path: "/project-management/material-utilizations",
    type: "feature",
  },
  {
    module_key: "project-management",
    label: "Materials Receipt",
    path: "/project-management/material-receipts",
    type: "feature",
  },
  {
    module_key: "project-management",
    label: "Project Orders",
    path: "/project-management/project-orders",
    type: "feature",
  },
  {
    module_key: "project-management",
    label: "Purchase Requisition",
    path: "/project-management/purchase-requisitions",
    type: "feature",
  },
  {
    module_key: "project-management",
    label: "Project Reports",
    path: "/project-management/reports",
    type: "dashboard",
  },
  {
    module_key: "project-management",
    label: "Project Status Report",
    path: "/project-management/reports/project-status",
    type: "dashboard",
  },
  {
    module_key: "project-management",
    label: "Project Income Report",
    path: "/project-management/reports/project-income",
    type: "feature",
  },
  {
    module_key: "project-management",
    label: "Project Expense Report",
    path: "/project-management/reports/project-expense",
    type: "feature",
  },
];
