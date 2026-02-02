import React, { useState, useEffect, useRef } from "react";
import {
  useNavigate,
  useParams,
  Link,
  useSearchParams,
} from "react-router-dom";
import { api } from "api/client";
import { useAuth } from "../../../../auth/AuthContext.jsx";
import defaultLogo from "../../../../assets/resources/OMNISUITE_LOGO_FILL.png";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  Save,
  Trash2,
  X,
  Plus,
  ArrowLeft,
  Printer,
  Download,
  Truck,
  User,
  FileText,
} from "lucide-react";

function escapeHtml(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolvePath(obj, rawPath) {
  const path = String(rawPath || "")
    .trim()
    .replace(/^\./, "");
  if (!path) return undefined;
  const parts = path.split(".").filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function renderTemplateString(templateHtml, data, root = data) {
  let out = String(templateHtml ?? "");

  out = out.replace(
    /{{#each\s+([^}]+)}}([\s\S]*?){{\/each}}/g,
    (_m, expr, inner) => {
      const key = String(expr || "").trim();
      const val = key.startsWith("@root.")
        ? resolvePath(root, key.slice(6))
        : (resolvePath(data, key) ?? resolvePath(root, key));
      const arr = Array.isArray(val) ? val : [];
      return arr
        .map((item) => renderTemplateString(inner, item ?? {}, root))
        .join("");
    },
  );

  out = out.replace(/{{{\s*([^}]+?)\s*}}}/g, (_m, expr) => {
    const key = String(expr || "").trim();
    let val;
    if (key === "this" || key === ".") val = data;
    else if (key.startsWith("@root.")) val = resolvePath(root, key.slice(6));
    else val = resolvePath(data, key) ?? resolvePath(root, key);
    return String(val ?? "");
  });

  out = out.replace(/{{\s*([^}]+?)\s*}}/g, (_m, expr) => {
    const key = String(expr || "").trim();
    let val;
    if (key === "this" || key === ".") val = data;
    else if (key.startsWith("@root.")) val = resolvePath(root, key.slice(6));
    else val = resolvePath(data, key) ?? resolvePath(root, key);
    return escapeHtml(val);
  });

  return out;
}

function wrapDoc(bodyHtml) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sales Order</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #fff; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; }
      th { background: #f8fafc; text-align: left; }
      .right { text-align: right; }
      .center { text-align: center; }
    </style>
  </head>
  <body>${bodyHtml || ""}</body>
</html>`;
}

async function waitForImages(rootEl) {
  const imgs = Array.from(rootEl.querySelectorAll("img"));
  if (!imgs.length) return;
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) return resolve();
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        }),
    ),
  );
}

export default function SalesOrderForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isViewMode =
    String(searchParams.get("mode") || "").toLowerCase() === "view";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("details");

  const [formData, setFormData] = useState({
    order_no: "",
    order_date: new Date().toISOString().split("T")[0],
    customer_id: "",
    quotation_id: "",
    status: "DRAFT",
    currency_id: 4,
    exchange_rate: 1,
    sales_person_id: "",
    warehouse_id: "",
    price_type: "RETAIL",
    payment_type: "CASH",
    payment_terms: "",
    priority: "MEDIUM",
    shipping_charges: 0,
    delivery_time: "",
    internal_notes: "",
    customer_notes: "",
    city: "",
    state: "",
    country: "",
    phone: "",
    remarks: "",
  });

  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const pdfRef = useRef(null);
  const [taxComponentsByCode, setTaxComponentsByCode] = useState({});
  const [companyInfo, setCompanyInfo] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    website: "",
    taxId: "",
    registrationNo: "",
    logoUrl: "",
  });
  const [preparedBy, setPreparedBy] = useState("");
  const [salesOrderTemplateHtml, setSalesOrderTemplateHtml] = useState(null);

  // New Item State
  const [newItem, setNewItem] = useState({
    item_id: "",
    item_name: "",
    qty: "",
    unit_price: "",
    discount_percent: 0,
    tax_type: "",
    remarks: "",
  });

  const statuses = [
    { value: "DRAFT", label: "Draft", color: "bg-gray-100 text-gray-800" },
    {
      value: "CONFIRMED",
      label: "Confirmed",
      color: "bg-blue-100 text-blue-800",
    },
    {
      value: "PROCESSING",
      label: "Processing",
      color: "bg-yellow-100 text-yellow-800",
    },
    {
      value: "SHIPPED",
      label: "Shipped",
      color: "bg-purple-100 text-purple-800",
    },
    {
      value: "DELIVERED",
      label: "Delivered",
      color: "bg-green-100 text-green-800",
    },
    {
      value: "CANCELLED",
      label: "Cancelled",
      color: "bg-red-100 text-red-800",
    },
  ];

  const priorities = [
    { value: "LOW", label: "Low" },
    { value: "MEDIUM", label: "Medium" },
    { value: "HIGH", label: "High" },
    { value: "URGENT", label: "Urgent" },
  ];

  // Helper: Calculate Item Totals
  const calcItemTotals = (itm) => {
    const qty = parseFloat(itm.qty) || 0;
    const price = parseFloat(itm.unit_price) || 0;
    const disc = parseFloat(itm.discount_percent) || 0;

    const sub = qty * price;
    const discAmt = (sub * disc) / 100;
    const net = sub - discAmt;

    const taxRate =
      taxes.find((t) => String(t.value) === String(itm.tax_type))?.rate || 0;
    const taxAmt = (net * taxRate) / 100;

    return { sub, discAmt, net, taxAmt, total: net + taxAmt };
  };

  // Helper: Calculate Grand Totals (match Quotation: net subtotal + tax)
  const calcGrandTotal = () => {
    const sub = items.reduce((s, i) => s + (i.net || 0), 0);
    const tax = items.reduce((s, i) => s + (i.taxAmt || 0), 0);
    return { sub, tax, total: sub + tax };
  };

  // Helper: Normalize tax identifier to numeric ID
  const resolveTaxId = (raw) => {
    if (raw === null || raw === undefined || raw === "") return null;
    const num = Number(raw);
    if (Number.isFinite(num) && String(num) === String(raw)) return num;
    const byCode = taxes.find(
      (t) => String(t.code || "") === String(raw || ""),
    );
    return byCode ? byCode.value : null;
  };

  const fetchAvailable = async (warehouseId, itemId) => {
    if (!warehouseId || !itemId) return 0;
    try {
      const resp = await api.get(
        `/inventory/stock/available?warehouse_id=${warehouseId}&item_id=${itemId}`,
      );
      return Number(resp.data?.qty || 0);
    } catch {
      return 0;
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchInventoryItems();
    fetchQuotations();
    fetchWarehouses();
    fetchCurrencies();
    fetchTaxCodes();
    fetchCompanyInfo();
    if (isEditMode) {
      fetchOrder();
    } else {
      api
        .get("/sales/orders/next-no")
        .then((resp) => {
          const nextNo = resp.data?.nextNo;
          if (nextNo) {
            setFormData((p) => ({ ...p, order_no: nextNo }));
          }
        })
        .catch(() => {
          setFormData((p) => ({
            ...p,
            order_no: p.order_no || "SO-000001",
          }));
        });
    }
  }, [id]);

  useEffect(() => {
    if (user?.username) {
      setPreparedBy(user.username);
    }
  }, [user]);

  const fetchCompanyInfo = async () => {
    try {
      const usernameFromAuth = user?.username || "";
      setPreparedBy(usernameFromAuth);
      const meResp = await api.get("/admin/me");
      const companyId = meResp.data?.scope?.companyId;
      const usernameFromApi = meResp.data?.user?.username || "";
      if (!usernameFromAuth && usernameFromApi) {
        setPreparedBy(usernameFromApi);
      }
      if (companyId) {
        const cResp = await api.get(`/admin/companies/${companyId}`);
        const item = cResp.data?.item || {};
        setCompanyInfo((prev) => ({
          ...prev,
          name: item.name || prev.name || "",
          address: item.address || prev.address || "",
          phone: item.telephone || prev.phone || "",
          email: item.email || prev.email || "",
          city: item.city || prev.city || "",
          state: item.state || prev.state || "",
          postalCode: item.postal_code || prev.postalCode || "",
          country: item.country || prev.country || "",
          website: item.website || prev.website || "",
          taxId: item.tax_id || prev.taxId || "",
          registrationNo: item.registration_no || prev.registrationNo || "",
          logoUrl:
            item.has_logo === 1 || item.has_logo === true
              ? `/api/admin/companies/${companyId}/logo`
              : defaultLogo,
        }));
      } else {
        setCompanyInfo((prev) => ({
          ...prev,
          logoUrl: prev.logoUrl || defaultLogo,
        }));
      }
    } catch {
      if (user?.username) {
        setPreparedBy(user.username);
      }
      setCompanyInfo((prev) => ({
        ...prev,
        logoUrl: prev.logoUrl || defaultLogo,
      }));
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await api.get("/sales/customers");
      setCustomers(
        Array.isArray(response.data?.items) ? response.data.items : [],
      );
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
  };

  const fetchInventoryItems = async () => {
    try {
      const response = await api.get("/inventory/items");
      setInventoryItems(
        Array.isArray(response.data?.items) ? response.data.items : [],
      );
    } catch (error) {
      console.error("Error fetching items:", error);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const response = await api.get("/inventory/warehouses");
      setWarehouses(
        Array.isArray(response.data?.items) ? response.data.items : [],
      );
    } catch (error) {
      console.error("Error fetching warehouses:", error);
    }
  };

  const fetchCurrencies = async () => {
    try {
      const response = await api.get("/finance/currencies");
      const arr = Array.isArray(response.data?.items)
        ? response.data.items
        : [];
      setCurrencies(arr);
      const cedi =
        arr.find(
          (c) =>
            String(c.code || c.currency_code || "").toUpperCase() === "GHS",
        ) ||
        arr.find((c) =>
          /ghana|cedi/i.test(String(c.name || c.currency_name || "")),
        );
      if (!isEditMode && cedi) {
        setFormData((prev) => ({ ...prev, currency_id: cedi.id }));
      }
    } catch (error) {
      console.error("Error fetching currencies:", error);
    }
  };

  const fetchTaxCodes = async () => {
    try {
      const response = await api.get("/finance/tax-codes");
      const fetchedTaxes = Array.isArray(response.data?.items)
        ? response.data.items
        : [];
      const mappedTaxes = fetchedTaxes.map((t) => ({
        value: t.id,
        label: t.name,
        rate: Number(t.rate_percent),
        code: t.code,
      }));
      setTaxes(mappedTaxes);

      // Update newItem default tax if taxes are loaded and newItem has no tax set
      if (mappedTaxes.length > 0 && !newItem.tax_type) {
        setNewItem((prev) => ({ ...prev, tax_type: mappedTaxes[0].value }));
      }
    } catch (error) {
      console.error("Error fetching tax codes:", error);
    }
  };

  const fetchTaxComponentsForCode = async (taxCodeId) => {
    const key = String(taxCodeId || "");
    if (!key) return;
    try {
      const resp = await api.get(`/finance/tax-codes/${taxCodeId}/components`);
      const items = Array.isArray(resp.data?.items) ? resp.data.items : [];
      setTaxComponentsByCode((prev) => ({ ...prev, [key]: items }));
    } catch {}
  };

  const ensureTaxComponentsLoaded = async () => {
    const uniqueTaxIds = Array.from(
      new Set(items.map((i) => String(i.tax_type)).filter(Boolean)),
    );
    const missing = uniqueTaxIds.filter((id) => !(id in taxComponentsByCode));
    if (missing.length) {
      await Promise.all(missing.map((id) => fetchTaxComponentsForCode(id)));
    }
  };

  const calcTaxComponentsTotals = () => {
    const sub = items.reduce((s, i) => s + (i.net || 0), 0);
    const compTotals = {};
    items.forEach((i) => {
      const comps = taxComponentsByCode[String(i.tax_type)] || [];
      comps.forEach((c) => {
        const rate = Number(c.rate_percent) || 0;
        const amt = ((i.net || 0) * rate) / 100;
        const name = c.component_name;
        if (!compTotals[name])
          compTotals[name] = { amount: 0, rate, sort_order: c.sort_order || 0 };
        compTotals[name].amount += amt;
      });
    });
    const components = Object.keys(compTotals)
      .map((name) => ({
        name,
        amount: compTotals[name].amount,
        rate: compTotals[name].rate,
        sort_order: compTotals[name].sort_order,
      }))
      .sort((a, b) => a.sort_order - b.sort_order);
    const taxTotal = components.reduce((s, c) => s + c.amount, 0);
    const total = sub + taxTotal;
    return { sub, components, taxTotal, total };
  };

  const calcAggregates = () => {
    const grossSub = items.reduce((s, i) => s + (i.sub || 0), 0);
    const discountTotal = items.reduce((s, i) => s + (i.discAmt || 0), 0);
    const netSub = items.reduce((s, i) => s + (i.net || 0), 0);
    const tc = calcTaxComponentsTotals();
    const grand = netSub + tc.taxTotal;
    return {
      grossSub,
      discountTotal,
      netSub,
      components: tc.components,
      taxTotal: tc.taxTotal,
      grand,
    };
  };

  const fetchQuotations = async () => {
    try {
      const response = await api.get("/sales/quotations");
      setQuotations(
        Array.isArray(response.data?.items) ? response.data.items : [],
      );
    } catch (error) {
      console.error("Error fetching quotations:", error);
    }
  };

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/sales/orders/${id}`);
      const data = response.data?.item;

      if (data) {
        setFormData((prev) => ({
          order_no: data.order_no || "",
          order_date: data.order_date
            ? new Date(data.order_date).toISOString().split("T")[0]
            : "",
          customer_id: data.customer_id || "",
          quotation_id: data.quotation_id || "",
          status: data.status || "DRAFT",
          warehouse_id: data.warehouse_id || "",
          price_type: data.price_type || "RETAIL",
          payment_type: data.payment_type || "CASH",
          currency_id: data.currency_id ?? prev.currency_id ?? "",
          exchange_rate: data.exchange_rate || 1,
          sales_person_id: data.sales_person_id || "",
          payment_terms: data.payment_terms || "",
          priority: data.priority || "MEDIUM",
          shipping_charges: data.shipping_charges || 0,
          delivery_time: data.delivery_time || "",
          internal_notes: data.internal_notes || "",
          customer_notes: data.customer_notes || "",
          remarks: data.remarks || "",
        }));

        if (response.data?.details) {
          let mappedItems = response.data.details.map((line, index) => {
            const calculations = calcItemTotals({
              qty: line.qty ?? line.quantity ?? 0,
              unit_price: line.unit_price ?? 0,
              discount_percent: line.discount_percent ?? 0,
              tax_type: line.tax_id ?? taxes?.[0]?.value ?? "",
            });
            return {
              ...line,
              line_id: index + 1,
              ...calculations,
            };
          });
          const wh = data.warehouse_id || formData.warehouse_id || "";
          if (wh) {
            const enriched = await Promise.all(
              mappedItems.map(async (it) => ({
                ...it,
                available_qty: await fetchAvailable(wh, it.item_id),
              })),
            );
            mappedItems = enriched;
          }
          setItems(mappedItems);
        }
      }
    } catch (error) {
      setError(error?.response?.data?.message || "Error fetching order");
      console.error("Error fetching order:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuotationChange = async (e) => {
    const quotationId = e.target.value;
    setFormData((prev) => ({ ...prev, quotation_id: quotationId }));

    if (!quotationId) return;

    try {
      setLoading(true);
      const response = await api.get(`/sales/quotations/${quotationId}`);
      const { item, details } = response.data;

      if (item) {
        setFormData((prev) => ({
          ...prev,
          customer_id: item.customer_id || "",
          currency_id: item.currency_id || prev.currency_id || "",
          exchange_rate: item.exchange_rate || prev.exchange_rate || 1,
          remarks: item.remarks || "",
          payment_terms: item.terms_and_conditions || prev.payment_terms || "",
          price_type: item.price_type || prev.price_type || "RETAIL",
          payment_type: item.payment_type || prev.payment_type || "CASH",
          warehouse_id: item.warehouse_id || prev.warehouse_id || "",
        }));
      }

      if (details && Array.isArray(details)) {
        const mappedItems = details.map((line, index) => {
          const inventoryItem = inventoryItems.find(
            (i) => i.id == line.item_id,
          );
          const qty = line.qty ?? line.quantity ?? 0;
          const unitPrice = line.unit_price ?? 0;
          const taxId = resolveTaxId(line.tax_id ?? taxes?.[0]?.value ?? "");
          const calculations = calcItemTotals({
            qty,
            unit_price: unitPrice,
            discount_percent: line.discount_percent ?? 0,
            tax_type: taxId,
          });
          const taxAmt =
            line.tax_amount !== undefined && line.tax_amount !== null
              ? Number(line.tax_amount)
              : calculations.taxAmt;
          const totalAmt =
            line.total_amount !== undefined && line.total_amount !== null
              ? Number(line.total_amount)
              : calculations.total;

          return {
            item_id: line.item_id,
            item_name:
              inventoryItem?.item_name ||
              line.item_name ||
              "Item " + line.item_id,
            qty,
            unit_price: unitPrice,
            discount_percent: line.discount_percent ?? 0,
            tax_type: taxId,
            tax_rate:
              line.tax_rate !== undefined && line.tax_rate !== null
                ? Number(line.tax_rate)
                : taxes.find((t) => String(t.value) === String(taxId))?.rate,
            remarks: line.remarks || "",
            line_id: Date.now() + index,
            ...calculations,
            taxAmt,
            total: totalAmt,
          };
        });
        setItems(mappedItems);
      }
    } catch (error) {
      console.error("Error fetching quotation details:", error);
      alert("Failed to load quotation details");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "customer_id") {
      const cust = customers.find((c) => String(c.id) === String(value));
      setFormData((prev) => ({
        ...prev,
        customer_id: value,
        city: cust?.city || "",
        state: cust?.state || "",
        country: cust?.country || "",
        phone: cust?.phone || cust?.customer_phone || "",
      }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNewItemChange = (e) => {
    const { name, value } = e.target;
    if (name === "item_id") {
      const prod = inventoryItems.find((p) => p.id === parseInt(value));
      setNewItem((prev) => ({
        ...prev,
        item_id: value,
        item_name: prod?.item_name || "",
        unit_price: prod?.selling_price || "",
        qty: 1,
      }));
      if (value) {
        if (formData.customer_id) {
          api
            .post("/sales/prices/best-price", {
              product_id: value,
              customer_id: formData.customer_id,
              quantity: 1,
              date: formData.order_date,
              price_type:
                typeof formData.price_type === "string"
                  ? formData.price_type
                  : String(formData.price_type || ""),
              only_standard: true,
            })
            .then((res) => {
              if (res.data && res.data.price !== undefined) {
                setNewItem((prev) => ({
                  ...prev,
                  unit_price: res.data.price,
                }));
              }
            })
            .catch((err) => console.error("Error fetching price:", err));
        }

        api
          .get(`/finance/item-tax/${value}`)
          .then((resp) => {
            const tax = resp.data?.tax;
            if (tax) {
              const resolvedTaxType =
                tax.id ||
                taxes.find((t) => t.code === tax.tax_code)?.value ||
                null;
              const resolvedTaxRate = resolvedTaxType
                ? taxes.find((t) => String(t.value) === String(resolvedTaxType))
                    ?.rate
                : null;
              setNewItem((prev) => ({
                ...prev,
                tax_type: resolvedTaxType ?? prev.tax_type,
                tax_rate:
                  resolvedTaxRate !== null && resolvedTaxRate !== undefined
                    ? resolvedTaxRate
                    : tax.tax_rate,
              }));
            } else {
              setNewItem((prev) => ({
                ...prev,
                tax_rate: undefined,
              }));
            }
          })
          .catch(() => {
            setNewItem((prev) => ({
              ...prev,
              tax_rate: undefined,
            }));
          });

        const wh = formData.warehouse_id;
        if (wh) {
          fetchAvailable(wh, Number(value)).then((aq) =>
            setNewItem((prev) => ({ ...prev, available_qty: aq })),
          );
        } else {
          setNewItem((prev) => ({ ...prev, available_qty: undefined }));
        }
      }
    } else {
      setNewItem((prev) => ({ ...prev, [name]: value }));
    }
  };

  const addItem = () => {
    if (!newItem.item_id || !newItem.qty || !newItem.unit_price) {
      alert("Please fill all required item fields");
      return;
    }
    if (
      formData.warehouse_id &&
      newItem.available_qty !== undefined &&
      Number(newItem.qty || 0) > Number(newItem.available_qty || 0)
    ) {
      alert("Quantity exceeds available stock for selected warehouse");
      return;
    }

    const normalizedTaxType =
      resolveTaxId(newItem.tax_type) ??
      (taxes.length > 0 ? taxes[0].value : null);
    const calculations = calcItemTotals({
      ...newItem,
      tax_type: normalizedTaxType,
    });
    setItems([
      ...items,
      {
        ...newItem,
        tax_type: normalizedTaxType,
        line_id: Date.now(),
        ...calculations,
        available_qty: newItem.available_qty,
      },
    ]);

    setNewItem({
      item_id: "",
      item_name: "",
      qty: "",
      unit_price: "",
      discount_percent: 0,
      tax_type: taxes.length > 0 ? taxes[0].value : "",
      tax_rate: undefined,
      remarks: "",
      available_qty: undefined,
    });
  };

  const removeItem = (lineId) => {
    setItems(items.filter((i) => i.line_id !== lineId));
  };

  const fetchSalesOrderTemplateHtml = async () => {
    if (salesOrderTemplateHtml !== null) return salesOrderTemplateHtml;
    try {
      const res = await api.get("/admin/document-templates/SALES_ORDER");
      const tpl = String(res.data?.item?.template_html || "").trim();
      setSalesOrderTemplateHtml(tpl);
      return tpl;
    } catch {
      setSalesOrderTemplateHtml("");
      return "";
    }
  };

  const buildSalesOrderTemplateData = () => {
    const logoUrl = String(companyInfo.logoUrl || "").trim();
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${escapeHtml(companyInfo.name || "Company")}" style="max-height:80px;object-fit:contain;" />`
      : "";
    const customer = customers.find(
      (c) => String(c.id) === String(formData.customer_id),
    );
    const aggregates = calcAggregates();
    const itemsData = (Array.isArray(items) ? items : []).map((i) => {
      const qty = Number(i.qty || 0);
      const unit = Number(i.unit_price || 0);
      const total = Number(i.total || qty * unit);
      return {
        item_name: String(i.item_name || ""),
        qty: qty.toFixed(2),
        unit_price: unit.toFixed(2),
        total: total.toFixed(2),
      };
    });
    return {
      company: {
        name: companyInfo.name || "Company",
        address: companyInfo.address || "",
        city: companyInfo.city || "",
        state: companyInfo.state || "",
        postalCode: companyInfo.postalCode || "",
        country: companyInfo.country || "",
        phone: companyInfo.phone || "",
        email: companyInfo.email || "",
        website: companyInfo.website || "",
        taxId: companyInfo.taxId || "",
        registrationNo: companyInfo.registrationNo || "",
        logoUrl,
        logoHtml,
      },
      salesOrder: {
        order_no: String(formData.order_no || ""),
        order_date: String(formData.order_date || ""),
        status: String(formData.status || ""),
        currency: String(
          currencies.find((c) => String(c.id) === String(formData.currency_id))
            ?.code || "",
        ),
        payment_type: String(formData.payment_type || ""),
        price_type: String(formData.price_type || ""),
        prepared_by: String(preparedBy || ""),
      },
      customer: {
        id: String(customer?.id || ""),
        code: String(customer?.customer_code || ""),
        name: String(customer?.customer_name || ""),
        type: String(customer?.customer_type || ""),
        contactPerson: String(customer?.contact_person || ""),
        email: String(customer?.email || ""),
        phone: String(customer?.phone || formData.phone || ""),
        mobile: String(customer?.mobile || ""),
        address: String(customer?.address || ""),
        city: String(customer?.city || formData.city || ""),
        state: String(customer?.state || formData.state || ""),
        zone: String(customer?.zone || ""),
        country: String(customer?.country || formData.country || ""),
        paymentTerms: String(customer?.payment_terms || ""),
        creditLimit: Number(customer?.credit_limit || 0).toFixed(2),
      },
      items: itemsData,
      totals: {
        subtotal: Number(aggregates.grossSub || 0).toFixed(2),
        discount: Number(aggregates.discountTotal || 0).toFixed(2),
        tax: Number(aggregates.taxTotal || 0).toFixed(2),
        total: Number(aggregates.grand || 0).toFixed(2),
      },
    };
  };

  const printUsingSalesOrderTemplate = async () => {
    const tpl = await fetchSalesOrderTemplateHtml();
    if (!tpl) return false;
    await ensureTaxComponentsLoaded();
    const data = buildSalesOrderTemplateData();
    const html = wrapDoc(renderTemplateString(tpl, data));
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
      return true;
    }
    doc.open();
    doc.write(html);
    doc.close();
    const win = iframe.contentWindow || window;
    const doPrint = () => {
      win.focus();
      try {
        win.print();
      } catch {}
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 100);
    };
    setTimeout(doPrint, 200);
    return true;
  };

  const downloadPdfUsingSalesOrderTemplate = async () => {
    const tpl = await fetchSalesOrderTemplateHtml();
    if (!tpl) return false;
    await ensureTaxComponentsLoaded();
    const data = buildSalesOrderTemplateData();
    const html = renderTemplateString(tpl, data);
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-10000px";
    container.style.top = "0";
    container.style.width = "794px";
    container.style.background = "white";
    container.style.padding = "32px";
    container.innerHTML = html;
    document.body.appendChild(container);
    try {
      await waitForImages(container);
      const canvas = await html2canvas(container, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let rendered = 0;
      while (rendered < imgHeight) {
        pdf.addImage(imgData, "PNG", 0, -rendered, imgWidth, imgHeight);
        rendered += pageHeight;
        if (rendered < imgHeight) pdf.addPage();
      }
      const fname =
        "SalesOrder_" +
        (formData.order_no || new Date().toISOString().slice(0, 10)) +
        ".pdf";
      pdf.save(fname);
    } finally {
      document.body.removeChild(container);
    }
    return true;
  };

  useEffect(() => {
    const wh = formData.warehouse_id;
    if (!wh) {
      setItems((prev) => prev.map((i) => ({ ...i, available_qty: undefined })));
      setNewItem((prev) => ({ ...prev, available_qty: undefined }));
      return;
    }
    (async () => {
      const enriched = await Promise.all(
        items.map(async (i) => ({
          ...i,
          available_qty: await fetchAvailable(wh, i.item_id),
        })),
      );
      setItems(enriched);
      if (newItem.item_id) {
        const aq = await fetchAvailable(wh, Number(newItem.item_id));
        setNewItem((prev) => ({ ...prev, available_qty: aq }));
      }
    })();
  }, [formData.warehouse_id]);

  const handlePrint = async () => {
    try {
      if (await printUsingSalesOrderTemplate()) return;
    } catch {}
    ensureTaxComponentsLoaded().finally(() => window.print());
  };

  const handleDownload = async () => {
    if (await downloadPdfUsingSalesOrderTemplate()) return;
    await ensureTaxComponentsLoaded();
    const el = pdfRef.current;
    if (!el) return;
    const original = el.style.cssText;
    el.style.cssText =
      original +
      ";position:fixed;left:-10000px;top:0;display:block;z-index:-1;background:white;width:794px;padding:32px;";
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let rendered = 0;
      while (rendered < imgHeight) {
        pdf.addImage(imgData, "PNG", 0, -rendered, imgWidth, imgHeight);
        rendered += pageHeight;
        if (rendered < imgHeight) pdf.addPage();
      }
      const fname =
        "SalesOrder_" +
        (formData.order_no || new Date().toISOString().slice(0, 10)) +
        ".pdf";
      pdf.save(fname);
    } finally {
      el.style.cssText = original;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customer_id || items.length === 0) {
      alert("Please select a customer and add at least one item");
      return;
    }

    setLoading(true);
    const totals = calcGrandTotal();

    let finalOrderNo = formData.order_no;
    if (!finalOrderNo) {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const randomSuffix = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");
      finalOrderNo = `SO-${dateStr}-${randomSuffix}`;
    }

    try {
      const payload = {
        ...formData,
        order_no: finalOrderNo,
        customer_id: Number(formData.customer_id),
        quotation_id: formData.quotation_id
          ? Number(formData.quotation_id)
          : null,
        total_amount: totals.total,
        sub_total: totals.sub,
        tax_amount: totals.tax,
        items: items.map((item) => {
          const taxIdEff = resolveTaxId(item.tax_type);
          const taxEntry = taxes.find(
            (t) => String(t.value) === String(taxIdEff),
          );
          return {
            item_id: item.item_id,
            quantity: Number(item.qty),
            unit_price: Number(item.unit_price),
            discount_percent: Number(item.discount_percent),
            tax_id: taxIdEff,
            tax_rate: taxEntry
              ? taxEntry.rate
              : Number(item.tax_rate || 0) || 0,
            tax_amount: item.taxAmt,
            total_amount: item.total,
            net_amount: item.net,
          };
        }),
      };

      if (isEditMode) {
        await api.put(`/sales/orders/${id}`, payload);
      } else {
        await api.post("/sales/orders", payload);
      }

      alert(
        isEditMode
          ? "Order updated successfully!"
          : "Order created successfully!",
      );
      navigate("/sales/sales-orders");
    } catch (error) {
      console.error("Error saving order:", error);
      const msg =
        error.response?.data?.message || error.message || "Unknown error";
      alert(`Error saving order: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const isConfirmed =
    String(formData.status || "").toUpperCase() === "CONFIRMED";
  const viewLocked = isViewMode && isConfirmed;
  return (
    <div
      className={`max-w-7xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden my-6 print:shadow-none print:my-0 print:w-full print:max-w-none`}
    >
      <style>{`
        @media print {
          @page { margin: 1cm; }
          body { 
            background: white; 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
          }
          #root > div > header,
          #root > div > div > aside { display: none !important; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          #root > div > div > main { padding: 0 !important; }
          input, select, textarea {
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
            appearance: none !important;
            -webkit-appearance: none !important;
            resize: none;
            overflow: visible;
          }
        }
        .quotation-table { 
          border-collapse: collapse; 
          table-layout: fixed; 
          width: 100%; 
          max-width: 100%; 
          border-spacing: 0; 
          box-sizing: border-box;
          margin: 0 auto;
        }
        .view-mode input, .view-mode select, .view-mode textarea {
          background-color: #eff6ff !important;
        }
        .quotation-table th, .quotation-table td { 
          border: 1px solid #000000; 
          box-sizing: border-box; 
          word-break: break-word; 
          overflow-wrap: anywhere; 
          white-space: normal; 
          padding: 6px 4px;
          font-size: 10px;
        }
        .quotation-table td {
          overflow: visible;
        }
        .quotation-table thead th { 
          background: #0E3646; 
          color: #ffffff; 
        }
        .quotation-table thead th:last-child,
        .quotation-table tbody td:last-child {
          background: #ffffff;
          color: #000000;
        }
        .quotation-table thead th:last-child {
          border-top: 1px solid #ffffff;
          border-right: 1px solid #ffffff;
          border-bottom: 1px solid #ffffff;
          border-left: 1px solid #000000;
        }
        .quotation-table tbody td:last-child {
          border-top: 1px solid #ffffff;
          border-right: 1px solid #ffffff;
          border-bottom: 1px solid #ffffff;
          border-left: 1px solid #000000;
        }
        @media print {
          .quotation-table {
            width: 100%;
            max-width: 100%;
          }
          .quotation-table thead th:last-child,
          .quotation-table tbody td:last-child {
            background: #ffffff !important;
            color: #000000 !important;
          }
          .quotation-table thead th:last-child {
            border-top: 1px solid #ffffff !important;
            border-right: 1px solid #ffffff !important;
            border-bottom: 1px solid #ffffff !important;
            border-left: 1px solid #000000 !important;
          }
          .quotation-table tbody td:last-child {
            border-top: 1px solid #ffffff !important;
            border-right: 1px solid #ffffff !important;
            border-bottom: 1px solid #ffffff !important;
            border-left: 1px solid #000000 !important;
          }
        }
      `}</style>

      {/* Header */}
      <div
        className="p-6 border-b text-white print:hidden"
        style={{ backgroundColor: "#0E3646" }}
      >
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">
              {isEditMode ? "Edit" : "New"} Sales Order
            </h2>
            <p className="text-sm opacity-80">
              {isEditMode ? "Update order details" : "Create a new sales order"}
            </p>
          </div>
          <div className="flex gap-4 print:hidden items-center">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors text-sm font-medium border border-white/20"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            <button
              onClick={handlePrint}
              className="text-white hover:text-gray-200"
            >
              <Printer className="w-6 h-6" />
            </button>
            <Link
              to="/sales/sales-orders"
              className="text-white hover:text-gray-200"
            >
              <ArrowLeft className="w-6 h-6" />
            </Link>
          </div>
        </div>
      </div>
      <div className={`p-6 print:hidden`}>
        <form onSubmit={handleSubmit}>
          {/* Tabs */}
          <div className="flex gap-4 border-b mb-6 print:hidden">
            <button
              type="button"
              onClick={() => setActiveTab("details")}
              className={`pb-2 px-4 font-medium transition-colors ${
                activeTab === "details"
                  ? "border-b-2 border-[#0E3646] text-[#0E3646]"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Order Details
            </button>
          </div>

          {/* Tab Content */}
          <fieldset
            disabled={viewLocked}
            className={isViewMode ? "view-mode" : ""}
          >
            <div
              className={
                activeTab === "details" || "print:block" ? "block" : "hidden"
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Order #
                  </label>
                  <input
                    type="text"
                    name="order_no"
                    value={formData.order_no}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                    placeholder="Auto-generated"
                    readOnly={!isEditMode && !formData.order_no}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    name="order_date"
                    value={formData.order_date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer *
                  </label>
                  <select
                    name="customer_id"
                    value={formData.customer_id}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                    required
                  >
                    <option value="">Select Customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.customer_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Warehouse
                  </label>
                  <select
                    name="warehouse_id"
                    value={formData.warehouse_id}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                  >
                    <option value="">Select Warehouse</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.warehouse_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quotation Ref
                  </label>
                  <select
                    name="quotation_id"
                    value={formData.quotation_id}
                    onChange={handleQuotationChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                  >
                    <option value="">Select Quotation</option>
                    {quotations.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.quotation_no} - {q.customer_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                  >
                    {statuses.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                  >
                    {priorities.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price Type
                  </label>
                  <select
                    name="price_type"
                    value={formData.price_type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                  >
                    <option value="RETAIL">Retail</option>
                    <option value="WHOLESALE">Wholesale</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Type
                  </label>
                  <select
                    name="payment_type"
                    value={formData.payment_type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                  >
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CREDIT">Credit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Currency
                  </label>
                  <select
                    name="currency_id"
                    value={formData.currency_id}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                  >
                    {currencies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code || c.currency_code} -{" "}
                        {c.name || c.currency_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Line Items Section */}
              <div className="border-t pt-6 mb-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">
                  Order Items
                </h3>

                {/* New Item Input */}
                <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200 print:hidden">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Item *
                      </label>
                      <select
                        name="item_id"
                        value={newItem.item_id}
                        onChange={handleNewItemChange}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                      >
                        <option value="">Select Item</option>
                        {inventoryItems.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.item_code} - {p.item_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Qty *
                      </label>
                      <input
                        type="number"
                        name="qty"
                        value={newItem.qty}
                        onChange={handleNewItemChange}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Available
                      </label>
                      <input
                        type="text"
                        value={
                          formData.warehouse_id
                            ? Number(newItem.available_qty || 0).toFixed(2)
                            : ""
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50"
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Price *
                      </label>
                      <input
                        type="number"
                        name="unit_price"
                        value={newItem.unit_price}
                        onChange={handleNewItemChange}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Disc %
                      </label>
                      <input
                        type="number"
                        name="discount_percent"
                        value={newItem.discount_percent}
                        onChange={handleNewItemChange}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                        min="0"
                        max="100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Tax
                      </label>
                      <select
                        name="tax_type"
                        value={newItem.tax_type}
                        onChange={handleNewItemChange}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                      >
                        {taxes.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      {newItem.tax_rate !== undefined && (
                        <div className="text-xs text-gray-500 mt-1">
                          Tax rate: {Number(newItem.tax_rate).toFixed(2)}%
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={addItem}
                      className="bg-[#0E3646] text-white px-4 py-2 rounded-lg hover:bg-[#092530] flex items-center gap-2 transition-colors text-sm"
                    >
                      <Plus className="w-4 h-4" /> Add Item
                    </button>
                  </div>
                </div>

                {/* Items List (adopt Quotation structure) */}
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Item
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Qty
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Available
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Price
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Disc%
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Net
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Tax
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Total
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider print:hidden">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {items.length === 0 ? (
                        <tr>
                          <td
                            colSpan="8"
                            className="px-4 py-8 text-center text-gray-500"
                          >
                            No items added yet
                          </td>
                        </tr>
                      ) : (
                        items.map((i) => (
                          <tr key={i.line_id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-900">
                              {i.item_name}
                            </td>
                            <td className="px-4 py-3 text-gray-900">{i.qty}</td>
                            <td className="px-4 py-3 text-gray-900">
                              {formData.warehouse_id
                                ? Number(i.available_qty || 0).toFixed(2)
                                : ""}
                            </td>
                            <td className="px-4 py-3 text-gray-900">
                              {parseFloat(i.unit_price).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-gray-900">
                              {parseFloat(i.discount_percent || 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-gray-900">
                              {i.net.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-gray-900">
                              {i.taxAmt.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {i.total.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 print:hidden">
                              <button
                                type="button"
                                onClick={() => removeItem(i.line_id)}
                                className="text-red-600 hover:text-red-900 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td
                          colSpan="4"
                          className="px-4 py-3 text-right font-semibold text-gray-700"
                        >
                          Totals:
                        </td>
                        <td className="px-4 py-3 font-bold text-gray-900">
                          {calcGrandTotal().sub.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 font-bold text-gray-900">
                          {calcGrandTotal().tax.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 font-bold text-gray-900">
                          {calcGrandTotal().total.toFixed(2)}
                        </td>
                        <td className="print:hidden"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </fieldset>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 mt-8 pt-6 border-t print:hidden">
            <Link
              to="/sales/sales-orders"
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-[#0E3646] text-white rounded-lg hover:bg-[#092530] font-medium transition-colors flex items-center gap-2"
            >
              {loading ? (
                "Saving..."
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {isEditMode ? "Update Order" : "Create Order"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      <div className="hidden print:block p-8 max-w-[19cm] mx-auto">
        <div className="grid grid-cols-3 gap-4 items-start mb-4">
          <div className="flex items-center gap-3">
            <img
              src={companyInfo.logoUrl || defaultLogo}
              alt={companyInfo.name || "Company"}
              className="w-16 h-16 object-contain border border-gray-300"
            />
            <div className="text-sm">
              <div className="font-semibold text-base">
                {companyInfo.name || "Company"}
              </div>
              {companyInfo.address && <div>{companyInfo.address}</div>}
              {(companyInfo.city ||
                companyInfo.state ||
                companyInfo.country) && (
                <div>
                  {[companyInfo.city, companyInfo.state, companyInfo.country]
                    .filter(Boolean)
                    .join(", ")}
                </div>
              )}
              <div className="flex gap-3">
                {companyInfo.phone && <span>{companyInfo.phone}</span>}
                {companyInfo.email && <span>{companyInfo.email}</span>}
              </div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold">Sales Order</div>
          </div>
          <div className="text-right text-sm">
            <div>DATE: {formData.order_date || ""}</div>
            <div>Order #: {formData.order_no || ""}</div>
            <div>
              Customer:{" "}
              {customers.find(
                (c) => String(c.id) === String(formData.customer_id),
              )?.customer_name || ""}
            </div>
            <div>City: {formData.city || ""}</div>
            <div>State: {formData.state || ""}</div>
            <div>Country: {formData.country || ""}</div>
            <div>Phone: {formData.phone || ""}</div>
            <div>Price Type: {formData.price_type || ""}</div>
            <div>Payment Type: {formData.payment_type || ""}</div>
            <div>
              Currency:{" "}
              {currencies.find(
                (c) => String(c.id) === String(formData.currency_id),
              )?.code || ""}
            </div>
            <div>
              Warehouse:{" "}
              {warehouses.find(
                (w) => String(w.id) === String(formData.warehouse_id),
              )?.warehouse_name || ""}
            </div>
            <div>Prepared by: {preparedBy || ""}</div>
          </div>
        </div>
        <div className="mb-2 mx-auto">
          <table className="quotation-table text-sm">
            <colgroup>
              <col style={{ width: "35%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "25%" }} />
              <col style={{ width: "25%" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="px-2 py-2 text-left">Description</th>
                <th className="px-2 py-2 text-right">Quantity</th>
                <th className="px-2 py-2 text-right">Unit Price</th>
                <th className="px-2 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.line_id}>
                  <td className="px-2 py-2">{i.item_name}</td>
                  <td className="px-2 py-2 text-right">
                    {Number(i.qty || 0).toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {Number(i.unit_price || 0).toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {Number(i.total || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div></div>
          <div>
            <div>
              <div className="grid grid-cols-2">
                <div className="px-2 py-1 font-medium">Subtotal</div>
                <div className="px-2 py-1 text-right">
                  {calcAggregates().grossSub.toFixed(2)}
                </div>
                <div className="px-2 py-1 font-medium">Discount</div>
                <div className="px-2 py-1 text-right">
                  {calcAggregates().discountTotal.toFixed(2)}
                </div>
                <div className="px-2 py-1 font-medium">Net Sub Total</div>
                <div className="px-2 py-1 text-right font-semibold">
                  {calcAggregates().netSub.toFixed(2)}
                </div>
                {calcAggregates().components.map((c) => (
                  <React.Fragment key={c.name}>
                    <div className="px-2 py-1">
                      {c.name} [{c.rate}%]
                    </div>
                    <div className="px-2 py-1 text-right">
                      {c.amount.toFixed(2)}
                    </div>
                  </React.Fragment>
                ))}
                <div className="px-2 py-1 font-semibold">Total</div>
                <div className="px-2 py-1 text-right font-semibold">
                  {calcAggregates().grand.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 text-center text-sm">
          THANK YOU FOR YOUR BUSINESS!
        </div>
      </div>
      <div
        ref={pdfRef}
        className="hidden p-8 bg-white"
        style={{ width: "794px", maxWidth: "794px" }}
      >
        <div className="grid grid-cols-3 gap-4 items-start mb-4">
          <div className="flex items-center gap-3">
            <img
              src={companyInfo.logoUrl || defaultLogo}
              alt={companyInfo.name || "Company"}
              className="w-16 h-16 object-contain border border-gray-300"
            />
            <div className="text-sm">
              <div className="font-semibold text-base">
                {companyInfo.name || "Company"}
              </div>
              {companyInfo.address && <div>{companyInfo.address}</div>}
              {(companyInfo.city ||
                companyInfo.state ||
                companyInfo.country) && (
                <div>
                  {[companyInfo.city, companyInfo.state, companyInfo.country]
                    .filter(Boolean)
                    .join(", ")}
                </div>
              )}
              <div className="flex gap-3">
                {companyInfo.phone && <span>{companyInfo.phone}</span>}
                {companyInfo.email && <span>{companyInfo.email}</span>}
              </div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold">Sales Order</div>
          </div>
          <div className="text-right text-sm">
            <div>DATE: {formData.order_date || ""}</div>
            <div>Order #: {formData.order_no || ""}</div>
            <div>
              Customer:{" "}
              {customers.find(
                (c) => String(c.id) === String(formData.customer_id),
              )?.customer_name || ""}
            </div>
            <div>City: {formData.city || ""}</div>
            <div>State: {formData.state || ""}</div>
            <div>Country: {formData.country || ""}</div>
            <div>Phone: {formData.phone || ""}</div>
            <div>Price Type: {formData.price_type || ""}</div>
            <div>Payment Type: {formData.payment_type || ""}</div>
            <div>
              Currency:{" "}
              {currencies.find(
                (c) => String(c.id) === String(formData.currency_id),
              )?.code || ""}
            </div>
            <div>
              Warehouse:{" "}
              {warehouses.find(
                (w) => String(w.id) === String(formData.warehouse_id),
              )?.warehouse_name || ""}
            </div>
            <div>Prepared by: {preparedBy || ""}</div>
          </div>
        </div>
        <div
          className="mb-2"
          style={{ width: "100%", overflow: "visible", margin: "0 auto" }}
        >
          <table
            className="quotation-table text-sm"
            style={{ width: "100%", tableLayout: "fixed" }}
          >
            <colgroup>
              <col style={{ width: "35%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "25%" }} />
              <col style={{ width: "25%" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="px-2 py-2 text-left">Description</th>
                <th className="px-2 py-2 text-right">Quantity</th>
                <th className="px-2 py-2 text-right">Unit Price</th>
                <th className="px-2 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.line_id}>
                  <td className="px-2 py-2">{i.item_name}</td>
                  <td className="px-2 py-2 text-right">
                    {Number(i.qty || 0).toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {Number(i.unit_price || 0).toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {Number(i.total || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div></div>
          <div>
            <div>
              <div className="grid grid-cols-2">
                <div className="px-2 py-1 font-medium">Gross Subtotal</div>
                <div className="px-2 py-1 text-right">
                  {calcAggregates().grossSub.toFixed(2)}
                </div>
                <div className="px-2 py-1 font-medium">Discount</div>
                <div className="px-2 py-1 text-right">
                  {calcAggregates().discountTotal.toFixed(2)}
                </div>
                <div className="px-2 py-1 font-medium">Net Sub Total</div>
                <div className="px-2 py-1 text-right font-semibold">
                  {calcAggregates().netSub.toFixed(2)}
                </div>
                {calcAggregates().components.map((c) => (
                  <div key={c.name} className="contents">
                    <div className="px-2 py-1">
                      {c.name} [{c.rate}%]
                    </div>
                    <div className="px-2 py-1 text-right">
                      {c.amount.toFixed(2)}
                    </div>
                  </div>
                ))}
                <div className="px-2 py-1 font-semibold">Total</div>
                <div className="px-2 py-1 text-right font-semibold">
                  {calcAggregates().grand.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
