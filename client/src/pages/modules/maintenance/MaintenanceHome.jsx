/**
 * @fileoverview MaintenanceHome component.
 * Provides functionality for MaintenanceHome.
 */

import React from "react";
import { Route, Routes } from "react-router-dom";

import AssetList from "./assets/AssetList.jsx";
import AssetForm from "./assets/AssetForm.jsx";
import PmScheduleList from "./pm-schedules/PmScheduleList.jsx";
import PmScheduleForm from "./pm-schedules/PmScheduleForm.jsx";
import MaintenanceReports from "./reports/MaintenanceReports.jsx";
import ModuleDashboard from "../../../components/ModuleDashboard.jsx";
import { api } from "../../../api/client.js";
import MaintenanceRequestsList from "./maintenance-requests/MaintenanceRequestsList.jsx";
import MaintenanceRequestForm from "./maintenance-requests/MaintenanceRequestForm.jsx";
import MaintenanceJobOrdersList from "./job-orders/MaintenanceJobOrdersList.jsx";
import MaintenanceJobOrderForm from "./job-orders/MaintenanceJobOrderForm.jsx";
import JobExecutionList from "./job-execution/JobExecutionList.jsx";
import JobExecutionForm from "./job-execution/JobExecutionForm.jsx";
import MaintenanceRFQList from "./rfq/MaintenanceRFQList.jsx";
import MaintenanceRFQForm from "./rfq/MaintenanceRFQForm.jsx";
import SupplierQuotationsList from "./supplier-quotations/SupplierQuotationsList.jsx";
import SupplierQuotationForm from "./supplier-quotations/SupplierQuotationForm.jsx";
import MaintenanceBillList from "./maintenance-bills/MaintenanceBillList.jsx";
import MaintenanceBillForm from "./maintenance-bills/MaintenanceBillForm.jsx";
import MaintenanceScheduleList from "./schedules/MaintenanceScheduleList.jsx";
import MaintenanceScheduleForm from "./schedules/MaintenanceScheduleForm.jsx";
import MaintenanceRosterList from "./rosters/MaintenanceRosterList.jsx";
import MaintenanceRosterForm from "./rosters/MaintenanceRosterForm.jsx";
import EquipmentList from "./equipment/EquipmentList.jsx";
import EquipmentForm from "./equipment/EquipmentForm.jsx";
import MaintenanceContractList from "./contracts/MaintenanceContractList.jsx";
import MaintenanceContractForm from "./contracts/MaintenanceContractForm.jsx";
import MaintenanceSetupPage from "./setup/MaintenanceSetupPage";
import DowntimeLogList from "./assets/DowntimeLogList.jsx";
import DowntimeLogForm from "./assets/DowntimeLogForm.jsx";
import DowntimeAnalysisReport from "./reports/DowntimeAnalysisReport.jsx";
import MaintenanceMaterialRequisitionList from "./material-requisitions/MaintenanceMaterialRequisitionList.jsx";
import MaintenanceMaterialRequisitionForm from "./material-requisitions/MaintenanceMaterialRequisitionForm.jsx";

