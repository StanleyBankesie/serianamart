/**
 * @fileoverview Network error diagnostics and real-problem identification utility.
 * Diagnoses whether network failures are due to no internet, server unreachable,
 * timeouts, DNS failures, gateway issues (502/503/504), or internal server errors (500),
 * providing clear user-facing explanations of the real problem and actionable guidance.
 */

/**
 * Extracts target host and URL for clear error descriptions.
 */
function extractTargetUrl(error, fallbackBase = "") {
  try {
    const rawUrl = error?.config?.url || "";
    const base = error?.config?.baseURL || fallbackBase || (typeof window !== "undefined" ? window.location.origin : "");
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
      const parsed = new URL(rawUrl);
      return { fullUrl: rawUrl, host: parsed.host, path: parsed.pathname };
    }
    const full = `${base.replace(/\/+$/, "")}/${rawUrl.replace(/^\/+/, "")}`;
    if (full.startsWith("http://") || full.startsWith("https://")) {
      const parsed = new URL(full);
      return { fullUrl: full, host: parsed.host, path: parsed.pathname };
    }
    return {
      fullUrl: full,
      host: typeof window !== "undefined" ? window.location.host : "server",
      path: rawUrl || "/",
    };
  } catch {
    return { fullUrl: "", host: "server", path: "" };
  }
}

