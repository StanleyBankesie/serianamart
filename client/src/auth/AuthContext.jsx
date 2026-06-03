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
import {
  clearLastActivity,
  clearStoredAuth,
  getAuthChangedEventName,
  isTokenExpired,
  readStoredAuth,
  touchLastActivity,
  writeStoredAuth,
} from "./authStorage.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [scope, setScope] = useState({ companyId: 1, branchId: 1 });
  const [initialized, setInitialized] = useState(false);
  const [access, setAccess] = useState({ patterns: [], modules: [] });

  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      const parsed = readStoredAuth();
      // Only attempt refresh if we have or had a session hint
      if (!parsed || (!parsed.token && !parsed.user)) {
        if (mounted) setInitialized(true);
        return;
      }

      // Offline path: restore from stored auth if token is still valid
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (parsed.token && !isTokenExpired(parsed.token)) {
          setToken(parsed.token);
          setUser(parsed.user);
          setScope(parsed.scope || { companyId: 1, branchId: 1 });
          touchLastActivity();
        }
        if (mounted) setInitialized(true);
        return;
      }

      try {
        const res = await api.post("/auth/refresh");
        if (!mounted) return;
        const nextToken = res.data?.token || res.data?.accessToken || null;
        if (!nextToken) throw new Error("Missing access token");
        const nextUser = res.data?.user || parsed?.user || null;
        const fallbackScope = {
          companyId:
            Number(nextUser?.companyIds?.[0]) ||
            Number(parsed?.scope?.companyId) ||
            1,
          branchId:
            Number(nextUser?.branchIds?.[0]) ||
            Number(parsed?.scope?.branchId) ||
            1,
        };
        const nextScope = res.data?.scope || fallbackScope;

        setToken(nextToken);
        setUser(nextUser);
        setScope(nextScope);
        touchLastActivity();
      } catch (err) {
        if (!mounted) return;
        // Only clear if it was an actual 401, not a network/server failure
        if (err?.response?.status === 401) {
          clearStoredAuth();
          clearLastActivity();
          setToken(null);
          setUser(null);
          setScope({ companyId: 1, branchId: 1 });
        } else if (parsed.token && !isTokenExpired(parsed.token)) {
          // Refresh failed for a transient reason (offline, 5xx, timeout).
          // Fall back to cached token if still valid.
          setToken(parsed.token);
          setUser(parsed.user);
          setScope(parsed.scope || { companyId: 1, branchId: 1 });
          touchLastActivity();
        }
      } finally {
        if (mounted) setInitialized(true);
      }
    };

    restoreSession();

    return () => {
      mounted = false;
    };
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
    if (!initialized) return;
    if (!token || !user) {
      if (readStoredAuth()) {
        clearStoredAuth();
      }
      return;
    }
    writeStoredAuth({ token, user, scope });
  }, [initialized, token, user, scope]);

  async function login({ username, password, rememberMe = false }) {
    const res = await api.post("/login", { username, password, rememberMe });
    const nextToken = res.data.token || res.data.accessToken || null;
    const nextUser = res.data.user || null;
    const nextScope = {
      companyId:
        Number(nextUser?.companyIds?.[0]) || Number(scope?.companyId) || 1,
      branchId:
        Number(nextUser?.branchIds?.[0]) || Number(scope?.branchId) || 1,
    };

    setToken(nextToken);
    setUser(nextUser);
    setAccess({ patterns: [], modules: [] });
    if (nextToken && nextUser) {
      setAuthToken(nextToken);
      setUserHeader(nextUser);
      writeStoredAuth({ token: nextToken, user: nextUser, scope: nextScope });
    }
    touchLastActivity();
    return res.data;
  }

  useEffect(() => {
    // Skip permission loading - RBAC disabled
    setAccess({ patterns: [], modules: [] });
  }, [token, user]);

  async function logout({ redirect = true } = {}) {
    try {
      await api.post("/auth/logout").catch(() => {});
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
    clearStoredAuth();
    clearLastActivity();
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem("last_path");
      } catch {}
    }
    // clear all cached/permission data
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.removeItem("rbac.permission.snapshot.v1");
        window.localStorage.removeItem("push_enabled");
      } catch {}
    }
    setAccess({ patterns: [], modules: [] });
  }

  useEffect(() => {
    const handleAuthExpired = () => {
      logout({ redirect: false });
    };
    window.addEventListener("omnisuite:auth-expired", handleAuthExpired);
    return () => {
      window.removeEventListener("omnisuite:auth-expired", handleAuthExpired);
    };
  }, []);

  useEffect(() => {
    const events = ["click", "keydown", "mousemove", "scroll", "touchstart"];
    const touch = () => {
      if (token) touchLastActivity();
    };

    events.forEach((eventName) =>
      window.addEventListener(eventName, touch, true),
    );
    return () => {
      events.forEach((eventName) =>
        window.removeEventListener(eventName, touch, true),
      );
    };
  }, [token]);

  useEffect(() => {
    const eventName = getAuthChangedEventName();
    const handler = (event) => {
      const nextAuth = event?.detail || readStoredAuth();
      if (!nextAuth?.token) {
        setToken((prev) => (prev === null ? prev : null));
        setUser((prev) => (prev === null ? prev : null));
        setScope((prev) =>
          prev?.companyId === 1 && prev?.branchId === 1
            ? prev
            : { companyId: 1, branchId: 1 },
        );
        return;
      }
      setToken((prev) => (prev === nextAuth.token ? prev : nextAuth.token));
      setUser((prev) =>
        prev === (nextAuth.user || null) ? prev : nextAuth.user || null,
      );
      setScope((prev) => {
        const nextScope = nextAuth.scope || { companyId: 1, branchId: 1 };
        return prev?.companyId === nextScope.companyId &&
          prev?.branchId === nextScope.branchId
          ? prev
          : nextScope;
      });
    };

    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      scope,
      initialized,
      setScope,
      login,
      logout,
      hasAccess: () => true, // RBAC disabled
      hasModuleAccess: () => true, // RBAC disabled
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