function MaintenanceLanding() {
  const [stats, setStats] = React.useState([
    {
      rbac_key: "open-requests",
      value: "—",
      label: "New Requests",
      change: "Loading…",
      changeType: "neutral",
      path: "/maintenance/maintenance-requests",
    },
    {
      rbac_key: "active-jobs",
      value: "—",
      label: "Jobs In Progress",
      change: "Loading…",
      changeType: "neutral",
      path: "/maintenance/job-orders",
    },
    {
      rbac_key: "overdue-pms",
      value: "—",
      label: "Overdue PMs",
      change: "Loading…",
      changeType: "neutral",
      path: "/maintenance/pm-schedules",
    },
    {
      rbac_key: "asset-health",
      value: "—",
      label: "Asset Health",
      change: "Loading…",
      changeType: "neutral",
      path: "/maintenance/assets",
    },
  ]);

  React.useEffect(() => {
    let mounted = true;
    let timer;
    async function load() {
      try {
        const resp = await api.get("/maintenance/dashboard/stats");
        const d = resp.data;
        if (mounted) {
          setStats((prev) => {
            const next = [...prev];
            next[0] = { ...next[0], value: String(d.openRequests ?? "—") };
            next[1] = { ...next[1], value: String(d.activeJobs ?? "—") };
            next[2] = { ...next[2], value: String(d.overduePm ?? "—") };
            next[3] = { ...next[3], value: `${d.assetHealth ?? 0}%` };
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

  const buildFeature = (title, path, description, icon) => ({
    title,
    path,
    description,
    icon,
  });

  const sections = [
    {
      title: "Master Data",
      items: [
        buildFeature(
          "Assets",
          "/maintenance/assets",
          "Register and manage assets",
          "🏷",
        ),
        buildFeature(
          "Downtime Tracking",
          "/maintenance/assets/downtime",
          "Log and analyze asset downtime",
          "⏱️",
        ),
        buildFeature(
          "Equipment",
          "/maintenance/equipment",
          "Equipment setup",
          "🧰",
        ),
        buildFeature(
          "Maintenance Contracts",
          "/maintenance/contracts",
          "Manage service contracts",
          "📄",
        ),
      ],
    },
    {
      title: "Requests & Orders",
      items: [
        buildFeature(
          "Maintenance Requests",
          "/maintenance/maintenance-requests",
          "Review submitted requests and track follow-up work",
          "📝",
        ),
        buildFeature(
          "Job Orders",
          "/maintenance/job-orders",
          "Create and track job orders",
          "🛠",
        ),
        buildFeature(
          "Material Requisitions",
          "/maintenance/material-requisitions",
          "Request materials from warehouse",
          "📦",
        ),
      ],
    },
    {
      title: "External Service",
      items: [
        buildFeature(
          "RFQs",
          "/maintenance/rfq",
          "Request quotations from suppliers",
          "📣",
        ),
        buildFeature(
          "Supplier Quotations",
          "/maintenance/supplier-quotations",
          "Record quotations received",
          "📑",
        ),
      ],
    },
    {
      title: "Execution & Billing",
      items: [
        buildFeature(
          "Job Executions",
          "/maintenance/job-executions",
          "Record execution progress and completion",
          "⚙️",
        ),
        buildFeature(
          "Maintenance Bills",
          "/maintenance/bills",
          "Raise bills for finance",
          "💳",
        ),
      ],
    },
    {
      title: "Preventive Maintenance",
      items: [
        buildFeature(
          "PM Schedules",
          "/maintenance/pm-schedules",
          "Define preventive maintenance schedules",
          "🗓",
        ),
        buildFeature(
          "Maintenance Schedules",
          "/maintenance/schedules",
          "Manage ad-hoc schedules",
          "🗓",
        ),
        buildFeature(
          "Maintenance Rosters",
          "/maintenance/rosters",
          "Plan maintenance rosters",
          "📋",
        ),
      ],
    },
    {
      title: "Reports",
      items: [
        buildFeature(
          "Maintenance Reports",
          "/maintenance/reports",
          "Asset and maintenance KPIs",
          "📊",
        ),
        buildFeature(
          "Setup",
          "/maintenance/setup",
          "Configure maintenance parameters",
          "🛠️",
        ),
      ],
    },
  ];

  return (
    <ModuleDashboard
      title="Maintenance"
      description="Asset maintenance and work order management"
      stats={stats}
      sections={sections}
      features={maintenanceFeatures}
    />
  );
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function MaintenanceHome() {
  return (
    <Routes>
      <Route path="/" element={<MaintenanceLanding />} />

      <Route path="/assets" element={<AssetList />} />
      <Route path="/assets/new" element={<AssetForm />} />
      <Route path="/assets/:id" element={<AssetForm />} />
      <Route path="/assets/downtime" element={<DowntimeLogList />} />
      <Route path="/assets/downtime/new" element={<DowntimeLogForm />} />

      <Route
        path="/maintenance-requests"
        element={<MaintenanceRequestsList />}
      />
      <Route
        path="/maintenance-requests/new"
        element={<MaintenanceRequestForm />}
      />
      <Route
        path="/maintenance-requests/:id"
        element={<MaintenanceRequestForm />}
      />

      <Route path="/job-orders" element={<MaintenanceJobOrdersList />} />
      <Route path="/job-orders/new" element={<MaintenanceJobOrderForm />} />
      <Route path="/job-orders/:id" element={<MaintenanceJobOrderForm />} />

      <Route path="/job-executions" element={<JobExecutionList />} />
      <Route path="/job-executions/new" element={<JobExecutionForm />} />
      <Route path="/job-executions/:id" element={<JobExecutionForm />} />

      <Route path="/rfq" element={<MaintenanceRFQList />} />
      <Route path="/rfq/new" element={<MaintenanceRFQForm />} />
      <Route path="/rfq/:id" element={<MaintenanceRFQForm />} />

      <Route path="/supplier-quotations" element={<SupplierQuotationsList />} />
      <Route
        path="/supplier-quotations/new"
        element={<SupplierQuotationForm />}
      />
      <Route
        path="/supplier-quotations/:id"
        element={<SupplierQuotationForm />}
      />

      <Route path="/bills" element={<MaintenanceBillList />} />
      <Route path="/bills/new" element={<MaintenanceBillForm />} />
      <Route path="/bills/:id" element={<MaintenanceBillForm />} />

      <Route path="/schedules" element={<MaintenanceScheduleList />} />
      <Route path="/schedules/new" element={<MaintenanceScheduleForm />} />
      <Route path="/schedules/:id" element={<MaintenanceScheduleForm />} />

      <Route path="/rosters" element={<MaintenanceRosterList />} />
      <Route path="/rosters/new" element={<MaintenanceRosterForm />} />
      <Route path="/rosters/:id" element={<MaintenanceRosterForm />} />

      <Route path="/equipment" element={<EquipmentList />} />
      <Route path="/equipment/new" element={<EquipmentForm />} />
      <Route path="/equipment/:id" element={<EquipmentForm />} />

      <Route path="/contracts" element={<MaintenanceContractList />} />
      <Route path="/contracts/new" element={<MaintenanceContractForm />} />
      <Route path="/contracts/:id" element={<MaintenanceContractForm />} />

      <Route path="/material-requisitions" element={<MaintenanceMaterialRequisitionList />} />
      <Route path="/material-requisitions/new" element={<MaintenanceMaterialRequisitionForm />} />
      <Route path="/material-requisitions/:id" element={<MaintenanceMaterialRequisitionForm />} />

      <Route path="/pm-schedules" element={<PmScheduleList />} />
      <Route path="/pm-schedules/new" element={<PmScheduleForm />} />
      <Route path="/pm-schedules/:id" element={<PmScheduleForm />} />

      <Route path="/setup" element={<MaintenanceSetupPage />} />

      <Route path="/reports" element={<MaintenanceReports />} />
      <Route path="/reports/downtime" element={<DowntimeAnalysisReport />} />
    </Routes>
  );
}

export const maintenanceFeatures = [
  {
    module_key: "maintenance",
    label: "Assets",
    path: "/maintenance/assets",
    type: "feature",
  },
  {
    module_key: "maintenance",
    label: "PM Schedules",
    path: "/maintenance/pm-schedules",
    type: "feature",
  },
  {
    module_key: "maintenance",
    label: "Maintenance Reports",
    path: "/maintenance/reports",
    type: "dashboard",
  },
  {
    module_key: "maintenance",
    label: "Maintenance Requests",
    path: "/maintenance/maintenance-requests",
    type: "feature",
  },
  {
    module_key: "maintenance",
    label: "Job Orders",
    path: "/maintenance/job-orders",
    type: "feature",
  },
  {
    module_key: "maintenance",
    label: "Job Executions",
    path: "/maintenance/job-executions",
    type: "feature",
  },
  {
    module_key: "maintenance",
    label: "RFQs",
    path: "/maintenance/rfq",
    type: "feature",
  },
  {
    module_key: "maintenance",
    label: "Supplier Quotations",
    path: "/maintenance/supplier-quotations",
    type: "feature",
  },
  {
    module_key: "maintenance",
    label: "Maintenance Bills",
    path: "/maintenance/bills",
    type: "feature",
  },
  {
    module_key: "maintenance",
    label: "Maintenance Schedules",
    path: "/maintenance/schedules",
    type: "feature",
  },
  {
    module_key: "maintenance",
    label: "Maintenance Rosters",
    path: "/maintenance/rosters",
    type: "feature",
  },
  {
    module_key: "maintenance",
    label: "Equipment",
    path: "/maintenance/equipment",
    type: "feature",
  },
  {
    module_key: "maintenance",
    label: "Maintenance Contracts",
    path: "/maintenance/contracts",
    type: "feature",
  },
  {
    module_key: "maintenance",
    label: "Material Requisitions",
    path: "/maintenance/material-requisitions",
    type: "feature",
  },
  {
    module_key: "maintenance",
    label: "Setup",
    path: "/maintenance/setup",
    type: "feature",
  },
];
