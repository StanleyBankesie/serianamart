import React from "react";
import { Link, Route, Routes } from "react-router-dom";
import ModuleDashboard from "../../../components/ModuleDashboard";
import { api } from "../../../api/client.js";

import UserList from "./users/UserList.jsx";
import UserForm from "./users/UserForm.jsx";
import WorkflowList from "./workflows/WorkflowList.jsx";
import WorkflowForm from "./workflows/WorkflowForm.jsx";
import MyApprovals from "./workflows/MyApprovals.jsx";
import ApprovedDocuments from "./workflows/ApprovedDocuments.jsx";
import DocumentReview from "./workflows/DocumentReview.jsx";
import CompanyList from "./companies/CompanyList.jsx";
import CompanyForm from "./companies/CompanyForm.jsx";
import BranchList from "./branches/BranchList.jsx";
import BranchForm from "./branches/BranchForm.jsx";
import ReportsPage from "./reports/ReportsPage.jsx";
import SystemLogBookPage from "./reports/SystemLogBookPage.jsx";
import UserLoginActivityReportPage from "./reports/UserLoginActivityReportPage.jsx";
import SettingsPage from "./SettingsPage.jsx";
import DocumentTemplatesPage from "./templates/DocumentTemplatesPage.jsx";
import RoleManagement from "./access-control/RoleManagementNew.jsx";
import UserOverrides from "./access-control/UserOverrides.jsx";
import UserPermissions from "./access-control/UserPermissionsNew.jsx";

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

  const quickActions = [
    {
      label: "Settings",
      path: "/administration/settings",
      icon: "⚙️",
    },
  ];

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const resp = await api.get("/bi/dashboards");
        const users = Number(resp?.data?.summary?.administration?.users || 0);
        const sessions = Number(
          resp?.data?.summary?.administration?.active_sessions || 0,
        );
        const pending = Number(
          resp?.data?.summary?.administration?.pending_workflows || 0,
        );
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
          title: "Settings",
          description: "Push notifications and document templates",
          path: "/administration/settings",
          icon: "⚙️",
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
          description: "Create roles and assign modules, features, and dashboards",
          module_key: "administration",
          feature_key: "roles",
          path: "/administration/access/roles",
          icon: "�️",
          actions: [
            {
              label: "Open",
              module_key: "administration",
              feature_key: "roles",
              path: "/administration/access/roles",
              type: "primary",
            },
          ],
        },
        {
          title: "User Permissions",
          description: "Set granular CRUD permissions for individual users",
          module_key: "administration",
          feature_key: "user-permissions",
          path: "/administration/access/user-permissions",
          icon: "✅",
          actions: [
            {
              label: "Open",
              module_key: "administration",
              feature_key: "user-permissions",
              path: "/administration/access/user-permissions",
              type: "primary",
            },
          ],
        },
        {
          title: "Dashboard Permissions",
          description: "Grant and override access for dashboards",
          module_key: "administration",
          feature_key: "user-permissions",
          path: "/administration/access/user-permissions",
          icon: "📊",
          actions: [
            {
              label: "Open",
              module_key: "administration",
              feature_key: "user-permissions",
              path: "/administration/access/user-permissions",
              type: "primary",
            },
          ],
        },
        {
          title: "Exceptional Permissions",
          description: "Set exceptional permissions and overrides per user",
          module_key: "administration",
          feature_key: "user-overrides",
          path: "/administration/access/user-overrides",
          icon: "✨",
          actions: [
            {
              label: "Open",
              module_key: "administration",
              feature_key: "user-overrides",
              path: "/administration/access/user-overrides",
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
          title: "Workflow Approvals",
          description: "Approve pending documents",
          path: "/administration/workflows/approvals",
          icon: "✅",
        },
        {
          title: "Document Review",
          description: "Review documents awaiting action",
          path: "/administration/workflows/approvals",
          icon: "📝",
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
            {
              label: "User Login Activity",
              path: "/administration/reports/user-login-activity",
              type: "outline",
            },
          ],
        },
        {
          title: "System Log Book Report",
          description: "Audit logs and system activity",
          path: "/administration/reports/system-log-book",
          icon: "📘",
        },
        {
          title: "User Login Activity Report",
          description: "Recent user sign-ins and sessions",
          path: "/administration/reports/user-login-activity",
          icon: "👤",
        },
      ],
    },
  ];

  return (
    <ModuleDashboard
      title="Administration"
      description="System configuration and user management"
      stats={stats}
      quickActions={quickActions}
      sections={sections}
      features={administrationFeatures}
    />
  );
}

