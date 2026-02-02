import React, { useState, useEffect } from "react";
import { useInstallPrompt } from "../hooks/useInstallPrompt";
import { X, Download } from "lucide-react";

export function PWAInstallBanner() {
  const { isInstallable, isInstalled, handleInstall, dismissPrompt } =
    useInstallPrompt();
  const [showBanner, setShowBanner] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);

  // Check for debug mode in URL or localStorage
  useEffect(() => {
    const debugParam = new URLSearchParams(window.location.search).get("pwa-debug");
    const debugStored = localStorage.getItem("pwa-debug-mode");
    if (debugParam === "true" || debugStored === "true") {
      setIsDebugMode(true);
      console.log("[PWA] Debug mode enabled");
    }
  }, []);

  useEffect(() => {
    // Only show banner if app is installable and not already installed
    // OR in debug mode (for testing)
    if ((isInstallable || isDebugMode) && !isInstalled) {
      setShowBanner(true);
      console.log("[PWA] Banner visibility:", { isInstallable, isInstalled, isDebugMode });
    }
  }, [isInstallable, isInstalled, isDebugMode]);

  if (!showBanner) {
    return null;
  }

  const handleDismiss = () => {
    setShowBanner(false);
    dismissPrompt();
  };

  const handleInstallClick = async () => {
    if (isDebugMode && !isInstallable) {
      console.log("[PWA] Debug mode: Install simulated");
      setShowBanner(false);
      return;
    }
    await handleInstall();
    setShowBanner(false);
  };

  return (
    <div
      className="fixed top-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg z-50"
      style={{
        animation: "slideDown 0.3s ease-out",
      }}
    >
      <style>{`
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Download className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm sm:text-base">
                Install OmniSuite
                {isDebugMode && <span className="ml-2 text-xs bg-yellow-600 px-2 py-1 rounded">DEBUG MODE</span>}
              </p>
              <p className="text-xs sm:text-sm text-blue-100">
                Get faster access and offline support. Install our app on your
                device.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleInstallClick}
              className="bg-white text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg font-semibold text-sm transition-colors duration-200"
            >
              Install Now
            </button>
            <button
              onClick={handleDismiss}
              className="text-blue-100 hover:text-white p-1 transition-colors duration-200"
              aria-label="Dismiss install prompt"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
