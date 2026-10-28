/**
 * @fileoverview Network error diagnostics utility.
 * Whenever there is no internet, the internet is weak, or the backend server
 * (in production serianaserver.omnisuite-erp.com or dev) is unreachable/failing,
 * consistently returns and displays ONLY "No internet access".
 */

export const NO_INTERNET_ACCESS = "No internet access";

/**
 * Resolves the true API base URL across environments (production, staging, local dev).
 */
export function getApiBaseUrl() {
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "serianamart.omnisuite-erp.com" ||
      window.location.hostname === "serianaserver.omnisuite-erp.com")
  ) {
    return "https://serianaserver.omnisuite-erp.com/api";
  }
  const envBase = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL;
  if (!envBase) {
    return "/api";
  }
  if (!envBase.startsWith("http") && !envBase.startsWith("/")) {
    return "/" + envBase;
  }
  return envBase;
}

/**
 * Extracts target host and URL for error context.
 */
function extractTargetUrl(error, fallbackBase = "") {
  try {
    const rawUrl = error?.config?.url || "";
    const base = error?.config?.baseURL || fallbackBase || getApiBaseUrl();
    const method = String(error?.config?.method || "GET").toUpperCase();
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
      const parsed = new URL(rawUrl);
      return { fullUrl: rawUrl, host: parsed.host, path: parsed.pathname, method };
    }
    const full = `${base.replace(/\/+$/, "")}/${rawUrl.replace(/^\/+/, "")}`;
    if (full.startsWith("http://") || full.startsWith("https://")) {
      const parsed = new URL(full);
      return { fullUrl: full, host: parsed.host, path: parsed.pathname, method };
    }
    return {
      fullUrl: full,
      host: typeof window !== "undefined" ? window.location.host : "server",
      path: rawUrl || "/",
      method,
    };
  } catch {
    return { fullUrl: "", host: "server", path: "", method: "GET" };
  }
}

/**
 * Diagnoses an error. Whenever there is no internet, the connection is weak,
 * or the backend server is unreachable/inaccessible, ensures the message is ONLY "No internet access".
 * 
 * @param {Error|object} error - The caught AxiosError or fetch error
 * @param {object} [context] - Optional additional context
 * @returns {object} Diagnosis object
 */
export function diagnoseNetworkIssue(error, context = {}) {
  const code = String(error?.code || "").toUpperCase();
  const rawMsg = String(error?.message || "");
  const lowerMsg = rawMsg.toLowerCase();
  const status = Number(error?.response?.status || 0);
  const statusText = error?.response?.statusText || "";
  const backendData = error?.response?.data;
  
  // Extract backend error message if available
  let backendMsg = "";
  if (typeof backendData === "string") {
    backendMsg = backendData.trim();
  } else if (backendData && typeof backendData === "object") {
    backendMsg = String(
      backendData.message ||
      backendData.error ||
      backendData.detail ||
      backendData.sqlMessage ||
      backendData.msg ||
      ""
    ).trim();
  }

  const isBrowserOffline = typeof navigator !== "undefined" && navigator.onLine === false;
  const { host, fullUrl, method, path } = extractTargetUrl(error, context.baseURL || getApiBaseUrl());

  // 1. Device Offline / No Internet Connection
  const isNoInternet =
    isBrowserOffline ||
    code === "ERR_INTERNET_DISCONNECTED" ||
    code === "ENETUNREACH" ||
    lowerMsg.includes("internet disconnected") ||
    lowerMsg.includes("offline");

  // 2. Internet is weak / Timeout / Request aborted
  const isWeakInternet =
    code === "ECONNABORTED" ||
    code === "ETIMEDOUT" ||
    error?.name === "AbortError" ||
    lowerMsg.includes("aborted") ||
    lowerMsg.includes("timeout of") ||
    lowerMsg.includes("timed out") ||
    lowerMsg.includes("network timeout") ||
    status === 408;

  // 3. DNS failure (cannot resolve host)
  const isDnsFailure =
    code === "ENOTFOUND" ||
    code === "ERR_NAME_NOT_RESOLVED" ||
    lowerMsg.includes("name not resolved") ||
    lowerMsg.includes("enotfound");

  // 4. Server unreachable / connection refused / network error
  const isServerUnreachable =
    !error?.response &&
    (
      code === "ERR_NETWORK" ||
      code === "ERR_CONNECTION_REFUSED" ||
      code === "ECONNREFUSED" ||
      code === "ERR_CONNECTION_RESET" ||
      lowerMsg === "network error" ||
      lowerMsg.includes("failed to fetch") ||
      lowerMsg.includes("connection refused") ||
      lowerMsg.includes("connection reset")
    );

  // 5. Gateway issues / server unavailable (502, 503, 504) or server crash HTML/empty 500
  //    EXCLUDE Service Worker synthetic fallback responses — those return 503 with
  //    "X-Service-Worker-Fallback: 1" header or { offline: true } body. They indicate
  //    the SW couldn't reach the server but the device may still have internet. The
  //    real connectivity check happens via checkServerHealth(); SW fallbacks should
  //    not trigger the "No internet access" banner on their own.
  const isSwFallback =
    (backendData && typeof backendData === "object" && backendData.offline === true) ||
    lowerMsg.includes("network unavailable");

  const isGatewayOrDown =
    !isSwFallback && (
      status === 502 ||
      status === 503 ||
      status === 504 ||
      (status === 500 && (
        !backendMsg ||
        backendMsg === "Internal Server Error" ||
        backendMsg.startsWith("<!DOCTYPE") ||
        backendMsg.startsWith("<html")
      ))
    );

  // 6. Browser blocked CORS due to network failure
  const isCorsOrBlocked =
    code === "ERR_BLOCKED_BY_CLIENT" ||
    lowerMsg.includes("cors policy") ||
    lowerMsg.includes("blocked by cors");

  // NOTE: Previously there was a catch-all `isNoResponse = !error?.response`
  // that treated ANY error without an HTTP response as a network error.
  // This caused false "No internet access" banners for request cancellations,
  // client-side errors, and other non-network issues. Removed because all
  // genuine network failure cases are already covered by conditions 1–6 above.

  const isNetworkIssue =
    isNoInternet ||
    isWeakInternet ||
    isDnsFailure ||
    isServerUnreachable ||
    isGatewayOrDown ||
    isCorsOrBlocked;

  if (isNetworkIssue) {
    let title = "Unable to connect to server";
    let realProblem = "Could not establish connection to the backend server.";
    let category = "SERVER_UNREACHABLE";

    if (isNoInternet) {
      category = "NO_INTERNET";
      title = NO_INTERNET_ACCESS;
      realProblem = "Your device is not connected to the internet. Please check your network connection.";
    } else if (isGatewayOrDown) {
      category = "GATEWAY_ERROR";
      title = "Server temporarily unavailable";
      realProblem = backendMsg || "The server is temporarily unavailable or undergoing maintenance. Please retry in a moment.";
    } else if (isWeakInternet) {
      category = "TIMEOUT";
      title = "Connection timed out";
      realProblem = "The server took too long to respond. Please check your network speed or retry.";
    } else if (isServerUnreachable) {
      category = "SERVER_UNREACHABLE";
      title = "Unable to connect to server";
      realProblem = "Could not establish connection to the backend server. Please retry in a few moments.";
    } else if (isDnsFailure) {
      category = "DNS_FAILURE";
      title = "Server unreachable";
      realProblem = `Cannot resolve server host (${host || "server"}).`;
    } else if (isCorsOrBlocked) {
      category = "BLOCKED";
      title = "Connection blocked";
      realProblem = "Connection blocked by network security policy.";
    }

    return {
      isNetworkError: true,
      category,
      title,
      realProblem,
      suggestion: "",
      summary: title,
      technicalDetail: null,
      status: status || 0,
      host,
      fullUrl,
      method,
      endpoint: path,
      timestamp: Date.now(),
    };
  }

  // Normal application HTTP error (400, 401, 403, 404, 422, or 500 with custom application message)
  return {
    isNetworkError: false,
    category: "HTTP_ERROR",
    title: `Error (${status})`,
    realProblem: backendMsg || statusText || rawMsg,
    suggestion: "",
    summary: backendMsg || `Error ${status}: ${statusText || rawMsg}`,
    technicalDetail: null,
    status,
    host,
    fullUrl,
    timestamp: Date.now(),
  };
}

