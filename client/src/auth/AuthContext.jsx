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
    await loadPermissions(res.data.user);
    return res.data;
  }
  useEffect(() => {
    if (token && user) {
      loadPermissions(user);
    }
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

  function buildAccess(pages = [], permissions = []) {
    const byId = {};
    for (const p of pages) {
      byId[p.id] = p;
    }
    const byPath = {};
    for (const p of pages) {
      if (!p?.path) continue;
      byPath[p.path] = {
        path: p.path,
        module: p.module || "",
        can_view: 1,
        can_create: 0,
        can_edit: 0,
        can_delete: 0,
      };
    }
    for (const r of permissions) {
      const pg = byId[r.page_id];
      if (!pg || !pg.path) continue;
      byPath[pg.path] = {
        path: pg.path,
        module: pg.module || "",
        can_view: Number(r.can_view) ? 1 : 0,
        can_create: Number(r.can_create) ? 1 : 0,
        can_edit: Number(r.can_edit) ? 1 : 0,
        can_delete: Number(r.can_delete) ? 1 : 0,
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
    const userId =
      Number(userPayload?.sub) ||
      Number(userPayload?.id) ||
      Number(user?.sub) ||
      Number(user?.id);
    if (!Number.isFinite(userId) || userId <= 0) {
      setAccess({ patterns: [], modules: [] });
      return;
    }
    try {
      const res = await api.get(`/admin/users/${userId}/permissions-context`);
      const pages = Array.isArray(res.data?.pages) ? res.data.pages : [];
      const permissions = Array.isArray(res.data?.permissions)
        ? res.data.permissions
        : [];
      buildAccess(pages, permissions);
    } catch {
      setAccess({ patterns: [], modules: [] });
    }
  }

  function hasAccess(path, action = "view") {
    if (!Array.isArray(access.patterns) || access.patterns.length === 0)
      return true;
    const pth = String(path || "");
    const isEditPath = /\/edit$/.test(pth);
    const isCreatePath = /(\/new|\/create)$/.test(pth);
    let found =
      access.patterns.find((p) => p.pattern === pth) ||
      access.patterns.find((p) => p.regex.test(pth));
    if (isEditPath) {
      const base = pth.replace(/\/edit$/, "");
      const baseFound =
        access.patterns.find((p) => p.pattern === base) ||
        access.patterns.find((p) => p.regex.test(base));
      if (baseFound) {
        return Boolean(baseFound.can_view || baseFound.can_edit);
      }
      if (found) {
        return Boolean(found.can_edit || found.can_view);
      }
      return true;
    }
    if (isCreatePath) {
      const base = pth.replace(/\/(new|create)$/, "");
      const baseFound =
        access.patterns.find((p) => p.pattern === base) ||
        access.patterns.find((p) => p.regex.test(base));
      if (baseFound) {
        return Boolean(baseFound.can_create || baseFound.can_view);
      }
      if (found) {
        return Boolean(found.can_create || found.can_view);
      }
      return true;
    }
    if (!found) return true;
    if (action === "create") return Boolean(found.can_create);
    if (action === "edit") return Boolean(found.can_edit);
    if (action === "delete") return Boolean(found.can_delete);
    return Boolean(found.can_view);
  }

  function hasModuleAccess(label) {
    if (!Array.isArray(access.modules) || access.modules.length === 0)
      return true;
    return access.modules.includes(String(label || ""));
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
