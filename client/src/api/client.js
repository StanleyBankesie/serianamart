import axios from "axios";
import {
  queueMutation,
  startSyncEngine,
  getQueueSnapshot,
} from "../offline/syncEngine.js";

export const api = axios.create({
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

const origin =
  typeof window !== "undefined" && window.location
    ? window.location.origin
    : "";
const runtimeOverride =
  typeof window !== "undefined"
    ? window.__OMNI_API_BASE__ || localStorage.getItem("omni.apiBase") || ""
    : "";
const envBase =
  typeof import.meta !== "undefined" &&
  import.meta.env &&
  import.meta.env.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL
    : "";
api.defaults.baseURL =
  runtimeOverride || envBase || (origin ? origin + "/api" : "/api");

startSyncEngine();

api.interceptors.request.use(
  async (config) => {
    const method = String(config.method || "get").toLowerCase();
    if (["post", "put", "patch", "delete"].includes(method)) {
      if (!navigator.onLine) {
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
    return config;
  },
  (error) => Promise.reject(error),
);

// api.interceptors.request.use(
//   (config) => {
//     const token = localStorage.getItem("token");
//     if (token && config.url !== "/register") {
//       config.headers.Authorization = `Bearer ${token}`;
//     }
//     return config;
//   },
//   (error) => Promise.reject(error),
// );

api.interceptors.response.use(
  (response) => {
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
    if (
      error.response?.status === 401 &&
      error.config?.headers?.Authorization
    ) {
      localStorage.clear();
      window.location.href = "/login";
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
