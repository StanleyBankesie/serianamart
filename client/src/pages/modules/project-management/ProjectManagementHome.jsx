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
import ProjectStatusReport from "./reports/ProjectStatusReport.jsx";

function ProjectManagementLanding() {
  const [stats, setStats] = React.useState([
    {
      rbac_key: "active-projects",
      icon: "📁",
      value: "0",
      label: "Total Projects",
      path: "/project-management/projects",
    },
    {
      rbac_key: "active-tasks",
      icon: "✅",
      value: "0",
      label: "Active Tasks",
      path: "/project-management/tasks",
    },
    {
      rbac_key: "total-budget",
      icon: "💰",
      value: "0",
      label: "Total Budget",
      path: "/project-management/reports",
    },
    {
      rbac_key: "logged-hours",
      icon: "⏱️",
      value: "0",
      label: "Logged Hours",
      path: "/project-management/reports",
    },
  ]);

  React.useEffect(() => {
    async function load() {
      try {
        const resp = await api.get("/projects/dashboard/stats");
        const d = resp.data;
        setStats([
          { ...stats[0], value: String(d.totalProjects) },
          { ...stats[1], value: String(d.activeTasks) },
          { ...stats[2], value: `GHS ${Number(d.totalBudget).toLocaleString()}` },
          { ...stats[3], value: `${Number(d.totalLoggedHours).toFixed(1)}h` },
        ]);
      } catch {}
    }
    load();
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
          title: "Setup",
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
          title: "Timesheets",
          path: "/project-management/timesheets",
          description: "Log and approve work hours",
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
      ],
    },
  ];

  return (
    <ModuleDashboard
      title="Project Management"
      description="Strategic project planning and operational execution"
      stats={stats}
      sections={sections}
      features={projectManagementFeatures}
    />
  );
}

export default function ProjectManagementHome() {
  return (
    <Routes>
      <Route path="/" element={<ProjectManagementLanding />} />

      <Route path="/projects" element={<ProjectList />} />
      <Route path="/projects/new" element={<ProjectForm />} />
      <Route path="/projects/:id/edit" element={<ProjectForm />} />
      <Route path="/projects/:id" element={<ProjectForm />} />
      <Route path="/projects/:id/dashboard" element={<ProjectDetailDashboard />} />

      <Route path="/tasks" element={<TaskList />} />
      <Route path="/tasks/new" element={<TaskForm />} />
      <Route path="/tasks/:id" element={<TaskForm />} />

      <Route path="/timesheets" element={<TimesheetList />} />
      <Route path="/expenses" element={<ExpenseList />} />

      <Route path="/reports" element={<ProjectReports />} />
      <Route path="/reports/project-status" element={<ProjectStatusReport />} />

      <Route path="/setup" element={<PMSetup />} />

      <Route path="/material-requisitions" element={<PMMaterialRequisitionList />} />
      <Route path="/material-requisitions/new" element={<PMMaterialRequisitionForm />} />
      <Route path="/material-requisitions/:id" element={<PMMaterialRequisitionForm />} />

      <Route path="/material-utilizations" element={<PMMaterialUtilizationList />} />
      <Route path="/material-utilizations/new" element={<PMMaterialUtilizationForm />} />
      <Route path="/material-utilizations/:id" element={<PMMaterialUtilizationForm />} />

      <Route path="/material-receipts" element={<PMMaterialReceiptList />} />
      <Route path="/material-receipts/new" element={<PMMaterialReceiptForm />} />
      <Route path="/material-receipts/:id" element={<PMMaterialReceiptForm />} />
    </Routes>
  );
}

export const projectManagementFeatures = [
  { module_key: "project-management", label: "Projects", path: "/project-management/projects", type: "feature" },
  { module_key: "project-management", label: "Tasks", path: "/project-management/tasks", type: "feature" },
  { module_key: "project-management", label: "Timesheets", path: "/project-management/timesheets", type: "feature" },
  { module_key: "project-management", label: "Expenses", path: "/project-management/expenses", type: "feature" },
  { module_key: "project-management", label: "Setup", path: "/project-management/setup", type: "feature" },
  { module_key: "project-management", label: "Material Requisition", path: "/project-management/material-requisitions", type: "feature" },
  { module_key: "project-management", label: "Material Utilization", path: "/project-management/material-utilizations", type: "feature" },
  { module_key: "project-management", label: "Materials Receipt", path: "/project-management/material-receipts", type: "feature" },
  { module_key: "project-management", label: "Project Reports", path: "/project-management/reports", type: "dashboard" },
  { module_key: "project-management", label: "Project Status Report", path: "/project-management/reports/project-status", type: "dashboard" },
];
