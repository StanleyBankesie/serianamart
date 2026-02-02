import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App.jsx";
import "antd/dist/reset.css";
import "./styles.css";

async function clearPwaCachesOnce() {
  const key = "omnisuite_favicon_reset_v3";
  try {
    if (localStorage.getItem(key) === "1") return;
    localStorage.setItem(key, "1");

    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
    window.location.reload();
  } catch {
    try {
      localStorage.setItem(key, "1");
    } catch {}
  }
}

clearPwaCachesOnce();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const base = import.meta.env.BASE_URL || "/";
    const url = `${base.replace(/\/+$/, "")}/sw.js`;
    navigator.serviceWorker.register(url).catch(() => {});
  });
}
