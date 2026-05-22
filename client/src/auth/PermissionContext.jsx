import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { api } from "../api/client.js";
import { MODULES_REGISTRY } from "../data/modulesRegistry.js";

/**
 * PermissionContext - Centralized permission management
 *
 * Provides:
 * - Current user permissions
 * - Permission checking functions
 * - Dynamic permission updates
 * - Module/feature visibility control
 */

const PermissionContext = createContext();
const RBAC_CACHE_KEY = "rbac.permission.snapshot.v1";
const PAGE_PERM_RETRY_MS = 30_000;

function isTransientBackendError(err) {
  const status = Number(err?.response?.status || 0);
  if (status === 503 || status === 502 || status === 504 || status === 429) {
    return true;
  }
  return !err?.response;
}

function readPermissionSnapshot() {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(RBAC_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      modules: Array.isArray(data?.modules) ? data.modules : [],
      permissions: Array.isArray(data?.permissions) ? data.permissions : [],
      roleFeatures: Array.isArray(data?.roleFeatures) ? data.roleFeatures : [],
      exceptionalPerms: Array.isArray(data?.exceptionalPerms)
        ? data.exceptionalPerms
        : [],
    };
  } catch {
    return null;
  }
}

function writePermissionSnapshot(snapshot) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(RBAC_CACHE_KEY, JSON.stringify(snapshot));
  } catch {}
}

export const usePermission = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error("usePermission must be used within a PermissionProvider");
  }
  return context;
};

