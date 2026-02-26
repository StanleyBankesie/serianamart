import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

import {
  api,
  setAuthToken,
  setScopeHeaders,
  setUserHeader,
} from "../api/client.js";

const AuthContext = createContext(null);

const STORAGE_KEY = "omnisuite.auth";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState({
    sub: 0,
    id: 0,
    username: "dev",
    email: "dev@local",
    permissions: ["*"],
    companyIds: [1],
    branchIds: [1],
  });
  const [scope, setScope] = useState({ companyId: 1, branchId: 1 });
  const [initialized, setInitialized] = useState(false);
  const [access, setAccess] = useState({ patterns: [], modules: [] });

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.token) {
          setToken(parsed.token);
          setUser(parsed.user || null);
          setScope(parsed.scope || { companyId: 1, branchId: 1 });
        }
      } catch {}
    }
    setInitialized(true);
  }, []);

  useLayoutEffect(() => {
    setAuthToken(token);
  }, [token]);

  useLayoutEffect(() => {
    setScopeHeaders(scope);
  }, [scope]);

  useLayoutEffect(() => {
    setUserHeader(user || null);
  }, [user]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user, scope }));
  }, [token, user, scope]);

  async function login({ username, password }) {
    const res = await api.post("/login", { username, password });
    setToken(res.data.token);
    setUser(res.data.user);
    setAccess({ patterns: [], modules: [] });
    return res.data;
  }
  useEffect(() => {
    // Skip permission loading - RBAC disabled
    setAccess({ patterns: [], modules: [] });
  }, [token, user]);

  async function logout() {
    try {
      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing && existing.endpoint) {
          try {
            await api.delete("/push/unsubscribe", {
              data: { subscription: existing.toJSON() },
            });
          } catch {}
          try {
            await existing.unsubscribe();
          } catch {}
        }
      }
    } catch {}
    // clear auth state and persisted storage
    setToken(null);
    setUser(null);
    setScope({ companyId: 1, branchId: 1 });
    setAuthToken(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setAccess({ patterns: [], modules: [] });
  }

  function pathToRegex(pattern) {
    const re = "^" + String(pattern || "").replace(/:[^/]+/g, "[^/]+") + "$";
    return new RegExp(re);
  }

  function buildAccess(allPages = [], rolePages = [], permissions = []) {
    const byId = {};
    for (const p of allPages) {
      byId[p.id] = p;
    }
    const permByPageId = {};
    for (const r of permissions) {
      if (!r || typeof r.page_id === "undefined") continue;
      permByPageId[r.page_id] = r;
    }
    const byPath = {};
    for (const p of rolePages) {
      if (!p || !p.id || !p.path) continue;
      const perm = permByPageId[p.id];
      const hasOverride = typeof perm !== "undefined";
      let can_view = 1;
      let can_create = 0;
      let can_edit = 0;
      let can_delete = 0;
      if (hasOverride) {
        can_view = Number(perm.can_view) ? 1 : 0;
        can_create = Number(perm.can_create) ? 1 : 0;
        can_edit = Number(perm.can_edit) ? 1 : 0;
        can_delete = Number(perm.can_delete) ? 1 : 0;
      }
      byPath[p.path] = {
        path: p.path,
        module: p.module || "",
        can_view,
        can_create,
        can_edit,
        can_delete,
      };
    }
    const patterns = Object.values(byPath).map((v) => ({
      pattern: v.path,
      module: v.module,
      can_view: v.can_view,
      can_create: v.can_create,
      can_edit: v.can_edit,
      can_delete: v.can_delete,
      regex: pathToRegex(v.path),
    }));
    const modules = [];
    const seen = new Set();
    for (const v of patterns) {
      if (v.can_view && v.module && !seen.has(v.module)) {
        seen.add(v.module);
        modules.push(v.module);
      }
    }
    setAccess({ patterns, modules });
  }

  async function loadPermissions(userPayload) {
    // Stub - no backend calls needed with RBAC disabled
    setAccess({ patterns: [], modules: [] });
  }

  function hasAccess(path, action = "view") {
    if (!Array.isArray(access.patterns) || access.patterns.length === 0) {
      return false;
    }
    const pth = String(path || "");
    const found =
      access.patterns.find((p) => p.pattern === pth) ||
      access.patterns.find((p) => p.regex.test(pth));
    if (!found) return false;
    if (action === "create") return Boolean(found.can_create);
    if (action === "edit") return Boolean(found.can_edit);
    if (action === "delete") return Boolean(found.can_delete);
    return Boolean(found.can_view);
  }

  function hasModuleAccess(label) {
    if (!Array.isArray(access.modules) || access.modules.length === 0) {
      return false;
    }
    const raw = String(label || "");
    const t = raw.toLowerCase().trim();
    let norm = raw;
    if (t.includes("administration")) norm = "Administration";
    else if (t.includes("inventory")) norm = "Inventory";
    else if (t.includes("sales")) norm = "Sales";
    else if (t.includes("purchase")) norm = "Purchase";
    else if (t.includes("finance")) norm = "Finance";
    else if (t.includes("human resources")) norm = "Human Resources";
    else if (t.includes("project management")) norm = "Project Management";
    else if (t.includes("service management")) norm = "Service Management";
    else if (t.includes("maintenance")) norm = "Maintenance";
    else if (t.includes("production")) norm = "Production";
    else if (t.includes("business intelligence"))
      norm = "Business Intelligence";
    else if (t.includes("pos")) norm = "POS";
    if (access.modules.includes(norm) || access.modules.includes(raw))
      return true;
    const pats = Array.isArray(access.patterns) ? access.patterns : [];
    const hasPrefix = (prefix) =>
      pats.some(
        (p) =>
          p.can_view && String(p.pattern || p.path || "").startsWith(prefix),
      );
    if (norm === "Administration") return hasPrefix("/administration/");
    if (norm === "Inventory") return hasPrefix("/inventory/");
    if (norm === "Sales") return hasPrefix("/sales/");
    if (norm === "Purchase") return hasPrefix("/purchase/");
    if (norm === "Finance") return hasPrefix("/finance/");
    if (norm === "Human Resources") return hasPrefix("/human-resources/");
    if (norm === "Project Management") return hasPrefix("/project-management/");
    if (norm === "Service Management") return hasPrefix("/service-management/");
    if (norm === "Maintenance") return hasPrefix("/maintenance/");
    if (norm === "Production") return hasPrefix("/production/");
    if (norm === "Business Intelligence")
      return hasPrefix("/business-intelligence/");
    if (norm === "POS") return hasPrefix("/pos/");
    return false;
  }

  const value = useMemo(
    () => ({
      token,
      user,
      scope,
      initialized,
      setScope,
      login,
      logout,
      hasAccess,
      hasModuleAccess,
    }),
    [token, user, scope, initialized, access],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx) return ctx;
  return {
    token: null,
    user: null,
    scope: { companyId: 1, branchId: 1 },
    initialized: true,
    setScope: () => {},
    login: async () => ({}),
    logout: () => {},
    hasAccess: () => true,
    hasModuleAccess: () => true,
  };
}
