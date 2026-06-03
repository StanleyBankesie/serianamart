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
  if (typeof navigator === "undefined") return;
  try {
    if (navigator.onLine === false) return;
  } catch {
    return;
  }
  preloaded = true;

  // Warm general endpoints (fire and forget)
  for (const url of POS_ENDPOINTS) {
    api.get(url).catch(() => {});
  }

  // Warm inventory items — store in localStorage so POS entry loads instantly
  api
    .get("/inventory/items")
    .then((res) => {
      const raw = Array.isArray(res.data?.items) ? res.data.items : [];
      if (raw.length) {
        const mapped = raw
          .filter((it) => it && it.is_active !== false)
          .map((it) => ({
            id: it.id,
            name: it.item_name || "",
            code: it.item_code || "",
            price: Number(it.selling_price ?? 0),
            availQty: Number(it.stock_level ?? 0),
            image_url: it.image_url || "",
            barcode: it.barcode || "",
          }));
        try {
          localStorage.setItem("omnisuite.pos.products", JSON.stringify(mapped));
        } catch {}
      }
    })
    .catch(() => {});
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    preloaded = false;
  });
}