export const PermissionProvider = ({ children }) => {
  const { user, token, initialized } = useAuth();
  const [modules, setModules] = useState(new Set());
  const [permissions, setPermissions] = useState([]);
  const [roleFeatures, setRoleFeatures] = useState(new Set());
  const [exceptionalPerms, setExceptionalPerms] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessionOverrides, setSessionOverrides] = useState(() => new Map());
  const [pagePermsByPath, setPagePermsByPath] = useState(() => new Map());
  const [pagePermsPending, setPagePermsPending] = useState(() => new Set());
  const [pagePermRetryAfter, setPagePermRetryAfter] = useState(() => new Map());
  const [globalOverrides, setGlobalOverrides] = useState(() => {
    if (typeof localStorage === "undefined") {
      return {
        view: undefined,
        create: undefined,
        edit: undefined,
        delete: undefined,
      };
    }
    try {
      const getVal = (k) => {
        const raw = localStorage.getItem(k);
        if (raw === "1") return true;
        if (raw === "0") return undefined;
        return undefined;
      };
      return {
        view: getVal("rbac_allow_all_view"),
        create: getVal("rbac_allow_all_create"),
        edit: getVal("rbac_allow_all_edit"),
        delete: getVal("rbac_allow_all_delete"),
      };
    } catch {
      return {
        view: undefined,
        create: undefined,
        edit: undefined,
        delete: undefined,
      };
    }
  });
  useEffect(() => {
    try {
      if (typeof localStorage !== "undefined") {
        const setOrRemove = (key, val) => {
          if (val === true) localStorage.setItem(key, "1");
          else if (val === false) localStorage.setItem(key, "0");
          else localStorage.removeItem(key);
        };
        setOrRemove("rbac_allow_all_view", globalOverrides.view);
        setOrRemove("rbac_allow_all_create", globalOverrides.create);
        setOrRemove("rbac_allow_all_edit", globalOverrides.edit);
        setOrRemove("rbac_allow_all_delete", globalOverrides.delete);
      }
    } catch {}
  }, [globalOverrides]);

  /**
   * Load user permissions from backend
   */
  const loadPermissions = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!initialized || !token) {
        setModules(new Set());
        setPermissions([]);
        setRoleFeatures(new Set());
        setExceptionalPerms(new Set());
        return;
      }

      const userId = Number(user?.id || user?.sub || 0);
      if (!Number.isFinite(userId) || !userId) {
        setModules(new Set());
        setPermissions([]);
        setRoleFeatures(new Set());
        return;
      }

      const res = await api.get("/admin/user-permissions");
      const mods = Array.isArray(res.data?.modules) ? res.data.modules : [];
      const rolePerms = Array.isArray(res.data?.permissions)
        ? res.data.permissions
        : [];
      const feats = Array.isArray(res.data?.role_features)
        ? res.data.role_features
        : [];

      // Load user-specific overrides and merge (overrides win)
      const userOverridesRes = await api
        .get(`/admin/users/${userId}/feature-permissions`)
        .catch(() => ({ data: { items: [] } }));
      const overrideItems = Array.isArray(userOverridesRes?.data?.items)
        ? userOverridesRes.data.items
        : [];
      const overrideByFk = new Map(
        overrideItems.map((it) => [
          String(it.feature_key || "").trim(),
          {
            feature_key: String(it.feature_key || "").trim(),
            can_view: !!it.can_view,
            can_create: !!it.can_create,
            can_edit: !!it.can_edit,
            can_delete: !!it.can_delete,
          },
        ]),
      );

      const merged = rolePerms.map((p) => {
        const rawFk = String(p?.feature_key || "").trim();
        const mk = String(p?.module_key || "").trim();
        const canonicalFk = rawFk.includes(":")
          ? rawFk
          : mk
            ? `${mk}:${rawFk}`
            : rawFk;
        const ov = overrideByFk.get(canonicalFk);
        if (ov) {
          return {
            module_key: mk,
            feature_key: canonicalFk,
            can_view: ov.can_view,
            can_create: ov.can_create,
            can_edit: ov.can_edit,
            can_delete: ov.can_delete,
          };
        }
        return p;
      });

      setModules(
        new Set(mods.map((m) => String(m || "").trim()).filter(Boolean)),
      );
      // Use merged permissions; include overrides for features not in role perms
      for (const [fk, ov] of overrideByFk.entries()) {
        if (!merged.find((p) => String(p.feature_key || "") === fk)) {
          const [mk] = fk.split(":");
          merged.push({
            module_key: mk,
            feature_key: fk,
            can_view: ov.can_view,
            can_create: ov.can_create,
            can_edit: ov.can_edit,
            can_delete: ov.can_delete,
          });
        }
      }

      setPermissions(merged);
      setRoleFeatures(
        new Set(feats.map((f) => String(f || "").trim()).filter(Boolean)),
      );
      try {
        const exRes = await api
          .get(`/admin/users/${userId}/exceptional-permissions`)
          .catch(() => ({ data: { data: { items: [] } } }));
        const rows = Array.isArray(exRes?.data?.data?.items)
          ? exRes.data.data.items
          : Array.isArray(exRes?.data?.items)
            ? exRes.data.items
            : [];
        const byCode = new Map();
        for (const it of rows) {
          const code = String(it?.permission_code || "")
            .toUpperCase()
            .trim();
          if (!code) continue;
          const active = Number(it?.is_active) === 1;
          const isAllow =
            String(it?.effect || "ALLOW").toUpperCase() === "ALLOW";
          const isDeny = String(it?.effect || "ALLOW").toUpperCase() === "DENY";
          const cur = byCode.get(code) || { allow: false, deny: false };
          if (active && isAllow) cur.allow = true;
          if (active && isDeny) cur.deny = true;
          byCode.set(code, cur);
        }
        const set = new Set(
          Array.from(byCode.entries())
            .filter(([_, v]) => v.allow && !v.deny)
            .map(([k]) => k),
        );
        setExceptionalPerms(set);
        writePermissionSnapshot({
          modules: mods,
          permissions: merged,
          roleFeatures: feats,
          exceptionalPerms: Array.from(set),
        });
      } catch {
        setExceptionalPerms(new Set());
      }
      try {
        window.dispatchEvent(new Event("rbac:updated"));
      } catch {}
    } catch (err) {
      console.error("Failed to load permissions:", err);
      setError(err.message);
      if (isTransientBackendError(err)) {
        const snapshot = readPermissionSnapshot();
        if (snapshot) {
          setModules(
            new Set(snapshot.modules.map((m) => String(m || "").trim()).filter(Boolean)),
          );
          setPermissions(Array.isArray(snapshot.permissions) ? snapshot.permissions : []);
          setRoleFeatures(
            new Set(
              snapshot.roleFeatures
                .map((f) => String(f || "").trim())
                .filter(Boolean),
            ),
          );
          setExceptionalPerms(
            new Set(
              snapshot.exceptionalPerms
                .map((c) => String(c || "").toUpperCase().trim())
                .filter(Boolean),
            ),
          );
        }
      } else {
        setModules(new Set());
        setPermissions([]);
        setRoleFeatures(new Set());
      }
    } finally {
      setLoading(false);
    }
  };

  // Dashboard element view permissions (cards/tickers/dashboards)
  const [dashboardViewMap, setDashboardViewMap] = useState(() => new Map());
  const [dashboardViewLoaded, setDashboardViewLoaded] = useState(false);
  const loadDashboardPermissions = async () => {
    try {
      if (!initialized || !token) {
        setDashboardViewMap(new Map());
        setDashboardViewLoaded(true);
        return;
      }
      const userId = Number(user?.id || user?.sub || 0);
      if (!Number.isFinite(userId) || !userId) {
        setDashboardViewMap(new Map());
        setDashboardViewLoaded(true);
        return;
      }
      const res = await api.get("/access/dashboard-permissions");
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      const m = new Map();
      const byModule = new Map();
      for (const it of items) {
        const mk = String(it.module_key || "");
        const type = it.card_key
          ? "card"
          : it.ticker_key
            ? "ticker"
            : "dashboard";
        const key = String(
          it.card_key || it.ticker_key || it.dashboard_key || "",
        );
        const composite = `${mk}|${type}|${key}`;
        m.set(composite, Number(it.can_view) === 1);
        const set = byModule.get(mk) || new Set();
        set.add(type);
        byModule.set(mk, set);
      }
      setDashboardViewMap(m);
      setDashboardViewLoaded(true);
    } catch {
      setDashboardViewMap(new Map());
      setDashboardViewLoaded(true);
    }
  };

  const basePathFrom = (p) => {
    const raw = String(p || "").trim() || "/";
    let parts = raw.split("/").filter(Boolean);
    if (parts.length === 0) return "/";

    const last = parts[parts.length - 1];
    if (last === "new" || last === "create") {
      parts = parts.slice(0, parts.length - 1);
    } else if (/^[0-9]+$/.test(last) || /^[0-9a-fA-F-]{8,}$/.test(last)) {
      parts = parts.slice(0, parts.length - 1);
    }

    if (
      parts[0] === "administration" &&
      parts[1] === "access" &&
      parts.length >= 3
    ) {
      return `/${parts.slice(0, 3).join("/")}`;
    }
    if (parts.length >= 2) {
      return `/${parts.slice(0, 2).join("/")}`;
    }
    return `/${parts[0]}`;
  };

  const ensurePagePerms = async (path) => {
    const base = basePathFrom(path);
    if (!base) return null;
    if (pagePermsByPath.has(base)) return pagePermsByPath.get(base);
    if (pagePermsPending.has(base)) return null;
    const now = Date.now();
    const retryAt = Number(pagePermRetryAfter.get(base) || 0);
    if (retryAt > now) return null;
    setPagePermsPending((prev) => new Set(prev).add(base));
    try {
      const res = await api.get(
        `/admin/page-permissions?path=${encodeURIComponent(base)}`,
      );
      const row = res?.data || {};
      const perms = {
        can_view: !!row.can_view,
        can_create: !!row.can_create,
        can_edit: !!row.can_edit,
        can_delete: !!row.can_delete,
      };
      setPagePermsByPath((prev) => {
        const next = new Map(prev);
        next.set(base, perms);
        return next;
      });
      setPagePermRetryAfter((prev) => {
        const next = new Map(prev);
        next.delete(base);
        return next;
      });
      try {
        window.dispatchEvent(new Event("rbac:updated"));
      } catch {}
      return perms;
    } catch (err) {
      if (isTransientBackendError(err)) {
        setPagePermRetryAfter((prev) => {
          const next = new Map(prev);
          next.set(base, Date.now() + PAGE_PERM_RETRY_MS);
          return next;
        });
      }
      return null;
    } finally {
      setPagePermsPending((prev) => {
        const next = new Set(prev);
        next.delete(base);
        return next;
      });
    }
  };

  const getPagePerms = (path) => {
    const base = basePathFrom(path);
    if (!base) return null;
    return pagePermsByPath.get(base) || null;
  };

  const canPerformPageAction = (path, action = "view") => {
    const perms = getPagePerms(path);
    if (!perms) return null;
    const key =
      action === "view"
        ? "can_view"
        : action === "create"
          ? "can_create"
          : action === "edit"
            ? "can_edit"
            : action === "delete"
              ? "can_delete"
              : `can_${action}`;
    return perms[key] === true;
  };

  /**
   * Check if module is enabled
   */
  const permByFeatureKey = useMemo(() => {
    const m = new Map();
    for (const p of permissions || []) {
      const rawFk = String(p?.feature_key || "").trim();
      const mk = String(p?.module_key || "").trim();
      if (!rawFk) continue;

      // Normalize to the canonical key format used everywhere else: `${module_key}:${feature_key}`
      // Some DB rows may store `feature_key` as just `users` instead of `administration:users`.
      const canonicalFk = rawFk.includes(":")
        ? rawFk
        : mk
          ? `${mk}:${rawFk}`
          : rawFk;

      const entry = {
        module_key: mk,
        feature_key: canonicalFk,
        can_view: !!p.can_view,
        can_create: !!p.can_create,
        can_edit: !!p.can_edit,
        can_delete: !!p.can_delete,

        // Keep the original raw key for reference/debugging.
        raw_feature_key: rawFk,
      };

      m.set(canonicalFk, entry);
      // Alias: if a caller mistakenly uses the raw feature key, allow lookup too.
      if (!rawFk.includes(":")) m.set(rawFk, entry);
    }
    return m;
  }, [permissions]);

  const isSuper = useMemo(() => {
    return (
      modules.has("*") ||
      permByFeatureKey.has("*") ||
      (user?.permissions || []).includes("*")
    );
  }, [modules, permByFeatureKey, user]);

  const isModuleEnabled = (moduleKey) => {
    const mk = String(moduleKey || "");
    if (!mk) return false;
    if (isSuper) return true;
    return modules.has(mk);
  };

  /**
   * Check if a module should appear in sidebar navigation.
   * Unlike isModuleEnabled, this respects the role's explicit module assignments
   * even for superadmins. If modules have been configured (non-empty set),
   * only those modules are shown. Falls back to isSuper when no configuration exists
   * to prevent accidental lockout.
   */
  const canViewModule = (moduleKey) => {
    const mk = String(moduleKey || "");
    if (!mk) return false;
    if (modules.size > 0) return modules.has(mk);
    return isSuper;
  };

  /**
   * Check if feature is enabled
   */
  const hasExplicitRoleConfig = roleFeatures.size > 0 || permissions.length > 0;

  const isFeatureEnabled = (moduleKey, featureKey) => {
    if (!isModuleEnabled(moduleKey)) return false;
    const fk = `${moduleKey}:${featureKey}`;
    if (hasExplicitRoleConfig) return permByFeatureKey.has(fk);
    if (isSuper) return true;
    return permByFeatureKey.has(fk);
  };

  /**
   * Check if dashboard is enabled
   */
  const isDashboardEnabled = (moduleKey, dashboardKey) => {
    if (!isModuleEnabled(moduleKey)) return false;
    const fk = `${moduleKey}:${dashboardKey}`;
    if (hasExplicitRoleConfig) return permByFeatureKey.has(fk);
    if (isSuper) return true;
    return permByFeatureKey.has(fk);
  };

  /**
   * Check if user can access a specific feature path
   */
  const canAccessFeatureKey = (moduleKey, featureKey) => {
    const mk = String(moduleKey || "");
    const seg = String(featureKey || "");
    if (!mk || !seg) return false;
    if (!isModuleEnabled(mk)) return false;

    const allowKey = `${mk}:${seg}`;
    if (roleFeatures.has(allowKey)) return true;
    if (permByFeatureKey.has(allowKey)) return true;
    if (mk === "purchase") {
      if (
        seg === "direct-purchase" &&
        (roleFeatures.has("purchase:direct-purchases") ||
          permByFeatureKey.has("purchase:direct-purchases"))
      )
        return true;
      if (
        seg === "direct-purchases" &&
        (roleFeatures.has("purchase:direct-purchase") ||
          permByFeatureKey.has("purchase:direct-purchase"))
      )
        return true;
    }
    if (mk === "inventory") {
      if (
        seg === "items" &&
        (roleFeatures.has("inventory:item-master") ||
          permByFeatureKey.has("inventory:item-master"))
      )
        return true;
      if (
        seg === "item-master" &&
        (roleFeatures.has("inventory:items") ||
          permByFeatureKey.has("inventory:items"))
      )
        return true;
    }
    if (hasExplicitRoleConfig) return false;
    return isSuper;
  };

  const hasRoleFeature = (allowKey) => {
    const k = String(allowKey || "").trim();
    if (!k) return false;
    if (hasExplicitRoleConfig) return roleFeatures.has(k) || permByFeatureKey.has(k);
    if (isSuper) return true;
    return roleFeatures.has(k) || permByFeatureKey.has(k);
  };

  const canAccessPath = (path, action = "view") => {
    const p = String(path || "");
    if (!p) return false;
    if (p === "/" || p === "/dashboard") return true;
    if (hasExplicitRoleConfig && globalOverrides.view) return true;
    if (!hasExplicitRoleConfig && (isSuper || globalOverrides.view)) return true;

    const parts = p.split("/").filter(Boolean);
    if (parts[0] === "home") {
      const k = String(parts[1] || "");
      if (!k) return true;
      return hasRoleFeature(`home:${k}`);
    }
    const mk = String(parts[0] || "");
    if (!mk) return false;
    if (!isModuleEnabled(mk)) return false;

    // Module root path (e.g. /sales) should always be reachable if module is enabled.
    // Feature-level restrictions are applied on deeper paths and via UI filtering.
    if (parts.length === 1) return true;

    const moduleInfo = MODULES_REGISTRY[mk];
    const seg = String(parts[1] || "");
    if (!seg) {
      return true;
    }

    if (!moduleInfo) return true;
    const isKnown =
      (moduleInfo.features || []).some((f) => String(f.key) === seg) ||
      (moduleInfo.dashboards || []).some((d) => String(d.key) === seg);
    if (!isKnown) return true;

    return canAccessFeatureKey(mk, seg);
  };

  const canPerformAction = (featureKey, action = "view") => {
    const fk = String(featureKey || "").trim();
    if (!fk) return false;
    if (isSuper && !hasExplicitRoleConfig) return true;
    try {
      const path =
        (typeof window !== "undefined" &&
          window.location &&
          window.location.pathname) ||
        "/";
      const base = basePathFrom ? basePathFrom(path) : path;
      if (base && pagePermsByPath && pagePermsByPath.has(base)) {
        const perms = pagePermsByPath.get(base);
        const k =
          action === "view"
            ? "can_view"
            : action === "create"
              ? "can_create"
              : action === "edit"
                ? "can_edit"
                : action === "delete"
                  ? "can_delete"
                  : `can_${action}`;
        if (typeof perms?.[k] === "boolean") {
          return perms[k] === true;
        }
      }
    } catch {}
    const sess = sessionOverrides.get(fk);
    if (sess) {
      const k =
        action === "view"
          ? "can_view"
          : action === "create"
            ? "can_create"
            : action === "edit"
              ? "can_edit"
              : action === "delete"
                ? "can_delete"
                : `can_${action}`;
      if (typeof sess[k] === "boolean") return !!sess[k];
    }
    const act =
      action === "delete"
        ? "delete"
        : action === "create"
          ? "create"
          : action === "edit"
            ? "edit"
            : "view";
    if (
      globalOverrides &&
      Object.prototype.hasOwnProperty.call(globalOverrides, act) &&
      typeof globalOverrides[act] === "boolean"
    ) {
      return globalOverrides[act] === true;
    }

    const perm = permByFeatureKey.get(fk);
    if (!perm) return false;

    const key =
      action === "view"
        ? "can_view"
        : action === "create"
          ? "can_create"
          : action === "edit"
            ? "can_edit"
            : action === "delete"
              ? "can_delete"
              : `can_${action}`;
    return perm[key] === true;
  };

  /**
   * Derive feature key from a URL path (e.g. /sales/invoices/new -> sales:invoices)
   */
  const featureKeyFromPath = (path) => {
    const base = basePathFrom(path || window?.location?.pathname || "/");
    const parts = String(base || "/").split("/").filter(Boolean);
    if (parts.length < 2) return null;
    if (
      parts[0] === "administration" &&
      parts[1] === "access" &&
      parts[2]
    ) {
      return `administration:${parts[2]}`;
    }
    return `${parts[0]}:${parts[1]}`;
  };

  /**
   * Check if current user can create on the current page's feature
   */
  const canCreateOnPage = (path) => {
    const fk = featureKeyFromPath(path);
    if (!fk) return true;
    return canPerformAction(fk, "create");
  };

  /**
   * Check if current user can delete on the current page's feature
   */
  const canDeleteOnPage = (path) => {
    const fk = featureKeyFromPath(path);
    if (!fk) return true;
    return canPerformAction(fk, "delete");
  };

  /**
   * Get enabled modules for sidebar
   */
  const getEnabledModules = () =>
    Object.keys(MODULES_REGISTRY).filter((k) => isModuleEnabled(k));

  /**
   * Get enabled features for a module
   */
  const getEnabledFeatures = (moduleKey) => {
    if (!isModuleEnabled(moduleKey)) return [];
    const module = MODULES_REGISTRY[moduleKey];
    if (!module) return [];
    // If role features or permissions have been explicitly configured, respect them
    // even for superadmins (same as canViewModule sidebar logic).
    if (roleFeatures.size > 0 || permissions.length > 0) {
      return (module.features || []).filter(
        (f) =>
          roleFeatures.has(`${moduleKey}:${f.key}`) ||
          permByFeatureKey.has(`${moduleKey}:${f.key}`),
      );
    }
    if (isSuper) return module.features || [];
    return (module.features || []).filter(
      (f) =>
        roleFeatures.has(`${moduleKey}:${f.key}`) ||
        permByFeatureKey.has(`${moduleKey}:${f.key}`),
    );
  };

  /**
   * Get enabled dashboards for a module
   */
  const getEnabledDashboards = (moduleKey) => {
    if (!isModuleEnabled(moduleKey)) return [];
    const module = MODULES_REGISTRY[moduleKey];
    if (!module) return [];
    if (roleFeatures.size > 0 || permissions.length > 0) {
      return (module.dashboards || []).filter(
        (d) =>
          roleFeatures.has(`${moduleKey}:${d.key}`) ||
          permByFeatureKey.has(`${moduleKey}:${d.key}`),
      );
    }
    if (isSuper) return module.dashboards || [];
    return (module.dashboards || []).filter(
      (d) =>
        roleFeatures.has(`${moduleKey}:${d.key}`) ||
        permByFeatureKey.has(`${moduleKey}:${d.key}`),
    );
  };

  /**
   * Get disabled features for ModuleDashboard component
   */
  const getDisabledFeatures = (moduleKey) => {
    const module = MODULES_REGISTRY[moduleKey];
    if (!module) return [];

    const disabledFeatures = [];

    // If module is disabled, all features are disabled
    if (!isModuleEnabled(moduleKey)) {
      (module.features || []).forEach((feature) => {
        disabledFeatures.push(`${moduleKey}:${feature.key}`);
      });
      return disabledFeatures;
    }

    // Otherwise, check individual features
    (module.features || []).forEach((feature) => {
      if (!isFeatureEnabled(moduleKey, feature.key)) {
        disabledFeatures.push(`${moduleKey}:${feature.key}`);
      }
    });

    return disabledFeatures;
  };

  /**
   * Refresh permissions (useful after role changes)
   */
  const refreshPermissions = async () => {
    if (!initialized || !token) {
      setModules(new Set());
      setPermissions([]);
      setRoleFeatures(new Set());
      setExceptionalPerms(new Set());
      setDashboardViewMap(new Map());
      setDashboardViewLoaded(true);
      setLoading(false);
      return;
    }
    await loadPermissions();
    await loadDashboardPermissions();
  };

  useEffect(() => {
    if (!initialized) return;
    loadPermissions();
  }, [initialized, token, user?.id]);
  useEffect(() => {
    if (!initialized) return;
    loadDashboardPermissions();
  }, [initialized, token, user?.id]);
  useEffect(() => {
    try {
      if (typeof document !== "undefined" && document.body) {
        if (exceptionalPerms.has("SALES.DISCOUNT.ALLOW")) {
          document.body.classList.add("discount-guard-disabled");
        } else {
          document.body.classList.remove("discount-guard-disabled");
        }
        const guards = [
          'input[name="discount_percent"]',
          'input[name="discount"]',
          'input[placeholder="Disc %"]',
          'input[placeholder*="Discount"]',
          ".discount-guard input",
          ".discount-guard select",
          ".discount-guard textarea",
        ];

        const guardEnabled = exceptionalPerms.has("SALES.DISCOUNT.ALLOW");

        // Apply guard immediately to existing elements
        if (guardEnabled) {
          const all = document.querySelectorAll(guards.join(","));
          all.forEach((el) => {
            try {
              if (!el.hasAttribute("data-discount-guard")) {
                el.setAttribute("data-discount-guard", "1");
              }
              el.setAttribute("disabled", "true");
            } catch {}
          });
        }

        // Only observe when guard is active; debounce to avoid layout thrashing
        if (guardEnabled && typeof MutationObserver !== "undefined") {
          let timer = null;
          const applyGuard = () => {
            if (timer) return;
            timer = requestAnimationFrame(() => {
              timer = null;
              const nodes = document.querySelectorAll(guards.join(","));
              nodes.forEach((el) => {
                try {
                  if (!el.hasAttribute("data-discount-guard")) {
                    el.setAttribute("data-discount-guard", "1");
                  }
                  el.setAttribute("disabled", "true");
                } catch {}
              });
            });
          };
          const obs = new MutationObserver(() => applyGuard());
          obs.observe(document.body, { childList: true, subtree: true });
          return () => {
            if (timer) cancelAnimationFrame(timer);
            obs.disconnect();
          };
        }
      }
    } catch {}
  }, [exceptionalPerms]);

  // Centralized create/delete button guard across all list pages
  const guardCleanupRef = useRef(null);
  useEffect(() => {
    if (typeof document === "undefined") return;

    function runGuard() {
      if (guardCleanupRef.current) guardCleanupRef.current();

      const path = window?.location?.pathname || "/";
      const canCreate = canCreateOnPage(path);
      const canDelete = canDeleteOnPage(path);
      document.body.classList.toggle("create-guard-disabled", !canCreate);
      document.body.classList.toggle("delete-guard-disabled", !canDelete);
      if (canCreate && canDelete) { guardCleanupRef.current = null; return; }

      let timer = null;
      const createSelectors = 'a[href*="/new"], a[href*="/create"], .btn-success, .btn-primary';
      const applyGuards = () => {
        if (timer) return;
        timer = requestAnimationFrame(() => {
          timer = null;
          if (!canCreate) {
            document.querySelectorAll(createSelectors).forEach((el) => {
              const exempt =
                el.getAttribute?.("data-rbac-exempt") === "" ||
                el.getAttribute?.("data-rbac-exempt") === "true";
              if (exempt) return;
              const text = (el.textContent || "").trim();
              const href = (el.getAttribute("href") || "").toLowerCase();
              if (href.includes("/new") || href.includes("/create") || /^\+/.test(text) || /\bNew\b/.test(text) || /\bCreate\b/.test(text)) {
                if (!el.hasAttribute("data-create-guard")) {
                  el.setAttribute("data-create-guard", el.style.display === "none" ? "hidden" : "visible");
                  el.style.display = "none";
                }
              }
            });
          }
          if (!canDelete) {
            document.querySelectorAll('.btn-danger, a[href*="/delete"]').forEach((el) => {
              const exempt =
                el.getAttribute?.("data-rbac-exempt") === "" ||
                el.getAttribute?.("data-rbac-exempt") === "true";
              if (exempt) return;
              const text = (el.textContent || "").trim().toLowerCase();
              const href = (el.getAttribute("href") || "").toLowerCase();
              if (href.includes("delete") || text === "delete" || (text.includes("delete") && text.length < 15)) {
                if (!el.hasAttribute("data-delete-guard")) {
                  el.setAttribute("data-delete-guard", el.style.display === "none" ? "hidden" : "visible");
                  el.style.display = "none";
                }
              }
            });
          }
        });
      };

      applyGuards();
      const obs = new MutationObserver(() => applyGuards());
      obs.observe(document.body, { childList: true, subtree: true });
      guardCleanupRef.current = () => {
        if (timer) cancelAnimationFrame(timer);
        obs.disconnect();
        document.querySelectorAll("[data-create-guard]").forEach((el) => {
          if (el.getAttribute("data-create-guard") === "visible") el.style.display = "";
          el.removeAttribute("data-create-guard");
        });
        document.querySelectorAll("[data-delete-guard]").forEach((el) => {
          if (el.getAttribute("data-delete-guard") === "visible") el.style.display = "";
          el.removeAttribute("data-delete-guard");
        });
      };
    }

    runGuard();
    const onNav = () => runGuard();
    window.addEventListener("popstate", onNav);
    window.addEventListener("rbac:updated", onNav);
    return () => {
      window.removeEventListener("popstate", onNav);
      window.removeEventListener("rbac:updated", onNav);
      if (guardCleanupRef.current) guardCleanupRef.current();
    };
  }, [permissions, roleFeatures, exceptionalPerms, pagePermsByPath]);

  useEffect(() => {
    function onChanged() {
      refreshPermissions();
    }
    window.addEventListener("rbac:changed", onChanged);
    return () => window.removeEventListener("rbac:changed", onChanged);
  }, []);

  const value = {
    modules,
    permissions,
    roleFeatures,
    exceptionalPerms,
    loading,
    error,
    isModuleEnabled,
    canViewModule,
    isFeatureEnabled,
    isDashboardEnabled,
    canAccessPath,
    canAccessFeatureKey,
    hasRoleFeature,
    canPerformAction,
    canCreateOnPage,
    canDeleteOnPage,
    featureKeyFromPath,
    getEnabledModules,
    getEnabledFeatures,
    getEnabledDashboards,
    getDisabledFeatures,
    refreshPermissions,
    MODULES_REGISTRY,
    globalOverrides,
    setGlobalOverrides,
    sessionOverrides,
    setSessionOverrides,
    pagePermsByPath,
    ensurePagePerms,
    getPagePerms,
    canPerformPageAction,
    basePathFrom,
    canViewDashboardElement: (moduleKey, type, key) => {
      const mk = String(moduleKey || "");
      const t = String(type || "");
      const rawKey = String(key || "");
      const normKey = rawKey
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      // Wait for dashboard permissions to load before showing elements
      if (!dashboardViewLoaded) return false;
      // If dashboard permissions have been explicitly configured, respect them
      // even for superadmins (same as canViewModule sidebar logic).
      if (dashboardViewMap.size > 0) {
        const comp = `${mk}|${t}|${normKey}`;
        return dashboardViewMap.get(comp) === true;
      }
      // No dashboard permissions configured yet — fall back to isSuper
      return isSuper;
    },
    setActionSessionOverride: (fk, action, value) => {
      const key =
        action === "can_view"
          ? "can_view"
          : action === "can_create"
            ? "can_create"
            : action === "can_edit"
              ? "can_edit"
              : action === "can_delete"
                ? "can_delete"
                : action;
      const featureKey = String(fk || "").trim();
      if (!featureKey || !key) return;
      setSessionOverrides((prev) => {
        const next = new Map(prev);
        const existing = next.get(featureKey) || {};
        next.set(featureKey, { ...existing, [key]: !!value });
        return next;
      });
      try {
        window.dispatchEvent(new Event("rbac:updated"));
      } catch {}
    },
    clearSessionOverrides: () => {
      setSessionOverrides(new Map());
      try {
        window.dispatchEvent(new Event("rbac:updated"));
      } catch {}
    },
    hasExceptional: (code) => {
      const c = String(code || "")
        .toUpperCase()
        .trim();
      if (!c) return false;
      return exceptionalPerms.has(c);
    },
    canReverseApproval: () => exceptionalPerms.has("WORKFLOW.APPROVAL.REVERSE"),
    canEditDiscount: () => exceptionalPerms.has("SALES.DISCOUNT.ALLOW"),
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};

export default PermissionContext;
