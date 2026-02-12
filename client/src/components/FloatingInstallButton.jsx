import React, { useEffect, useState } from "react";
import { Download } from "lucide-react";
import usePWAInstall from "../hooks/usePWAInstall.js";

export default function FloatingInstallButton() {
  const { isInstallable, isInstalled, isPWASupported, handleInstall } =
    usePWAInstall();
  const [showHelp, setShowHelp] = useState(false);
  const [visible, setVisible] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1920,
  );

  useEffect(() => {
    function onResize() {
      setViewportWidth(window.innerWidth);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    // Only show if PWA is supported AND not already installed
    // AND we either have the install prompt OR are on a browser that *might* show it
    // Limit to small/medium devices (<= 1024px)
    const shouldShow =
      isPWASupported &&
      !isInstalled &&
      (isInstallable ||
        /Mobile|Android|iPad|iPhone/.test(navigator.userAgent)) &&
      viewportWidth <= 1024;
    setVisible(shouldShow);
  }, [isInstallable, isInstalled, isPWASupported, viewportWidth]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2">
      {showHelp && (
        <div className="card p-3 shadow-erp-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
          <div className="text-sm font-semibold">Install</div>
          <div className="text-xs text-slate-600 dark:text-slate-400">
            {/iPad|iPhone|iPod/.test(navigator.userAgent)
              ? "Tap Share → Add to Home Screen"
              : "Tap menu → Install / Add to Home Screen"}
          </div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              className="btn-secondary px-2 py-1"
              onClick={() => setShowHelp(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        className="btn-primary rounded-full w-12 h-12 shadow-erp-lg flex items-center justify-center"
        aria-label="Install app"
        onClick={async () => {
          if (isInstallable) {
            const accepted = await handleInstall();
            if (!accepted) setShowHelp(true); // user dismissed prompt
          } else {
            setShowHelp(true);
            setTimeout(() => setShowHelp(false), 4000);
          }
        }}
        title="Install OmniSuite"
      >
        <Download className="w-5 h-5" />
      </button>
    </div>
  );
}
