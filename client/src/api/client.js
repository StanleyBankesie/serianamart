import axios from "axios";
import {
  queueMutation,
  startSyncEngine,
  getQueueSnapshot,
} from "../offline/syncEngine.js";
import { putCache, getCache } from "../offline/cache.js";
import {
  clearStoredAuth,
  readStoredAuth,
  touchLastActivity,
  writeStoredAuth,
} from "../auth/authStorage.js";

export const api = axios.create({
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
  transformRequest: [
    (data, headers) => {
      if (data && typeof data === "object" && !(data instanceof FormData)) {
        return JSON.stringify(data);
      }
      return data;
    },
  ],
});

const isLocal =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);
const rawBase =
  typeof import.meta !== "undefined" &&
  import.meta.env &&
  import.meta.env.VITE_API_BASE_URL
    ? String(import.meta.env.VITE_API_BASE_URL).trim()
    : "";
let normalizedBase = rawBase;
if (normalizedBase) {
  if (!/^https?:\/\//i.test(normalizedBase)) {
    normalizedBase = normalizedBase.startsWith("/")
      ? normalizedBase
      : `/${normalizedBase}`;
  }
}
const host =
  typeof window !== "undefined" && window.location
    ? String(window.location.hostname || "")
    : "";
if (!normalizedBase) {
  if (/^serianamart\.omnisuite-erp\.com$/i.test(host)) {
    normalizedBase = "https://serianaserver.omnisuite-erp.com/api";
  }
}
api.defaults.baseURL = normalizedBase || "/api";

startSyncEngine();

let refreshPromise = null;

function normalizeUrl(url) {
  return String(url || "").trim();
}

function isUnauthenticatedEndpoint(url) {
  const value = normalizeUrl(url);
  return [
    "/register",
    "/login",
    "/auth/refresh",
    "/auth/logout",
    "/forgot-password/request-otp",
    "/forgot-password/reset",
  ].includes(value);
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;
  window.location.href = "/login";
}

async function requestTokenRefresh() {
  if (!refreshPromise) {
    refreshPromise = axios({
      baseURL: api.defaults.baseURL,
      url: "/auth/refresh",
      method: "post",
      withCredentials: true,
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => {
        const nextToken =
          response.data?.token || response.data?.accessToken || null;
        if (!nextToken) {
          throw new Error("Refresh endpoint did not return an access token");
        }

        const current = readStoredAuth() || {};
        writeStoredAuth({
          ...current,
          token: nextToken,
          user: response.data?.user || current.user || null,
        });
        setAuthToken(nextToken);
        touchLastActivity();
        return nextToken;
      })
      .catch((error) => {
        clearStoredAuth();
        setAuthToken(null);
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

api.interceptors.request.use(
  async (config) => {
    // Attach a cache key for GET requests
    const method = String(config.method || "get").toLowerCase();
    if (method === "get") {
      try {
        const base = api.defaults.baseURL || "";
        const url = new URL(
          config.url.startsWith("http") ? config.url : `${base}${config.url}`,
          window.location.origin,
        );
        if (config.params && typeof config.params === "object") {
          Object.entries(config.params).forEach(([k, v]) =>
            url.searchParams.set(k, String(v)),
          );
        }
        config.__cacheKey = `GET:${url.toString()}`;
      } catch {}
    }
    if (["post", "put", "patch", "delete"].includes(method)) {
      const skipOffline =
        config?.__skipOfflineQueue === true ||
        config?.headers?.["x-skip-offline-queue"] === "1" ||
        config?.headers?.["x-skip-offline-queue"] === 1 ||
        config?.headers?.["x-skip-offline-queue"] === true;
      if (!navigator.onLine && !skipOffline) {
        const queued = await queueMutation({
          method,
          url: config.url,
          data: config.data,
          headers: config.headers,
        });
        return Promise.reject({
          isOfflineQueued: true,
          queued,
          config,
          snapshot: getQueueSnapshot(),
        });
      }
    }
    if (method === "get" && !navigator.onLine && config.__cacheKey) {
      const cached = await getCache(config.__cacheKey);
      if (cached && cached.data) {
        return Promise.reject({
          isOfflineCached: true,
          cached: cached.data,
          config,
        });
      }
    }
    touchLastActivity();
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.request.use(
  (config) => {
    const token = readStoredAuth()?.token || null;
    if (token && !isUnauthenticatedEndpoint(config.url)) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => {
    // Cache GET responses for offline usage (skip for blob/non-JSON data)
    try {
      const method = String(response?.config?.method || "get").toLowerCase();
      const isBlob = response.data instanceof Blob;
      if (method === "get" && response?.config?.__cacheKey && !isBlob) {
        // Fire and forget - don't await caching, just attempt it
        putCache(response.config.__cacheKey, response.data || null).catch(
          (error) => {
            // Silently ignore caching errors - don't block response
            console.debug("Cache store error (non-critical):", error.message);
          },
        );
      }
    } catch (error) {
      // Silently ignore cache setup errors
      console.debug("Cache setup error (non-critical):", error.message);
    }
    if (response && typeof response === "object") {
      return response;
    }
    return {
      data: response,
      status: 200,
      statusText: "OK",
      headers: {},
      config: response?.config || {},
    };
  },
  (error) => {
    if (error && error.isOfflineQueued) {
      return Promise.resolve({
        data: {
          queued: true,
          offline: true,
          id: error.queued?.id,
          snapshot: error.snapshot,
        },
        status: 202,
        statusText: "Accepted (queued)",
        headers: {},
        config: error.config,
      });
    }
    if (error && error.isOfflineCached) {
      return Promise.resolve({
        data: error.cached,
        status: 200,
        statusText: "OK (cached)",
        headers: {},
        config: error.config,
      });
    }
    const originalRequest = error?.config || {};
    const requestUrl = normalizeUrl(originalRequest.url);
    const shouldTryRefresh =
      error?.response?.status === 401 &&
      !!originalRequest?.headers?.Authorization &&
      !originalRequest.__isRetryRequest &&
      !isUnauthenticatedEndpoint(requestUrl);

    if (shouldTryRefresh) {
      return requestTokenRefresh()
        .then((token) => {
          originalRequest.__isRetryRequest = true;
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch(() => {
          redirectToLogin();
          return Promise.reject({
            message: error.message,
            response: error.response,
            config: error.config,
            isAxiosError: true,
          });
        });
    }

    if (
      error.response?.status === 401 &&
      isUnauthenticatedEndpoint(requestUrl)
    ) {
      clearStoredAuth();
      setAuthToken(null);
    }

    return Promise.reject({
      message: error.message,
      response: error.response,
      config: error.config,
      isAxiosError: true,
    });
  },
);

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export function setScopeHeaders({ companyId, branchId }) {
  if (companyId)
    api.defaults.headers.common["x-company-id"] = String(companyId);
  if (branchId) api.defaults.headers.common["x-branch-id"] = String(branchId);
}

export function setUserHeader(user) {
  const candidate =
    user && typeof user.id !== "undefined"
      ? Number(user.id)
      : user && typeof user.sub !== "undefined"
        ? Number(user.sub)
        : null;
  if (candidate && Number.isFinite(candidate)) {
    api.defaults.headers.common["x-user-id"] = String(candidate);
  } else {
    delete api.defaults.headers.common["x-user-id"];
  }
}

export default api;