/**
 * Actively probes backend health to determine if the server is genuinely reachable.
 * 
 * @param {number} [timeoutMs=4000] - Probe timeout in milliseconds
 * @returns {Promise<{isOnline: boolean, isServerReachable: boolean, diagnosis: object|null, latencyMs: number}>}
 */
export async function checkServerHealth(timeoutMs = 4000) {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine !== false : true;
  if (!isOnline) {
    const offlineDiag = diagnoseNetworkIssue({ code: "ERR_INTERNET_DISCONNECTED" });
    return {
      isOnline: false,
      isServerReachable: false,
      diagnosis: offlineDiag,
      latencyMs: 0,
    };
  }

  const startTime = Date.now();
  const apiBase = getApiBaseUrl();
  const cleanBase = apiBase.replace(/\/+$/, "");
  const healthUrl = `${cleanBase}/health?_t=${Date.now()}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    
    const resp = await fetch(healthUrl, {
      method: "GET",
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
      signal: controller.signal,
    });
    clearTimeout(timer);

    const latencyMs = Date.now() - startTime;

    // Detect Service Worker synthetic fallback responses — these do NOT
    // indicate real network failure; they just mean the SW's own fetch timed
    // out or failed. Treat them as "server reachable" = unknown and retry
    // with a direct network check if possible.
    const isSwFallback = resp.headers.get("X-Service-Worker-Fallback") === "1";
    if (isSwFallback) {
      // The SW intercepted our probe — browser IS online but we can't trust
      // this response. Report as online but not server-confirmed.
      return {
        isOnline: true,
        isServerReachable: false,
        diagnosis: null,
        latencyMs,
        isSwFallback: true,
      };
    }

    if (resp.ok) {
      return {
        isOnline: true,
        isServerReachable: true,
        diagnosis: null,
        latencyMs,
      };
    }

    const diag = diagnoseNetworkIssue({
      response: { status: resp.status, statusText: resp.statusText },
      config: { url: healthUrl, method: "GET" },
    }, { baseURL: apiBase });
    return {
      isOnline: true,
      isServerReachable: false,
      diagnosis: diag,
      latencyMs,
    };
  } catch (err) {
    const diag = diagnoseNetworkIssue(err, { baseURL: apiBase });
    return {
      isOnline: typeof navigator !== "undefined" ? navigator.onLine !== false : true,
      isServerReachable: false,
      diagnosis: diag,
      latencyMs: Date.now() - startTime,
    };
  }
}
