/**
 * @fileoverview NetworkStatusBanner component.
 * Displays a clean, non-intrusive network status banner across the entire application
 * whenever internet connectivity is lost, internet is weak, or the backend server is unreachable.
 * Only displays "No internet access" with a Retry action.
 */

import React, { useState, useEffect, useCallback } from "react";
import { checkServerHealth, diagnoseNetworkIssue } from "../utils/networkErrorDiagnostics.js";

export default function NetworkStatusBanner() {
  const [networkState, setNetworkState] = useState(() => {
    const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
    if (isOffline) {
      return {
        hasError: true,
        title: "No internet access",
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
        });
        setDismissed(false);
        setTimeout(() => {
          setNetworkState((prev) => (prev.isRestored ? { hasError: false, isRestored: false } : prev));
        }, 3000);
      } else {
        setNetworkState({
          hasError: true,
          title: "No internet access",
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
      checkServerHealth(4000).then((health) => {
        if (health.isServerReachable) {
          setNetworkState({
            hasError: false,
            isRestored: true,
            title: "Connection Restored",
          });
          setDismissed(false);
          setTimeout(() => {
            setNetworkState((prev) => (prev.isRestored ? { hasError: false, isRestored: false } : prev));
          }, 3000);
        } else {
          setNetworkState({
            hasError: true,
            title: "No internet access",
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
        title: "No internet access",
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
        title: "No internet access",
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
        className="fixed top-0 left-0 right-0 z-[99999] bg-emerald-600 text-white px-4 py-2 shadow-md flex items-center justify-between transition-all duration-300"
      >
        <div className="flex items-center gap-2.5 max-w-5xl mx-auto w-full">
          <span className="text-lg leading-none">✅</span>
          <div className="flex-1 text-sm font-semibold tracking-wide">
            Connection restored
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-white/80 hover:text-white text-base px-2 rounded hover:bg-emerald-700/50"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  // Active Network Error Banner: Only show "No internet access"
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 left-0 right-0 z-[99999] bg-amber-600 text-white px-4 py-2.5 shadow-lg flex items-center justify-between transition-all duration-300"
    >
      <div className="flex items-center gap-3 max-w-5xl mx-auto w-full">
        <span className="text-xl leading-none">📡</span>
        <div className="flex-1 text-sm font-semibold tracking-wide">
          No internet access
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isChecking}
            className="px-3 py-1 bg-white text-slate-900 rounded-lg text-xs font-semibold hover:bg-slate-100 disabled:opacity-60 transition shadow-sm flex items-center gap-1.5"
          >
            {isChecking ? (
              <>
                <span className="animate-spin text-xs">⟳</span>
                <span>Checking...</span>
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
            className="p-1 text-white/80 hover:text-white rounded hover:bg-black/20 text-sm ml-1"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
