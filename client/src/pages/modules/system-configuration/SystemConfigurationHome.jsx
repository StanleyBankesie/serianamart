/**
 * @fileoverview SystemConfigurationHome component.
 * Provides functionality for restricted System Configuration module.
 */

import React from "react";
import { Link, Route, Routes } from "react-router-dom";
import ModuleDashboard from "../../../components/ModuleDashboard";
import ModuleLayout from "../../../components/ModuleLayout";

import CompanyList from "../administration/companies/CompanyList.jsx";
import CompanyForm from "../administration/companies/CompanyForm.jsx";
import BranchList from "../administration/branches/BranchList.jsx";
import BranchForm from "../administration/branches/BranchForm.jsx";
import BackupPage from "../administration/BackupPage.jsx";
import AdminPermissionsPage from "../../admin/AdminPermissionsPage.jsx";
import LicenseManagement from "../../admin/LicenseManagement.jsx";
import PaymentPackages from "../../admin/PaymentPackages.jsx";
import GeneralSettingsPage from "./GeneralSettingsPage.jsx";

export const systemConfigurationSections = [
    {
      title: "System Configuration",
      badge: "Core",
      items: [
        {
          title: "Company Setup",
          description: "Manage company information and settings",
          path: "/system-configuration/companies",
        
          icon: "🏢",
          hidden: false,
          actions: [
            { label: "View", path: "/system-configuration/companies", type: "outline" },
            { label: "New", path: "/system-configuration/companies/new", type: "primary" },
          ],
        },
        {
          title: "Branch Setup",
          description: "Configure and manage company branches",
          path: "/system-configuration/branches",
          icon: "🏪",
          actions: [
            { label: "View", path: "/system-configuration/branches", type: "outline" },
            { label: "New", path: "/system-configuration/branches/new", type: "primary" },
          ],
        },
        {
          title: "General Settings",
          description: "Global configurations and SMS/WhatsApp APIs",
          path: "/system-configuration/general-settings",
          icon: "⚙️",
          actions: [
            { label: "View", path: "/system-configuration/general-settings", type: "outline" },
          ],
        },
      ],
    },
    {
      icon: "🛡️",
      title: "Access & Security",
      items: [
        {
          title: "Admin Permissions",
          description: "Configure system-wide admin permissions",
          path: "/system-configuration/admin-permissions",
          icon: "🔒",
          actions: [
            { label: "View", path: "/system-configuration/admin-permissions", type: "outline" },
          ],
        },
        {
          title: "Backup Settings",
          description: "Configure automated database backups",
          path: "/system-configuration/backups",
          icon: "💾",
          actions: [
            { label: "View", path: "/system-configuration/backups", type: "outline" },
          ],
        },
      ],
    },
    {
      title: "Licensing & Billing",
      items: [
        {
          title: "License Management",
          description: "Manage system licensing",
          path: "/system-configuration/licenses",
          icon: "🔑",
          actions: [
            { label: "View", path: "/system-configuration/licenses", type: "outline" },
          ],
        },
        {
          title: "Payment Packages",
          description: "Manage subscription and payment packages",
          path: "/system-configuration/payment-packages",
          icon: "💳",
          actions: [
            { label: "View", path: "/system-configuration/payment-packages", type: "outline" },
          ],
        },
      ],
    },
  ];

function SystemConfigurationLanding() {
  return (
    <ModuleDashboard
      useSectionNavigation={true}
      title="System Configuration"
      description="Super-admin restricted system configuration and setup."
      stats={[]}
      sections={systemConfigurationSections}
      quickActions={[]}
    />
  );
}

export default function SystemConfigurationHome() {
  return (
    <ModuleLayout sections={systemConfigurationSections} moduleKey="system-configuration">
      <Routes>
        <Route path="/" element={<SystemConfigurationLanding />} />
        <Route path="/companies" element={<CompanyList />} />
        <Route path="/companies/new" element={<CompanyForm />} />
        <Route path="/companies/:id" element={<CompanyForm />} />
        <Route path="/branches" element={<BranchList />} />
        <Route path="/branches/new" element={<BranchForm />} />
        <Route path="/branches/:id" element={<BranchForm />} />
        <Route path="/admin-permissions" element={<AdminPermissionsPage />} />
        <Route path="/backups" element={<BackupPage />} />
        <Route path="/licenses" element={<LicenseManagement />} />
        <Route path="/payment-packages" element={<PaymentPackages />} />
        <Route path="/general-settings" element={<GeneralSettingsPage />} />
      </Routes>
    </ModuleLayout>
  );
}
