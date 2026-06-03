import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import api from "../../../../api/client.js";
import { useAuth } from "../../../../auth/AuthContext.jsx";
import defaultLogo from "../../../../assets/resources/OMNISUITE_LOGO_FILL.png";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { filterByPrefix } from "@/utils/searchUtils.js";
import { saveLocalSale } from "../../../../offline/posStore.js";
import { uuid } from "../../../../offline/uuid.js";
import { toast } from "react-toastify";
import QRCode from "qrcode";

function FilterableSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  filterPlaceholder,
}) {
  const filtered = Array.isArray(options) ? options : [];
  return (
    <div>
      <select
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">{placeholder || "Select..."}</option>
        {filtered.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function PosSalesEntry() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canEditDiscount, canPerformAction, canAccessPath } = usePermission();
  const [now, setNow] = useState(new Date());
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [saving, setSaving] = useState(false);
  const [receiptNo, setReceiptNo] = useState("");
  const [entryBarcode, setEntryBarcode] = useState("");
  const [entryQty, setEntryQty] = useState(1);
  const [entryPriceType, setEntryPriceType] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [products, setProducts] = useState(() => {
    // Seed immediately from localStorage cache so barcode scans work
    // before the API fetch completes (especially important on slow/flaky connections)
    try {
      const cached = localStorage.getItem("omnisuite.pos.products");
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState("");
  const [priceTypes, setPriceTypes] = useState([]);
  const [priceTypesLoading, setPriceTypesLoading] = useState(false);
  const [priceTypesError, setPriceTypesError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showItemNotFound, setShowItemNotFound] = useState(false);
  const [showNoPermission, setShowNoPermission] = useState(false);
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine !== false : true,
  );
  // Price cache: { [productId:priceTypeId]: price } — skip network on repeated scans of same item
  const priceCacheRef = useRef({});
  const prevPriceTypeRef = useRef("");
  // Clear price cache whenever the price type changes so fresh prices are fetched
  useEffect(() => {
    if (prevPriceTypeRef.current !== entryPriceType) {
      priceCacheRef.current = {};
      prevPriceTypeRef.current = entryPriceType;
    }
  }, [entryPriceType]);
  const [saleTimestamp, setSaleTimestamp] = useState(null);
  const [paymentModes, setPaymentModes] = useState([]);
  const [paymentModesLoading, setPaymentModesLoading] = useState(false);
  const [paymentModesError, setPaymentModesError] = useState("");
  const [selectedPaymentModeId, setSelectedPaymentModeId] = useState("");
  const [taxRatePercent, setTaxRatePercent] = useState(12.5);
  const [taxType, setTaxType] = useState("Exclusive");
  const [taxCodeLabel, setTaxCodeLabel] = useState("");
  const [taxActive, setTaxActive] = useState(true);
  const [taxComponents, setTaxComponents] = useState([]);
  const [taxCodeId, setTaxCodeId] = useState(null);
  const [dayOpen, setDayOpen] = useState(false);
  const [dayExists, setDayExists] = useState(false);
  const [dayStatus, setDayStatus] = useState("");
  const [dayLoading, setDayLoading] = useState(true);
  const [terminalCode, setTerminalCode] = useState("");
  const [terminalWarehouseId, setTerminalWarehouseId] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [companyInfo, setCompanyInfo] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    country: "",
    phone: "",
    email: "",
    website: "",
    taxId: "",
    registrationNo: "",
    logoUrl: defaultLogo,
  });
  const [generalSettings, setGeneralSettings] = useState({ allowDiscounts: true });
  useEffect(() => {
    try {
      const raw = localStorage.getItem("pos_general_settings");
      if (raw) {
        const parsed = JSON.parse(raw);
        setGeneralSettings(parsed || {});
      }
    } catch {}
  }, []);
  const filtered = useMemo(() => {
    const q = String(search || "").trim();
    if (!q) return products;
    return filterAndSort(products, {
      query: q,
      getKeys: (p) => [p.name, p.code],
    });
  }, [products, search]);

  const itemSelectOptions = useMemo(() => {
    return (Array.isArray(products) ? products : []).map((p) => ({
      value: String(p.id),
      label: String(p.name || ""),
      sellingPrice: Number(p.price || 0),
    }));
  }, [products]);
  const itemSearchResults = useMemo(() => {
    const q = String(entryBarcode || "").trim().toLowerCase();
    if (!q) return [];
    const exactMatch = products.find((p) => {
      const code = String(p.code || "").toLowerCase();
      const name = String(p.name || "").toLowerCase();
      const barcode = String(p.barcode || "").toLowerCase();
      return code === q || name === q || barcode === q;
    });
    if (exactMatch) return [];
    return itemSelectOptions.filter((o) =>
      String(o.label || "").toLowerCase().includes(q) ||
      (products.find((p) => String(p.id) === o.value)?.code || "").toLowerCase().includes(q),
    ).slice(0, 20);
  }, [entryBarcode, itemSelectOptions, products]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    // Respond immediately to browser online/offline events
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    // Active heartbeat: probe the server every 5 s to catch flaky connections
    // faster than navigator.onLine alone (which only detects LAN disconnection).
    let heartbeatTimer = null;
    let lastHeartbeatFailed = false;
    async function heartbeat() {
      try {
        // Lightweight request — the /ping endpoint or a HEAD of the API base.
        const ctrl = new AbortController();
        const id = setTimeout(() => ctrl.abort(), 1500);
        await fetch("/api/ping", { method: "HEAD", signal: ctrl.signal, cache: "no-store" });
        clearTimeout(id);
        if (lastHeartbeatFailed) {
          lastHeartbeatFailed = false;
          setOnline(true);
        }
      } catch {
        lastHeartbeatFailed = true;
        setOnline(false);
      }
    }
    // Only run heartbeat when the component is visible
    function startHeartbeat() {
      if (heartbeatTimer) return;
      heartbeat(); // immediate first probe
      heartbeatTimer = setInterval(heartbeat, 2000);
    }
    function stopHeartbeat() {
      if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    }
    function onVisibility() {
      if (document.visibilityState === "visible") startHeartbeat();
      else stopHeartbeat();
    }
    document.addEventListener("visibilitychange", onVisibility);
    startHeartbeat();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      document.removeEventListener("visibilitychange", onVisibility);
      stopHeartbeat();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function resolveTerminalAndDay() {
      setDayLoading(true);
      try {
        const uid =
          Number(user?.sub || 0) || Number(user?.id || 0) || undefined;
        const [termsRes, linksRes] = await Promise.all([
          api.get("/pos/terminals"),
          api.get("/pos/terminal-users"),
        ]);
        const allTerminals = Array.isArray(termsRes.data?.items)
          ? termsRes.data.items
          : [];
        const links = Array.isArray(linksRes.data?.items)
          ? linksRes.data.items
          : [];
        const assignedIds = new Set(
          links
            .filter((x) => Number(x?.user_id) === Number(uid))
            .map((x) => Number(x?.terminal_id))
            .filter((n) => Number.isFinite(n) && n > 0),
        );
        const assigned = allTerminals.filter((t) =>
          assignedIds.has(Number(t?.id)),
        );
        const code =
          (assigned.length ? String(assigned[0]?.code || "") : "") || "";
        const wId =
          (assigned.length ? String(assigned[0]?.warehouse_id || "") : "") ||
          "";
        setTerminalCode(code);
        setTerminalWarehouseId(wId);
        try {
          const raw = sessionStorage.getItem("omni.pos.day");
          if (raw) {
            const data = JSON.parse(raw);
            const t = String(data?.terminal || data?.terminalCode || "");
            const status = String(data?.status || "").toUpperCase();
            const recent = Number(data?.ts || 0) > Date.now() - 5000;
            if (status === "OPEN" && recent && (!code || !t || t === code)) {
              setDayExists(true);
              setDayStatus("OPEN");
              setDayOpen(true);
              setDayLoading(false);
              return;
            }
          }
        } catch {}
        const params = code ? { params: { terminal: code } } : undefined;
        const res = await api.get("/pos/day/status", params);
        const item = res?.data?.item || null;
        const status = String(item?.status || "").toUpperCase();
        const exists = !!item;
        setDayExists(exists);
        setDayStatus(status);
        setDayOpen(status === "OPEN");
      } catch {
        if (cancelled) return;
        // Offline fallback: use sessionStorage cache even if stale
        try {
          const raw = sessionStorage.getItem("omni.pos.day");
          if (raw) {
            const data = JSON.parse(raw);
            const t = String(data?.terminal || data?.terminalCode || "");
            const status = String(data?.status || "").toUpperCase();
            if (
              status === "OPEN" &&
              (!terminalCode || !t || t === terminalCode)
            ) {
              setDayExists(true);
              setDayStatus("OPEN");
              setDayOpen(true);
              setDayLoading(false);
              return;
            }
          }
        } catch {}
        setDayExists(false);
        setDayStatus("");
        setDayOpen(false);
      } finally {
        if (cancelled) return;
        setDayLoading(false);
      }
    }
    resolveTerminalAndDay();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.sub]);

  useEffect(() => {
    function onPosDayEvent(e) {
      try {
        const d = e.detail || {};
        const t = String(d.terminal || d.terminalCode || "");
        if (terminalCode && t && t !== terminalCode) return;
        const status = String(d.status || "").toUpperCase();
        if (status === "OPEN") {
          setDayExists(true);
          setDayOpen(true);
          setDayStatus("OPEN");
        } else if (status === "CLOSED") {
          setDayExists(true);
          setDayOpen(false);
          setDayStatus("CLOSED");
        }
      } catch {}
    }
    window.addEventListener("omni.pos.day", onPosDayEvent);
    return () => window.removeEventListener("omni.pos.day", onPosDayEvent);
  }, [terminalCode]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("omni.pos.day");
      if (!raw) return;
      const data = JSON.parse(raw);
      const t = String(data?.terminal || data?.terminalCode || "");
      if (terminalCode && t && t !== terminalCode) return;
      const status = String(data?.status || "").toUpperCase();
      if (status === "OPEN") {
        setDayExists(true);
        setDayOpen(true);
        setDayStatus("OPEN");
      } else if (status === "CLOSED") {
        setDayExists(true);
        setDayOpen(false);
        setDayStatus("CLOSED");
      }
    } catch {}
  }, [terminalCode]);

  useEffect(() => {
    let mounted = true;
    setPaymentModesLoading(true);
    setPaymentModesError("");
    api
      .get("/pos/payment-modes")
      .then((res) => {
        if (!mounted) return;
        const raw = Array.isArray(res.data?.items) ? res.data.items : [];
        const active = raw.filter(
          (m) => m && m.is_active !== 0 && m.is_active !== false,
        );
        setPaymentModes(active);
        if (!selectedPaymentModeId && active.length) {
          let def =
            active.find(
              (m) =>
                String(m.type || "")
                  .trim()
                  .toLowerCase() === "cash",
            ) || active[0];
          if (def && def.id) {
            setSelectedPaymentModeId(String(def.id));
          }
        }
      })
      .catch((e) => {
        if (!mounted) return;
        setPaymentModesError(
          e?.response?.data?.message || "Failed to load payment modes",
        );
        // Offline fallback: use a built-in Cash payment mode
        const cashMode = { id: 1, name: "Cash", type: "cash", is_active: true };
        setPaymentModes([cashMode]);
        if (!selectedPaymentModeId) {
          setSelectedPaymentModeId("1");
        }
      })
      .finally(() => {
        if (!mounted) return;
        setPaymentModesLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [selectedPaymentModeId]);

  useEffect(() => {
    let mounted = true;
    async function loadTaxSettings() {
      try {
        const res = await api.get("/pos/tax-settings");
        if (!mounted) return;
        const item = res.data?.item || null;
        if (!item) {
          setTaxActive(false);
          setTaxRatePercent(0);
          setTaxType("Exclusive");
          setTaxCodeLabel("");
          setTaxComponents([]);
          setTaxCodeId(null);
          return;
        }
        const enabled = item.is_active !== 0 && item.is_active !== false;
        setTaxActive(enabled);
        if (!enabled) {
          setTaxRatePercent(0);
          setTaxType("Exclusive");
          setTaxCodeLabel("");
          setTaxComponents([]);
          setTaxCodeId(null);
          return;
        }
        if (item.tax_type) setTaxType(String(item.tax_type));
        const rate = Number(item.tax_rate_percent ?? 12.5);
        setTaxRatePercent(Number.isFinite(rate) ? rate : 12.5);
        const name = String(item.tax_name || "").trim();
        const code = String(item.tax_code || "").trim();
        const id = String(item.tax_code_id || "").trim();
        setTaxCodeLabel(name || code || id || "");

        // Fetch tax components if tax code exists
        const taxCodeId = Number(item.tax_code_id || 0);
        if (taxCodeId > 0) {
          setTaxCodeId(taxCodeId);
          try {
            const compRes = await api.get(
              `/finance/tax-codes/${taxCodeId}/components`,
            );
            if (Array.isArray(compRes.data?.items)) {
              setTaxComponents(compRes.data.items);
            }
          } catch (err) {
            console.warn("Failed to fetch tax components", err);
            setTaxComponents([]);
          }
        } else {
          setTaxComponents([]);
          setTaxCodeId(null);
        }
      } catch (err) {
        if (!mounted) return;
        setTaxActive(false);
        setTaxRatePercent(0);
        setTaxType("Exclusive");
        setTaxCodeLabel("");
        setTaxComponents([]);
        setTaxCodeId(null);
      }
    }
    loadTaxSettings();
    return () => {
      mounted = false;
    };
  }, []);
  const [headerDiscount, setHeaderDiscount] = useState("");

  useEffect(() => {
    let mounted = true;
    async function fetchCompanyInfo() {
      try {
        const meResp = await api.get("/admin/me");
        const companyId = meResp.data?.scope?.companyId;
        if (!companyId) {
          if (!mounted) return;
          setCompanyInfo((prev) => ({
            ...prev,
            logoUrl: prev.logoUrl || defaultLogo,
          }));
          return;
        }
        const cResp = await api.get(`/admin/companies/${companyId}`);
        const item = cResp.data?.item || {};
        if (!mounted) return;
        setCompanyInfo((prev) => ({
          ...prev,
          name: item.name || prev.name || "",
          address: item.address || prev.address || "",
          city: item.city || prev.city || "",
          state: item.state || prev.state || "",
          country: item.country || prev.country || "",
          phone: item.telephone || prev.phone || "",
          email: item.email || prev.email || "",
          website: item.website || prev.website || "",
          taxId: item.tax_id || prev.taxId || "",
          registrationNo: item.registration_no || prev.registrationNo || "",
          logoUrl:
            item.has_logo === 1 || item.has_logo === true
              ? `/api/admin/companies/${companyId}/logo`
              : prev.logoUrl || defaultLogo,
        }));
      } catch {
        if (!mounted) return;
        setCompanyInfo((prev) => ({
          ...prev,
          logoUrl: prev.logoUrl || defaultLogo,
        }));
      }
    }
    fetchCompanyInfo();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    setPriceTypesLoading(true);
    setPriceTypesError("");
    api
      .get("/sales/price-types")
      .then((res) => {
        if (!mounted) return;
        const raw = Array.isArray(res.data?.items) ? res.data.items : [];
        setPriceTypes(raw);
        if (!entryPriceType && raw.length) {
          let def =
            raw.find(
              (pt) =>
                String(pt.name || "")
                  .trim()
                  .toLowerCase() === "retail",
            ) || raw[0];
          if (def && def.id) {
            setEntryPriceType(String(def.id));
          }
        }
      })
      .catch((e) => {
        if (!mounted) return;
        setPriceTypesError(
          e?.response?.data?.message || "Failed to load price types",
        );
      })
      .finally(() => {
        if (!mounted) return;
        setPriceTypesLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [entryPriceType]);

  useEffect(() => {
    let mounted = true;
    setItemsLoading(true);
    setItemsError("");
    const params = terminalWarehouseId
      ? { warehouse_id: terminalWarehouseId }
      : {};
    api
      .get("/inventory/items", { params })
      .then((res) => {
        if (!mounted) return;
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
          setProducts(mapped);
          try {
            localStorage.setItem(
              "omnisuite.pos.products",
              JSON.stringify(mapped),
            );
          } catch {}
        } else {
          // Offline fallback: use cached products from localStorage
          try {
            const cached = localStorage.getItem("omnisuite.pos.products");
            if (cached) setProducts(JSON.parse(cached));
          } catch {}
        }
      })
      .catch(() => {
        if (!mounted) return;
        // Offline fallback: use cached products from localStorage
        try {
          const cached = localStorage.getItem("omnisuite.pos.products");
          if (cached) setProducts(JSON.parse(cached));
        } catch {}
      })
      .finally(() => {
        if (!mounted) return;
        setItemsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [terminalWarehouseId]);

  useEffect(() => {
    let mounted = true;
    api
      .get("/sales/customers")
      .then((res) => {
        if (!mounted) return;
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setCustomers(items);
      })
      .catch(() => {
        if (!mounted) return;
        setCustomers([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const gross = useMemo(() => {
    return cart.reduce((sum, i) => {
      const qty = Number(i.quantity || 0);
      const price = Number(i.price || 0);
      return sum + qty * price;
    }, 0);
  }, [cart]);
  const subtotal = useMemo(() => {
    return cart.reduce((sum, i) => {
      const qty = Number(i.quantity || 0);
      const price = Number(i.price || 0);
      const disc = Number(i.discount || 0);
      const lineTotal = Math.max(0, qty * price - disc);
      return sum + lineTotal;
    }, 0);
  }, [cart]);
  const discountTotal = useMemo(() => {
    const diff = gross - subtotal;
    if (!Number.isFinite(diff) || diff < 0) return 0;
    return diff;
  }, [gross, subtotal]);
  const tax = useMemo(() => {
    const rate = Number(taxRatePercent || 0) / 100;
    if (!rate || subtotal <= 0) return 0;
    return subtotal * rate;
  }, [subtotal, taxRatePercent]);
  const total = useMemo(() => {
    return subtotal + tax;
  }, [subtotal, tax]);
  const tendered = useMemo(() => {
    const v = Number(amountPaid || 0);
    return Number.isFinite(v) ? v : 0;
  }, [amountPaid]);
  const changeDue = useMemo(() => {
    const diff = tendered - total;
    return Number.isFinite(diff) ? diff : 0;
  }, [tendered, total]);

  useEffect(() => {
    setAmountPaid(String(total.toFixed(2)));
  }, [total]);
  const cartRef = useRef(null);
  const barcodeDebounceRef = useRef(null);
  const barcodeInputRef = useRef(null);
  const vfdDebounceRef = useRef(null);
  const lastVfdItemRef = useRef(null);

  function toAsciiPrintable(input) {
    return String(input || "").replace(/[^\x20-\x7E]/g, "");
  }

  function trimToMax(input, maxLen) {
    const s = toAsciiPrintable(input);
    if (!maxLen || maxLen <= 0) return s;
    return s.length > maxLen ? s.slice(0, maxLen) : s;
  }

  const selectedPaymentMode = useMemo(() => {
    if (!paymentModes.length || !selectedPaymentModeId) return null;
    return (
      paymentModes.find(
        (m) => String(m.id) === String(selectedPaymentModeId),
      ) || null
    );
  }, [paymentModes, selectedPaymentModeId]);

  function resolvePaymentMethodForSale(mode) {
    const t = String(mode?.type || "").toLowerCase();
    if (t === "cash") return "CASH";
    if (t === "card" || t === "bank") return "CARD";
    if (t === "mobile") return "MOBILE";
    return "CASH";
  }

  function searchProducts() {}

  async function resolveStandardPrice(productId, priceTypeId, fallbackPrice) {
    // 1. Return cached price immediately if we already fetched it once.
    const cacheKey = `${productId}:${priceTypeId || ""}`;
    if (priceCacheRef.current[cacheKey] !== undefined) {
      return priceCacheRef.current[cacheKey];
    }
    // 2. If offline, skip network entirely.
    if (!online) {
      const price = Number(fallbackPrice || 0);
      priceCacheRef.current[cacheKey] = price;
      return price;
    }
    // 3. Race the API call against a 2-second timeout so a flaky connection
    //    never stalls the cashier for more than 2 s.
    try {
      const body = {
        product_id: productId,
        quantity: 1,
        price_type: priceTypeId || "",
        only_standard: true,
      };
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("price-timeout")), 2000)
      );
      const fetchPromise = api.post("/sales/prices/best-price", body, { timeout: 2500 });
      const res = await Promise.race([fetchPromise, timeoutPromise]);
      const price = Number(res.data?.price);
      const resolved = Number.isFinite(price) ? price : Number(fallbackPrice || 0);
      priceCacheRef.current[cacheKey] = resolved;
      return resolved;
    } catch {
      const price = Number(fallbackPrice || 0);
      // Cache fallback too so repeated scans of same item stay fast
      priceCacheRef.current[cacheKey] = price;
      return price;
    }
  }

  const selectedProduct = null;

  function addEntryToCartForProduct(prod, initialQtyOverride) {
    const sourceQty =
      initialQtyOverride !== undefined ? initialQtyOverride : entryQty;
    const qty = Math.max(1, Number(sourceQty || 1));
    if (!prod || !qty) return;
    const unitPrice = prod.price;
    setCart((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      const existing = base.find((p) => p.id === prod.id);
      if (existing) {
        const nextQty = Number(existing.quantity || 0) + qty;
        lastVfdItemRef.current = {
          id: prod.id,
          name: prod.name,
          quantity: nextQty,
          price: unitPrice,
        };
        return base.map((p) => {
          if (p.id !== prod.id) return p;
          return {
            ...p,
            quantity: nextQty,
            price: unitPrice,
            discount: Number(p.discount || 0),
          };
        });
      }
      lastVfdItemRef.current = {
        id: prod.id,
        name: prod.name,
        quantity: qty,
        price: unitPrice,
      };
      return [
        ...base,
        {
          id: prod.id,
          name: prod.name,
          code: prod.code,
          price: unitPrice,
          quantity: qty,
          discount: canEditDiscount() ? Number(headerDiscount || 0) : 0,
        },
      ];
    });
    setSelectedItems((prev) =>
      prev.some((p) => p.id === prod.id) ? prev : [...prev, prod],
    );
    setEntryBarcode("");
    setEntryQty(1);
    if (barcodeInputRef.current) {
      try {
        barcodeInputRef.current.focus();
      } catch {}
    }
    if (cartRef.current) {
      try {
        cartRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch {}
    }
    resolveStandardPrice(prod.id, entryPriceType, prod.price)
      .then((realPrice) => {
        if (Number.isFinite(realPrice) && realPrice !== unitPrice) {
          setCart((prev) =>
            prev.map((p) => (p.id === prod.id ? { ...p, price: realPrice } : p)),
          );
        }
      })
      .catch(() => {});
  }
  function handleSelectItemById(idStr) {
    const prod = products.find((p) => String(p.id) === String(idStr)) || null;
    if (prod) addEntryToCartForProduct(prod, 1);
    setEntryBarcode("");
  }

  function addProductsToCartForIds(ids, qtyOverride) {
    const qty = Math.max(1, Number(qtyOverride ?? entryQty ?? 1));
    const values = Array.isArray(ids) ? ids : [];
    const unique = Array.from(
      new Set(values.map((v) => String(v)).filter(Boolean)),
    );
    if (!unique.length) return;

    const prods = unique
      .map((id) => products.find((p) => String(p.id) === id) || null)
      .filter(Boolean);
    if (!prods.length) return;

    setCart((prev) => {
      const next = Array.isArray(prev) ? prev.slice() : [];
      for (const prod of prods) {
        const unitPrice = prod.price;
        const idx = next.findIndex((p) => p.id === prod.id);
        if (idx >= 0) {
          const existing = next[idx];
          const nextQty = Number(existing.quantity || 0) + qty;
          next[idx] = {
            ...existing,
            quantity: nextQty,
            price: unitPrice,
            discount: Number(existing.discount || 0),
          };
          lastVfdItemRef.current = {
            id: prod.id,
            name: prod.name,
            quantity: nextQty,
            price: unitPrice,
          };
        } else {
          next.push({
            id: prod.id,
            name: prod.name,
            code: prod.code,
            price: unitPrice,
            quantity: qty,
            discount: canEditDiscount() ? Number(headerDiscount || 0) : 0,
          });
          lastVfdItemRef.current = {
            id: prod.id,
            name: prod.name,
            quantity: qty,
            price: unitPrice,
          };
        }
      }
      return next;
    });

    setSelectedItems((prev) => {
      const existing = Array.isArray(prev) ? prev : [];
      const existingIds = new Set(existing.map((p) => p.id));
      const additions = prods.filter((p) => !existingIds.has(p.id));
      return additions.length ? [...existing, ...additions] : existing;
    });

    setEntryBarcode("");
    setEntryQty(1);
    if (barcodeInputRef.current) {
      try {
        barcodeInputRef.current.focus();
      } catch {}
    }
    if (cartRef.current) {
      try {
        cartRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch {}
    }
    for (const prod of prods) {
      resolveStandardPrice(prod.id, entryPriceType, prod.price)
        .then((realPrice) => {
          if (Number.isFinite(realPrice) && realPrice !== prod.price) {
            setCart((prev) =>
              prev.map((p) => (p.id === prod.id ? { ...p, price: realPrice } : p)),
            );
          }
        })
        .catch(() => {});
    }
  }

  async function handleItemMultiChange(nextIds) {
    const next = Array.isArray(nextIds) ? nextIds.map(String) : [];
    const prev = (Array.isArray(selectedItems) ? selectedItems : []).map((p) =>
      String(p.id),
    );
    const prevSet = new Set(prev);
    const nextSet = new Set(next);
    const removed = prev.filter((id) => !nextSet.has(id));
    const added = next.filter((id) => !prevSet.has(id));

    if (removed.length) {
      const removedNums = removed
        .map((id) => Number(id))
        .filter((n) => Number.isFinite(n));
      setCart((prevCart) =>
        (Array.isArray(prevCart) ? prevCart : []).filter(
          (p) => !removedNums.includes(p.id),
        ),
      );
      setSelectedItems((prevSelected) =>
        (Array.isArray(prevSelected) ? prevSelected : []).filter(
          (p) => !removedNums.includes(p.id),
        ),
      );
      setEntryQty(1);
    }

    if (added.length) {
      await addProductsToCartForIds(added, entryQty);
    }
  }

  function addEntryToCart() {
    const barcodeCandidate = String(entryBarcode || "")
      .trim()
      .toLowerCase();
    let prod = null;
    if (barcodeCandidate) {
      prod =
        products.find(
          (p) =>
            String(p.code || "").toLowerCase() === barcodeCandidate ||
            String(p.name || "").toLowerCase() === barcodeCandidate ||
            String(p.barcode || "").toLowerCase() === barcodeCandidate,
        ) || null;
    }
    if (!prod) {
      setShowItemNotFound(true);
      return;
    }
    addEntryToCartForProduct(prod);
  }

  function handleRegisterItem() {
    setShowItemNotFound(false);
    if (canAccessPath("/inventory/items/new")) {
      navigate("/inventory/items/new", { state: { from: "/pos/sales-entry" } });
    } else {
      setShowNoPermission(true);
    }
  }

  function addToCart(prod) {
    setCart((prev) => {
      const existing = prev.find((p) => p.id === prod.id);
      if (existing) {
        const nextQty = Number(existing.quantity || 0) + 1;
        lastVfdItemRef.current = {
          id: prod.id,
          name: prod.name,
          quantity: nextQty,
          price: Number(prod.price || 0),
        };
        return prev.map((p) =>
          p.id === prod.id
            ? {
                ...p,
                quantity: nextQty,
                discount: Number(p.discount || 0),
              }
            : p,
        );
      }
      lastVfdItemRef.current = {
        id: prod.id,
        name: prod.name,
        quantity: 1,
        price: Number(prod.price || 0),
      };
      return [...prev, { ...prod, quantity: 1, discount: 0 }];
    });
  }

  function updateQuantity(id, delta) {
    setCart((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) {
        const nextQty = Math.max(0, Number(target.quantity || 0) + delta);
        lastVfdItemRef.current = {
          id: target.id,
          name: target.name,
          quantity: nextQty,
          price: Number(target.price || 0),
        };
      }
      return prev
        .map((p) =>
          p.id === id
            ? {
                ...p,
                quantity: Math.max(0, Number(p.quantity || 0) + delta),
              }
            : p,
        )
        .filter((p) => Number(p.quantity || 0) > 0);
    });
  }

  function updateCartField(id, field, value) {
    setCart((prev) => {
      // Hard guard: ignore discount updates when user lacks exceptional permission
      if (field === "discount" && (!canEditDiscount() || generalSettings.allowDiscounts === false)) {
        return prev;
      }
      if (field === "quantity") {
        const target = prev.find((p) => p.id === id);
        if (target) {
          const v = Number(value || 0);
          lastVfdItemRef.current = {
            id: target.id,
            name: target.name,
            quantity: v > 0 ? v : 0,
            price: Number(target.price || 0),
          };
        }
      }
      return prev
        .map((p) => {
          if (p.id !== id) return p;
          if (field === "quantity") {
            const v = Number(value || 0);
            return { ...p, quantity: v > 0 ? v : 0 };
          }
          if (field === "discount") {
            const v = Number(value || 0);
            return { ...p, discount: v >= 0 ? v : 0 };
          }
          return p;
        })
        .filter((p) => Number(p.quantity || 0) > 0);
    });
  }

  function removeFromCart(id) {
    setCart((prev) => prev.filter((p) => p.id !== id));
    setSelectedItems((prev) => prev.filter((p) => p.id !== id));
    lastVfdItemRef.current = null;
    setEntryQty(1);
  }

  function removeSelectedItem(id) {
    removeFromCart(id);
  }

  function clearCart() {
    if (!cart.length) return;
    setCart([]);
    setSelectedItems([]);
    lastVfdItemRef.current = null;
  }

  useEffect(() => {
    if (barcodeDebounceRef.current) {
      clearTimeout(barcodeDebounceRef.current);
      barcodeDebounceRef.current = null;
    }
    const v = String(entryBarcode || "")
      .trim()
      .toLowerCase();
    if (!v) return;
    const match = products.find((p) => {
      const code = String(p.code || "").toLowerCase();
      const name = String(p.name || "").toLowerCase();
      const barcode = String(p.barcode || "").toLowerCase();
      return code === v || name === v || barcode === v;
    });
    if (match) {
      barcodeDebounceRef.current = setTimeout(() => {
        addEntryToCartForProduct(match, 1);
      }, 120);
    }
    return () => {
      if (barcodeDebounceRef.current) {
        clearTimeout(barcodeDebounceRef.current);
        barcodeDebounceRef.current = null;
      }
    };
  }, [entryBarcode, products]);

  useEffect(() => {
    setSelectedItems((prev) =>
      (Array.isArray(prev) ? prev : []).filter((p) =>
        cart.some((c) => c.id === p.id),
      ),
    );
  }, [cart]);
  useEffect(() => {
    if (vfdDebounceRef.current) clearTimeout(vfdDebounceRef.current);
    if (!cart.length || !terminalCode) return;
    vfdDebounceRef.current = setTimeout(() => {
      const last =
        lastVfdItemRef.current || cart[cart.length - 1] || cart[0] || null;
      const lastName = trimToMax(last?.name || "ITEM", 14);
      const lastQty = Number(last?.quantity || 1);
      const lastPrice = Number(last?.price || 0);
      const line1 = trimToMax(
        `${lastName} ${lastQty}x${lastPrice.toFixed(2)}`,
        20,
      );
      const line2 = trimToMax(`TOTAL GHS ${Number(total || 0).toFixed(2)}`, 20);
      api.post("/pos/vfd/display", {
        terminal_code: terminalCode,
        line1,
        line2,
      }).catch(() => {});
    }, 300);
    return () => {
      if (vfdDebounceRef.current) clearTimeout(vfdDebounceRef.current);
    };
  }, [cart, terminalCode, total]);
  useEffect(() => {
    if (barcodeInputRef.current) {
      try {
        barcodeInputRef.current.focus();
      } catch {}
    }
  }, [dayOpen]);

  async function checkout() {
    if (!cart.length || saving) return;
    if (!dayExists) {
      alert(
        "Please open POS Day for today before making sales. Go to POS → Start/End Business Day to open the day.",
      );
      return;
    }
    if (generalSettings.requireCustomer && !selectedCustomerId) {
      toast.warn("Please select a customer before checkout");
      return;
    }
    const saleCart = cart;
    let payload;
    try {
      setSaving(true);
      let effectivePaymentModeId = selectedPaymentModeId
        ? String(selectedPaymentModeId)
        : "";
      if (!effectivePaymentModeId) {
        const active = Array.isArray(paymentModes) ? paymentModes : [];
        const def =
          active.find(
            (m) =>
              String(m.type || "")
                .trim()
                .toLowerCase() === "cash",
          ) || active[0];
        if (def?.id) {
          effectivePaymentModeId = String(def.id);
          setSelectedPaymentModeId(String(def.id));
        }
      }
      if (!effectivePaymentModeId) {
        alert("Please configure a POS payment mode before completing a sale.");
        return;
      }
      const lines = saleCart.map((it) => ({
        item_id: it.id,
        name: it.name,
        quantity: Number(it.quantity || 0),
        price: Number(it.price || 0),
        discount: Number(it.discount || 0),
      }));
      const chosenCustomer =
        customers.find((c) => String(c.id) === String(selectedCustomerId)) ||
        null;
      const method = resolvePaymentMethodForSale(selectedPaymentMode);
      payload = {
        payment_method: method,
        payment_mode_id: Number(effectivePaymentModeId),
        customer_id: chosenCustomer ? Number(chosenCustomer.id) : null,
        customer_name: chosenCustomer
          ? String(chosenCustomer.customer_name || chosenCustomer.name || "")
          : null,
        lines,
        items: lines,
        status: "COMPLETED",
        terminal: terminalCode || "",
        subtotal,
        tax_total: tax,
        grand_total: total,
        amount_paid: tendered,
        change_due: changeDue,
        tax_rate_percent: taxActive ? taxRatePercent : 0,
        tax_type: taxActive ? taxType : "Exclusive",
        tax_code_id: taxActive && taxCodeId ? Number(taxCodeId) : null,
        tax_components: (() => {
          if (
            !taxActive ||
            !Array.isArray(taxComponents) ||
            !taxComponents.length
          )
            return [];
          let currentBase = subtotal;
          const res = [];
          for (const comp of taxComponents) {
            const rate = Number(comp.rate_percent || 0);
            let compTax = 0;
            if (comp.compound_level) {
              compTax = (currentBase * rate) / 100;
            } else {
              compTax = (subtotal * rate) / 100;
            }
            res.push({
              id: comp.id,
              name: comp.component_name || comp.name,
              amount: Math.round(compTax * 100) / 100,
            });
            currentBase += compTax;
          }
          return res;
        })(),
      };
      const res = await api.post("/pos/sales", payload, {
        headers: { "x-skip-offline-queue": "1" },
      });
      setProducts((prev) =>
        prev.map((p) => {
          const sold = saleCart.find((c) => c.id === p.id);
          if (sold) {
            return {
              ...p,
              availQty: Math.max(
                0,
                Number(p.availQty || 0) - Number(sold.quantity || 0),
              ),
            };
          }
          return p;
        }),
      );
      setSelectedItems((prev) =>
        prev.map((p) => {
          const sold = saleCart.find((c) => c.id === p.id);
          if (sold) {
            return {
              ...p,
              availQty: Math.max(
                0,
                Number(p.availQty || 0) - Number(sold.quantity || 0),
              ),
            };
          }
          return p;
        }),
      );
      const rcp = String(res.data?.receipt_no || "");
      setReceiptNo(rcp);
      setSaleTimestamp(new Date());
      setShowModal(true);
      if (generalSettings.autoPrintReceipt) {
        setTimeout(() => printReceipt(), 500);
      }
    } catch (err) {
      const isNetworkError = !err?.response;
      if (isNetworkError) {
        const localId = uuid();
        const offSeq = (() => {
          try {
            return (
              Number(localStorage.getItem("omnisuite.pos.offlineSeq") || "0") +
              1
            );
          } catch {
            return 1;
          }
        })();
        try {
          localStorage.setItem("omnisuite.pos.offlineSeq", String(offSeq));
        } catch {}
        const offReceipt = `POS-${String(offSeq).padStart(6, "0")}-OFF`;
        setProducts((prev) =>
          prev.map((p) => {
            const sold = saleCart.find((c) => c.id === p.id);
            if (sold) {
              return {
                ...p,
                availQty: Math.max(
                  0,
                  Number(p.availQty || 0) - Number(sold.quantity || 0),
                ),
              };
            }
            return p;
          }),
        );
        setSelectedItems((prev) =>
          prev.map((p) => {
            const sold = saleCart.find((c) => c.id === p.id);
            if (sold) {
              return {
                ...p,
                availQty: Math.max(
                  0,
                  Number(p.availQty || 0) - Number(sold.quantity || 0),
                ),
              };
            }
            return p;
          }),
        );
        await saveLocalSale({
          id: localId,
          ...payload,
          status: "pending",
          createdAt: Date.now(),
          receipt_no: offReceipt,
        });
        setReceiptNo(offReceipt);
        setSaleTimestamp(new Date());
        setShowModal(true);
        toast.info(
          "Sale saved offline. It will sync when connectivity returns.",
        );
        if (generalSettings.autoPrintReceipt) {
          setTimeout(() => printReceipt(), 500);
        }
      } else {
        const message =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to complete sale";
        alert(message);
      }
    } finally {
      setSaving(false);
    }
  }

  function newSale() {
    setShowModal(false);
    setCart([]);
    setSelectedItems([]);
    setReceiptNo("");
    setAmountPaid("");
    setSelectedCustomerId("");
    setEntryBarcode("");
    setEntryQty(1);
    setSaleTimestamp(null);
    if (Array.isArray(paymentModes) && paymentModes.length) {
      const cashMode =
        paymentModes.find(
          (m) =>
            String(m.type || "")
              .trim()
              .toLowerCase() === "cash",
        ) || paymentModes[0];
      if (cashMode?.id) {
        setSelectedPaymentModeId(String(cashMode.id));
      }
    }
    if (barcodeInputRef.current) {
      try {
        barcodeInputRef.current.focus();
      } catch {}
    }
  }

  async function loadReceiptSettings() {
    try {
      const res = await api.get("/pos/receipt-settings");
      const item = res.data?.item || null;
      if (!item) return {};
      return {
        companyName: item.company_name || "",
        showLogo:
          item.show_logo === 1 ||
          item.show_logo === true ||
          item.show_logo === "1",
        showBarcode:
          item.show_barcode === 1 ||
          item.show_barcode === true ||
          item.show_barcode === "1",
        headerText: item.header_text || "",
        footerText: item.footer_text || "",
        contactNumber: item.contact_number || "",
        addressLine1: item.address_line1 || "",
        addressLine2: item.address_line2 || "",
        logoUrl: item.logo_url || "",
      };
    } catch {
      return {};
    }
  }

  async function printReceipt() {
    if (!cart.length) {
      return;
    }
    const settings = await loadReceiptSettings();
    const when = saleTimestamp ? new Date(saleTimestamp) : new Date();
    const dateStr = when.toLocaleString();
    const cashierName =
      user?.username || user?.name || user?.fullName || "Cashier";
    const method =
      selectedPaymentMode?.name ||
      (function () {
        const t = String(selectedPaymentMode?.type || "").toLowerCase();
        if (t === "cash") return "Cash";
        if (t === "card") return "Card";
        if (t === "mobile") return "Mobile Money";
        if (t === "bank") return "Bank";
        return "Other";
      })();
    const companyName = String(
      settings.companyName || companyInfo.name || "Company Name",
    );
    const addressParts = [];
    if (companyInfo.address) addressParts.push(companyInfo.address);
    const cityState = [companyInfo.city, companyInfo.state]
      .filter(Boolean)
      .join(", ");
    if (cityState) addressParts.push(cityState);
    if (companyInfo.country) addressParts.push(companyInfo.country);
    const addressLine1 = String(
      addressParts[0] || settings.addressLine1 || "Street address",
    );
    const addressLine2 = String(
      addressParts.slice(1).join(" • ") ||
        settings.addressLine2 ||
        "City, State, ZIP",
    );
    const contactNumber = String(
      companyInfo.phone || settings.contactNumber || "+1234567890",
    );
    const headerText = String(
      settings.headerText || "Thank you for your purchase",
    );
    const footerText = String(settings.footerText || "Please visit again");
    const extras = [];
    if (companyInfo.taxId) extras.push(`TIN: ${companyInfo.taxId}`);
    if (companyInfo.website) extras.push(companyInfo.website);
    const extraLine = extras.join(" • ");
    const showLogo = !!settings.showLogo;
    let logoUrl = showLogo ? String(settings.logoUrl || "").trim() : "";
    if (logoUrl) {
      const isAbsolute =
        logoUrl.startsWith("http://") ||
        logoUrl.startsWith("https://") ||
        logoUrl.startsWith("data:");
      if (!isAbsolute) {
        const origin = window.location.origin || "";
        if (logoUrl.startsWith("/")) {
          logoUrl = origin + logoUrl;
        } else {
          logoUrl = origin + "/" + logoUrl;
        }
      }
    }
    const logoHtml = logoUrl
      ? `<div class="center"><img src="${logoUrl}" alt="${companyName}" style="max-height:100px;margin-bottom:8px;object-fit:contain;" /></div>`
      : "";

    const rateDisplay = taxActive ? Number(taxRatePercent || 0) : 0;
    const customerNameSelected = selectedCustomerId
      ? String(
          customers.find((c) => String(c.id) === String(selectedCustomerId))
            ?.customer_name ||
            customers.find((c) => String(c.id) === String(selectedCustomerId))
              ?.name ||
            "",
        )
      : "";
    const itemsArr = cart.map((it) => ({
      name: it.name || "",
      qty: Number(it.quantity || 0),
      price: Number(it.price || 0),
      total: Math.max(0, Number(it.quantity || 0) * Number(it.price || 0) - Number(it.discount || 0)),
    }));
    const linesHtml = itemsArr
      .map((it) => {
        return `
          <tr>
            <td>${it.name}</td>
            <td class="right">${it.qty}</td>
            <td class="right">GH₵ ${it.price.toFixed(2)}</td>
            <td class="right">GH₵ ${it.total.toFixed(2)}</td>
          </tr>
        `;
      })
      .join("");

    let qrHtml = "";
    if (settings.showBarcode) {
      try {
        const qrData = JSON.stringify({
          receipt_no: receiptNo || "",
          date: when.toISOString(),
          company: companyName,
          cashier: cashierName,
          payment: method,
          customer: customerNameSelected || undefined,
          items: itemsArr,
          subtotal: subtotal,
          discount: discountTotal,
          tax: tax,
          total: total,
          tendered: tendered,
          change: changeDue,
        });
        const qrDataUrl = await QRCode.toDataURL(qrData, { width: 140, margin: 2 });
        qrHtml = `<div class="center" style="margin-top:12px;"><img src="${qrDataUrl}" alt="QR Code" style="width:140px;height:140px;" /></div>`;
      } catch {}
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>POS Receipt</title>
        <style>
          body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 16px 24px; max-width: 480px; margin: 0 auto; overflow-wrap: break-word; }
          h1 { text-align: center; margin: 0 0 4px; font-size: 18px; }
          .center { text-align: center; }
          .muted { font-size: 12px; color: #555; }
          .row { display: flex; justify-content: space-between; font-size: 13px; margin: 2px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th, td { padding: 4px; border-bottom: 1px solid #eee; }
          th { text-align: left; }
          th.right, td.right { text-align: right; }
          .totals { margin-top: 8px; border-top: 1px solid #000; padding-top: 4px; }
          .footer { margin-top: 10px; text-align: center; font-size: 11px; white-space: pre-wrap; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        ${logoHtml}
        <h1>${companyName}</h1>
        <div class="center muted">${addressLine1}</div>
        <div class="center muted">${addressLine2}</div>
        <div class="center muted">Mobile: ${contactNumber}</div>
        ${extraLine ? `<div class="center muted">${extraLine}</div>` : ""}
        <div class="center muted" style="margin-top:6px;">${headerText}</div>
        <hr />
        <div class="row"><span>Receipt No:</span><span>${
          receiptNo || "-"
        }</span></div>
        <div class="row"><span>Date:</span><span>${dateStr}</span></div>
        <div class="row"><span>Cashier:</span><span>${cashierName}</span></div>
        <div class="row"><span>Payment:</span><span>${method}</span></div>
        ${
          customerNameSelected
            ? `<div class="row"><span>Customer:</span><span>${customerNameSelected}</span></div>`
            : ""
        }
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th class="right">Qty</th>
              <th class="right">Price</th>
              <th class="right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${linesHtml}
          </tbody>
        </table>
        <div class="totals">
          <div class="row"><span>Subtotal</span><span>GH₵ ${subtotal.toFixed(
            2,
          )}</span></div>
          <div class="row"><span>Discount</span><span>GH₵ ${discountTotal.toFixed(2)}</span></div>${
            taxActive
              ? `<div class="row"><span>Tax</span><span>GH₵ ${tax.toFixed(2)}</span></div>`
              : ""
          }
          <div class="row"><strong>Grand Total</strong><strong>GH₵ ${total.toFixed(
            2,
          )}</strong></div>
          <div class="row"><span>Amount Tendered</span><span>GH₵ ${tendered.toFixed(2)}</span></div>
          <div class="row"><span>${changeDue >= 0 ? "Change" : "Amount Due"}</span><span>GH₵ ${Math.abs(changeDue).toFixed(2)}</span></div>
        </div>
        ${qrHtml}
        <div class="footer">${footerText}</div>
      </body>
      </html>
    `;
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc =
      iframe.contentWindow?.document || iframe.contentDocument || null;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }
    const printStyle = `<style>@media print { img, svg { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }</style>`;
    doc.open();
    doc.write(printStyle + html);
    doc.close();
    const win = iframe.contentWindow || window;
    const handlePrint = () => {
      win.focus();
      try {
        win.print();
      } catch {}
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 100);
    };
    setTimeout(handlePrint, 200);
  }

  return (
    <div className="space-y-3 pos-sales-entry pr-1">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/pos"
            className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to POS
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            POS Sales Entry
          </h1>
          {/* <p className="text-sm mt-1">
            Search products, build cart, and complete sale
          </p> */}
        </div>
        <div className="text-right">
          <div className="text-sm text-slate-700">
            {now.toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
          <div className="text-sm font-semibold text-brand-700">
            {now.toLocaleTimeString()}
          </div>
          <div className="mt-1 text-xs">
            <span className="mr-2">Terminal:</span>
            <span className="font-semibold">{terminalCode || "-"}</span>
            <span className="ml-3">
              <span
                className={`inline-block w-2 h-2 rounded-full mr-1 ${online ? "bg-green-500" : "bg-red-500"}`}
              />
              {online ? "Online" : "Offline"}
            </span>
            <span className="ml-3">
              Status:
              <span
                className={`ml-1 px-2 py-0.5 rounded ${
                  dayOpen
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {dayOpen ? "Open" : dayExists ? "Closed" : "Not Opened"}
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
        <div className="lg:col-span-3 space-y-3">
          {!dayExists && !dayLoading ? (
            <div className="alert alert-warning">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">POS Day not opened</div>
                  <div className="text-sm">
                    Open today’s POS Day before making sales.
                  </div>
                </div>
                <Link to="/pos/day-management" className="btn btn-primary">
                  Open Day
                </Link>
              </div>
            </div>
          ) : null}
          {dayExists && dayOpen && !dayLoading ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold">POS Day is Open</div>
                <div className="text-sm text-slate-600">
                  Review collections and close day when ready.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div style={{ minWidth: 220 }}>
                  <FilterableSelect
                    value={selectedCustomerId}
                    onChange={setSelectedCustomerId}
                    options={(Array.isArray(customers) ? customers : []).map(
                      (c) => ({
                        value: String(c.id),
                        label: String(c.customer_name || c.name || ""),
                      }),
                    )}
                    placeholder="Select customer"
                    disabled={false}
                    filterPlaceholder="Filter customers..."
                  />
                </div>
                <Link
                  to="/pos/cash-collection"
                  className="btn btn-primary"
                  title="Go to Cash Collection to close day"
                >
                  Check Account &amp; Close Day
                </Link>
              </div>
            </div>
          ) : null}
          <div className="card">
            <div className="card-body space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-5">
                  <label className="label">Barcode / Item Search</label>
                  <div className="relative">
                    <input
                      className="input w-full"
                      placeholder="Scan barcode or type item name"
                      value={entryBarcode}
                      onChange={(e) => setEntryBarcode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          if (barcodeDebounceRef.current) {
                            clearTimeout(barcodeDebounceRef.current);
                            barcodeDebounceRef.current = null;
                          }
                          if (itemSearchResults.length) {
                            handleSelectItemById(itemSearchResults[0].value);
                          } else {
                            addEntryToCart();
                          }
                        }
                      }}
                      ref={barcodeInputRef}
                      autoFocus
                      disabled={false}
                    />
                    {entryBarcode && itemSearchResults.length ? (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                        {itemSearchResults.map((o) => (
                          <button
                            type="button"
                            key={o.value}
                            className="block w-full text-left px-3 py-2 hover:bg-slate-50"
                            onClick={() => handleSelectItemById(o.value)}
                          >
                            <div className="flex justify-between items-center">
                              <span>{o.label}</span>
                              <span className="font-semibold text-brand-700 whitespace-nowrap ml-2">
                                GH₵ {Number(o.sellingPrice || 0).toFixed(2)}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="label">Quantity</label>
                  <input
                    type="number"
                    className="input w-full"
                    min={1}
                    value={entryQty}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEntryQty(v);
                      if (selectedItems.length === 1) {
                        updateCartField(selectedItems[0].id, "quantity", v);
                      }
                    }}
                    disabled={false}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="label">Price Type</label>
                  <FilterableSelect
                    value={entryPriceType}
                    onChange={(val) => setEntryPriceType(val)}
                    options={priceTypes.map((pt) => ({
                      value: String(pt.id),
                      label: String(pt.name || ""),
                    }))}
                    placeholder={
                      priceTypesLoading
                        ? "Loading price types..."
                        : "Select Price Type"
                    }
                    disabled={priceTypesLoading || !priceTypes.length}
                    filterPlaceholder="Filter price types..."
                  />
                </div>
                <div className="md:col-span-2 discount-guard">
                  <label className="label">Discount</label>
                  <input
                    name="discount"
                    type="number"
                    className={`input w-full ${(!canEditDiscount() || generalSettings.allowDiscounts === false) ? "disabled-light-blue" : ""}`}
                    min={0}
                    step="0.01"
                    value={headerDiscount}
                    onChange={(e) => {
                      const v = e.target.value;
                      setHeaderDiscount(v);
                      if (selectedItems.length === 1 && canEditDiscount() && generalSettings.allowDiscounts !== false) {
                        updateCartField(selectedItems[0].id, "discount", v);
                      }
                    }}
                    disabled={!canEditDiscount()}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-900 mb-2">
                  Item Information
                </div>
                {selectedItems.length ? (
                  <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <table className="min-w-full text-sm font-bold">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700">
                          <th className="px-3 py-2 text-left">Item Code</th>
                          <th className="px-3 py-2 text-left">Item Name</th>
                          <th className="px-3 py-2 text-right">
                            Available Qty
                          </th>
                          <th className="px-3 py-2 text-right">Price</th>
                          <th className="px-3 py-2 text-right">QTY</th>
                          <th className="px-3 py-2 text-right">Discount</th>
                          <th className="px-3 py-2 text-right">Total</th>
                          <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedItems.map((it) => {
                          const cartItem =
                            cart.find((c) => c.id === it.id) || null;
                          const qty = Number(cartItem?.quantity || 0);
                          const unitPrice = Number(cartItem?.price || 0);
                          const discount = Number(cartItem?.discount || 0);
                          const lineTotal = Math.max(
                            0,
                            qty * unitPrice - discount,
                          );
                          return (
                            <tr key={it.id}>
                              <td className="px-3 py-2">{it.code}</td>
                              <td className="px-3 py-2">{it.name}</td>
                              <td className="px-3 py-2 text-right">
                                {Number(it.availQty || 0)}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {`GH₵ ${unitPrice.toFixed(2)}`}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <div className="flex items-center gap-2 justify-end">
                                  <button
                                    type="button"
                                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                                    onClick={() => updateQuantity(it.id, -1)}
                                  >
                                    -
                                  </button>
                                  <span className="w-8 text-center font-semibold inline-block">
                                    {qty}
                                  </span>
                                  <button
                                    type="button"
                                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                                    onClick={() => updateQuantity(it.id, 1)}
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <div className="discount-guard">
                                  <input
                                    name="discount"
                                    type="number"
                                    className={`input text-right w-24 ${(!canEditDiscount() || generalSettings.allowDiscounts === false) ? "disabled-light-blue" : ""}`}
                                    min={1}
                                    step={1}
                                    value={discount}
                                    onChange={(e) =>
                                      updateCartField(
                                        it.id,
                                        "discount",
                                        e.target.value,
                                      )
                                    }
                                    disabled={!canEditDiscount()}
                                  />
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right">
                                {`GH₵ ${lineTotal.toFixed(2)}`}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  className="btn-danger inline-flex items-center justify-center"
                                  onClick={() => removeSelectedItem(it.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
                    Scan barcode or search item to add to cart
                  </div>
                )}
                {selectedItems.length > 0 && (
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      className="px-4 py-2 bg-[#0E3646] text-white font-semibold rounded-lg shadow hover:bg-[#092530] transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-[#0E3646]"
                      onClick={() => {
                        setAmountPaid("");
                        const input = document.getElementById("amountPaid");
                        if (input) {
                          // Allow React state to update first, then focus
                          setTimeout(() => {
                            input.focus();
                          }, 0);
                        }
                      }}
                    >
                      Enter Amount Tendered →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:pr-0">
          <div className="card">
            <div className="card-header bg-brand text-white rounded-t-lg">
              <div className="font-semibold text-lg">Shopping Cart</div>
            </div>
            <div className="card-body space-y-3 text-base" ref={cartRef}>
              {/* Selected items list hidden per requirement */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <div>Customer</div>
                  <div>
                    {selectedCustomerId
                      ? String(
                          customers.find(
                            (c) => String(c.id) === String(selectedCustomerId),
                          )?.customer_name || "",
                        )
                      : "-"}
                  </div>
                </div>
                <div className="flex justify-between">
                  <div>Discount</div>
                  <div>{`GH₵ ${discountTotal.toFixed(2)}`}</div>
                </div>
                <div className="flex justify-between">
                  <div>Subtotal</div>
                  <div>{`GH₵ ${subtotal.toFixed(2)}`}</div>
                </div>
                {taxActive ? (
                  <div className="flex justify-between">
                    <div>Tax</div>
                    <div>{`GH₵ ${tax.toFixed(2)}`}</div>
                  </div>
                ) : null}
                <div className="flex justify-between font-bold pt-2 border-t text-lg">
                  <div>Total</div>
                  <div className="font-extrabold">{`GH₵ ${total.toFixed(2)}`}</div>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <label htmlFor="amountPaid" className="mr-2">
                    Amount Tendered
                  </label>
                  <input
                    id="amountPaid"
                    type="number"
                    inputMode="decimal"
                    className="input text-right w-40"
                    step="1"
                    min="0"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder="0.00"
                    disabled={false}
                  />
                </div>
                <div className="flex justify-between text-lg mt-2">
                  <div>{changeDue >= 0 ? "Change" : "Amount Due"}</div>
                  <div
                    className={`font-semibold whitespace-nowrap ${changeDue >= 0 ? "text-brand-700" : "text-red-600"}`}
                  >
                    {`GH₵ ${Math.abs(changeDue).toFixed(2)}`}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body space-y-3 text-base">
              <div className="grid grid-cols-2 gap-2">
                {paymentModesLoading ? (
                  <div className="col-span-2 text-center text-sm text-slate-500">
                    Loading payment modes...
                  </div>
                ) : !paymentModes.length ? (
                  <div className="col-span-2 text-center text-sm text-slate-500">
                    No payment modes configured
                  </div>
                ) : (
                  paymentModes.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`btn text-base ${
                        String(selectedPaymentModeId) === String(m.id)
                          ? "btn-primary"
                          : "btn-secondary"
                      }`}
                      onClick={() => setSelectedPaymentModeId(String(m.id))}
                      disabled={false}
                    >
                      {m.name}
                    </button>
                  ))
                )}
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  className="btn-success w-full text-base"
                  onClick={clearCart}
                  disabled={false}
                >
                  Clear Cart
                </button>
                <button
                  type="button"
                  className="btn-success w-full text-base"
                  onClick={checkout}
                  disabled={
                    !cart.length ||
                    saving ||
                    paymentModesLoading ||
                    !paymentModes.length ||
                    !selectedPaymentModeId
                  }
                >
                  Complete Sale
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="text-2xl font-bold text-brand-700">
              Sale Completed
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between">
                <div>Receipt No</div>
                <div className="font-semibold">{receiptNo || "-"}</div>
              </div>
              <div className="flex justify-between">
                <div>Total</div>
                <div className="font-semibold">{`GH₵ ${total.toFixed(2)}`}</div>
              </div>
              <div className="flex justify-between">
                <div>Amount Tendered</div>
                <div className="font-semibold">{`GH₵ ${tendered.toFixed(2)}`}</div>
              </div>
              <div className="flex justify-between">
                <div>{changeDue >= 0 ? "Change" : "Amount Due"}</div>
                <div className="font-semibold">
                  {`GH₵ ${Math.abs(changeDue).toFixed(2)}`}
                </div>
              </div>
              <div className="flex justify-between">
                <div>Payment Method</div>
                <div className="font-semibold">
                  {selectedPaymentMode?.name ||
                    (function () {
                      const t = String(
                        selectedPaymentMode?.type || "",
                      ).toLowerCase();
                      if (t === "cash") return "Cash";
                      if (t === "card") return "Card";
                      if (t === "mobile") return "Mobile Money";
                      if (t === "bank") return "Bank";
                      return "Other";
                    })()}
                </div>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button type="button" className="btn-primary" onClick={newSale}>
                New Sale
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={printReceipt}
              >
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {showItemNotFound && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
            <div className="text-lg font-bold text-red-600">
              Item Not Registered
            </div>
            <p className="mt-2 text-sm text-slate-600">
              The scanned item is not registered in the system.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => {
                  setEntryBarcode("");
                  setShowItemNotFound(false);
                }}
              >
                Back
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={handleRegisterItem}
              >
                Register Item
              </button>
            </div>
          </div>
        </div>
      )}

      {showNoPermission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
            <div className="text-lg font-bold text-red-600">
              Permission Denied
            </div>
            <p className="mt-2 text-sm text-slate-600">
              You do not have permission to register new items. Contact your
              administrator.
            </p>
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowNoPermission(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
