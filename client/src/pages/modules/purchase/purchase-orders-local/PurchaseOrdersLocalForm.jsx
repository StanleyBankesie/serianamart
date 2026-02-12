import React, { useEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { api } from "api/client";
import { useAuth } from "../../../../auth/AuthContext.jsx";
import defaultLogo from "../../../../assets/resources/OMNISUITE_LOGO_FILL.png";
import UnitConversionModal from "@/components/UnitConversionModal";
import { useUoms } from "@/hooks/useUoms";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Printer, Download } from "lucide-react";

export default function PurchaseOrdersLocalForm() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isNew = !id || id === "new";
  const isEdit =
    Boolean(id) &&
    id !== "new" &&
    (location.pathname.includes("/edit") ||
      (() => {
        try {
          const params = new URLSearchParams(location.search || "");
          const mode = String(params.get("mode") || "").toLowerCase();
          const editFlag = String(params.get("edit") || "").toLowerCase();
          return mode === "edit" || editFlag === "1" || editFlag === "true";
        } catch {
          return false;
        }
      })());
  const isView = Boolean(id) && id !== "new" && !isEdit;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showForwardModal, setShowForwardModal] = useState(false);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState("");
  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [firstApprover, setFirstApprover] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [submittingForward, setSubmittingForward] = useState(false);
  const [workflowsCache, setWorkflowsCache] = useState(null);
  const [targetApproverId, setTargetApproverId] = useState(null);

  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [allQuotations, setAllQuotations] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [standardPrices, setStandardPrices] = useState([]);
  const [unitConversions, setUnitConversions] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const pdfRef = useRef(null);

  // Form State
  const [formData, setFormData] = useState({
    po_no: "",
    po_date: new Date().toISOString().split("T")[0],
    supplier_id: "",
    quotation_id: "",
    po_type: "LOCAL",
    status: "DRAFT",
    warehouse_id: "",
    currency: "GHS",
    exchange_rate: 1,
    delivery_date: "",
    payment_terms: 30,
    remarks: "",
    // Import specific fields
    port_loading: "",
    port_discharge: "",
    incoterms: "",
    hs_code: "",
    shipping_date: "",
    insurance_required: false,
    // Summary fields
    freight_amount: 0,
    other_charges: 0,
    discount_amount: 0,
    tax_amount: 0,
    terms_conditions: `1. All goods must meet specified quality standards
2. Delivery to be made as per schedule
3. Payment terms: Net 30 days from delivery
4. Supplier responsible for any defects within warranty period
5. Late delivery penalties may apply as per agreement
6. All disputes subject to arbitration in Accra, Ghana`,
  });

  const [items, setItems] = useState([
    {
      item_id: "",
      qty: 0,
      uom: "",
      unit_price: 0,
      discount_percent: 0,
      tax_percent: 0,
      line_total: 0,
    },
  ]);
  const [companyInfo, setCompanyInfo] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    city: "",
    state: "",
    country: "",
    logoUrl: "",
  });
  const [convModal, setConvModal] = useState({
    open: false,
    itemId: null,
    defaultUom: "",
    currentUom: "",
    rowIdx: null,
  });

  const { uoms } = useUoms();
  const defaultUomCode = useMemo(() => {
    const list = Array.isArray(uoms) ? uoms : [];
    const pcs =
      list.find((u) => String(u.uom_code || "").toUpperCase() === "PCS") ||
      list[0];
    if (pcs && pcs.uom_code) return pcs.uom_code;
    return "PCS";
  }, [uoms]);
  // Load Lookups
  useEffect(() => {
    let mounted = true;
    async function loadLookups() {
      try {
        const [supRes, whRes, itemsRes, quotRes, convRes] =
          await Promise.allSettled([
            api.get("/purchase/suppliers"),
            api.get("/inventory/warehouses"),
            api.get("/inventory/items"),
            api.get("/purchase/quotations"),
            api.get("/inventory/unit-conversions"),
          ]);

        if (!mounted) return;
        if (supRes.status === "fulfilled") {
          setSuppliers(
            Array.isArray(supRes.value.data?.items)
              ? supRes.value.data.items
              : [],
          );
        }
        if (whRes.status === "fulfilled") {
          setWarehouses(
            Array.isArray(whRes.value.data?.items)
              ? whRes.value.data.items
              : [],
          );
        }
        if (itemsRes.status === "fulfilled") {
          setAvailableItems(
            Array.isArray(itemsRes.value.data?.items)
              ? itemsRes.value.data.items
              : [],
          );
        }
        if (quotRes.status === "fulfilled") {
          const rawQuotations = Array.isArray(quotRes.value.data?.items)
            ? quotRes.value.data.items
            : [];
          setAllQuotations(rawQuotations);
          const sid = String(formData.supplier_id || "");
          const filtered =
            sid && sid.length
              ? rawQuotations.filter(
                  (q) => String(q.supplier_id) === String(sid),
                )
              : [];
          setQuotations(filtered);
        }
        if (convRes.status === "fulfilled") {
          setUnitConversions(
            Array.isArray(convRes.value.data?.items)
              ? convRes.value.data.items
              : [],
          );
        }
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load lookups");
      }
    }
    loadLookups();
    return () => {
      mounted = false;
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
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
        "PurchaseOrder_" +
        (formData.po_no || new Date().toISOString().slice(0, 10)) +
        ".pdf";
      pdf.save(fname);
    } finally {
      el.style.cssText = original;
    }
  };

  useEffect(() => {
    let mounted = true;
    async function fetchCurrencies() {
      try {
        const response = await api.get("/finance/currencies");
        if (!mounted) return;
        const arr = Array.isArray(response.data?.items)
          ? response.data.items
          : [];
        setCurrencies(arr);
      } catch {}
    }
    fetchCurrencies();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    async function ensureUsdGhsRate() {
      try {
        const arr = Array.isArray(currencies) ? currencies : [];
        if (!arr.length) return;
        const base =
          arr.find(
            (c) =>
              String(c.is_base) === "1" ||
              c.is_base === 1 ||
              c.is_base === true,
          ) ||
          arr.find(
            (c) =>
              String(c.code || c.currency_code || "").toUpperCase() === "GHS",
          ) ||
          arr.find((c) =>
            /ghana|cedi/i.test(String(c.name || c.currency_name || "")),
          );
        const usd = arr.find(
          (c) =>
            String(c.code || c.currency_code || "").toUpperCase() === "USD",
        );
        if (!base || !usd || base.id === usd.id) return;
        const toDate =
          formData.po_date || new Date().toISOString().split("T")[0];
        const res = await api.get("/finance/currency-rates", {
          params: {
            fromCurrencyId: usd.id,
            toCurrencyId: base.id,
            to: toDate,
          },
        });
        const list = Array.isArray(res.data?.items) ? res.data.items : [];
        if (!list.length) {
          try {
            await api.post("/finance/currency-rates", {
              fromCurrencyId: usd.id,
              toCurrencyId: base.id,
              rate: 1,
              rateDate: toDate,
            });
          } catch {}
        }
      } catch {}
    }
    ensureUsdGhsRate();
  }, [currencies, formData.po_date]);

  useEffect(() => {
    let mounted = true;
    async function loadStandardPrices() {
      try {
        const res = await api.get("/sales/prices/standard");
        if (!mounted) return;
        const arr = Array.isArray(res.data?.items) ? res.data.items : [];
        setStandardPrices(arr);
      } catch {}
    }
    loadStandardPrices();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadTaxCodes() {
      try {
        const response = await api.get("/finance/tax-codes");
        if (!mounted) return;
        const fetchedTaxes = Array.isArray(response.data?.items)
          ? response.data.items
          : [];
        const mappedTaxes = fetchedTaxes.map((t) => ({
          value: t.id,
          label: t.name,
          rate: Number(t.rate_percent),
        }));
        setTaxes(mappedTaxes);
      } catch {}
    }
    loadTaxCodes();
    return () => {
      mounted = false;
    };
  }, []);

  const fetchExchangeRateForCode = async (selectedCode) => {
    const code = String(selectedCode || "").toUpperCase();
    const arr = Array.isArray(currencies) ? currencies : [];
    if (!code || !arr.length) return;
    const base =
      arr.find(
        (c) =>
          String(c.is_base) === "1" || c.is_base === 1 || c.is_base === true,
      ) ||
      arr.find(
        (c) => String(c.code || c.currency_code || "").toUpperCase() === "GHS",
      ) ||
      arr.find((c) =>
        /ghana|cedi/i.test(String(c.name || c.currency_name || "")),
      );
    const target = arr.find(
      (c) => String(c.code || c.currency_code || "").toUpperCase() === code,
    );
    if (!base || !target || base.id === target.id) {
      setFormData((prev) => ({ ...prev, exchange_rate: 1 }));
      return;
    }
    try {
      const toDate = formData.po_date || new Date().toISOString().split("T")[0];
      const res = await api.get("/finance/currency-rates", {
        params: {
          fromCurrencyId: target.id,
          toCurrencyId: base.id,
          to: toDate,
        },
      });
      const list = Array.isArray(res.data?.items) ? res.data.items : [];
      const first = list[0];
      if (first && first.rate) {
        setFormData((prev) => ({
          ...prev,
          exchange_rate: Number(first.rate) || prev.exchange_rate || 1,
        }));
      } else {
        try {
          await api.post("/finance/currency-rates", {
            fromCurrencyId: target.id,
            toCurrencyId: base.id,
            rate: 1,
            rateDate: toDate,
          });
          setFormData((prev) => ({ ...prev, exchange_rate: 1 }));
        } catch {
          setFormData((prev) => ({ ...prev, exchange_rate: 1 }));
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchExchangeRateForCode(formData.currency);
  }, [currencies, formData.currency, formData.po_date]);
  useEffect(() => {
    if (isEdit) return;

    let mounted = true;

    api
      .get("/purchase/orders/next-no", {
        params: { po_type: formData.po_type || "LOCAL" },
      })
      .then((res) => {
        if (!mounted) return;
        if (res.data?.nextNo) {
          const raw = String(res.data.nextNo || "");
          const lp = raw.replace(/^PO-/i, "LP-");
          const ensured = lp.toUpperCase().startsWith("LP-")
            ? lp
            : `LP-${raw.replace(/^LP-/i, "")}`;
          setFormData((prev) => ({
            ...prev,
            po_no: prev.po_no || ensured,
          }));
        }
      })
      .catch((err) =>
        console.error("Failed to load next purchase order number", err),
      );

    return () => {
      mounted = false;
    };
  }, [isEdit, formData.po_type]);

  useEffect(() => {
    fetchCompanyInfo();
  }, []);

  async function fetchCompanyInfo() {
    try {
      const meResp = await api.get("/admin/me");
      const companyId = meResp.data?.scope?.companyId;
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
          country: item.country || prev.country || "",
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
      setCompanyInfo((prev) => ({
        ...prev,
        logoUrl: prev.logoUrl || defaultLogo,
      }));
    }
  }

  // Load PO Data
  useEffect(() => {
    if (isNew) return;
    let mounted = true;
    setLoading(true);
    setError("");
    api
      .get(`/purchase/orders/${id}`)
      .then((res) => {
        if (!mounted) return;
        const po = res.data?.item;
        const details = Array.isArray(res.data?.item?.details)
          ? res.data.item.details
          : [];
        if (!po) return;
        setFormData({
          po_no: po.po_no || "",
          po_date: po.po_date || new Date().toISOString().split("T")[0],
          supplier_id: po.supplier_id ? String(po.supplier_id) : "",
          po_type: po.po_type || "LOCAL",
          status: po.status || "DRAFT",
          warehouse_id: po.warehouse_id ? String(po.warehouse_id) : "",
          currency: po.currency || "GHS",
          exchange_rate: Number(po.exchange_rate) || 1,
          delivery_date: po.delivery_date || "",
          payment_terms: po.payment_terms || 30,
          remarks: po.remarks || "",
          port_loading: po.port_loading || "",
          port_discharge: po.port_discharge || "",
          incoterms: po.incoterms || "",
          hs_code: po.hs_code || "",
          shipping_date: po.shipping_date || "",
          insurance_required: Boolean(po.insurance_required),
          freight_amount: Number(po.freight_amount) || 0,
          other_charges: Number(po.other_charges) || 0,
          discount_amount: Number(po.discount_amount) || 0,
          tax_amount: Number(po.tax_amount) || 0,
          terms_conditions: po.terms_conditions || formData.terms_conditions,
        });
        setItems(
          details.length
            ? details
                .filter((d) => d)
                .map((d) => ({
                  item_id: d.item_id ? String(d.item_id) : "",
                  qty: Number(d.qty) || 0,
                  uom: d.uom || "",
                  unit_price: Number(d.unit_price) || 0,
                  discount_percent: Number(d.discount_percent) || 0,
                  tax_percent: Number(d.tax_percent) || 0,
                  line_total: Number(d.line_total) || 0,
                }))
            : [
                {
                  item_id: "",
                  qty: 0,
                  uom: "",
                  unit_price: 0,
                  discount_percent: 0,
                  tax_percent: 0,
                  line_total: 0,
                },
              ],
        );
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load purchase order");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  // Calculations
  const summary = useMemo(() => {
    let subTotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    items.forEach((item) => {
      if (!item) return;
      const qty = Number(item.qty) || 0;
      const price = Number(item.unit_price) || 0;
      const discPct = Number(item.discount_percent) || 0;
      const taxPct = Number(item.tax_percent) || 0;

      const base = qty * price;
      const disc = base * (discPct / 100);
      const taxable = base - disc;
      const tax = taxable * (taxPct / 100);

      subTotal += base;
      totalDiscount += disc;
      totalTax += tax;
    });

    const freight = Number(formData.freight_amount) || 0;
    const other = Number(formData.other_charges) || 0;

    const grandTotal = subTotal - totalDiscount + totalTax + freight + other;

    return {
      subTotal,
      totalDiscount,
      totalTax,
      freight,
      other,
      grandTotal,
    };
  }, [items, formData.freight_amount, formData.other_charges]);

  // Handlers
  const handleInputChange = async (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (name === "supplier_id") {
      const supId = String(value || "");
      if (supId) {
        const filtered = (
          Array.isArray(allQuotations) ? allQuotations : []
        ).filter((q) => String(q.supplier_id) === supId);
        setQuotations(filtered);
        setFormData((prev) => {
          const stillValid = filtered.some(
            (q) => String(q.id) === String(prev.quotation_id || ""),
          );
          return {
            ...prev,
            quotation_id: stillValid ? prev.quotation_id : "",
          };
        });
        try {
          const sup = suppliers.find((s) => String(s.id) === supId);
          const acctSearch =
            (sup && sup.supplier_code && String(sup.supplier_code).trim()) ||
            (sup ? `SU-${String(Number(sup.id || 0)).padStart(6, "0")}` : "");
          if (acctSearch) {
            const res = await api.get("/finance/accounts", {
              params: { search: acctSearch },
            });
            const items = Array.isArray(res.data?.items) ? res.data.items : [];
            const exact =
              items.find((a) => String(a.code) === acctSearch) ||
              items[0] ||
              null;
            const accCode =
              (exact &&
                (exact.currency_code ||
                  exact.currency ||
                  exact.currencyCode)) ||
              null;
            if (accCode) {
              const code = String(accCode).toUpperCase();
              setFormData((prev) => ({
                ...prev,
                currency: code,
              }));
              await fetchExchangeRateForCode(code);
            }
          }
        } catch {}
      } else {
        setQuotations(Array.isArray(allQuotations) ? allQuotations : []);
      }
    }

    if (name === "quotation_id" && value) {
      try {
        const res = await api.get(`/purchase/quotations/${value}`);
        const q = res.data?.item;
        if (q) {
          const arr = Array.isArray(currencies) ? currencies : [];
          const currencyMatch = arr.find(
            (c) => String(c.id) === String(q.currency_id || ""),
          );
          const currencyCode =
            String(
              currencyMatch?.code ||
                currencyMatch?.currency_code ||
                q.currency_code ||
                q.currency ||
                "",
            ).toUpperCase() || formData.currency;
          const allowedCurrencyCodes = new Set(["USD", "EUR", "GBP"]);
          const newCurrency = allowedCurrencyCodes.has(currencyCode)
            ? currencyCode
            : formData.currency;
          setFormData((prev) => ({
            ...prev,
            supplier_id: q.supplier_id
              ? String(q.supplier_id)
              : prev.supplier_id,
            currency: newCurrency,
            exchange_rate:
              q.exchange_rate !== undefined && q.exchange_rate !== null
                ? Number(q.exchange_rate) || prev.exchange_rate || 1
                : prev.exchange_rate,
            delivery_date: q.valid_until || prev.delivery_date || "",
            remarks: q.remarks || prev.remarks || "",
          }));
          if (!(q.exchange_rate !== undefined && q.exchange_rate !== null)) {
            await fetchExchangeRateForCode(newCurrency);
          }

          if (q.details) {
            const newItems = q.details.map((d) => ({
              item_id: String(d.item_id),
              qty: Number(d.qty) || 0,
              uom: d.uom || defaultUomCode,
              unit_price: Number(d.unit_price) || 0,
              discount_percent: Number(d.discount_percent) || 0,
              tax_percent: 0,
              line_total: Number(d.line_total) || 0,
            }));
            setItems(newItems);
          }
        }
      } catch (err) {
        console.error("Failed to fetch quotation details", err);
      }
    }
    if (name === "currency") {
      await fetchExchangeRateForCode(value);
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };

    if (field === "item_id") {
      const selectedItem = availableItems.find(
        (i) => String(i.id) === String(value),
      );
      const fallbackUom = selectedItem?.uom || defaultUomCode;
      updated[index].uom = fallbackUom;

      const fallbackPrice = selectedItem
        ? Number(selectedItem.cost_price) || 0
        : 0;
      let unitPrice = fallbackPrice;

      if (Array.isArray(standardPrices) && standardPrices.length) {
        const filtered = standardPrices
          .filter((p) => String(p.product_id) === String(value))
          .sort((a, b) => {
            const ad = a.effective_date
              ? new Date(a.effective_date).getTime()
              : 0;
            const bd = b.effective_date
              ? new Date(b.effective_date).getTime()
              : 0;
            return (
              bd - ad ||
              new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
            );
          });
        if (filtered.length > 0) {
          unitPrice = Number(filtered[0].cost_price) || unitPrice;
        }
      }

      updated[index].unit_price = unitPrice;
    }

    const qty = Number(updated[index].qty) || 0;
    const price = Number(updated[index].unit_price) || 0;
    const discPct = Number(updated[index].discount_percent) || 0;
    const taxPct = Number(updated[index].tax_percent) || 0;

    const base = qty * price;
    const disc = base * (discPct / 100);
    const taxable = base - disc;
    const tax = taxable * (taxPct / 100);
    updated[index].line_total = taxable + tax;

    setItems(updated);
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        item_id: "",
        qty: 0,
        uom: "",
        unit_price: 0,
        discount_percent: 0,
        tax_percent: 0,
        line_total: 0,
      },
    ]);
  };

  const removeItem = (index) => {
    setItems((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== index) : prev,
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const submitType = e?.nativeEvent?.submitter?.dataset?.submitType;
      const computedStatus =
        submitType === "pending"
          ? "PENDING_APPROVAL"
          : submitType === "draft"
            ? "DRAFT"
            : formData.status || "DRAFT";

      if (!formData.supplier_id) {
        setError("Supplier is required");
        setSaving(false);
        return;
      }

      const validItems = items.filter(
        (r) => r.item_id && Number(r.qty) > 0 && Number(r.unit_price) > 0,
      );
      if (validItems.length === 0) {
        setError("At least one item with quantity and unit price is required");
        setSaving(false);
        return;
      }

      const poNoRaw = String(formData.po_no || "");
      const poNoEnsured = poNoRaw.toUpperCase().startsWith("LP-")
        ? poNoRaw
        : poNoRaw.replace(/^PO-/i, "LP-") ||
          (poNoRaw.length ? `LP-${poNoRaw.replace(/^LP-/i, "")}` : "");
      const payload = {
        po_no: poNoEnsured,
        po_date: formData.po_date,
        po_type: "LOCAL",
        status: computedStatus,
        supplier_id: Number(formData.supplier_id),
        warehouse_id: Number(formData.warehouse_id) || null,
        currency: formData.currency,
        exchange_rate: Number(formData.exchange_rate) || 1,
        delivery_date: formData.delivery_date || "",
        payment_terms: Number(formData.payment_terms) || 0,
        remarks: formData.remarks || "",
        port_loading: formData.port_loading || "",
        port_discharge: formData.port_discharge || "",
        incoterms: formData.incoterms || "",
        hs_code: formData.hs_code || "",
        shipping_date: formData.shipping_date || "",
        insurance_required: Boolean(formData.insurance_required),
        freight_amount: Number(formData.freight_amount) || 0,
        other_charges: Number(formData.other_charges) || 0,
        discount_amount: summary.totalDiscount,
        tax_amount: summary.totalTax,
        total_amount: summary.grandTotal,
        terms_conditions: formData.terms_conditions || "",
        quotation_id: formData.quotation_id
          ? Number(formData.quotation_id)
          : undefined,
        details: validItems.map((r) => ({
          item_id: Number(r.item_id),
          qty: Number(r.qty) || 0,
          uom: r.uom || "",
          unit_price: Number(r.unit_price) || 0,
          discount_percent: Number(r.discount_percent) || 0,
          tax_percent: Number(r.tax_percent) || 0,
          line_total: Number(r.line_total) || 0,
        })),
      };

      if (submitType === "pending") {
        if (isEdit) {
          await api.post(`/purchase/orders/${id}/submit`, {
            amount: summary.grandTotal ?? null,
            workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
            target_user_id: targetApproverId || null,
          });
          const res = await api.get(`/purchase/orders/${id}`);
          const po = res.data?.item;
          const details = Array.isArray(res.data?.item?.details)
            ? res.data.item.details
            : [];
          if (po) {
            setFormData({
              po_no: po.po_no || "",
              po_date: po.po_date || new Date().toISOString().split("T")[0],
              supplier_id: po.supplier_id ? String(po.supplier_id) : "",
              po_type: po.po_type || "LOCAL",
              status: po.status || "DRAFT",
              warehouse_id: po.warehouse_id ? String(po.warehouse_id) : "",
              currency: po.currency || "GHS",
              exchange_rate: Number(po.exchange_rate) || 1,
              delivery_date: po.delivery_date || "",
              payment_terms: po.payment_terms || 30,
              remarks: po.remarks || "",
              port_loading: po.port_loading || "",
              port_discharge: po.port_discharge || "",
              incoterms: po.incoterms || "",
              hs_code: po.hs_code || "",
              shipping_date: po.shipping_date || "",
              insurance_required: Boolean(po.insurance_required),
              freight_amount: Number(po.freight_amount) || 0,
              other_charges: Number(po.other_charges) || 0,
            });
            setItems(
              details.map((d) => ({
                item_id: d.item_id ? String(d.item_id) : "",
                qty: Number(d.qty) || Number(d.qty_ordered) || 0,
                uom: d.uom || defaultUomCode || "",
                unit_price: Number(d.unit_price) || 0,
                discount_percent: Number(d.discount_percent) || 0,
                tax_percent: Number(d.tax_percent) || 0,
                line_total: Number(d.line_total) || Number(d.amount) || 0,
              })),
            );
          }
        } else {
          const resp = await api.post("/purchase/orders", payload);
          const createdId = resp?.data?.id;
          if (createdId) {
            await api.post(`/purchase/orders/${createdId}/submit`, {
              amount: summary.grandTotal ?? null,
              workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
              target_user_id: targetApproverId || null,
            });
          }
        }
        navigate("/purchase/purchase-orders-local");
        return;
      }

      if (isEdit) {
        await api.put(`/purchase/orders/${id}/status`, {
          status: computedStatus,
        });
        const res = await api.get(`/purchase/orders/${id}`);
        const po = res.data?.item;
        const details = Array.isArray(res.data?.item?.details)
          ? res.data.item.details
          : [];
        if (po) {
          setFormData({
            po_no: po.po_no || "",
            po_date: po.po_date || new Date().toISOString().split("T")[0],
            supplier_id: po.supplier_id ? String(po.supplier_id) : "",
            po_type: po.po_type || "LOCAL",
            status: po.status || "DRAFT",
            warehouse_id: po.warehouse_id ? String(po.warehouse_id) : "",
            currency: po.currency || "GHS",
            exchange_rate: Number(po.exchange_rate) || 1,
            delivery_date: po.delivery_date || "",
            payment_terms: po.payment_terms || 30,
            remarks: po.remarks || "",
            port_loading: po.port_loading || "",
            port_discharge: po.port_discharge || "",
            incoterms: po.incoterms || "",
            hs_code: po.hs_code || "",
            shipping_date: po.shipping_date || "",
            insurance_required: Boolean(po.insurance_required),
            freight_amount: Number(po.freight_amount) || 0,
            other_charges: Number(po.other_charges) || 0,
          });
          setItems(
            details.map((d) => ({
              item_id: d.item_id ? String(d.item_id) : "",
              qty: Number(d.qty) || Number(d.qty_ordered) || 0,
              uom: d.uom || defaultUomCode || "",
              unit_price: Number(d.unit_price) || 0,
              discount_percent: Number(d.discount_percent) || 0,
              tax_percent: Number(d.tax_percent) || 0,
              line_total: Number(d.line_total) || Number(d.amount) || 0,
            })),
          );
        }
      } else {
        const resp = await api.post("/purchase/orders", payload);
        const createdId = resp?.data?.id;
        if (createdId && computedStatus !== "DRAFT") {
          await api.put(`/purchase/orders/${createdId}/status`, {
            status: computedStatus,
          });
        } else if (createdId) {
        }
      }
      navigate("/purchase/purchase-orders-local");
    } catch (e2) {
      const msg =
        e2?.response?.data?.message ||
        e2?.message ||
        "Error saving purchase order. Please try again.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const openForwardModal = async () => {
    setShowForwardModal(true);
    setWfError("");
    if (!workflowsCache) {
      try {
        setWfLoading(true);
        const res = await api.get("/workflows");
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setWorkflowsCache(items);
        await computeCandidateFromList(items);
      } catch (e) {
        setWfError(e?.response?.data?.message || "Failed to load workflows");
      } finally {
        setWfLoading(false);
      }
    } else {
      await computeCandidate();
    }
  };

  const computeCandidate = async () => {
    if (!workflowsCache || !workflowsCache.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWfError("");
      return;
    }
    const route = "/purchase/purchase-orders-local";
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const chosen =
      workflowsCache.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      workflowsCache.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "PURCHASE_ORDER",
      ) ||
      null;
    setCandidateWorkflow(chosen || null);
    setFirstApprover(null);
    if (!chosen) return;
    try {
      setWfLoading(true);
      const res = await api.get(`/workflows/${chosen.id}`);
      const item = res.data?.item;
      const steps = Array.isArray(item?.steps) ? item.steps : [];
      setWorkflowSteps(steps);
      const first = steps[0] || null;
      setFirstApprover(
        first
          ? {
              userId: first.approver_user_id,
              name: first.approver_name,
              stepName: first.step_name,
              stepOrder: first.step_order,
              approvalLimit: first.approval_limit,
            }
          : null,
      );
      if (first) {
        const defaultTarget =
          (Array.isArray(first.approvers) && first.approvers.length
            ? first.approvers[0].id
            : first.approver_user_id) || null;
        setTargetApproverId(defaultTarget);
      } else {
        setTargetApproverId(null);
      }
    } catch (e) {
      setWfError(
        e?.response?.data?.message || "Failed to load workflow details",
      );
    } finally {
      setWfLoading(false);
    }
  };

  const computeCandidateFromList = async (items) => {
    if (!items || !items.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWfError("");
      return;
    }
    const route = "/purchase/purchase-orders-local";
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const chosen =
      items.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      items.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "PURCHASE_ORDER",
      ) ||
      null;
    setCandidateWorkflow(chosen || null);
    setFirstApprover(null);
    if (!chosen) return;
    try {
      setWfLoading(true);
      const res = await api.get(`/workflows/${chosen.id}`);
      const item = res.data?.item;
      const steps = Array.isArray(item?.steps) ? item.steps : [];
      setWorkflowSteps(steps);
      const first = steps[0] || null;
      setFirstApprover(
        first
          ? {
              userId: first.approver_user_id,
              name: first.approver_name,
              stepName: first.step_name,
              stepOrder: first.step_order,
              approvalLimit: first.approval_limit,
            }
          : null,
      );
      if (first) {
        const defaultTarget =
          (Array.isArray(first.approvers) && first.approvers.length
            ? first.approvers[0].id
            : first.approver_user_id) || null;
        setTargetApproverId(defaultTarget);
      } else {
        setTargetApproverId(null);
      }
    } catch (e) {
      setWfError(
        e?.response?.data?.message || "Failed to load workflow details",
      );
    } finally {
      setWfLoading(false);
    }
  };

  const forwardDocument = async () => {
    if (isNew) return;
    setSubmittingForward(true);
    setWfError("");
    try {
      const res = await api.post(`/purchase/orders/${id}/submit`, {
        amount: summary.grandTotal ?? null,
        workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
        target_user_id: targetApproverId || null,
      });
      const newStatus = res?.data?.status || "PENDING_APPROVAL";
      setFormData((prev) => ({ ...prev, status: newStatus }));
      setShowForwardModal(false);
      navigate("/purchase/purchase-orders-local");
    } catch (e) {
      setWfError(
        e?.response?.data?.message || "Failed to forward for approval",
      );
    } finally {
      setSubmittingForward(false);
    }
  };
  // Styles matched to adopt.txt
  const colors = {
    primary: "#0E3646",
    primaryDark: "#082330",
    light: "#f8f9fa",
    border: "#dee2e6",
    success: "#28a745",
    danger: "#dc3545",
    info: "#17a2b8",
  };

  console.log("Rendering PurchaseOrdersLocalForm", { id, isNew, isEdit });

  return (
    <div className="w-full pb-10">
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
            <div className="text-xl font-semibold">Purchase Order</div>
          </div>
          <div className="text-right text-sm">
            <div>DATE: {formData.po_date || ""}</div>
            <div>PO #: {formData.po_no || ""}</div>
          </div>
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
            <div className="text-xl font-semibold">Purchase Order</div>
          </div>
          <div className="text-right text-sm">
            <div>DATE: {formData.po_date || ""}</div>
            <div>PO #: {formData.po_no || ""}</div>
            <div>
              Supplier:{" "}
              {suppliers.find(
                (s) => String(s.id) === String(formData.supplier_id),
              )?.supplier_name ||
                suppliers.find(
                  (s) => String(s.id) === String(formData.supplier_id),
                )?.name ||
                ""}
            </div>
            <div>Currency: {formData.currency || ""}</div>
            <div>
              Exchange Rate: {Number(formData.exchange_rate || 1).toFixed(2)}
            </div>
          </div>
        </div>
        <div
          className="mb-2"
          style={{ width: "100%", overflow: "visible", margin: "0 auto" }}
        >
          <table
            className="text-sm"
            style={{ width: "100%", tableLayout: "fixed" }}
          >
            <colgroup>
              <col style={{ width: "40%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "20%" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="px-2 py-2 text-left">Description</th>
                <th className="px-2 py-2 text-right">Quantity</th>
                <th className="px-2 py-2 text-right">Unit Price</th>
                <th className="px-2 py-2 text-right">Net Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, idx) => {
                const it = availableItems.find(
                  (i) => String(i.id) === String(row.item_id),
                );
                const name = it?.item_name || it?.item_code || "Item";
                return (
                  <tr key={idx}>
                    <td className="px-2 py-2">{name}</td>
                    <td className="px-2 py-2 text-right">
                      {Number(row.qty || 0).toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {Number(row.unit_price || 0).toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {Number(row.line_total || 0).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="px-2 py-2 font-semibold">Subtotal</td>
                <td></td>
                <td></td>
                <td className="px-2 py-2 text-right">
                  {Number(summary.subTotal || 0).toFixed(2)}
                </td>
              </tr>
              <tr>
                <td className="px-2 py-2 font-semibold">Discount</td>
                <td></td>
                <td></td>
                <td className="px-2 py-2 text-right">
                  {Number(summary.totalDiscount || 0).toFixed(2)}
                </td>
              </tr>
              <tr>
                <td className="px-2 py-2 font-semibold">Tax</td>
                <td></td>
                <td></td>
                <td className="px-2 py-2 text-right">
                  {Number(summary.totalTax || 0).toFixed(2)}
                </td>
              </tr>
              <tr>
                <td className="px-2 py-2 font-semibold">Freight</td>
                <td></td>
                <td></td>
                <td className="px-2 py-2 text-right">
                  {Number(summary.freight || 0).toFixed(2)}
                </td>
              </tr>
              <tr>
                <td className="px-2 py-2 font-semibold">Other Charges</td>
                <td></td>
                <td></td>
                <td className="px-2 py-2 text-right">
                  {Number(summary.other || 0).toFixed(2)}
                </td>
              </tr>
              <tr>
                <td className="px-2 py-2 font-semibold">Grand Total</td>
                <td></td>
                <td></td>
                <td className="px-2 py-2 text-right">
                  {Number(summary.grandTotal || 0).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <div className="w-full bg-white rounded-xl shadow-[0_4px_20px_rgba(14,54,70,0.15)] overflow-hidden">
        {/* Header */}
        <div className="bg-[#0E3646] text-white p-8">
          <h1 className="text-3xl font-bold mb-2">📝 Purchase Order</h1>
          <p className="opacity-90">Create local and import purchase orders</p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap justify-between items-center p-5 bg-[#f8f9fa] border-b border-[#dee2e6] gap-4">
          <div className="flex bg-[#f8f9fa] p-1 rounded-md border border-[#dee2e6]">
            <button
              type="button"
              className={`px-5 py-2.5 rounded text-sm font-semibold transition-all ${
                formData.po_type === "LOCAL"
                  ? "bg-[#0E3646] text-white"
                  : "text-gray-500 hover:bg-gray-200"
              }`}
              onClick={() => setFormData({ ...formData, po_type: "LOCAL" })}
            >
              🏠 Local Order
            </button>
          </div>
          <div className="flex gap-3">
            <Link
              to="/purchase/purchase-orders-local"
              className="btn btn-secondary font-medium flex items-center gap-2"
            >
              📄 View Orders
            </Link>
            <button
              type="button"
              onClick={handleDownload}
              className="btn-outline font-medium flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="btn-primary font-medium flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>

        {/* Form Content */}
        <div className="p-8">
          {loading && <div className="text-center py-4">Loading...</div>}
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded mb-6 border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* PO Info Section */}
            <div className="mb-8">
              <div className="text-lg font-semibold text-[#0E3646] mb-5 pb-2 border-b-2 border-[#0E3646]">
                📋 Purchase Order Information
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div className="flex flex-col">
                  <label className="text-[13px] font-bold text-[#0E3646] mb-1.5 required">
                    PO Number
                  </label>
                  <input
                    type="text"
                    name="po_no"
                    value={formData.po_no}
                    className="p-2.5 border border-[#dee2e6] rounded-md text-sm focus:outline-none focus:border-[#0E3646] focus:ring-2 focus:ring-[#0E3646]/10 bg-[#e9ecef] cursor-not-allowed"
                    readOnly
                    placeholder="Auto-generated"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[13px] font-bold text-[#0E3646] mb-1.5 required">
                    PO Date
                  </label>
                  <input
                    type="date"
                    name="po_date"
                    value={formData.po_date}
                    onChange={handleInputChange}
                    className="p-2.5 border border-[#dee2e6] rounded-md text-sm focus:outline-none focus:border-[#0E3646] focus:ring-2 focus:ring-[#0E3646]/10"
                    required
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[13px] font-bold text-[#0E3646] mb-1.5">
                    Order Type
                  </label>
                  <input
                    type="text"
                    value={formData.po_type}
                    className="p-2.5 border border-[#dee2e6] rounded-md text-sm bg-[#e9ecef]"
                    readOnly
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[13px] font-bold text-[#0E3646] mb-1.5">
                    Status
                  </label>
                  <div>
                    <span className="px-4 py-1.5 rounded-full text-xs font-bold bg-[#e9ecef] text-[#495057]">
                      {formData.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div className="flex flex-col">
                  <label className="text-[13px] font-bold text-[#0E3646] mb-1.5 required">
                    Supplier
                  </label>
                  <select
                    name="supplier_id"
                    value={formData.supplier_id}
                    onChange={handleInputChange}
                    className="p-2.5 border border-[#dee2e6] rounded-md text-sm focus:outline-none focus:border-[#0E3646] focus:ring-2 focus:ring-[#0E3646]/10"
                    required
                  >
                    <option value="">Select Supplier</option>
                    {Array.isArray(suppliers) &&
                      suppliers.map(
                        (s) =>
                          s && (
                            <option key={s.id} value={s.id}>
                              {s.supplier_name || s.name || "Unknown Supplier"}
                            </option>
                          ),
                      )}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-[13px] font-bold text-[#0E3646] mb-1.5">
                    Reference Quotation
                  </label>
                  <select
                    name="quotation_id"
                    value={formData.quotation_id}
                    onChange={handleInputChange}
                    className="p-2.5 border border-[#dee2e6] rounded-md text-sm focus:outline-none focus:border-[#0E3646] focus:ring-2 focus:ring-[#0E3646]/10"
                  >
                    <option value="">Select Quotation</option>
                    {Array.isArray(quotations) &&
                      quotations.map(
                        (q) =>
                          q && (
                            <option key={q.id} value={q.id}>
                              {q.quotation_no} - {q.supplier_name}
                            </option>
                          ),
                      )}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-[13px] font-bold text-[#0E3646] mb-1.5 required">
                    Warehouse
                  </label>
                  <select
                    name="warehouse_id"
                    value={formData.warehouse_id}
                    onChange={handleInputChange}
                    className="p-2.5 border border-[#dee2e6] rounded-md text-sm focus:outline-none focus:border-[#0E3646] focus:ring-2 focus:ring-[#0E3646]/10"
                  >
                    <option value="">Select Warehouse</option>
                    {Array.isArray(warehouses) &&
                      warehouses.map(
                        (w) =>
                          w && (
                            <option key={w.id} value={w.id}>
                              {w.warehouse_name ||
                                w.name ||
                                "Unknown Warehouse"}
                            </option>
                          ),
                      )}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-[13px] font-bold text-[#0E3646] mb-1.5 required">
                    Currency
                  </label>
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleInputChange}
                    className="p-2.5 border border-[#dee2e6] rounded-md text-sm focus:outline-none focus:border-[#0E3646] focus:ring-2 focus:ring-[#0E3646]/10"
                  >
                    <option value="GHS">GHS - Ghana Cedi</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-[13px] font-bold text-[#0E3646] mb-1.5">
                    Exchange Rate
                  </label>
                  <input
                    type="number"
                    name="exchange_rate"
                    value={formData.exchange_rate}
                    onChange={handleInputChange}
                    step="0.0001"
                    className="p-2.5 border border-[#dee2e6] rounded-md text-sm focus:outline-none focus:border-[#0E3646] focus:ring-2 focus:ring-[#0E3646]/10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col">
                  <label className="text-[13px] font-bold text-[#0E3646] mb-1.5 required">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    name="delivery_date"
                    value={formData.delivery_date}
                    onChange={handleInputChange}
                    className="p-2.5 border border-[#dee2e6] rounded-md text-sm focus:outline-none focus:border-[#0E3646] focus:ring-2 focus:ring-[#0E3646]/10"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[13px] font-bold text-[#0E3646] mb-1.5">
                    Payment Terms (Days)
                  </label>
                  <input
                    type="number"
                    name="payment_terms"
                    value={formData.payment_terms}
                    onChange={handleInputChange}
                    className="p-2.5 border border-[#dee2e6] rounded-md text-sm focus:outline-none focus:border-[#0E3646] focus:ring-2 focus:ring-[#0E3646]/10"
                  />
                </div>
              </div>
            </div>

            {/* Items Section */}
            <div className="mb-8">
              <div className="bg-[#f8f9fa] p-5 rounded-lg border border-[#dee2e6]">
                <div className="flex justify-between items-center mb-4">
                  <div className="text-lg font-semibold text-[#0E3646]">
                    📦 Order Items
                  </div>
                  <button
                    type="button"
                    onClick={addItem}
                    className="px-4 py-2 bg-[#0E3646] text-white rounded hover:bg-[#082330] transition-all text-sm font-medium flex items-center gap-2"
                  >
                    ➕ Add Item
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <div className="mb-2 text-xs text-slate-600">
                    If a unit conversion exists for the selected item and UOM,
                    use the “number of UOM” button beside the UOM to convert
                    quantity to the item’s default for accurate costing.
                  </div>
                  <table className="w-full border-collapse bg-white rounded-lg overflow-hidden">
                    <thead className="bg-[#0E3646] text-white">
                      <tr>
                        <th className="p-3 text-left text-[13px] w-[50px]">
                          #
                        </th>
                        <th className="p-3 text-left text-[13px]">Item Name</th>
                        <th className="p-3 text-left text-[13px] w-[100px]">
                          Qty
                        </th>
                        <th className="p-3 text-left text-[13px] w-[120px]">
                          UOM
                        </th>
                        <th className="p-3 text-left text-[13px] w-[120px]">
                          Unit Price
                        </th>
                        <th className="p-3 text-left text-[13px] w-[100px]">
                          Disc %
                        </th>
                        <th className="p-3 text-left text-[13px] w-[100px]">
                          Tax %
                        </th>
                        <th className="p-3 text-left text-[13px] w-[150px]">
                          Net Amount
                        </th>
                        <th className="p-3 text-left text-[13px] w-[80px]">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(
                        (row, idx) =>
                          row && (
                            <tr
                              key={idx}
                              className="border-b border-[#dee2e6] hover:bg-[#0E3646]/5 transition-colors"
                            >
                              <td className="p-3 text-sm">{idx + 1}</td>
                              <td className="p-3">
                                <select
                                  value={row.item_id}
                                  onChange={(e) =>
                                    handleItemChange(
                                      idx,
                                      "item_id",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full p-2 border border-[#dee2e6] rounded text-sm focus:outline-none focus:border-[#0E3646]"
                                  required
                                >
                                  <option value="">Select Item</option>
                                  {Array.isArray(availableItems) &&
                                    availableItems.map(
                                      (it) =>
                                        it && (
                                          <option key={it.id} value={it.id}>
                                            {it.item_name ||
                                              it.item_code ||
                                              "Unknown Item"}
                                          </option>
                                        ),
                                    )}
                                </select>
                              </td>
                              <td className="p-3">
                                <input
                                  type="number"
                                  value={row.qty}
                                  onChange={(e) =>
                                    handleItemChange(idx, "qty", e.target.value)
                                  }
                                  className="w-full p-2 border border-[#dee2e6] rounded text-sm text-right focus:outline-none focus:border-[#0E3646]"
                                  min="0"
                                  step="1"
                                />
                              </td>
                              <td className="p-3">
                                <select
                                  value={row.uom || defaultUomCode || ""}
                                  onChange={(e) =>
                                    handleItemChange(idx, "uom", e.target.value)
                                  }
                                  className="w-full p-2 border border-[#dee2e6] rounded text-sm text-center focus:outline-none focus:border-[#0E3646]"
                                >
                                  <option value="">Select UOM</option>
                                  {Array.isArray(uoms) &&
                                    uoms.map(
                                      (u) =>
                                        u && (
                                          <option key={u.id} value={u.uom_code}>
                                            {u.uom_name
                                              ? `${u.uom_name} (${u.uom_code})`
                                              : u.uom_code}
                                          </option>
                                        ),
                                    )}
                                </select>
                                {(() => {
                                  const it = availableItems.find(
                                    (ai) =>
                                      String(ai.id) === String(row.item_id),
                                  );
                                  const defaultUom =
                                    (it?.uom && String(it.uom)) ||
                                    (row.uom && String(row.uom)) ||
                                    (defaultUomCode
                                      ? String(defaultUomCode)
                                      : "");
                                  const nonDefaults = (
                                    Array.isArray(unitConversions)
                                      ? unitConversions
                                      : []
                                  )
                                    .filter(
                                      (c) =>
                                        Number(c.is_active) &&
                                        Number(c.item_id) ===
                                          Number(row.item_id) &&
                                        String(c.to_uom) === defaultUom,
                                    )
                                    .map((c) => String(c.from_uom));
                                  const currentUom = String(row.uom || "");
                                  const preferredUom =
                                    currentUom && currentUom !== defaultUom
                                      ? currentUom
                                      : nonDefaults[0] || "";
                                  const hasConv =
                                    nonDefaults.length > 0 &&
                                    preferredUom &&
                                    preferredUom !== defaultUom;
                                  return hasConv ? (
                                    <button
                                      type="button"
                                      className="ml-2 px-2 py-1 text-xs border border-brand text-brand rounded hover:bg-brand hover:text-white transition-colors"
                                      onClick={() =>
                                        setConvModal({
                                          open: true,
                                          itemId: row.item_id,
                                          defaultUom: defaultUom,
                                          currentUom: preferredUom,
                                          rowIdx: idx,
                                        })
                                      }
                                    >
                                      {`number of ${preferredUom}`}
                                    </button>
                                  ) : null;
                                })()}
                              </td>
                              <td className="p-3">
                                <input
                                  type="number"
                                  value={row.unit_price}
                                  onChange={(e) =>
                                    handleItemChange(
                                      idx,
                                      "unit_price",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full p-2 border border-[#dee2e6] rounded text-sm text-right focus:outline-none focus:border-[#0E3646]"
                                  min="0"
                                  step="1"
                                />
                              </td>
                              <td className="p-3">
                                <input
                                  type="number"
                                  value={row.discount_percent}
                                  onChange={(e) =>
                                    handleItemChange(
                                      idx,
                                      "discount_percent",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full p-2 border border-[#dee2e6] rounded text-sm text-right focus:outline-none focus:border-[#0E3646]"
                                  min="0"
                                  max="100"
                                  step="1"
                                />
                              </td>
                              <td className="p-3">
                                <select
                                  value={(() => {
                                    const match = taxes.find(
                                      (t) =>
                                        Number(t.rate) ===
                                        Number(row.tax_percent || 0),
                                    );
                                    return match ? match.value : "";
                                  })()}
                                  onChange={(e) => {
                                    const selectedId = e.target.value;
                                    const tax = taxes.find(
                                      (t) =>
                                        String(t.value) === String(selectedId),
                                    );
                                    const rate = tax ? tax.rate : 0;
                                    handleItemChange(idx, "tax_percent", rate);
                                  }}
                                  className="w-full p-2 border border-[#dee2e6] rounded text-sm text-right focus:outline-none focus:border-[#0E3646]"
                                >
                                  <option value="">No Tax</option>
                                  {taxes.map((t) => (
                                    <option key={t.value} value={t.value}>
                                      {t.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-3 text-right font-medium text-sm">
                                {formData.currency}{" "}
                                {row.line_total.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeItem(idx)}
                                  className="text-[#dc3545] hover:bg-[#dc3545]/10 p-1.5 rounded transition-colors"
                                >
                                  🗑️
                                </button>
                              </td>
                            </tr>
                          ),
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="bg-[#f8f9fa] p-5 rounded-lg mt-5 border border-[#dee2e6]">
                  <div className="flex justify-between py-2 border-b border-[#dee2e6]">
                    <span className="text-sm font-medium">Total Items:</span>
                    <span className="font-bold">
                      {items.filter((i) => i && i.item_id).length}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[#dee2e6]">
                    <span className="text-sm font-medium">Sub Total:</span>
                    <span className="font-bold">
                      {formData.currency}{" "}
                      {summary.subTotal.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[#dee2e6] text-[#dc3545]">
                    <span className="text-sm font-medium">Discount:</span>
                    <span className="font-bold">
                      -{formData.currency}{" "}
                      {summary.totalDiscount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[#dee2e6] text-[#0E3646]">
                    <span className="text-sm font-medium">Tax Amount:</span>
                    <span className="font-bold">
                      {formData.currency}{" "}
                      {summary.totalTax.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[#dee2e6] items-center">
                    <span className="text-sm font-medium">
                      Freight Charges:
                    </span>
                    <input
                      type="number"
                      name="freight_amount"
                      value={formData.freight_amount}
                      onChange={handleInputChange}
                      className="w-[150px] p-1.5 border border-[#dee2e6] rounded text-sm text-right focus:outline-none focus:border-[#0E3646]"
                    />
                  </div>
                  <div className="flex justify-between py-2 border-b border-[#dee2e6] items-center">
                    <span className="text-sm font-medium">Other Charges:</span>
                    <input
                      type="number"
                      name="other_charges"
                      value={formData.other_charges}
                      onChange={handleInputChange}
                      className="w-[150px] p-1.5 border border-[#dee2e6] rounded text-sm text-right focus:outline-none focus:border-[#0E3646]"
                    />
                  </div>
                  <div className="flex justify-between py-3 text-lg font-bold text-[#0E3646]">
                    <span>GRAND TOTAL:</span>
                    <span>
                      {formData.currency}{" "}
                      {summary.grandTotal.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms & Conditions */}
            <div className="mb-8">
              <div className="text-lg font-semibold text-[#0E3646] mb-5 pb-2 border-b-2 border-[#0E3646]">
                📜 Terms & Conditions
              </div>
              <div className="flex flex-col">
                <textarea
                  name="terms_conditions"
                  value={formData.terms_conditions}
                  onChange={handleInputChange}
                  rows="6"
                  className="p-3 border border-[#dee2e6] rounded-md text-sm focus:outline-none focus:border-[#0E3646] focus:ring-2 focus:ring-[#0E3646]/10"
                  placeholder="Enter terms and conditions..."
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap justify-between items-center mt-8 gap-4">
              <div>
                <button
                  type="button"
                  className="px-5 py-2.5 bg-[#dc3545] text-white rounded hover:bg-[#c82333] transition-all font-medium flex items-center gap-2"
                  onClick={() =>
                    alert("Delete functionality not implemented yet")
                  }
                >
                  🗑️ Delete
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="px-5 py-2.5 bg-[#6c757d] text-white rounded hover:bg-[#5a6268] transition-all font-medium flex items-center gap-2"
                  onClick={() => setFormData({ ...formData, remarks: "" })} // Example clear action
                >
                  🔄 Clear
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  data-submit-type="draft"
                  className="px-5 py-2.5 bg-[#0E3646] text-white rounded hover:bg-[#082330] transition-all font-medium flex items-center gap-2 disabled:opacity-70"
                >
                  {saving ? "Saving..." : "💾 Save as Draft"}
                </button>
                <button
                  type="button"
                  className="px-5 py-2.5 bg-[#17a2b8] text-white rounded hover:bg-[#138496] transition-all font-medium flex items-center gap-2"
                  onClick={() => window.print()}
                >
                  🖨️ Print
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  data-submit-type="pending"
                  className="px-5 py-2.5 bg-[#28a745] text-white rounded hover:bg-[#218838] transition-all font-medium flex items-center gap-2 disabled:opacity-70"
                >
                  ✅ Submit for Approval
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
      {showForwardModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-erp w-full max-w-md overflow-hidden">
            <div className="p-4 bg-brand text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">Forward for Approval</h2>
              <button
                onClick={() => {
                  setShowForwardModal(false);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setWfError("");
                }}
                className="text-white hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-slate-700">
                Document No:{" "}
                <span className="font-semibold">{formData.po_no}</span>
              </div>
              <div className="text-sm text-slate-700">
                Workflow:{" "}
                <span className="font-semibold">
                  {candidateWorkflow
                    ? `${candidateWorkflow.workflow_name} (${candidateWorkflow.workflow_code})`
                    : "None (inactive)"}
                </span>
              </div>
              <div>
                {wfLoading ? (
                  <div className="text-sm">Loading workflow...</div>
                ) : null}
              </div>
              <div>
                {wfError ? (
                  <div className="text-sm text-red-600">{wfError}</div>
                ) : null}
              </div>
              <div className="text-sm">
                <div className="font-medium">Target Approver</div>
                {(() => {
                  const hasSteps =
                    Array.isArray(workflowSteps) && workflowSteps.length > 0;
                  const first = hasSteps ? workflowSteps[0] : null;
                  const opts = first
                    ? Array.isArray(first.approvers) && first.approvers.length
                      ? first.approvers.map((u) => ({
                          id: u.id,
                          name: u.username,
                        }))
                      : first.approver_user_id
                        ? [
                            {
                              id: first.approver_user_id,
                              name:
                                first.approver_name ||
                                String(first.approver_user_id),
                            },
                          ]
                        : []
                    : [];
                  return opts.length > 0 ? (
                    <div className="mt-1">
                      <select
                        className="input w-full"
                        value={targetApproverId || ""}
                        onChange={(e) =>
                          setTargetApproverId(
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      >
                        <option value="">Select target approver</option>
                        {opts.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                      <div className="text-xs text-slate-600 mt-1">
                        {firstApprover
                          ? `Step ${firstApprover.stepOrder} • ${
                              firstApprover.stepName
                            }${
                              firstApprover.approvalLimit != null
                                ? ` • Limit: ${Number(
                                    firstApprover.approvalLimit,
                                  ).toLocaleString()}`
                                : ""
                            }`
                          : ""}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-600">
                      {candidateWorkflow
                        ? "No approver found in workflow definition"
                        : "No active workflow; default behavior will apply"}
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
              <button
                type="button"
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                onClick={() => {
                  setShowForwardModal(false);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setWfError("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-700"
                onClick={forwardDocument}
                disabled={submittingForward || isNew}
              >
                {submittingForward ? "Forwarding..." : "Forward"}
              </button>
            </div>
          </div>
        </div>
      )}
      <UnitConversionModal
        open={convModal.open}
        itemId={convModal.itemId}
        defaultUom={convModal.defaultUom}
        currentUom={convModal.currentUom}
        onClose={() =>
          setConvModal({
            open: false,
            itemId: null,
            defaultUom: "",
            currentUom: "",
            rowIdx: null,
          })
        }
        onApply={(payload) => {
          const { converted_qty } = payload || {};
          const idx = convModal.rowIdx;
          if (idx == null) return;
          setItems((prev) => {
            const updated = [...prev];
            const row = { ...updated[idx] };
            const qty = Number(converted_qty || 0);
            row.qty = qty;
            row.uom = convModal.defaultUom || row.uom;
            const price = Number(row.unit_price || 0);
            const discPct = Number(row.discount_percent || 0);
            const taxPct = Number(row.tax_percent || 0);
            const base = qty * price;
            const disc = base * (discPct / 100);
            const taxable = base - disc;
            const tax = taxable * (taxPct / 100);
            row.line_total = taxable + tax;
            updated[idx] = row;
            return updated;
          });
        }}
      />
    </div>
  );
}
