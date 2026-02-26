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
import { usePermission } from "../auth/PermissionContext.jsx";
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
import ServiceManagementHome from "../pages/modules/service-management/ServiceManagementHome.jsx";
import NotificationsPage from "../pages/NotificationsPage.jsx";
import SocialFeedPage from "../pages/social/SocialFeedPage.jsx";
import RoleSetup from "../pages/admin/RoleSetup.jsx";
import UserPermissions from "../pages/admin/UserPermissions.jsx";
import SocialFeedNotification from "../components/CompanyFeed/SocialFeedNotification.jsx";
import addNotification from "react-push-notification";

import logoDark from "../assets/resources/OMNISUITE_WHITE_LOGO.png";
import logoLight from "../assets/resources/OMNISUITE_LOGO_FILL.png";
import { api } from "../api/client.js";
import useOfflineQueue from "../offline/useOfflineQueue.js";
import FloatingInstallButton from "../components/FloatingInstallButton.jsx";
import { toast } from "react-toastify";
import { Bell } from "lucide-react";
import FloatingChatV2 from "../components/chatv2/FloatingChatV2.jsx";

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
  {
    key: "service-management",
    label: "Service Management",
    path: "/service-management",
    icon: "🛎️",
  },
];

export default function AppShell() {
  const { token, user, scope, setScope, logout } = useAuth();
  const {
    isModuleEnabled,
    canPerformAction,
    globalOverrides,
    canPerformPageAction,
    ensurePagePerms,
    basePathFrom,
  } = usePermission();
  const { theme } = useTheme();
  const { pending, failed, completed, items, lastEvent } = useOfflineQueue();
  const navigate = useNavigate();
  const location = useLocation();
  const [queueOpen, setQueueOpen] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  useEffect(() => {
    if (lastEvent === "queued") {
      setSavedToast(true);
      const t = setTimeout(() => setSavedToast(false), 3000);
      return () => clearTimeout(t);
    }
  }, [lastEvent]);

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
  useEffect(() => {
    try {
      if ("serviceWorker" in navigator) {
        const handler = (e) => {
          const data = e?.data || {};
          if (data.type === "navigate" && typeof data.url === "string") {
            navigate(data.url);
          }
        };
        navigator.serviceWorker.addEventListener("message", handler);
        return () =>
          navigator.serviceWorker.removeEventListener("message", handler);
      }
    } catch {}
  }, [navigate]);

  useEffect(() => {
    try {
      if (typeof sessionStorage !== "undefined") {
        const path = location.pathname + (location.search || "");
        sessionStorage.setItem("last_path", path);
      }
    } catch {}
  }, [location.pathname, location.search]);
  useEffect(() => {
    async function logPageView() {
      try {
        if (import.meta && import.meta.env && import.meta.env.DEV) {
          return;
        }
        const path = location.pathname || "/";
        const seg = path.split("/").filter(Boolean)[0] || "dashboard";
        const moduleName = seg
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        try {
          await api.post("/admin/activity/log", {
            module_name: moduleName,
            action: "VIEW",
            ref_no: String(user?.username || ""),
            message: "Page View",
            url_path: path,
            event_time: new Date().toISOString(),
          });
        } catch {}
      } catch {}
    }
    logPageView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(min-width: 768px)").matches;
    }
    return false;
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const [contextModalOpen, setContextModalOpen] = useState(false);
  const [lowStockPrompted, setLowStockPrompted] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

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
        const items =
          (res.data && res.data.data && Array.isArray(res.data.data.items)
            ? res.data.data.items
            : Array.isArray(res.data?.items)
              ? res.data.items
              : []) || [];
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
    setLowStockPrompted(false);
    setLowStockCount(0);
    setUnreadCount(0);
  }, [scope?.companyId, scope?.branchId]);

  useEffect(() => {
    let cancelled = false;
    async function subscribePush() {
      try {
        if (import.meta && import.meta.env && import.meta.env.DEV) {
          return;
        }
        const raw =
          typeof localStorage !== "undefined"
            ? localStorage.getItem("push_enabled")
            : null;
        const enabled = raw === null ? true : String(raw) === "1";
        if (!enabled) return;
        if (typeof window === "undefined") return;
        if (!("serviceWorker" in navigator)) return;
        if (!("PushManager" in window)) return;
        if (!("Notification" in window)) return;
        if (window.Notification.permission !== "granted") return;
        const reg = await navigator.serviceWorker.ready;
        let publicKey = "";
        try {
          const res = await api.get("/push/public-key");
          publicKey = String(res.data?.publicKey || "");
        } catch {
          publicKey = "";
        }
        if (!publicKey) return;
        function urlBase64ToUint8Array(base64String) {
          const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
          const base64 = (base64String + padding)
            .replace(/-/g, "+")
            .replace(/_/g, "/");
          const rawData = window.atob(base64);
          const outputArray = new Uint8Array(rawData.length);
          for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
          }
          return outputArray;
        }
        const applicationServerKey = urlBase64ToUint8Array(publicKey);
        const existing = await reg.pushManager.getSubscription();
        if (existing && existing.endpoint) {
          try {
            await api.post("/push/subscribe", {
              subscription: existing.toJSON(),
            });
          } catch {}
          return;
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
        if (cancelled) return;
        try {
          await api.post("/push/subscribe", { subscription: sub.toJSON() });
        } catch {}
      } catch {}
    }
    subscribePush();
    return () => {
      cancelled = true;
    };
  }, [token]);
  useEffect(() => {
    let cancelled = false;
    let pollTimer = null;

    async function loadUnread() {
      try {
        const res = await api.get("/workflows/notifications");
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        const unread = items.filter((n) => Number(n.is_read) !== 1).length;
        setUnreadCount(unread);
        if (typeof window !== "undefined") {
          try {
            const storeKey = "notified_notification_ids";
            const prevRaw = localStorage.getItem(storeKey);
            const prev = prevRaw ? JSON.parse(prevRaw) : [];
            const prevSet = new Set(Array.isArray(prev) ? prev : []);
            const nativeAllowed =
              "Notification" in window &&
              window.Notification?.permission === "granted";
            const icon =
              theme === "dark"
                ? "/OMNISUITE_ICON_CLEAR.png"
                : "/OMNISUITE_ICON_CLEAR.png";
            for (const n of items) {
              const id = Number(n.id);
              const isUnread = Number(n.is_read) !== 1;
              if (isUnread && !prevSet.has(id)) {
                try {
                  addNotification({
                    title: String(n.title || "Notification"),
                    message: String(n.message || ""),
                    native: nativeAllowed,
                    icon,
                    onClick: () => {
                      if (n.link) navigate(String(n.link));
                      else navigate("/notifications");
                    },
                  });
                } catch {}
                prevSet.add(id);
              }
            }
            localStorage.setItem(storeKey, JSON.stringify(Array.from(prevSet)));
          } catch {}
        }
      } catch {}
    }

    async function checkLowStock() {
      try {
        if (lowStockPrompted) return;
        const res = await api.get("/inventory/alerts/low-stock");
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        if (!items.length) return;
        setLowStockPrompted(true);
        setLowStockCount(items.length);
        const count = items.length;
        const nativeAllowed =
          typeof window !== "undefined" &&
          "Notification" in window &&
          window.Notification?.permission === "granted";
        const icon =
          theme === "dark"
            ? "/OMNISUITE_ICON_CLEAR.png"
            : "/OMNISUITE_ICON_CLEAR.png";
        if (count <= 5) {
          for (const it of items) {
            const qty = Number(it.qty || 0);
            const rl = Number(it.reorder_level || 0);
            toast.warn(
              `${it.item_code}: stock ${qty} ≤ reorder ${rl} (${it.item_name})`,
            );
            try {
              addNotification({
                title: "Low Stock",
                message: `${it.item_code}: stock ${qty} ≤ reorder ${rl}`,
                native: nativeAllowed,
                icon,
                onClick: () => navigate("/inventory/alerts/low-stock"),
              });
            } catch {}
          }
        } else {
          toast.warn(
            `${count} items are at or below reorder levels. Check Inventory.`,
          );
          try {
            addNotification({
              title: "Low Stock",
              message: `${count} items are at or below reorder levels`,
              native: nativeAllowed,
              icon,
              onClick: () => navigate("/inventory/alerts/low-stock"),
            });
          } catch {}
        }
      } catch {}
    }
    checkLowStock();
    loadUnread();
    pollTimer = setInterval(loadUnread, 60000);
    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [scope?.companyId, scope?.branchId, lowStockPrompted]);
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (window.Notification.permission === "default") {
        try {
          window.Notification.requestPermission().catch(() => {});
        } catch {}
      }
    }
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
        const items =
          (res.data && res.data.data && Array.isArray(res.data.data.items)
            ? res.data.data.items
            : Array.isArray(res.data?.items)
              ? res.data.items
              : []) || [];
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
    const targetId = Number(scope?.branchId ?? selectedBranchId);
    const found =
      branchOptions.find((b) => Number(b.id) === targetId) ||
      (branchOptions.length ? branchOptions[0] : null);
    if (found) {
      const comp = found.company_name || `Company #${found.company_id}`;
      return `${found.name} (${comp})`;
    }
    return profile.branchName;
  }, [branchOptions, scope?.branchId, selectedBranchId, profile.branchName]);
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

  useEffect(() => {
    // Proactively prefetch page-level permissions on route change
    try {
      if (ensurePagePerms && typeof location?.pathname === "string") {
        const path = location.pathname || "/";
        ensurePagePerms(path);
      }
    } catch {}
  }, [location.pathname, ensurePagePerms]);

  useEffect(() => {
    let raf = 0;
    const labels = {
      create: ["+", "new", "create", "generate", "add"],
      delete: ["delete", "deactivate", "remove"],
      edit: ["edit", "update"],
      view: ["view", "open", "details", "preview"],
    };
    const norm = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
    const matches = (t, group) => {
      if (!t) return false;
      if (group.includes("+") && t.includes("+")) return true;
      for (const w of group) {
        if (w === "+") continue;
        const re = new RegExp(
          `\\b${w.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`,
          "i",
        );
        if (re.test(t)) return true;
      }
      return false;
    };
    const resolveFeatureKey = () => {
      const path = (window.location && window.location.pathname) || "/";
      const parts = path.split("/").filter(Boolean);
      if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
      return null;
    };
    const resolveBasePath = () => {
      const path = (window.location && window.location.pathname) || "/";
      try {
        return basePathFrom(path);
      } catch {
        const parts = path.split("/").filter(Boolean);
        if (parts.length >= 2) return `/${parts[0]}/${parts[1]}`;
        if (parts.length === 1) return `/${parts[0]}`;
        return "/";
      }
    };
    const apply = () => {
      const fk = resolveFeatureKey();
      const go = globalOverrides || {
        view: false,
        create: false,
        edit: false,
        delete: false,
      };
      const base = resolveBasePath();
      const pageAllow = {
        view: canPerformPageAction ? canPerformPageAction(base, "view") : null,
        create: canPerformPageAction
          ? canPerformPageAction(base, "create")
          : null,
        edit: canPerformPageAction ? canPerformPageAction(base, "edit") : null,
        delete: canPerformPageAction
          ? canPerformPageAction(base, "delete")
          : null,
      };
      if (
        (pageAllow.view === null ||
          pageAllow.create === null ||
          pageAllow.edit === null ||
          pageAllow.delete === null) &&
        ensurePagePerms
      ) {
        try {
          ensurePagePerms(base);
        } catch {}
      }
      const hasOverride = (v) => typeof v === "boolean";
      // Build allow map per-action, preferring page-level perms when available
      const allow = {
        view:
          typeof pageAllow.view === "boolean"
            ? pageAllow.view
            : hasOverride(go.view)
              ? go.view
              : fk
                ? canPerformAction(fk, "view")
                : true,
        create:
          typeof pageAllow.create === "boolean"
            ? pageAllow.create
            : hasOverride(go.create)
              ? go.create
              : fk
                ? canPerformAction(fk, "create")
                : true,
        edit:
          typeof pageAllow.edit === "boolean"
            ? pageAllow.edit
            : hasOverride(go.edit)
              ? go.edit
              : fk
                ? canPerformAction(fk, "edit")
                : true,
        delete:
          typeof pageAllow.delete === "boolean"
            ? pageAllow.delete
            : hasOverride(go.delete)
              ? go.delete
              : fk
                ? canPerformAction(fk, "delete")
                : false,
      };
      const nodes = Array.from(
        document.querySelectorAll(
          'button, a, [role="button"], input[type="button"], input[type="submit"]',
        ),
      );
      const attrNames = [
        "aria-label",
        "title",
        "data-label",
        "data-title",
        "data-tooltip",
        "name",
        "alt",
        "value",
      ];
      const extractTitle = (el) => {
        for (const n of attrNames) {
          const v = el.getAttribute && el.getAttribute(n);
          if (v && String(v).trim()) return String(v);
        }
        // Try dataset fallbacks
        try {
          const ds = el.dataset || {};
          for (const k of Object.keys(ds || {})) {
            const v = ds[k];
            if (v && String(v).trim()) return String(v);
          }
        } catch {}
        // Fall back to text content
        return el.textContent || "";
      };
      for (const el of nodes) {
        try {
          if (
            (el.getAttribute && el.getAttribute("data-rbac-exempt") === "") ||
            (el.getAttribute && el.getAttribute("data-rbac-exempt") === "true")
          ) {
            continue;
          }
        } catch {}
        const titleRaw = extractTitle(el);
        const t = norm(titleRaw);
        let action = null;
        // Prefer explicit data-action or similar hints
        try {
          const ds = el.dataset || {};
          const da = String(ds.action || ds.permission || ds.permAction || "")
            .toLowerCase()
            .trim();
          if (
            da === "view" ||
            da === "create" ||
            da === "edit" ||
            da === "delete"
          ) {
            action = da;
          }
        } catch {}
        if (matches(t, labels.create)) {
          action = "create";
        } else if (matches(t, labels.delete)) {
          action = "delete";
        } else if (matches(t, labels.edit)) {
          action = "edit";
        } else if (matches(t, labels.view)) {
          action = "view";
        }
        if (!action) continue;
        const allowed = allow[action];
        if (allowed) {
          el.hidden = false;
          el.style.display = "";
          el.style.pointerEvents = "";
          el.style.opacity = "";
          el.setAttribute("aria-disabled", "false");
          if ("disabled" in el) el.disabled = false;
        } else {
          el.hidden = true;
          el.style.pointerEvents = "none";
          el.style.opacity = "0.6";
          el.setAttribute("aria-disabled", "true");
          if ("disabled" in el) el.disabled = true;
        }
      }
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };
    const mo = new MutationObserver(() => schedule());
    mo.observe(document.body, { childList: true, subtree: true });
    schedule();
    const onRbac = () => schedule();
    const onStorage = (e) => {
      try {
        const k = String(e?.key || "");
        if (
          k === "rbac_allow_all_view" ||
          k === "rbac_allow_all_create" ||
          k === "rbac_allow_all_edit" ||
          k === "rbac_allow_all_delete"
        ) {
          schedule();
        }
      } catch {
        schedule();
      }
    };
    window.addEventListener("rbac:changed", onRbac);
    window.addEventListener("rbac:updated", onRbac);
    window.addEventListener("storage", onStorage);
    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      window.removeEventListener("rbac:changed", onRbac);
      window.removeEventListener("rbac:updated", onRbac);
      window.removeEventListener("storage", onStorage);
    };
  }, [location.pathname, canPerformAction, globalOverrides]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100 flex flex-col">
      {/* Floating Social Feed Notification - Always Visible */}
      <SocialFeedNotification />

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
      {savedToast && (
        <div className="px-6 py-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-b border-green-300 dark:border-green-800 text-sm">
          Saved Offline
        </div>
      )}
      {!online && (
        <div className="px-6 py-2 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-b border-yellow-300 dark:border-yellow-800 text-sm">
          Offline mode enabled. Pages and assets are cached. Actions queue for
          sync.
        </div>
      )}
      {queueOpen && (
        <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <div className="text-sm">
            Pending {pending} • Failed {failed} • Completed {completed}
          </div>
          <div className="mt-3">
            <div className="grid grid-cols-1 gap-2">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between px-3 py-2 rounded border border-slate-200 dark:border-slate-800"
                >
                  <div className="text-xs">
                    <span className="font-semibold">
                      {it.method.toUpperCase()}
                    </span>{" "}
                    <span className="text-slate-500">{it.url}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        it.status === "pending"
                          ? "badge bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-800"
                          : it.status === "failed"
                            ? "badge bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-800"
                            : "badge bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-800"
                      }
                    >
                      {it.status}
                    </span>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="text-xs text-slate-500">No queued items</div>
              )}
            </div>
          </div>
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
              .filter((m) => {
                // Use PermissionContext to check if module is enabled
                return isModuleEnabled(m.key);
              })
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
          <div className="w-full max-w-full lg:max-w-[1200px] mx-auto p-2 md:p-2 lg:p-3">
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
              <Route
                path="/service-management/*"
                element={<ServiceManagementHome />}
              />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/social-feed" element={<SocialFeedPage />} />
              <Route path="/social-feed/:id" element={<SocialFeedPage />} />
              {/* chat v2 renders via floating modal; legacy /chat route removed */}

              {/* Admin Routes */}
              <Route path="/admin/roles" element={<RoleSetup />} />
              <Route
                path="/admin/user-permissions"
                element={<UserPermissions />}
              />
            </Routes>
          </div>
        </main>
      </div>
      <FloatingInstallButton />
      <FloatingChatV2 />
    </div>
  );
}
