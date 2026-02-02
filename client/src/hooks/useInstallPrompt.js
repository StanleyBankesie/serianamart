import { useState, useEffect } from "react";

export function useInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Log environment info for debugging
    console.log("[PWA] Environment:", {
      https: window.location.protocol === "https:",
      url: window.location.href,
      userAgent: navigator.userAgent,
    });

    // Check if the app is already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      console.log("[PWA] App is already installed (standalone mode detected)");
      return;
    }

    // Check if PWA requirements are met
    const checkPWASupport = async () => {
      const hasServiceWorkerAPI = "serviceWorker" in navigator;
      const hasActiveServiceWorker = navigator.serviceWorker.controller;
      const hasManifest = document.querySelector('link[rel="manifest"]');
      const manifestHref = document.querySelector('link[rel="manifest"]')?.href;

      console.log("[PWA] PWA Support Check:", {
        serviceWorkerAPI: hasServiceWorkerAPI,
        activeServiceWorker: !!hasActiveServiceWorker,
        manifest: !!hasManifest,
        manifestUrl: manifestHref,
        httpsRequired: window.location.protocol === "https:",
      });

      // Try to fetch and validate the manifest
      if (manifestHref) {
        try {
          const response = await fetch(manifestHref);
          const manifest = await response.json();
          console.log("[PWA] Manifest loaded:", manifest);
          if (response.status !== 200) {
            console.error(
              `[PWA] Manifest returned status ${response.status} (expected 200)`,
            );
          }
        } catch (error) {
          console.error("[PWA] Failed to load manifest:", error);
        }
      }
    };

    checkPWASupport();

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      console.log("[PWA] beforeinstallprompt event fired");
      e.preventDefault();
      setInstallPrompt(e);
      setIsInstallable(true);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      console.log("[PWA] App installed successfully");
      setIsInstalled(true);
      setIsInstallable(false);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Log if beforeinstallprompt doesn't fire after a delay
    const debugTimer = setTimeout(() => {
      if (!installPrompt) {
        console.warn(
          "[PWA] beforeinstallprompt event not triggered after 3 seconds.",
        );
        console.warn("[PWA] Common causes:");
        console.warn("  1. ❌ App not served over HTTPS (required!)");
        console.warn("  2. ❌ Service Worker not registered or not active");
        console.warn("  3. ❌ Manifest file not found (404) or invalid JSON");
        console.warn("  4. ❌ Browser doesn't support PWA install (old Safari)");
        console.warn("  5. ❌ App engagement criteria not met (varies by browser)");
        console.warn("");
        console.warn("[PWA] For Plesk hosting specifically:");
        console.warn("  • HTTPS must be enabled (Let's Encrypt is free in Plesk)");
        console.warn("  • Rebuild and redeploy: npm run build");
        console.warn("  • Clear all caches (browser, Plesk, service worker)");
        console.warn("  • Check that manifest.webmanifest exists in deployed files");
      }
    }, 3000);

    return () => {
      clearTimeout(debugTimer);
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;

    try {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;

      if (outcome === "accepted") {
        setIsInstalled(true);
        setIsInstallable(false);
      }

      setInstallPrompt(null);
    } catch (error) {
      console.error("Installation failed:", error);
    }
  };

  const dismissPrompt = () => {
    setIsInstallable(false);
    setInstallPrompt(null);
  };

  return {
    installPrompt,
    isInstallable,
    isInstalled,
    handleInstall,
    dismissPrompt,
  };
}
