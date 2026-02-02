import { useState, useEffect } from "react";

export function useInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if the app is already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      console.log("[PWA] App is already installed (standalone mode detected)");
      return;
    }

    // Check if PWA requirements are met
    const checkPWASupport = async () => {
      const hasServiceWorker =
        "serviceWorker" in navigator && navigator.serviceWorker.controller;
      const hasManifest = document.querySelector('link[rel="manifest"]');
      console.log("[PWA] Service Worker active:", !!navigator.serviceWorker.controller);
      console.log("[PWA] Manifest present:", !!hasManifest);
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
          "[PWA] beforeinstallprompt event not triggered. Possible reasons:",
          "1. App not served over HTTPS",
          "2. Service Worker not registered",
          "3. Manifest file missing or invalid",
          "4. Browser doesn't support PWA install prompt",
          "5. App engagement criteria not met"
        );
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
