import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useLocation,
} from "react-router-dom";

import { useAuth } from "../auth/AuthContext.jsx";
import { useTheme } from "../theme/ThemeContext.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import DashboardPage from "../pages/dashboard/DashboardPage.jsx";
import HomePage from "../pages/home/HomePage.jsx";
import AdministrationHome from "../pages/modules/administration/AdministrationHome.jsx";
import SalesHome from "../pages/modules/sales/SalesHome.jsx";
import InventoryHome from "../pages/modules/inventory/InventoryHome.jsx";
import PurchaseHome from "../pages/modules/purchase/PurchaseHome.jsx";
import FinanceRoutes from "../pages/modules/finance/FinanceRoutes.jsx";
import HumanResourcesHome from "../pages/modules/human-resources/HumanResourcesHome.jsx";
import MaintenanceHome from "../pages/modules/maintenance/MaintenanceHome.jsx";
import ProjectManagementHome from "../pages/modules/project-management/ProjectManagementHome.jsx";
import ProductionHome from "../pages/modules/production/ProductionHome.jsx";
import PosHome from "../pages/modules/pos/PosHome.jsx";
import BusinessIntelligenceHome from "../pages/modules/business-intelligence/BusinessIntelligenceHome.jsx";

import logoDark from "../assets/resources/OMNISUITE_WHITE_LOGO.png";
import logoLight from "../assets/resources/OMNISUITE_LOGO_FILL.png";
import { api } from "../api/client.js";

const modules = [
  {
    key: "administration",
    label: "Administration",
    path: "/administration",
    icon: "⚙",
  },
  { key: "sales", label: "Sales", path: "/sales", icon: "🧾" },
  { key: "inventory", label: "Inventory", path: "/inventory", icon: "📦" },
  { key: "purchase", label: "Purchase", path: "/purchase", icon: "🛒" },
  { key: "finance", label: "Finance", path: "/finance", icon: "💳" },
  {
    key: "human-resources",
    label: "Human Resources",
    path: "/human-resources",
    icon: "👥",
  },
  {
    key: "maintenance",
    label: "Maintenance",
    path: "/maintenance",
    icon: "🛠",
  },
  {
    key: "project-management",
    label: "Project Management",
    path: "/project-management",
    icon: "📋",
  },
  { key: "production", label: "Production", path: "/production", icon: "🏭" },
  { key: "pos", label: "POS", path: "/pos", icon: "🧮" },
  {
    key: "business-intelligence",
    label: "Business Intelligence",
    path: "/business-intelligence",
    icon: "📈",
  },
];

