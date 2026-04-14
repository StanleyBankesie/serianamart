import React from "react";
import { Route, Routes } from "react-router-dom";

import AssetList from "./assets/AssetList.jsx";
import AssetForm from "./assets/AssetForm.jsx";
import MaintenanceWorkOrderList from "./work-orders/MaintenanceWorkOrderList.jsx";
import MaintenanceWorkOrderForm from "./work-orders/MaintenanceWorkOrderForm.jsx";
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
import MaintenanceSetupPage from "./setup/MaintenanceSetupPage.jsx";

function MaintenanceLanding() {
  const [stats, setStats] = React.useState([
    {
      rbac_key: "open-work-orders",
      icon: "🛠",
      value: "8",
      label: "Open Work Orders",
      change: "2 critical",
      changeType: "negative",
      path: "/maintenance/work-orders",
    },
    {
      rbac_key: "overdue-pms",
      icon: "🗓",
      value: "4",
      label: "Overdue PMs",
      change: "Needs attention",
      changeType: "negative",
      path: "/maintenance/pm-schedules",
    },
    {
      rbac_key: "asset-health",
      icon: "🏷",
      value: "98%",
      label: "Asset Health",
      change: "↑ 1% this month",
      changeType: "positive",
      path: "/maintenance/assets",
    },
  ]);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const resp = await api.get("/bi/dashboards");
        const openWos = Number(
          resp?.data?.summary?.maintenance?.open_work_orders || 0,
        );
        const overdue = Number(
          resp?.data?.summary?.maintenance?.overdue_pms || 0,
        );
        const health = Number(
          resp?.data?.summary?.maintenance?.asset_health_percent || 0,
        );
        if (mounted) {
          setStats((prev) => {
            const next = [...prev];
            next[0] = { ...next[0], value: String(openWos) };
            next[1] = { ...next[1], value: String(overdue) };
            next[2] = { ...next[2], value: `${health}%` };
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
          "Work Orders",
          "/maintenance/work-orders",
          "Plan and assign maintenance work orders",
          "🧾",
        ),
        buildFeature(
          "Job Orders",
          "/maintenance/job-orders",
          "Create and track job orders",
          "🛠",
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

export default function MaintenanceHome() {
  return (
    <Routes>
      <Route path="/" element={<MaintenanceLanding />} />

      <Route path="/assets" element={<AssetList />} />
      <Route path="/assets/new" element={<AssetForm />} />
      <Route path="/assets/:id" element={<AssetForm />} />

      <Route path="/work-orders" element={<MaintenanceWorkOrderList />} />
      <Route path="/work-orders/new" element={<MaintenanceWorkOrderForm />} />
      <Route path="/work-orders/:id" element={<MaintenanceWorkOrderForm />} />

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

      <Route path="/pm-schedules" element={<PmScheduleList />} />
      <Route path="/pm-schedules/new" element={<PmScheduleForm />} />
      <Route path="/pm-schedules/:id" element={<PmScheduleForm />} />

      <Route path="/setup" element={<MaintenanceSetupPage />} />

      <Route path="/reports" element={<MaintenanceReports />} />
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
    label: "Work Orders",
    path: "/maintenance/work-orders",
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
    label: "Setup",
    path: "/maintenance/setup",
    type: "feature",
  },
];
