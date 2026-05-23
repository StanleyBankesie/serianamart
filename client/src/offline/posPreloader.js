import api from "../api/client.js";

const POS_ENDPOINTS = [
  "/pos/payment-modes",
  "/pos/tax-settings",
  "/pos/receipt-settings",
  "/pos/terminals",
  "/pos/terminal-users",
  "/sales/price-types",
  "/sales/customers",
  "/admin/me",
];

let preloaded = false;

export function preloadPosData() {
  if (preloaded) return;
  if (typeof navigator === "undefined" || !navigator.onLine) return;
  preloaded = true;
  for (const url of POS_ENDPOINTS) {
    api.get(url).catch(() => {});
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    setTimeout(() => {
      preloaded = false;
    }, 1000);
  });
}
