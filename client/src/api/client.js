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

const API_BASE = import.meta.env.VITE_API_BASE_URL || (
  typeof window !== "undefined" &&
  /^serianamart\.omnisuite-erp\.com$/i.test(window.location.hostname)
    ? "https://serianaserver.omnisuite-erp.com/api"
    : "/api"
);
api.defaults.baseURL = API_BASE;

let _syncStarted = false;
function ensureSyncEngine() {
  if (_syncStarted) return;
  _syncStarted = true;
  import("../offline/syncEngine.js").then(({ startSyncEngine }) =>
    startSyncEngine(),
  );
}

let refreshPromise = null;

function waitForFreshStoredToken(previousToken, timeoutMs = 1200) {
  if (typeof window === "undefined") return Promise.resolve(null);

  const readFreshToken = () => {
    const nextToken = readStoredAuth()?.token || null;
    if (
      nextToken &&
      nextToken !== previousToken &&
      !isTokenExpired(nextToken)
    ) {
      return nextToken;
    }
    return null;
  };

  const immediate = readFreshToken();
  if (immediate) return Promise.resolve(immediate);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (token = null) => {
      if (settled) return;
      settled = true;
      try {
        window.removeEventListener("omnisuite:auth-changed", onAuthChanged);
      } catch {}
      window.clearTimeout(timer);
      resolve(token);
    };

    const onAuthChanged = () => {
      const fresh = readFreshToken();
      if (fresh) finish(fresh);
    };

    const timer = window.setTimeout(() => {
      finish(readFreshToken());
    }, timeoutMs);

    try {
      window.addEventListener("omnisuite:auth-changed", onAuthChanged);
    } catch {
      finish(null);
    }
  });
}

function normalizeUrl(url) {
  return String(url || "").trim();
}

function isUnauthenticatedEndpoint(url) {
  const value = normalizeUrl(url);
  return [
    "/register",
    "/login",
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
    const tokenBeforeRefresh = readStoredAuth()?.token || null;
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
      .catch(async (error) => {
        const freshToken = await waitForFreshStoredToken(tokenBeforeRefresh);
        if (freshToken) {
          setAuthToken(freshToken);
          touchLastActivity();
          return freshToken;
        }
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
    if (!config.baseURL) {
      config.baseURL = api.defaults.baseURL;
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
    if (!config.baseURL) {
      config.baseURL = api.defaults.baseURL;
    }
    const token = readStoredAuth()?.token || null;
    if (token) ensureSyncEngine();
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
