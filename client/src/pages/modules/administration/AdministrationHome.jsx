import React from "react";
import { Link, Route, Routes } from "react-router-dom";
import ModuleDashboard from "../../../components/ModuleDashboard";
import { api } from "../../../api/client.js";

import RoleList from "./roles/RoleList.jsx";
import RoleForm from "./roles/RoleForm.jsx";
import UserList from "./users/UserList.jsx";
import UserForm from "./users/UserForm.jsx";
import WorkflowList from "./workflows/WorkflowList.jsx";
import WorkflowForm from "./workflows/WorkflowForm.jsx";
import MyApprovals from "./workflows/MyApprovals.jsx";
import DocumentReview from "./workflows/DocumentReview.jsx";
import ExceptionalPermissionList from "./exceptional-permissions/ExceptionalPermissionList.jsx";
import ExceptionalPermissionForm from "./exceptional-permissions/ExceptionalPermissionForm.jsx";
import CompanyList from "./companies/CompanyList.jsx";
import CompanyForm from "./companies/CompanyForm.jsx";
import BranchList from "./branches/BranchList.jsx";
import BranchForm from "./branches/BranchForm.jsx";
import ReportsPage from "./reports/ReportsPage.jsx";
import SystemLogBookPage from "./reports/SystemLogBookPage.jsx";
import UserPermissionList from "./permissions/UserPermissionList.jsx";
import UserPermissionAssignment from "./permissions/UserPermissionAssignment.jsx";
import SettingsPage from "./SettingsPage.jsx";