export default function AdministrationHome() {
  return (
    <Routes>
      <Route path="/" element={<AdministrationLanding />} />
      <Route path="/users" element={<UserList />} />
      <Route path="/users/new" element={<UserForm />} />
      <Route path="/users/:id" element={<UserForm />} />
      <Route path="/workflows" element={<WorkflowList />} />
      <Route path="/workflows/new" element={<WorkflowForm />} />
      <Route path="/workflows/:id" element={<WorkflowForm />} />
      <Route path="/workflows/approvals" element={<MyApprovals />} />
      <Route path="/workflows/approved" element={<ApprovedDocuments />} />
      <Route
        path="/workflows/approvals/:instanceId"
        element={<DocumentReview />}
      />

      <Route path="/companies" element={<CompanyList />} />
      <Route path="/companies/new" element={<CompanyForm />} />
      <Route path="/companies/:id" element={<CompanyForm />} />
      <Route path="/branches" element={<BranchList />} />
      <Route path="/branches/new" element={<BranchForm />} />
      <Route path="/branches/:id" element={<BranchForm />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/reports/system-log-book" element={<SystemLogBookPage />} />
      <Route
        path="/reports/user-login-activity"
        element={<UserLoginActivityReportPage />}
      />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/settings/templates" element={<DocumentTemplatesPage />} />
      <Route path="/access/roles" element={<RoleManagement />} />
      <Route path="/access/user-permissions" element={<UserPermissions />} />
      <Route path="/access/user-permissions/:id" element={<UserPermissions />} />
      <Route path="/access/user-overrides" element={<UserOverrides />} />
    </Routes>
  );
}

export const administrationFeatures = [
  {
    module_key: "administration",
    label: "Role Setup",
    path: "/administration/access/roles",
    type: "feature",
  },
  {
    module_key: "administration",
    label: "User Permissions",
    path: "/administration/access/user-permissions",
    type: "feature",
  },
  {
    module_key: "administration",
    label: "Exceptional Permissions",
    path: "/administration/access/user-overrides",
    type: "feature",
  },
  {
    module_key: "administration",
    label: "User Management",
    path: "/administration/users",
    type: "feature",
  },
  {
    module_key: "administration",
    label: "Settings",
    path: "/administration/settings",
    type: "feature",
  },
  {
    module_key: "administration",
    label: "Company Setup",
    path: "/administration/companies",
    type: "feature",
  },
  {
    module_key: "administration",
    label: "Branch Setup",
    path: "/administration/branches",
    type: "feature",
  },
  {
    module_key: "administration",
    label: "Workflow Configuration",
    path: "/administration/workflows",
    type: "feature",
  },
  {
    module_key: "administration",
    label: "Workflow Approvals",
    path: "/administration/workflows/approvals",
    type: "feature",
  },
  {
    module_key: "administration",
    label: "Document Review",
    path: "/administration/workflows/approvals",
    type: "feature",
  },
  {
    module_key: "administration",
    label: "System Log Book Report",
    path: "/administration/reports/system-log-book",
    type: "dashboard",
  },
  {
    module_key: "administration",
    label: "User Login Activity Report",
    path: "/administration/reports/user-login-activity",
    type: "dashboard",
  },
  {
    module_key: "administration",
    label: "Reports",
    path: "/administration/reports",
    type: "dashboard",
  },
];
