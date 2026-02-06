import { useEffect, useMemo, useState } from "react";

export default function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported("serviceWorker" in navigator);
    function onBeforeInstallPrompt(e) {
      // Do NOT prevent default if you want the browser's mini-infobar to appear automatically
      // But usually, browsers mute it if you don't handle it.
      // To show the "Add to Home Screen" mini-infobar on Android, we should NOT preventDefault immediately?
      // Actually, Chrome on Android shows a mini-infobar automatically if criteria are met.
      // If we preventDefault, we suppress it.
      // The user wants "application invokes browser install prompt".
      // This usually means "let the browser handle it" OR "trigger it programmatically immediately".
      // Since we are hiding the button, we should let the browser show its native prompt if it wants.
      // e.preventDefault(); // Commented out to allow native prompt
      setInstallPrompt(e);
    }
    function onAppInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    const displayModeStandalone =
      window.matchMedia &&
      window.matchMedia("(display-mode: standalone)").matches;
    const iosStandalone = navigator.standalone === true;
    if (displayModeStandalone || iosStandalone) {
      setInstalled(true);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const isInstallable = useMemo(() => Boolean(installPrompt), [installPrompt]);

  async function handleInstall() {
    if (!installPrompt) return false;
    // If we didn't preventDefault, prompt() might not be needed if the browser showed it?
    // But usually prompt() is called on user gesture.
    // If we want to support a custom button (even if hidden now), we keep this.
    const res = await installPrompt.prompt?.();
    setInstallPrompt(null);
    return res;
  }

  function dismissPrompt() {
    setInstallPrompt(null);
  }

  return {
    isInstallable,
    isInstalled: installed,
    isPWASupported: supported,
    handleInstall,
    dismissPrompt,
  };
}