function AdministrationLanding() {
  const [stats, setStats] = React.useState([
    {
      // icon: "👥",
      value: "120",
      label: "Total Users",
      change: "↑ 5 this month",
      changeType: "positive",
      path: "/administration/users",
    },
    {
      // icon: "💻",
      value: "15",
      label: "Active Sessions",
      change: "Current",
      changeType: "neutral",
      path: "/administration/reports",
    },
    {
      // icon: "🔄",
      value: "5",
      label: "Pending Workflows",
      change: "Requires approval",
      changeType: "neutral",
      path: "/administration/workflows",
    },
  ]);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const resp = await api.get("/bi/dashboards");
        const users = Number(resp?.data?.summary?.administration?.users || 0);
        const sessions = Number(resp?.data?.summary?.administration?.active_sessions || 0);
        const pending = Number(resp?.data?.summary?.administration?.pending_workflows || 0);
        if (mounted) {
          setStats((prev) => {
            const next = [...prev];
            next[0] = { ...next[0], value: String(users) };
            next[1] = { ...next[1], value: String(sessions) };
            next[2] = { ...next[2], value: String(pending) };
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
      title: "System Configuration",
      badge: "Core",
      items: [
        {
          title: "Company Setup",
          description: "Manage company information and settings",
          path: "/administration/companies",
          icon: "🏢",
          hidden: false,
          actions: [
            {
              label: "Manage",
              path: "/administration/companies",
              type: "primary",
            },
          ],
        },
        {
          title: "Branch Setup",
          description: "Configure and manage company branches",
          path: "/administration/branches",
          icon: "🏪",
          actions: [
            {
              label: "View List",
              path: "/administration/branches",
              type: "outline",
            },
            {
              label: "Add Branch",
              path: "/administration/branches/new",
              type: "primary",
            },
          ],
        },
        {
          title: "Document Templates",
          description:
            "Design receipt, invoice, payslip, delivery note, and sales order templates",
          path: "/administration/settings",
          icon: "🧾",
          actions: [
            {
              label: "Open",
              path: "/administration/settings",
              type: "primary",
            },
          ],
        },
      ],
    },
    {
      title: "User Management",
      badge: "Access Control",
      items: [
        {
          title: "Role Setup",
          description: "Configure roles and assign permissions to roles",
          path: "/administration/roles",
          icon: "👥",
          actions: [
            {
              label: "View Roles",
              path: "/administration/roles",
              type: "outline",
            },
            {
              label: "New Role",
              path: "/administration/roles/new",
              type: "primary",
            },
          ],
        },
        {
          title: "User Management",
          description:
            "Create and manage user accounts with detailed permissions",
          path: "/administration/users",
          icon: "👤",
          actions: [
            {
              label: "View Users",
              path: "/administration/users",
              type: "outline",
            },
            {
              label: "Add User",
              path: "/administration/users/new",
              type: "primary",
            },
          ],
        },
        {
          title: "Permissions",
          description: "Overview of system permissions, roles, and assignments",
          path: "/administration/permissions",
          icon: "🔐",
          actions: [
            {
              label: "Dashboard",
              path: "/administration/permissions",
              type: "outline",
            },
            {
              label: "Assign Rights",
              path: "/administration/user-permissions",
              type: "primary",
            },
          ],
        },
        {
          title: "Exceptional Permissions",
          description: "Grant special permissions to users temporarily",
          path: "/administration/exceptional-permissions",
          icon: "🔑",
          actions: [
            {
              label: "View Permissions",
              path: "/administration/exceptional-permissions",
              type: "outline",
            },
            {
              label: "Grant",
              path: "/administration/exceptional-permissions/new",
              type: "primary",
            },
          ],
        },
      ],
    },
    {
      title: "Process & Reporting",
      items: [
        {
          title: "Workflow Configuration",
          description: "Define and configure approval workflows for documents",
          path: "/administration/workflows",
          icon: "🔄",
          actions: [
            {
              label: "Configure",
              path: "/administration/workflows",
              type: "primary",
            },
          ],
        },
        {
          title: "Reports",
          description: "View user activity, audit logs, and system reports",
          path: "/administration/reports",
          icon: "📊",
          actions: [
            {
              label: "View Logs",
              path: "/administration/reports",
              type: "primary",
            },
            {
              label: "System Log Book",
              path: "/administration/reports/system-log-book",
              type: "outline",
            },
          ],
        },
      ],
    },
  ];

  return (
    <ModuleDashboard
      title="Administration"
      description="System configuration and user management"
      stats={stats}
      sections={sections}
    />
  );
}

export default function AdministrationHome() {
  return (
    <Routes>
      <Route path="/" element={<AdministrationLanding />} />
      <Route path="/roles" element={<RoleList />} />
      <Route path="/roles/new" element={<RoleForm />} />
      <Route path="/roles/:id" element={<RoleForm />} />
      <Route path="/users" element={<UserList />} />
      <Route path="/users/new" element={<UserForm />} />
      <Route path="/users/:id" element={<UserForm />} />
      <Route path="/workflows" element={<WorkflowList />} />
      <Route path="/workflows/new" element={<WorkflowForm />} />
      <Route path="/workflows/:id" element={<WorkflowForm />} />
      <Route path="/workflows/approvals" element={<MyApprovals />} />
      <Route
        path="/workflows/approvals/:instanceId"
        element={<DocumentReview />}
      />
      <Route
        path="/exceptional-permissions"
        element={<ExceptionalPermissionList />}
      />
      <Route
        path="/exceptional-permissions/new"
        element={<ExceptionalPermissionForm />}
      />
      <Route
        path="/exceptional-permissions/:id"
        element={<ExceptionalPermissionForm />}
      />
      <Route path="/companies" element={<CompanyList />} />
      <Route path="/companies/new" element={<CompanyForm />} />
      <Route path="/companies/:id" element={<CompanyForm />} />
      <Route path="/branches" element={<BranchList />} />
      <Route path="/branches/new" element={<BranchForm />} />
      <Route path="/branches/:id" element={<BranchForm />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/reports/system-log-book" element={<SystemLogBookPage />} />
      <Route path="/permissions" element={<UserPermissionList />} />
      <Route path="/user-permissions" element={<UserPermissionAssignment />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}