export default function AppShell() {
  const { user, scope, setScope, logout, hasModuleAccess } = useAuth();
  const { theme } = useTheme();

  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine !== false : true,
  );
  useEffect(() => {
    function onOnline() {
      setOnline(true);
    }
    function onOffline() {
      setOnline(false);
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  useEffect(() => {
    function onBeforeInstallPrompt(e) {
      e.preventDefault();
      try {
        console.log("beforeinstallprompt fired");
      } catch {}
      setInstallPrompt(e);
      setShowInstall(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);
  useEffect(() => {
    function onAppInstalled() {
      try {
        console.log("PWA appinstalled event");
      } catch {}
      setShowInstall(false);
    }
    window.addEventListener("appinstalled", onAppInstalled);
    return () => window.removeEventListener("appinstalled", onAppInstalled);
  }, []);

  const onInstallClick = async () => {
    try {
      if (installPrompt?.prompt) {
        await installPrompt.prompt();
      }
    } catch {}
  };

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(min-width: 768px)").matches;
    }
    return false;
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const [contextModalOpen, setContextModalOpen] = useState(false);

  const profile = useMemo(() => {
    const username = user?.username || user?.name || "Guest";
    const role =
      user?.role ||
      (Array.isArray(user?.roles) ? user.roles[0] : null) ||
      "Developer";
    const companyName =
      user?.companyName || `Company #${scope?.companyId ?? "-"}`;
    const branchName = user?.branchName || `Branch #${scope?.branchId ?? "-"}`;

    return { username, role, companyName, branchName };
  }, [scope?.branchId, scope?.companyId, user]);

  const roleOptions = useMemo(
    () =>
      Array.isArray(user?.roles) ? user.roles : user?.role ? [user.role] : [],
    [user?.roles, user?.role],
  );
  const [selectedRole, setSelectedRole] = useState(() =>
    Array.isArray(user?.roles) ? user.roles[0] : user?.role || null,
  );
  const [dbRoles, setDbRoles] = useState([]);
  const [dbRolesLoading, setDbRolesLoading] = useState(false);
  useEffect(() => {
    const userId = Number(user?.sub || user?.id);
    if (!Number.isFinite(userId)) {
      setDbRoles([]);
      return;
    }
    let mounted = true;
    async function loadRoles() {
      setDbRolesLoading(true);
      try {
        const res = await api.get(`/admin/users/${userId}/roles`);
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        if (mounted) setDbRoles(items);
        if (mounted && items.length > 0 && !selectedRole) {
          setSelectedRole(items[0]?.name || items[0]?.code || null);
        }
      } catch {
        if (mounted) setDbRoles([]);
      } finally {
        if (mounted) setDbRolesLoading(false);
      }
    }
    loadRoles();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const roles = Array.isArray(user?.roles)
      ? user.roles
      : user?.role
        ? [user.role]
        : [];
    if (roles.length && !roles.includes(selectedRole)) {
      setSelectedRole(roles[0]);
    }
  }, [user?.roles, user?.role, selectedRole]);
  const userIdNum = useMemo(
    () => Number(user?.sub || user?.id),
    [user?.sub, user?.id],
  );
  const [branchOptions, setBranchOptions] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [companies, setCompanies] = useState([]);
  useEffect(() => {
    let mounted = true;
    async function loadUserBranches() {
      try {
        if (!Number.isFinite(userIdNum)) return;
        const res = await api.get(`/admin/users/${userIdNum}/branches`);
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        if (mounted) {
          setBranchOptions(items);
          if (!selectedBranchId && items.length > 0) {
            setSelectedBranchId(Number(items[0].id));
          }
        }
      } catch {
        try {
          const res2 = await api.get("/admin/branches");
          const items2 = Array.isArray(res2.data?.items) ? res2.data.items : [];
          const allowedIds = Array.isArray(user?.branchIds)
            ? user.branchIds.map(Number).filter((n) => Number.isFinite(n))
            : [];
          const filtered = items2.filter((b) =>
            allowedIds.includes(Number(b.id)),
          );
          if (mounted) {
            setBranchOptions(filtered);
            if (!selectedBranchId && filtered.length > 0) {
              setSelectedBranchId(Number(filtered[0].id));
            }
          }
        } catch {}
      }
    }
    loadUserBranches();
    return () => {
      mounted = false;
    };
  }, [userIdNum, user?.branchIds, selectedBranchId]);
  useEffect(() => {
    let mounted = true;
    async function loadCompanies() {
      try {
        const res = await api.get("/admin/companies");
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        if (mounted) setCompanies(items);
      } catch {}
    }
    loadCompanies();
    return () => {
      mounted = false;
    };
  }, []);
  const currentBranchName = useMemo(() => {
    const found = branchOptions.find(
      (b) => Number(b.id) === Number(scope?.branchId),
    );
    if (found) {
      const comp = found.company_name || `Company #${found.company_id}`;
      return `${found.name} (${comp})`;
    }
    return profile.branchName;
  }, [branchOptions, scope?.branchId, profile.branchName]);
  const currentCompanyName = useMemo(() => {
    const found = branchOptions.find(
      (b) => Number(b.id) === Number(scope?.branchId),
    );
    if (found) {
      return found.company_name || `Company #${found.company_id}`;
    }
    if (branchOptions.length === 1) {
      const b = branchOptions[0];
      return b.company_name || `Company #${b.company_id}`;
    }
    const mapped = companies.find(
      (c) => Number(c.id) === Number(scope?.companyId),
    );
    if (mapped) return mapped.name;
    return user?.companyName || `Company #${scope?.companyId ?? "-"}`;
  }, [
    branchOptions,
    scope?.branchId,
    user?.companyName,
    scope?.companyId,
    companies,
  ]);
  useEffect(() => {
    const hasMultipleRoles =
      (Array.isArray(dbRoles) && dbRoles.length > 1) ||
      (Array.isArray(roleOptions) && roleOptions.length > 1);
    const hasMultipleBranches = Array.isArray(branchOptions)
      ? branchOptions.length > 1
      : false;
    if (hasMultipleRoles && hasMultipleBranches) {
      setContextModalOpen(true);
    }
  }, [dbRoles, roleOptions, branchOptions]);

  const navigate = useNavigate();
  const location = useLocation();

  const isRootPage = useMemo(() => {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    if (path === "/" || path === "/dashboard") return true;
    return modules.some((m) => m.path === path);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.matchMedia("(min-width: 768px)").matches) {
        setSidebarOpen(isRootPage);
      } else {
        setSidebarOpen(false);
      }
    }
  }, [location.pathname, isRootPage]);

  useEffect(() => {
    function onDocClick(e) {
      if (!profileRef.current) return;
      if (!profileRef.current.contains(e.target)) setProfileOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100 flex flex-col">
      <header className="flex justify-between items-center px-6 py-1 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm z-50 sticky top-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setSidebarOpen((v) => !v)}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="text-xl leading-none" aria-hidden="true">
              ☰
            </span>
          </button>

          <Link
            to="/"
            className="inline-flex items-center"
            aria-label="Go to Home"
          >
            <img
              src={theme === "dark" ? logoDark : logoLight}
              alt="OmniSuite"
              className="h-8 w-auto"
            />
          </Link>
        </div>
        <div className="flex items-center gap-3">
          {/* <div className="badge bg-brand-100 dark:bg-brand-900/50 text-brand-800 dark:text-brand-200 border border-brand-300 dark:border-brand-700">
            Role-based + Branch-based
          </div> */}
          <ThemeToggle />
          <button
            type="button"
            className="btn-outline px-3 py-1 hidden md:inline-flex"
            onClick={onInstallClick}
            disabled={false}
            aria-disabled={false}
            title={
              installPrompt
                ? "Install OmniSuite"
                : "Use browser menu to install (Add to Home Screen)"
            }
          >
            Install
          </button>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="text-sm font-semibold">User Profile</span>
              <span aria-hidden="true">▾</span>
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-erp-lg overflow-hidden z-50">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {profile.username}
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Company
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 text-right">
                      {currentCompanyName}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Branch
                    </div>
                    <div className="text-right">
                      {branchOptions.length > 1 ? (
                        <select
                          className="input"
                          value={String(
                            scope?.branchId || selectedBranchId || "",
                          )}
                          onChange={(e) => {
                            const id = Number(e.target.value);
                            setSelectedBranchId(id);
                            setScope((prev) => {
                              const chosen = branchOptions.find(
                                (b) => Number(b.id) === id,
                              );
                              const companyId = chosen
                                ? Number(chosen.company_id)
                                : prev.companyId;
                              return { ...prev, companyId, branchId: id };
                            });
                            setProfileOpen(false);
                          }}
                        >
                          {branchOptions.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name} (
                              {b.company_name || `Company #${b.company_id}`})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {currentBranchName}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setContextModalOpen(true)}
                      className="btn-primary w-full"
                      disabled={
                        (dbRoles.length > 1 || roleOptions.length > 1) &&
                        branchOptions.length > 1
                      }
                    >
                      Switch Context
                    </button>
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        logout();
                        navigate("/login", { replace: true });
                      }}
                      className="btn-secondary"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
      {!online && (
        <div className="px-6 py-2 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-b border-yellow-300 dark:border-yellow-800 text-sm">
          Offline mode enabled. Pages and assets are cached. Actions queue for
          sync.
        </div>
      )}
      {contextModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md card p-6 shadow-erp-lg bg-white dark:bg-slate-900">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">Switch Role & Branch</h2>
              <button
                type="button"
                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                onClick={() => setContextModalOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="label">Company</label>
                <div className="input">{currentCompanyName}</div>
              </div>
              <div>
                <label className="label">Role</label>
                {dbRoles.length > 1 || roleOptions.length > 1 ? (
                  <select
                    className="input w-full"
                    value={selectedRole || ""}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    disabled={dbRolesLoading}
                  >
                    {(dbRoles.length ? dbRoles : roleOptions).map((r) => {
                      const name = typeof r === "string" ? r : r.name || r.code;
                      const key = typeof r === "string" ? r : r.id;
                      return (
                        <option key={key} value={name}>
                          {name}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <div className="input">{selectedRole || profile.role}</div>
                )}
              </div>
              <div>
                <label className="label">Branch</label>
                {branchOptions.length > 1 ? (
                  <select
                    className="input w-full"
                    value={String(selectedBranchId || scope?.branchId || "")}
                    onChange={(e) =>
                      setSelectedBranchId(Number(e.target.value))
                    }
                  >
                    {branchOptions.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.company_name || `Company #${b.company_id}`}
                        )
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="input">{currentBranchName}</div>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setContextModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={
                  ((dbRoles.length > 1 || roleOptions.length > 1) &&
                    !selectedRole) ||
                  (branchOptions.length > 1 && !selectedBranchId)
                }
                onClick={() => {
                  const chosen = branchOptions.find(
                    (b) =>
                      Number(b.id) ===
                      Number(selectedBranchId || scope?.branchId),
                  );
                  setScope((prev) => ({
                    ...prev,
                    companyId: chosen
                      ? Number(chosen.company_id)
                      : prev.companyId,
                    branchId: chosen ? Number(chosen.id) : prev.branchId,
                  }));
                  setContextModalOpen(false);
                  setProfileOpen(false);
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className={
          "flex-1 " +
          (sidebarOpen ? "grid md:grid-cols-[280px_1fr]" : "grid grid-cols-1")
        }
      >
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
          />
        )}

        <aside
          className={
            "border-b md:border-b-0 md:border-r border-slate-800 dark:border-slate-800 p-5 md:sticky md:top-[45px] md:h-[calc(100vh-45px)] bg-brand-950 dark:bg-slate-950 shadow-lg overflow-y-auto no-scrollbar z-40 " +
            (sidebarOpen
              ? "fixed md:static inset-y-0 left-0 w-[280px] top-[45px]"
              : "hidden")
          }
        >
          <nav className="space-y-1 pb-6">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ` +
                (isActive
                  ? "bg-brand-800 text-white shadow-lg border-l-4 border-primary-light"
                  : "text-brand-200 hover:bg-brand-800 hover:text-white border-l-4 border-transparent")
              }
            >
              <span
                className="w-6 text-lg leading-none opacity-80 group-hover:opacity-100 transition-opacity"
                aria-hidden="true"
              >
                🏠
              </span>
              Home
            </NavLink>
            {modules
              .filter((m) => hasModuleAccess(m.label))
              .map((m) => (
                <NavLink
                  key={m.key}
                  to={m.path}
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ` +
                    (isActive
                      ? "bg-brand-800 text-white shadow-lg border-l-4 border-primary-light"
                      : "text-brand-200 hover:bg-brand-800 hover:text-white border-l-4 border-transparent")
                  }
                >
                  <span
                    className="w-6 text-lg leading-none opacity-80 group-hover:opacity-100 transition-opacity"
                    aria-hidden="true"
                  >
                    {m.icon}
                  </span>
                  <span>{m.label}</span>
                </NavLink>
              ))}
          </nav>
        </aside>

        <main className="bg-slate-50 dark:bg-slate-900">
          <div className="w-full max-w-full lg:max-w-[1200px] mx-auto p-3 md:p-4 lg:p-6">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route
                path="/administration/*"
                element={<AdministrationHome />}
              />
              <Route path="/sales/*" element={<SalesHome />} />
              <Route path="/inventory/*" element={<InventoryHome />} />
              <Route path="/purchase/*" element={<PurchaseHome />} />
              <Route path="/finance/*" element={<FinanceRoutes />} />
              <Route
                path="/human-resources/*"
                element={<HumanResourcesHome />}
              />
              <Route path="/maintenance/*" element={<MaintenanceHome />} />
              <Route
                path="/project-management/*"
                element={<ProjectManagementHome />}
              />
              <Route path="/production/*" element={<ProductionHome />} />
              <Route path="/pos/*" element={<PosHome />} />
              <Route
                path="/business-intelligence/*"
                element={<BusinessIntelligenceHome />}
              />
            </Routes>
          </div>
        </main>
      </div>
      {showInstall && installPrompt && (
        <div className="fixed bottom-4 right-4 z-[60] card p-3 shadow-erp-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Install OmniSuite
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Install this app on your device
              </div>
            </div>
            <button
              type="button"
              className="btn-primary px-3 py-1"
              onClick={onInstallClick}
              title={
                installPrompt
                  ? "Install OmniSuite"
                  : "Use browser menu to install (Add to Home Screen)"
              }
            >
              Install
            </button>
            <button
              type="button"
              className="btn-secondary px-3 py-1"
              onClick={() => setShowInstall(false)}
              aria-label="Dismiss"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
