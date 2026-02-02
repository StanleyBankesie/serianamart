import axios from "axios";

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

const isLocal =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);
const envBase =
  typeof import.meta !== "undefined" &&
  import.meta.env &&
  import.meta.env.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL
    : "";
api.defaults.baseURL =
  envBase || (isLocal ? "/api" : "https://serianaserver.omnisuite-erp.com/api");

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
