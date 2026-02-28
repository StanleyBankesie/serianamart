import React from "react";
import { Link, Route, Routes } from "react-router-dom";
import ModuleDashboard from "../../../components/ModuleDashboard";
import { api } from "../../../api/client.js";

import ProjectList from "./projects/ProjectList.jsx";
import ProjectForm from "./projects/ProjectForm.jsx";
import TaskList from "./tasks/TaskList.jsx";
import TaskForm from "./tasks/TaskForm.jsx";
import ProjectReports from "./reports/ProjectReports.jsx";

function ProjectManagementLanding() {
  const [stats, setStats] = React.useState([
    {
      rbac_key: "active-projects",
      icon: "📁",
      value: "8",
      label: "Active Projects",
      change: "2 due this week",
      changeType: "neutral",
      path: "/project-management/projects",
    },
    {
      rbac_key: "open-tasks",
      icon: "✅",
      value: "34",
      label: "Open Tasks",
      change: "12 high priority",
      changeType: "negative",
      path: "/project-management/tasks",
    },
    {
      rbac_key: "on-time-completion",
      icon: "📊",
      value: "92%",
      label: "On Time Completion",
      change: "↑ 3% this month",
      changeType: "positive",
      path: "/project-management/reports",
    },
  ]);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const resp = await api.get("/bi/dashboards");
        const projects = Number(resp?.data?.summary?.projects?.active_projects || 0);
        const tasks = Number(resp?.data?.summary?.projects?.open_tasks || 0);
        const onTime = Number(resp?.data?.summary?.projects?.on_time_percent || 0);
        if (mounted) {
          setStats((prev) => {
            const next = [...prev];
            next[0] = { ...next[0], value: String(projects) };
            next[1] = { ...next[1], value: String(tasks) };
            next[2] = { ...next[2], value: `${onTime}%` };
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
      title: "Portfolio",
      badge: "Planning",
      items: [
        {
          title: "Projects",
          path: "/project-management/projects",
          description: "Create and manage projects",
          icon: "📁",
          actions: [
            {
              label: "View Projects",
              path: "/project-management/projects",
              type: "outline",
            },
            {
              label: "New Project",
              path: "/project-management/projects/new",
              type: "primary",
            },
          ],
        },
      ],
    },
    {
      title: "Execution",
      badge: "Tracking",
      items: [
        {
          title: "Tasks",
          path: "/project-management/tasks",
          description: "Assign and track tasks",
          icon: "✅",
          actions: [
            {
              label: "View Tasks",
              path: "/project-management/tasks",
              type: "outline",
            },
            {
              label: "New Task",
              path: "/project-management/tasks/new",
              type: "primary",
            },
          ],
        },
      ],
    },
    {
      title: "Reports",
      items: [
        {
          title: "Project Reports",
          path: "/project-management/reports",
          description: "Project KPIs and status reporting",
          icon: "📊",
          actions: [
            {
              label: "View Reports",
              path: "/project-management/reports",
              type: "primary",
            },
          ],
        },
      ],
    },
  ];

  return (
    <ModuleDashboard
      title="Project Management"
      description="Project planning, tracking, and resource allocation"
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
      <Route path="/projects/:id" element={<ProjectForm />} />

      <Route path="/tasks" element={<TaskList />} />
      <Route path="/tasks/new" element={<TaskForm />} />
      <Route path="/tasks/:id" element={<TaskForm />} />

      <Route path="/reports" element={<ProjectReports />} />
    </Routes>
  );
}

export const projectManagementFeatures = [
  { module_key: "project-management", label: "Projects", path: "/project-management/projects", type: "feature" },
  { module_key: "project-management", label: "New Project", path: "/project-management/projects/new", type: "feature" },
  { module_key: "project-management", label: "Tasks", path: "/project-management/tasks", type: "feature" },
  { module_key: "project-management", label: "New Task", path: "/project-management/tasks/new", type: "feature" },
  { module_key: "project-management", label: "Project Reports", path: "/project-management/reports", type: "dashboard" },
];
