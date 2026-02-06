import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App.jsx";
import "antd/dist/reset.css";
import "./styles.css";
import iconClearUrl from "./assets/resources/OMNISUITE_ICON_CLEAR.png?url";

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

if (import.meta.env.DEV) {
  clearPwaCachesOnce();
}

(function setFavicons() {
  try {
    const head = document.head || document.getElementsByTagName("head")[0];
    const rels = [
      "icon",
      "shortcut icon",
      "apple-touch-icon",
      "apple-touch-icon-precomposed",
    ];
    rels.forEach((rel) => {
      let link = document.querySelector(`link[rel="${rel}"]`);
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", rel);
        link.setAttribute("type", "image/png");
        if (rel.startsWith("apple-touch-icon")) {
          link.setAttribute("sizes", "180x180");
        }
        head.appendChild(link);
      }
      link.setAttribute("href", iconClearUrl);
    });
  } catch {}
})();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
