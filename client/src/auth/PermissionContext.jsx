import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
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

export const usePermission = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error("usePermission must be used within a PermissionProvider");
  }
  return context;
};

export const PermissionProvider = ({ children }) => {
  const { user } = useAuth();
  const [modules, setModules] = useState(new Set());
  const [permissions, setPermissions] = useState([]);
  const [roleFeatures, setRoleFeatures] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [globalOverrides, setGlobalOverrides] = useState(() => {
    if (typeof localStorage === "undefined") {
      return { view: false, create: false, edit: false, delete: false };
    }
    try {
      return {
        view: localStorage.getItem("rbac_allow_all_view") === "1",
        create: localStorage.getItem("rbac_allow_all_create") === "1",
        edit: localStorage.getItem("rbac_allow_all_edit") === "1",
        delete: localStorage.getItem("rbac_allow_all_delete") === "1",
      };
    } catch {
      return { view: false, create: false, edit: false, delete: false };
    }
  });
  useEffect(() => {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(
          "rbac_allow_all_view",
          globalOverrides.view ? "1" : "0",
        );
        localStorage.setItem(
          "rbac_allow_all_create",
          globalOverrides.create ? "1" : "0",
        );
        localStorage.setItem(
          "rbac_allow_all_edit",
          globalOverrides.edit ? "1" : "0",
        );
        localStorage.setItem(
          "rbac_allow_all_delete",
          globalOverrides.delete ? "1" : "0",
        );
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
        window.dispatchEvent(new Event("rbac:updated"));
      } catch {}
    } catch (err) {
      console.error("Failed to load permissions:", err);
      setError(err.message);
      setModules(new Set());
      setPermissions([]);
      setRoleFeatures(new Set());
    } finally {
      setLoading(false);
    }
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
    return modules.has("*") || permByFeatureKey.has("*");
  }, [modules, permByFeatureKey]);

  const isModuleEnabled = (moduleKey) => {
    const mk = String(moduleKey || "");
    if (!mk) return false;
    return modules.has(mk);
  };

  /**
   * Check if feature is enabled
   */
  const isFeatureEnabled = (moduleKey, featureKey) => {
    if (!isModuleEnabled(moduleKey)) return false;
    if (isSuper) return true;
    const fk = `${moduleKey}:${featureKey}`;
    return permByFeatureKey.has(fk);
  };

  /**
   * Check if dashboard is enabled
   */
  const isDashboardEnabled = (moduleKey, dashboardKey) => {
    if (!isModuleEnabled(moduleKey)) return false;
    if (isSuper) return true;
    const fk = `${moduleKey}:${dashboardKey}`;
    return permByFeatureKey.has(fk);
  };

  /**
   * Check if user can access a specific path
   */
  const canAccessFeatureKey = (moduleKey, featureKey) => {
    const mk = String(moduleKey || "");
    const seg = String(featureKey || "");
    if (!mk || !seg) return false;
    if (isSuper) return true;
    if (!isModuleEnabled(mk)) return false;

    const allowKey = `${mk}:${seg}`;
    if (roleFeatures.has(allowKey)) return true;
    if (mk === "purchase") {
      if (
        seg === "direct-purchase" &&
        roleFeatures.has("purchase:direct-purchases")
      )
        return true;
      if (
        seg === "direct-purchases" &&
        roleFeatures.has("purchase:direct-purchase")
      )
        return true;
    }
    return false;
  };

  const hasRoleFeature = (allowKey) => {
    const k = String(allowKey || "").trim();
    if (!k) return false;
    if (isSuper) return true;
    return roleFeatures.has(k);
  };

  const canAccessPath = (path, action = "view") => {
    const p = String(path || "");
    if (!p) return false;
    if (p === "/" || p === "/dashboard") return true;
    if (isSuper || globalOverrides.view) return true;

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
    if (isSuper) return true;

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
    if (isSuper) return module.features || [];
    return (module.features || []).filter((f) =>
      roleFeatures.has(`${moduleKey}:${f.key}`),
    );
  };

  /**
   * Get enabled dashboards for a module
   */
  const getEnabledDashboards = (moduleKey) => {
    if (!isModuleEnabled(moduleKey)) return [];
    const module = MODULES_REGISTRY[moduleKey];
    if (!module) return [];
    if (isSuper) return module.dashboards || [];
    return (module.dashboards || []).filter((d) =>
      roleFeatures.has(`${moduleKey}:${d.key}`),
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
    await loadPermissions();
  };

  useEffect(() => {
    loadPermissions();
  }, [user?.id]);

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
    loading,
    error,
    isModuleEnabled,
    isFeatureEnabled,
    isDashboardEnabled,
    canAccessPath,
    canAccessFeatureKey,
    hasRoleFeature,
    canPerformAction,
    getEnabledModules,
    getEnabledFeatures,
    getEnabledDashboards,
    getDisabledFeatures,
    refreshPermissions,
    MODULES_REGISTRY,
    globalOverrides,
    setGlobalOverrides,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};

export default PermissionContext;