/**
 * Accurately diagnoses a network error or response error to identify the real underlying problem.
 * 
 * @param {Error|object} error - The caught AxiosError or fetch error
 * @param {object} [context] - Optional additional context
 * @returns {object} Diagnosis object containing category, title, realProblem, suggestion, and summary
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
  const { host, fullUrl } = extractTargetUrl(error, context.baseURL);

  // 1. NO INTERNET CONNECTION (Device Offline)
  if (
    isBrowserOffline ||
    code === "ERR_INTERNET_DISCONNECTED" ||
    code === "ENETUNREACH" ||
    lowerMsg.includes("internet disconnected") ||
    lowerMsg.includes("offline")
  ) {
    return {
      isNetworkError: true,
      category: "NO_INTERNET",
      title: "Network Error: No Internet Connection",
      realProblem: "Your device is not connected to the internet. Wi-Fi, Ethernet, or mobile data is disconnected or unavailable.",
      suggestion: "Please check your network cables, reconnect your Wi-Fi, or enable mobile data.",
      summary: "Network Error: No Internet Connection. Your device is offline. Please check your network connection.",
      technicalDetail: `navigator.onLine=false, code=${code || "OFFLINE"}`,
      status: 0,
      host,
      fullUrl,
      timestamp: Date.now(),
    };
  }

  // 2. TIMEOUT (Server took too long to respond)
  const isTimeout =
    code === "ECONNABORTED" ||
    code === "ETIMEDOUT" ||
    lowerMsg.includes("timeout of") ||
    lowerMsg.includes("timed out") ||
    lowerMsg.includes("network timeout") ||
    status === 408;

  if (isTimeout) {
    const timeoutMatch = rawMsg.match(/timeout of (\d+)ms/i);
    const timeoutSec = timeoutMatch ? Math.round(Number(timeoutMatch[1]) / 1000) : (error?.config?.timeout ? Math.round(error.config.timeout / 1000) : 45);
    return {
      isNetworkError: true,
      category: "TIMEOUT",
      title: "Network Error: Request Timed Out",
      realProblem: `The server took longer than ${timeoutSec} seconds to respond. The server may be experiencing high load or your connection has high latency.`,
      suggestion: "Please check your network speed or try again in a few moments.",
      summary: `Network Error: Request Timed Out. The server did not respond within ${timeoutSec}s. The server may be overloaded or connection is slow.`,
      technicalDetail: `code=${code || "TIMEOUT"}, duration>${timeoutSec}s`,
      status: status || 408,
      host,
      fullUrl,
      timestamp: Date.now(),
    };
  }

  // 3. DNS FAILURE (Unable to resolve server domain)
  if (
    code === "ENOTFOUND" ||
    code === "ERR_NAME_NOT_RESOLVED" ||
    lowerMsg.includes("name not resolved") ||
    lowerMsg.includes("enotfound")
  ) {
    return {
      isNetworkError: true,
      category: "DNS_FAILURE",
      title: "Network Error: Domain Resolution Failed",
      realProblem: `Unable to find the server address '${host}'. The domain name could not be resolved by your DNS server.`,
      suggestion: "Please verify your DNS settings, proxy, or server domain name.",
      summary: `Network Error: DNS Resolution Failed. Unable to locate server address '${host}'. Check your DNS or internet settings.`,
      technicalDetail: `code=${code || "ENOTFOUND"}, host=${host}`,
      status: 0,
      host,
      fullUrl,
      timestamp: Date.now(),
    };
  }

  // 4. SERVER UNREACHABLE / CONNECTION REFUSED (Device has internet, but backend is unreachable)
  const isServerUnreachable =
    !error?.response && (
      code === "ERR_NETWORK" ||
      code === "ERR_CONNECTION_REFUSED" ||
      code === "ECONNREFUSED" ||
      code === "ERR_CONNECTION_RESET" ||
      lowerMsg === "network error" ||
      lowerMsg.includes("failed to fetch") ||
      lowerMsg.includes("connection refused")
    );

  if (isServerUnreachable) {
    const targetDesc = host && host !== "server" ? `at ${host}` : "";
    return {
      isNetworkError: true,
      category: "SERVER_UNREACHABLE",
      title: "Network Error: Server Unreachable",
      realProblem: `Cannot establish a connection to the application server ${targetDesc}. The server may be down, undergoing maintenance, or blocked by a firewall.`,
      suggestion: "Please verify that the backend server is running and accessible on your network.",
      summary: `Network Error: Server Unreachable. Cannot connect to the server ${targetDesc}. The backend server may be offline, stopped, or blocked by a firewall.`,
      technicalDetail: `code=${code || "ERR_NETWORK"}, online=true, target=${fullUrl || host}`,
      status: 0,
      host,
      fullUrl,
      timestamp: Date.now(),
    };
  }

  // 5. 502 BAD GATEWAY
  if (status === 502) {
    return {
      isNetworkError: true,
      category: "BAD_GATEWAY",
      title: "Network Error: Bad Gateway (502)",
      realProblem: "The web gateway or reverse proxy received an invalid response or could not connect to the upstream backend application server.",
      suggestion: "The backend server process may have stopped or is restarting. Please wait a moment and try again.",
      summary: "Network Error: Bad Gateway (502). The proxy cannot connect to the backend application server.",
      technicalDetail: `status=502 ${statusText}`,
      status: 502,
      host,
      fullUrl,
      timestamp: Date.now(),
    };
  }

  // 6. 503 SERVICE UNAVAILABLE
  if (status === 503) {
    return {
      isNetworkError: true,
      category: "SERVICE_UNAVAILABLE",
      title: "Network Error: Service Unavailable (503)",
      realProblem: backendMsg || "The server is temporarily unavailable, overloaded, or down for maintenance.",
      suggestion: "Please wait a moment and refresh, or contact the system administrator.",
      summary: `Network Error: Service Unavailable (503). ${backendMsg || "The server is temporarily overloaded or undergoing maintenance."}`,
      technicalDetail: `status=503 ${statusText}`,
      status: 503,
      host,
      fullUrl,
      timestamp: Date.now(),
    };
  }

  // 7. 504 GATEWAY TIMEOUT
  if (status === 504) {
    return {
      isNetworkError: true,
      category: "GATEWAY_TIMEOUT",
      title: "Network Error: Gateway Timeout (504)",
      realProblem: "The reverse proxy timed out waiting for the upstream application server to process the request.",
      suggestion: "The server operation took too long. Try again or check server resources.",
      summary: "Network Error: Gateway Timeout (504). The server took too long to complete the request.",
      technicalDetail: `status=504 ${statusText}`,
      status: 504,
      host,
      fullUrl,
      timestamp: Date.now(),
    };
  }

  // 8. 500 INTERNAL SERVER ERROR
  if (status === 500) {
    const detailMsg = backendMsg ? `Server Error: ${backendMsg}` : "An unhandled error occurred on the server.";
    return {
      isNetworkError: true,
      category: "SERVER_ERROR",
      title: "Network Error: Internal Server Error (500)",
      realProblem: detailMsg,
      suggestion: "Review server logs or retry the operation with valid input.",
      summary: `Network Error: Internal Server Error (500). ${detailMsg}`,
      technicalDetail: `status=500 ${statusText}, backendMsg=${backendMsg}`,
      status: 500,
      host,
      fullUrl,
      timestamp: Date.now(),
    };
  }

  // 9. CORS OR SECURITY POLICY BLOCK
  if (
    code === "ERR_BLOCKED_BY_CLIENT" ||
    lowerMsg.includes("cors policy") ||
    lowerMsg.includes("blocked by cors")
  ) {
    return {
      isNetworkError: true,
      category: "CORS_OR_SECURITY",
      title: "Network Error: Request Blocked",
      realProblem: "The request was blocked by browser security (CORS policy, Mixed Content, or an ad blocker).",
      suggestion: "Verify server CORS configuration and ensure no browser extension is blocking requests.",
      summary: "Network Error: Request Blocked by browser security or CORS policy.",
      technicalDetail: `code=${code}, message=${rawMsg}`,
      status: 0,
      host,
      fullUrl,
      timestamp: Date.now(),
    };
  }

  // 10. OTHER GENERIC NETWORK ERROR
  if (!error?.response) {
    return {
      isNetworkError: true,
      category: "UNKNOWN_NETWORK_ERROR",
      title: "Network Error",
      realProblem: rawMsg || "A network communication error occurred while connecting to the server.",
      suggestion: "Please check your network connection and try again.",
      summary: `Network Error: ${rawMsg || "Connection failed. Please check your network connection."}`,
      technicalDetail: `code=${code || "UNKNOWN"}, message=${rawMsg}`,
      status: 0,
      host,
      fullUrl,
      timestamp: Date.now(),
    };
  }

  // Default non-network HTTP error (400, 404, 422, etc.)
  return {
    isNetworkError: false,
    category: "HTTP_ERROR",
    title: `Error (${status})`,
    realProblem: backendMsg || statusText || rawMsg,
    suggestion: "Please verify your input and try again.",
    summary: backendMsg || `Error ${status}: ${statusText || rawMsg}`,
    technicalDetail: `status=${status} ${statusText}`,
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
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const healthUrl = `/api/health?_t=${Date.now()}`;
    
    const resp = await fetch(healthUrl, {
      method: "GET",
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
      signal: controller.signal,
    });
    clearTimeout(timer);

    const latencyMs = Date.now() - startTime;
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
      config: { url: healthUrl },
    });
    return {
      isOnline: true,
      isServerReachable: false,
      diagnosis: diag,
      latencyMs,
    };
  } catch (err) {
    const diag = diagnoseNetworkIssue(err, { baseURL: "/api" });
    return {
      isOnline: typeof navigator !== "undefined" ? navigator.onLine !== false : true,
      isServerReachable: false,
      diagnosis: diag,
      latencyMs: Date.now() - startTime,
    };
  }
}
