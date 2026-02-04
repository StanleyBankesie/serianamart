import { useEffect, useMemo, useState } from "react";

export default function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported("serviceWorker" in navigator);
    function onBeforeInstallPrompt(e) {
      e.preventDefault?.();
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
