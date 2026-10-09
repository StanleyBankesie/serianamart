/**
 * @fileoverview NetworkStatusBanner component.
 * Displays a persistent, user-friendly network status banner across the entire application
 * whenever internet connectivity is lost, the server is unreachable, or a network error occurs.
 * Clearly diagnoses and displays the real underlying problem with a "Retry Connection" action.
 */

import React, { useState, useEffect, useCallback } from "react";
import { checkServerHealth, diagnoseNetworkIssue } from "../utils/networkErrorDiagnostics.js";

export default function NetworkStatusBanner() {
  const [networkState, setNetworkState] = useState(() => {
    const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
    if (isOffline) {
      return {
        hasError: true,
        category: "NO_INTERNET",
        title: "Network Error: No Internet Connection",
        realProblem: "Your device is not connected to the internet. Wi-Fi, Ethernet, or mobile data is turned off or disconnected.",
        suggestion: "Please check your network cables or Wi-Fi connection.",
        isRestored: false,
      };
    }
    return {
      hasError: false,
      isRestored: false,
    };
  });

  const [isChecking, setIsChecking] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Manual retry handler
  const handleRetry = useCallback(async () => {
    setIsChecking(true);
    try {
      const health = await checkServerHealth(4000);
      if (health.isServerReachable && health.isOnline) {
        setNetworkState({
          hasError: false,
          isRestored: true,
          title: "Connection Restored",
          realProblem: "Successfully connected back to the server.",
          technicalDetail: null,
        });
        setDismissed(false);
        setTimeout(() => {
          setNetworkState((prev) => (prev.isRestored ? { hasError: false, isRestored: false } : prev));
        }, 3500);
      } else {
        const diag = health.diagnosis || diagnoseNetworkIssue({ code: "ERR_NETWORK" });
        setNetworkState({
          hasError: true,
          category: diag.category,
          title: diag.title,
          realProblem: diag.realProblem,
          technicalDetail: diag.technicalDetail,
          suggestion: diag.suggestion,
          isRestored: false,
        });
        setDismissed(false);
      }
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    // 1. Browser online event
    function handleBrowserOnline() {
      // Re-check if server is actually reachable now that network adapter is active
      checkServerHealth(4000).then((health) => {
        if (health.isServerReachable) {
          setNetworkState({
            hasError: false,
            isRestored: true,
            title: "Connection Restored",
            realProblem: "Internet connection has been re-established and the server is reachable.",
            technicalDetail: null,
          });
          setDismissed(false);
          setTimeout(() => {
            setNetworkState((prev) => (prev.isRestored ? { hasError: false, isRestored: false } : prev));
          }, 3500);
        } else {
          const diag = health.diagnosis || diagnoseNetworkIssue({ code: "ERR_NETWORK" });
          setNetworkState({
            hasError: true,
            category: diag.category,
            title: diag.title,
            realProblem: diag.realProblem,
            technicalDetail: diag.technicalDetail,
            suggestion: diag.suggestion,
            isRestored: false,
          });
          setDismissed(false);
        }
      });
    }

    // 2. Browser offline event
    function handleBrowserOffline() {
      setNetworkState({
        hasError: true,
        category: "NO_INTERNET",
        title: "Network Error: No Internet Connection",
        realProblem: "Your device is not connected to the internet. Wi-Fi, Ethernet, or mobile data is turned off or disconnected.",
        technicalDetail: "navigator.onLine=false",
        suggestion: "Please check your network cables or Wi-Fi connection.",
        isRestored: false,
      });
      setDismissed(false);
    }

    // 3. Custom API network error event dispatched by Axios client
    function handleApiNetworkError(e) {
      const diag = e?.detail;
      if (!diag || !diag.isNetworkError) return;
      
      setNetworkState({
        hasError: true,
        category: diag.category,
        title: diag.title,
        realProblem: diag.realProblem,
        technicalDetail: diag.technicalDetail,
        suggestion: diag.suggestion,
        isRestored: false,
      });
      setDismissed(false);
    }

    window.addEventListener("online", handleBrowserOnline);
    window.addEventListener("offline", handleBrowserOffline);
    window.addEventListener("omnisuite:network-error", handleApiNetworkError);

    return () => {
      window.removeEventListener("online", handleBrowserOnline);
      window.removeEventListener("offline", handleBrowserOffline);
      window.removeEventListener("omnisuite:network-error", handleApiNetworkError);
    };
  }, []);

  if (dismissed || (!networkState.hasError && !networkState.isRestored)) {
    return null;
  }

  // Restored Banner (Green)
  if (networkState.isRestored) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-0 left-0 right-0 z-[99999] bg-emerald-600 text-white px-4 py-2.5 shadow-md flex items-center justify-between transition-all duration-300"
      >
        <div className="flex items-center gap-2.5 max-w-5xl mx-auto w-full">
          <span className="text-xl leading-none">✅</span>
          <div className="flex-1 text-sm font-medium">
            <span className="font-bold mr-1">Connection Restored:</span>
            <span>{networkState.realProblem}</span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-white/80 hover:text-white text-lg px-2 rounded hover:bg-emerald-700/50"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  // Active Network Error Banner (Red / Amber)
  const isNoInternet = networkState.category === "NO_INTERNET";
  const bgColor = isNoInternet ? "bg-amber-600" : "bg-rose-700";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed top-0 left-0 right-0 z-[99999] ${bgColor} text-white px-4 py-3 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all duration-300`}
    >
      <div className="flex items-start gap-3 max-w-6xl mx-auto w-full">
        <span className="text-2xl leading-none mt-0.5">
          {isNoInternet ? "📡" : "⚠️"}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold tracking-wide uppercase">
              {networkState.title || "Network Error"}
            </h3>
            <span className="text-xs bg-black/25 px-2 py-0.5 rounded font-mono font-medium">
              {networkState.category || "NETWORK_ISSUE"}
            </span>
          </div>
          <p className="text-sm text-white/95 mt-0.5 font-medium leading-snug">
            <span className="font-bold underline decoration-white/40 mr-1">Real Problem:</span>
            {networkState.realProblem}
          </p>
          {networkState.technicalDetail && (
            <p className="text-xs font-mono text-white/85 mt-1 bg-black/20 px-2 py-0.5 rounded inline-block break-all">
              <span className="opacity-70 mr-1">Detail:</span>{networkState.technicalDetail}
            </p>
          )}
          {networkState.suggestion && (
            <p className="text-xs text-white/80 mt-1 italic">
              Suggested fix: {networkState.suggestion}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isChecking}
            className="px-3 py-1.5 bg-white text-slate-900 rounded-lg text-xs font-semibold hover:bg-slate-100 disabled:opacity-60 transition shadow-sm flex items-center gap-1.5"
          >
            {isChecking ? (
              <>
                <span className="animate-spin text-sm">⟳</span>
                <span>Testing...</span>
              </>
            ) : (
              <>
                <span>↻</span>
                <span>Retry Connection</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1.5 text-white/80 hover:text-white rounded hover:bg-black/20 text-sm"
            title="Dismiss notification"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
