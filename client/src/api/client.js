/**
 * @fileoverview Axios API client configuration.
 * Sets up base URL, interceptors, and handles token refresh logic.
 */

import axios from "axios";
import { queueMutation, getQueueSnapshot } from "../offline/syncEngine.js";
import { putCache, getCache } from "../offline/cache.js";
import {
  clearStoredAuth,
  isTokenExpired,
  readStoredAuth,
  touchLastActivity,
  writeStoredAuth,
} from "../auth/authStorage.js";

const AXIOS_TIMEOUT_MS = 30000;

/**
 * Core Axios instance for making authenticated requests to the backend API.
 * Includes credentials by default and automatically normalizes JSON payloads.
 */
export const api = axios.create({
  withCredentials: true,
  timeout: AXIOS_TIMEOUT_MS,
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

let API_BASE = import.meta.env.VITE_API_BASE_URL;
if (typeof window !== "undefined" && window.location.hostname.includes("serianamart.omnisuite-erp.com")) {
  API_BASE = "https://serianaserver.omnisuite-erp.com/api";
} else if (!API_BASE) {
  API_BASE = "/api";
}
api.defaults.baseURL = API_BASE;

let _syncStarted = false;
function ensureSyncEngine() {
  if (_syncStarted) return;
  _syncStarted = true;
  import("../offline/syncEngine.js").then(({ startSyncEngine }) =>
    startSyncEngine(),
  );
}

/* ── Token refresh state ─────────────────────────────────────── */

let refreshPromise = null;
let refreshErrorCount = 0;
const MAX_REFRESH_ERRORS = 3;
let refreshLastErrorTime = 0;
const REFRESH_COOLDOWN_MS = 60000;

function normalizeUrl(url) {
  return String(url || "").trim();
}

function isUnauthenticatedEndpoint(url) {
  const value = normalizeUrl(url);
  return [
    "/register",
    "/login",
    "/auth/logout",
    "/auth/refresh",
    "/forgot-password/request-otp",
    "/forgot-password/reset",
  ].includes(value);
}

async function requestTokenRefresh() {
  // If too many consecutive refresh failures and we're still within the
  // cooldown window, reject immediately — do not hammer the server.
  if (refreshErrorCount >= MAX_REFRESH_ERRORS) {
    const elapsed = Date.now() - refreshLastErrorTime;
    if (elapsed < REFRESH_COOLDOWN_MS) {
      console.warn(
        `[auth] refresh skipped — ${refreshErrorCount} consecutive errors, cooling down for ${Math.round((REFRESH_COOLDOWN_MS - elapsed) / 1000)}s`,
      );
      return Promise.reject(new Error("Refresh on cooldown — too many failures"));
    }
    refreshErrorCount = 0;
  }

  if (!refreshPromise) {
    refreshPromise = axios({
      baseURL: api.defaults.baseURL,
      url: "/auth/refresh",
      method: "post",
      withCredentials: true,
      timeout: AXIOS_TIMEOUT_MS,
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => {
        refreshErrorCount = 0;
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
        console.debug("[auth] token refreshed successfully");
        return nextToken;
      })
      .catch((error) => {
        const isHardAuthFailure = error?.response?.status === 401;
        if (isHardAuthFailure) {
          refreshErrorCount += 1;
          refreshLastErrorTime = Date.now();
          clearStoredAuth();
          setAuthToken(null);
        }
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

api.interceptors.request.use(
  (config) => {
    if (!config.baseURL) {
      config.baseURL = api.defaults.baseURL;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.request.use(
  async (config) => {
    if (!config.baseURL) {
      config.baseURL = api.defaults.baseURL;
    }
    if (config.url && !isUnauthenticatedEndpoint(config.url)) {
      const stored = readStoredAuth();
      const token = stored?.token || null;
      if (token && isTokenExpired(token)) {
        try {
          await requestTokenRefresh();
        } catch (err) {
          console.debug("[auth] pre-request refresh failed, continuing with existing token", err?.response?.status || err?.message);
        }
      }
    }

    const freshToken = readStoredAuth()?.token || null;
    if (freshToken) {
      ensureSyncEngine();
      if (config.url && !isUnauthenticatedEndpoint(config.url)) {
        config.headers.Authorization = `Bearer ${freshToken}`;
      }
    }

    // Attach a cache key for GET requests
    const method = String(config.method || "get").toLowerCase();
    if (method === "get") {
      try {
        const base = api.defaults.baseURL;
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
      if (typeof navigator !== "undefined" && !navigator.onLine && !skipOffline) {
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
    if (method === "get" && typeof navigator !== "undefined" && !navigator.onLine && config.__cacheKey) {
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
      const retryCount = originalRequest.__retryCount || 0;
      if (retryCount >= 1) {
        console.warn(`[auth] 401 loop detected for ${requestUrl}, not retrying`);
        return Promise.reject({
          message: "Too many 401 retries",
          response: error.response,
          config: error.config,
          isAxiosError: true,
        });
      }

      return requestTokenRefresh()
        .then((token) => {
          originalRequest.__retryCount = retryCount + 1;
          originalRequest.__isRetryRequest = true;
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch((err) => {
          if (err?.response?.status === 401) {
            // The refresh endpoint itself returned 401 — the refresh token is
            // expired or invalid. Signal the app to log out.
            console.error("[auth] refresh token expired or invalid — redirecting to login");
            if (typeof window !== "undefined" && window.location.pathname !== "/login") {
              window.dispatchEvent(new CustomEvent("omnisuite:auth-expired"));
            }
          } else {
            console.debug("[auth] refresh failed (transient), original request not retried", err?.message);
          }
          return Promise.reject({
            message: error.message,
            response: error.response,
            config: error.config,
            isAxiosError: true,
          });
        });
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

/** Coalesce duplicate in-flight GET requests to reduce concurrent server load */
const inflightGets = new Map();
const MAX_CONCURRENT_GETS = Math.max(
  1,
  Number(import.meta.env.VITE_MAX_CONCURRENT_GETS || 4),
);
const GET_RETRY_LIMIT = Math.max(
  0,
  Number(import.meta.env.VITE_GET_RETRY_LIMIT || 2),
);
const queuedGets = [];
let activeGetCount = 0;

const _origRequest = api.request.bind(api);

function dequeueNextGet() {
  if (activeGetCount >= MAX_CONCURRENT_GETS) return;
  const next = queuedGets.shift();
  if (typeof next === "function") next();
}

function enqueueGet(work) {
  return new Promise((resolve, reject) => {
    const run = () => {
      activeGetCount += 1;
      Promise.resolve()
        .then(work)
        .then(resolve, reject)
        .finally(() => {
          activeGetCount = Math.max(0, activeGetCount - 1);
          dequeueNextGet();
        });
    };

    if (activeGetCount < MAX_CONCURRENT_GETS) {
      run();
      return;
    }

    queuedGets.push(run);
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryGet(error, attempt) {
  if (attempt >= GET_RETRY_LIMIT) return false;
  if (error?.response) return false;
  if (error?.config?.__skipNetworkRetry === true) return false;
  return true;
}

async function runGetRequest(url, config) {
  let attempt = 0;
  while (true) {
    try {
      return await enqueueGet(() =>
        _origRequest({ method: "get", url, ...config }),
      );
    } catch (error) {
      if (!shouldRetryGet(error, attempt)) {
        throw error;
      }
      attempt += 1;
      await delay(250 * attempt);
    }
  }
}

api.get = function (url, config) {
  try {
    const base = api.defaults.baseURL;
    const fullUrl = new URL(
      url.startsWith("http") ? url : `${base}${url}`,
      window.location.origin,
    );
    const params = config?.params || {};
    Object.entries(params).forEach(([k, v]) =>
      fullUrl.searchParams.set(k, String(v)),
    );
    const cacheKey = `GET:${fullUrl.toString()}`;

    const existing = inflightGets.get(cacheKey);
    if (existing) {
      return existing;
    }

    const promise = runGetRequest(url, config);
    inflightGets.set(cacheKey, promise);
    promise.finally(() => {
      setTimeout(() => inflightGets.delete(cacheKey), 200);
    });
    return promise;
  } catch {
    return _origRequest({ method: "get", url, ...config });
  }
};

api.request = function (config) {
  const method = String(config?.method || "get").toLowerCase();
  if (method === "get") {
    return api.get(config.url, { ...config, method: undefined });
  }
  return _origRequest(config);
};

export default api;
