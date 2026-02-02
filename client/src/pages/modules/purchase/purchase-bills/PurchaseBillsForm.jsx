import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";
import { Trash } from "lucide-react";

const CURRENCIES = [
  { id: 4, code: "GHS", name: "Ghanaian Cedi" },
  { id: 1, code: "USD", name: "US Dollar" },
  { id: 2, code: "EUR", name: "Euro" },
  { id: 3, code: "GBP", name: "British Pound" },
];

export default function PurchaseBillsForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const isNew = !id || id === "new";
  const billType = location.pathname.includes("purchase-bills-import")
    ? "IMPORT"
    : "LOCAL";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [grns, setGrns] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);
  const [itemOptions, setItemOptions] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [finCurrencies, setFinCurrencies] = useState([]);
  const [baseFinCurrencyId, setBaseFinCurrencyId] = useState(null);
  const [taxCodes, setTaxCodes] = useState([]);
  const [currentBillId, setCurrentBillId] = useState(
    id && id !== "new" ? Number(id) : null,
  );

  const [formData, setFormData] = useState({
    bill_no: "",
    bill_date: new Date().toISOString().split("T")[0],
    supplier_id: "",
    po_id: "",
    grn_id: "",
    bill_type: billType,
    due_date: "",
    currency_id: 4,
    exchange_rate: 1,
    payment_terms: 30,
    status: "DRAFT",

    discount_amount: 0,
    freight_charges: 0,
    other_charges: 0,
  });

  const [lines, setLines] = useState([
    {
      id: Date.now(),
      item_id: "",
      uom_id: "",
      qty: 0,
      unit_price: 0,
      discount_percent: 0,
      tax_amount: 0,
      line_total: 0,
    },
  ]);

  useEffect(() => {
    let mounted = true;

    const fetchLookups = async () => {
      try {
        if (isNew) {
          const initialNo =
            billType === "IMPORT"
              ? `PIB-${String(1).padStart(6, "0")}`
              : `PLB-${String(1).padStart(6, "0")}`;
          setFormData((prev) => ({ ...prev, bill_no: initialNo }));
        }
        const [supRes, poRes, itemsRes, uomsRes, taxesRes] = await Promise.all([
          api.get("/purchase/suppliers").catch(() => ({ data: { items: [] } })),
          api.get("/purchase/orders").catch(() => ({ data: { items: [] } })),
          api.get("/inventory/items").catch(() => ({ data: { items: [] } })),
          api.get("/inventory/uoms").catch(() => ({ data: { items: [] } })),
          api.get("/finance/tax-codes").catch(() => ({ data: { items: [] } })),
        ]);

        if (mounted) {
          setSuppliers(
            Array.isArray(supRes.data?.items) ? supRes.data.items : [],
          );
          setPurchaseOrders(
            Array.isArray(poRes.data?.items) ? poRes.data.items : [],
          );
          setAvailableItems(
            Array.isArray(itemsRes.data?.items) ? itemsRes.data.items : [],
          );
          setItemOptions(
            Array.isArray(itemsRes.data?.items) ? itemsRes.data.items : [],
          );
          setUoms(Array.isArray(uomsRes.data?.items) ? uomsRes.data.items : []);
          setTaxCodes(
            Array.isArray(taxesRes.data?.items) ? taxesRes.data.items : [],
          );
        }

        // Fetch GRNs
        try {
          const grnRes = await api.get("/purchase/grns", {
            params: { status: "APPROVED" },
          });
          if (mounted) {
            setGrns(Array.isArray(grnRes.data?.items) ? grnRes.data.items : []);
          }
        } catch (e) {
          // Ignore
        }
        try {
          const curRes = await api.get("/finance/currencies");
          if (mounted) {
            const items = Array.isArray(curRes.data?.items)
              ? curRes.data.items
              : [];
            setFinCurrencies(items);
            const base = items.find((c) => Number(c.is_base) === 1);
            setBaseFinCurrencyId(base ? Number(base.id) : null);
          }
        } catch {}
      } catch (e) {
        if (mounted) setError("Failed to load lookups");
      }
    };

    fetchLookups();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (isNew) return;

    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get(`/purchase/bills/${id}`)
      .then((res) => {
        if (!mounted) return;
        const h = res.data?.item;
        const details = Array.isArray(res.data?.details)
          ? res.data.details
          : [];
        if (!h) return;

        setFormData({
          bill_no: h.bill_no || "",
          bill_date: h.bill_date ? h.bill_date.split("T")[0] : "",
          supplier_id: h.supplier_id ? String(h.supplier_id) : "",
          po_id: h.po_id ? String(h.po_id) : "",
          grn_id: h.grn_id ? String(h.grn_id) : "",
          bill_type: h.bill_type || billType,
          due_date: h.due_date ? h.due_date.split("T")[0] : "",
          currency_id: h.currency_id || 4,
          exchange_rate: Number(h.exchange_rate) || 1,
          payment_terms: Number(h.payment_terms) || 30,
          status: h.status || "DRAFT",
          discount_amount: Number(h.discount_amount) || 0,
          freight_charges: Number(h.freight_charges) || 0,
          other_charges: Number(h.other_charges) || 0,
        });

        setLines(
          details.length
            ? details.map((d) => ({
                id: d.id || Date.now() + Math.random(),
                item_id: d.item_id ? String(d.item_id) : "",
                uom_id: d.uom_id ? String(d.uom_id) : "",
                qty: Number(d.qty) || 0,
                unit_price: Number(d.unit_price) || 0,
                discount_percent: Number(d.discount_percent) || 0,
                tax_amount: Number(d.tax_amount) || 0,
                line_total: Number(d.line_total) || 0,
              }))
            : [],
        );
      })
      .catch((e) => {
        if (mounted) setError("Failed to load purchase bill");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id, isNew]);

  const recalcLine = (line) => {
    const qty = Number(line.qty) || 0;
    const unitPrice = Number(line.unit_price) || 0;
    const discountPercent = Number(line.discount_percent) || 0;
    let taxAmount = Number(line.tax_amount) || 0;

    // Logic: (qty * price) - discount + tax
    const gross = qty * unitPrice;
    const discount = gross * (discountPercent / 100);
    const taxable = gross - discount;
    if (line.tax_code_id) {
      const tc = taxCodes.find(
        (t) => String(t.id) === String(line.tax_code_id),
      );
      const rate = tc ? Number(tc.rate_percent) || 0 : 0;
      taxAmount = taxable * (rate / 100);
    }
    const lineTotal = taxable + taxAmount;

    return { ...line, tax_amount: taxAmount, line_total: lineTotal };
  };

  const applyItemDefaultTax = async (lineId, itemId) => {
    try {
      const res = await api.get(`/finance/item-tax/${itemId}`);
      const tax = res.data?.tax;
      if (!tax) return;
      setLines((prev) =>
        prev.map((l) => {
          if (l.id !== lineId) return l;
          const qty = Number(l.qty) || 0;
          const unitPrice = Number(l.unit_price) || 0;
          const discountPercent = Number(l.discount_percent) || 0;
          const gross = qty * unitPrice;
          const discount = gross * (discountPercent / 100);
          const taxable = gross - discount;
          const rate = Number(tax.tax_rate) || 0;
          const next = {
            ...l,
            tax_code_id: String(tax.id),
            tax_amount: taxable * (rate / 100),
          };
          return recalcLine(next);
        }),
      );
    } catch {}
  };

  const handleLineChange = (lineId, field, value) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        let next = { ...l, [field]: value };
        if (field === "item_id") {
          const it = availableItems.find((i) => String(i.id) === String(value));
          if (it && it.uom) {
            const u = uoms.find(
              (uom) => String(uom.uom_code) === String(it.uom),
            );
            next.uom_id = u ? String(u.id) : "";
          }
          if (value) {
            applyItemDefaultTax(lineId, value);
          }
        }
        if (field === "tax_code_id") {
          const tc = taxCodes.find((t) => String(t.id) === String(value));
          const qty = Number(next.qty) || 0;
          const unitPrice = Number(next.unit_price) || 0;
          const discountPercent = Number(next.discount_percent) || 0;
          const gross = qty * unitPrice;
          const discount = gross * (discountPercent / 100);
          const taxable = gross - discount;
          const rate = tc ? Number(tc.rate_percent) || 0 : 0;
          next.tax_amount = taxable * (rate / 100);
        }
        return recalcLine(next);
      }),
    );
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: Date.now(),
        item_id: "",
        uom_id: "",
        qty: 0,
        unit_price: 0,
        discount_percent: 0,
        tax_amount: 0,
        line_total: 0,
      },
    ]);
  };

  const removeLine = (lineId) => {
    setLines((prev) => prev.filter((l) => l.id !== lineId));
  };

  const populatePoDetails = async (poId) => {
    try {
      const res = await api.get(`/purchase/orders/${poId}`);
      const poItem = res.data?.item;
      const poDetails =
        Array.isArray(res.data?.item?.details) && res.data.item.details.length
          ? res.data.item.details
          : Array.isArray(res.data?.details)
            ? res.data.details
            : [];

      if (poItem) {
        const code = String(
          poItem.currency || poItem.currency_code || poItem.currencyCode || "",
        ).toUpperCase();
        const cur =
          CURRENCIES.find((c) => String(c.code).toUpperCase() === code) ||
          CURRENCIES[0];
        setFormData((prev) => ({
          ...prev,
          supplier_id: poItem.supplier_id
            ? String(poItem.supplier_id)
            : prev.supplier_id,
          po_id: String(poId),
          currency_id:
            Number(poItem.currency_id) ||
            (cur ? Number(cur.id) : prev.currency_id),
          exchange_rate:
            poItem.exchange_rate != null
              ? Number(poItem.exchange_rate || 1)
              : prev.exchange_rate,
        }));
      }

      if (poDetails.length > 0) {
        const newLines = poDetails.map((d) => {
          const uomObj = uoms.find(
            (u) => u.uom_code === d.uom || u.uom_name === d.uom,
          );
          const qty =
            Number(d.qty) || Number(d.qty_ordered) || Number(d.quantity) || 0;
          const unitPrice = Number(d.unit_price) || 0;
          const discountPercent = Number(d.discount_percent) || 0;
          const taxPercent = Number(d.tax_percent) || 0;
          const gross = qty * unitPrice;
          const discountAmt = gross * (discountPercent / 100);
          const taxable = gross - discountAmt;
          const taxAmt = taxable * (taxPercent / 100);
          const lineTotal = taxable + taxAmt;
          const matchedTax =
            taxCodes.find(
              (t) => Number(t.rate_percent) === Number(taxPercent),
            ) || null;
          return {
            id: Date.now() + Math.random(),
            item_id: d.item_id ? String(d.item_id) : "",
            uom_id: uomObj ? String(uomObj.id) : "",
            qty,
            unit_price: unitPrice,
            discount_percent: discountPercent,
            tax_amount: taxAmt,
            tax_code_id: matchedTax ? String(matchedTax.id) : "",
            line_total: lineTotal,
          };
        });
        setLines(newLines);
      }
    } catch (err) {
      console.error("Failed to load PO details", err);
    }
  };

  const populateGrnDetails = async (grnId) => {
    try {
      const res = await api.get(`/purchase/grns/${grnId}`);
      const grnItem = res.data?.item;
      const grnDetails = res.data?.item?.details;

      if (grnItem) {
        setFormData((prev) => ({
          ...prev,
          po_id: grnItem.po_id ? String(grnItem.po_id) : prev.po_id,
          supplier_id: grnItem.supplier_id
            ? String(grnItem.supplier_id)
            : prev.supplier_id,
          grn_id: String(grnId),
        }));
        if (grnItem.po_id) {
          try {
            const poRes = await api.get(`/purchase/orders/${grnItem.po_id}`);
            const poItem = poRes.data?.item;
            if (poItem) {
              const code = String(
                poItem.currency ||
                  poItem.currency_code ||
                  poItem.currencyCode ||
                  "",
              ).toUpperCase();
              const cur =
                CURRENCIES.find((c) => String(c.code).toUpperCase() === code) ||
                CURRENCIES[0];
              setFormData((prev) => ({
                ...prev,
                currency_id:
                  Number(poItem.currency_id) ||
                  (cur ? Number(cur.id) : prev.currency_id),
                exchange_rate:
                  poItem.exchange_rate != null
                    ? Number(poItem.exchange_rate || 1)
                    : prev.exchange_rate,
              }));
            }
          } catch (e) {
            // ignore currency population failure
          }
        }
      }

      if (Array.isArray(grnDetails) && grnDetails.length > 0) {
        const newLines = grnDetails.map((d) => {
          const uomObj = uoms.find(
            (u) => u.uom_code === d.uom || u.uom_name === d.uom,
          );
          const qty = Number(d.qty_accepted) || 0;
          const unitPrice = Number(d.unit_price) || 0;
          const lineTotal = qty * unitPrice;

          return {
            id: Date.now() + Math.random(),
            item_id: d.item_id ? String(d.item_id) : "",
            uom_id: uomObj ? String(uomObj.id) : "",
            qty,
            unit_price: unitPrice,
            discount_percent: 0,
            tax_amount: 0,
            line_total: lineTotal,
          };
        });
        setLines(newLines);
      }
      const itemIds = Array.from(
        new Set(
          grnDetails
            .map((d) => (d.item_id ? String(d.item_id) : ""))
            .filter(Boolean),
        ),
      );
      const options = itemIds.map((id) => {
        const it = availableItems.find((i) => String(i.id) === id);
        return it || { id, item_code: id, item_name: "" };
      });
      setItemOptions(options);
    } catch (err) {
      console.error("Failed to load GRN details", err);
    }
  };

  const handleChange = async (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "supplier_id") {
      if (value) {
        const sup = suppliers.find((s) => String(s.id) === String(value));
        const code =
          (sup && sup.supplier_code && String(sup.supplier_code).trim()) ||
          (sup ? `SU-${String(Number(sup.id || 0)).padStart(6, "0")}` : "");
        if (code) {
          try {
            const res = await api.get("/finance/accounts", {
              params: { search: code },
            });
            const items = Array.isArray(res.data?.items) ? res.data.items : [];
            const exact =
              items.find((a) => String(a.code) === code) || items[0] || null;
            const accCode =
              (exact && exact.currency_code && String(exact.currency_code)) ||
              null;
            if (accCode) {
              const cur =
                CURRENCIES.find(
                  (c) => String(c.code).toUpperCase() === accCode.toUpperCase(),
                ) || null;
              if (cur) {
                setFormData((prev) => ({
                  ...prev,
                  currency_id: Number(cur.id),
                }));
              }
            }
          } catch (err) {
            // ignore currency population failure
          }
        }
      } else {
        setFormData((prev) => ({ ...prev, currency_id: 4 }));
      }
    }

    if (name === "grn_id" && value) {
      await populateGrnDetails(value);
    } else if (name === "grn_id" && !value) {
      setItemOptions(availableItems);
    }

    if (name === "po_id" && value) {
      // 1. Populate supplier
      const selectedPo = purchaseOrders.find((po) => String(po.id) === value);
      let newSupplierId = formData.supplier_id;

      if (selectedPo && selectedPo.supplier_id) {
        newSupplierId = String(selectedPo.supplier_id);
        setFormData((prev) => ({
          ...prev,
          supplier_id: newSupplierId,
        }));
      }

      // 2. Try to find corresponding GRN
      // Filter GRNs that match this PO AND the current bill type
      const matchingGrns = grns.filter(
        (g) =>
          String(g.po_id) === value &&
          g.grn_type === billType &&
          String(g.status).toUpperCase() === "APPROVED",
      );

      if (matchingGrns.length === 1) {
        // If exactly one GRN, select it and populate items
        await populateGrnDetails(matchingGrns[0].id);
      } else {
        // If multiple or none, just ensure the GRN field is reset so user can choose
        // But if they had one selected that DOES match, keep it?
        setFormData((prev) => {
          const currentGrnMatches = matchingGrns.find(
            (g) => String(g.id) === prev.grn_id,
          );
          // If we updated supplier, make sure to preserve that in this update too if it raced
          return {
            ...prev,
            supplier_id: newSupplierId || prev.supplier_id,
            grn_id: currentGrnMatches ? prev.grn_id : "",
          };
        });
        // Keep item options as full list until a specific GRN is chosen
        setItemOptions(availableItems);
      }
    }
    if (name === "currency_id") {
      const cur = CURRENCIES.find((c) => Number(c.id) === Number(value));
      const code = cur ? String(cur.code).toUpperCase() : null;
      const selectedFin =
        code &&
        finCurrencies.find(
          (fc) => String(fc.code).toUpperCase() === code.toUpperCase(),
        );
      const selId = selectedFin ? Number(selectedFin.id) : null;
      const baseId = baseFinCurrencyId ? Number(baseFinCurrencyId) : null;
      if (!selId || !baseId) {
        setFormData((prev) => ({ ...prev, exchange_rate: 1 }));
      } else if (selId === baseId) {
        setFormData((prev) => ({ ...prev, exchange_rate: 1 }));
      } else {
        try {
          const res = await api.get("/finance/currency-rates", {
            params: { fromCurrencyId: selId, toCurrencyId: baseId },
          });
          const items = Array.isArray(res.data?.items) ? res.data.items : [];
          if (items.length > 0) {
            const rate = Number(items[0].rate) || 1;
            setFormData((prev) => ({ ...prev, exchange_rate: rate }));
          } else {
            const resInv = await api.get("/finance/currency-rates", {
              params: { fromCurrencyId: baseId, toCurrencyId: selId },
            });
            const invItems = Array.isArray(resInv.data?.items)
              ? resInv.data.items
              : [];
            if (invItems.length > 0) {
              const rate = Number(invItems[0].rate) || 1;
              setFormData((prev) => ({ ...prev, exchange_rate: 1 / rate }));
            } else {
              setFormData((prev) => ({ ...prev, exchange_rate: 1 }));
            }
          }
        } catch {
          setFormData((prev) => ({ ...prev, exchange_rate: 1 }));
        }
      }
    }
  };

  const totals = useMemo(() => {
    const subTotal = lines.reduce(
      (sum, l) => sum + (Number(l.qty) || 0) * (Number(l.unit_price) || 0),
      0,
    );
    const lineTaxTotal = lines.reduce(
      (sum, l) => sum + (Number(l.tax_amount) || 0),
      0,
    );
    // Note: line_total includes item discount.
    // If we want total discount, we sum item discounts + global discount.
    // Item discount = (qty * price * percent / 100)
    const itemDiscounts = lines.reduce((sum, l) => {
      const gross = (Number(l.qty) || 0) * (Number(l.unit_price) || 0);
      return sum + (gross * (Number(l.discount_percent) || 0)) / 100;
    }, 0);

    const totalDiscount =
      itemDiscounts + (Number(formData.discount_amount) || 0);
    const freight = Number(formData.freight_charges) || 0;
    const other = Number(formData.other_charges) || 0;

    const grandTotal =
      subTotal - totalDiscount + lineTaxTotal + freight + other;

    return { subTotal, itemDiscounts, lineTaxTotal, grandTotal };
  }, [
    lines,
    formData.discount_amount,
    formData.freight_charges,
    formData.other_charges,
  ]);

  const handleSubmit = async (status = "DRAFT") => {
    // Validation
    if (!formData.bill_date) {
      setError("Bill Date is required");
      return;
    }
    if (!formData.supplier_id) {
      setError("Supplier is required");
      return;
    }
    if (lines.length === 0 || !lines.some((l) => l.item_id)) {
      setError("At least one item is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        ...formData,
        bill_no: formData.bill_no || undefined,
        supplier_id: Number(formData.supplier_id),
        po_id: formData.po_id ? Number(formData.po_id) : null,
        grn_id: formData.grn_id ? Number(formData.grn_id) : null,
        currency_id: Number(formData.currency_id),
        exchange_rate: Number(formData.exchange_rate),
        payment_terms: Number(formData.payment_terms),
        discount_amount: Number(formData.discount_amount),
        freight_charges: Number(formData.freight_charges),
        other_charges: Number(formData.other_charges),
        status,
        details: lines
          .filter((l) => l.item_id)
          .map((l) => ({
            item_id: Number(l.item_id),
            uom_id: l.uom_id ? Number(l.uom_id) : null,
            qty: Number(l.qty) || 0,
            unit_price: Number(l.unit_price) || 0,
            discount_percent: Number(l.discount_percent) || 0,
            tax_amount: Number(l.tax_amount) || 0,
            line_total: Number(l.line_total) || 0,
          })),
      };

      if (isNew) {
        const res = await api.post("/purchase/bills", payload);
        const newId = Number(res?.data?.id || 0) || null;
        if (newId) setCurrentBillId(newId);
      } else {
        await api.put(`/purchase/bills/${id}`, payload);
        setCurrentBillId(Number(id));
      }

      navigate(`/purchase/purchase-bills-${billType.toLowerCase()}`);
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to save purchase bill");
    } finally {
      setSaving(false);
    }
  };

  const handlePostClick = async () => {
    if (!formData.bill_date) {
      setError("Bill Date is required");
      return;
    }
    if (!formData.supplier_id) {
      setError("Supplier is required");
      return;
    }
    if (!formData.grn_id) {
      setError("GRN is required for posting");
      return;
    }
    if (lines.length === 0 || !lines.some((l) => l.item_id)) {
      setError("At least one item is required");
      return;
    }
    try {
      setSaving(true);
      const payload = {
        ...formData,
        bill_no: formData.bill_no || undefined,
        supplier_id: Number(formData.supplier_id),
        po_id: formData.po_id ? Number(formData.po_id) : null,
        grn_id: formData.grn_id ? Number(formData.grn_id) : null,
        currency_id: Number(formData.currency_id),
        exchange_rate: Number(formData.exchange_rate),
        payment_terms: Number(formData.payment_terms),
        discount_amount: Number(formData.discount_amount),
        freight_charges: Number(formData.freight_charges),
        other_charges: Number(formData.other_charges),
        status: "DRAFT",
        details: lines
          .filter((l) => l.item_id)
          .map((l) => ({
            item_id: Number(l.item_id),
            uom_id: l.uom_id ? Number(l.uom_id) : null,
            qty: Number(l.qty) || 0,
            unit_price: Number(l.unit_price) || 0,
            discount_percent: Number(l.discount_percent) || 0,
            tax_amount: Number(l.tax_amount) || 0,
            line_total: Number(l.line_total) || 0,
          })),
      };
      let createdId = null;
      if (!currentBillId) {
        const createRes = await api.post("/purchase/bills", payload);
        createdId = Number(createRes?.data?.id || 0) || null;
        if (createdId) setCurrentBillId(createdId);
      } else {
        await api.put(`/purchase/bills/${currentBillId}`, payload);
      }
      const postId = currentBillId || createdId;
      if (!postId) {
        setError("Bill not found for posting");
        return;
      }
      await api.post(`/purchase/bills/${postId}/post`, {});
      setFormData((prev) => ({ ...prev, status: "POSTED" }));
      navigate(`/purchase/purchase-bills-${billType.toLowerCase()}`);
    } catch (e) {
      setError(e?.response?.data?.message || "Posting failed");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setFormData((prev) => ({
      ...prev,
      supplier_id: "",
      po_id: "",
      grn_id: "",
      due_date: "",
      currency_id: 4,
      exchange_rate: 1,
      payment_terms: 30,
      discount_amount: 0,
      freight_charges: 0,
      other_charges: 0,
    }));
    setLines([
      {
        id: Date.now(),
        item_id: "",
        uom_id: "",
        qty: 0,
        unit_price: 0,
        discount_percent: 0,
        tax_amount: 0,
        line_total: 0,
      },
    ]);
  };

  const listPath = `/purchase/purchase-bills-${billType.toLowerCase()}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {isNew ? "New" : "Edit"} Purchase Bill - {billType}
          </h1>
          <p className="text-sm mt-1">Record and manage supplier bills</p>
        </div>
        <Link to={listPath} className="btn-secondary">
          Back to List
        </Link>
      </div>

      {loading && <div className="p-4 bg-white rounded shadow">Loading...</div>}
      {error && (
        <div className="p-4 text-red-600 bg-white rounded shadow">{error}</div>
      )}

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg px-4 py-2">
          <h3 className="font-semibold">Invoice Information</h3>
        </div>
        <div className="card-body p-4 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <div className="form-group">
            <label className="label">Invoice Type</label>
            <select className="input" value={formData.bill_type} disabled>
              <option value="LOCAL">Local</option>
              <option value="IMPORT">Import</option>
            </select>
          </div>

          <div className="form-group">
            <label className="label">Bill No</label>
            <input
              className="input bg-gray-100"
              value={formData.bill_no}
              placeholder="Auto-generated"
              disabled
            />
          </div>

          <div className="form-group">
            <label className="label required">Bill Date</label>
            <input
              type="date"
              className="input"
              name="bill_date"
              value={formData.bill_date}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="label required">Supplier</label>
            <select
              className="input"
              name="supplier_id"
              value={formData.supplier_id}
              onChange={handleChange}
            >
              <option value="">-- Select Supplier --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.supplier_name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="label">Related PO</label>
            <select
              className="input"
              name="po_id"
              value={formData.po_id}
              onChange={handleChange}
            >
              <option value="">-- Select PO --</option>
              {purchaseOrders
                .filter(
                  (po) =>
                    (!formData.supplier_id ||
                      String(po.supplier_id) ===
                        String(formData.supplier_id)) &&
                    po.po_type === billType,
                )
                .map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.po_no}
                  </option>
                ))}
            </select>
          </div>

          <div className="form-group">
            <label className="label">Related GRN</label>
            <select
              className="input"
              name="grn_id"
              value={formData.grn_id}
              onChange={handleChange}
            >
              <option value="">-- Select GRN --</option>
              {grns
                .filter(
                  (g) =>
                    (!formData.supplier_id ||
                      String(g.supplier_id) === String(formData.supplier_id)) &&
                    (!formData.po_id ||
                      String(g.po_id) === String(formData.po_id)) &&
                    g.grn_type === billType &&
                    String(g.status).toUpperCase() === "APPROVED",
                )
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.grn_no}
                  </option>
                ))}
            </select>
          </div>

          <div className="form-group">
            <label className="label">Due Date</label>
            <input
              type="date"
              className="input"
              name="due_date"
              value={formData.due_date}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="label">Currency</label>
            <select
              className="input"
              name="currency_id"
              value={formData.currency_id}
              onChange={handleChange}
            >
              {CURRENCIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="label">Exchange Rate</label>
            <input
              type="number"
              className="input text-right"
              name="exchange_rate"
              value={formData.exchange_rate}
              onChange={handleChange}
              step="0.000001"
            />
          </div>

          <div className="form-group">
            <label className="label">Payment Terms (Days)</label>
            <input
              type="number"
              className="input text-right"
              name="payment_terms"
              value={formData.payment_terms}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            {/* Status field removed as requested */}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg px-4 py-2 flex justify-between items-center">
          <h3 className="font-semibold">Items</h3>
          <button
            type="button"
            className="btn-success text-xs"
            onClick={addLine}
          >
            + Add Item
          </button>
        </div>
        <div className="card-body overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th className="w-1/4">Item</th>
                <th className="w-28 text-right">Qty</th>
                <th className="w-36 text-right">UOM</th>
                <th className="w-32 text-right">Unit Price</th>
                <th className="w-28 text-right">Disc %</th>
                <th className="w-40 text-right">Tax Amt</th>
                <th className="w-32 text-right">Net Amount</th>
                <th className="w-16">Action</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id}>
                  <td>
                    <select
                      className="input text-sm w-full"
                      value={l.item_id}
                      onChange={(e) =>
                        handleLineChange(l.id, "item_id", e.target.value)
                      }
                    >
                      <option value="">Select Item</option>
                      {itemOptions.map((i) => (
                        <option key={i.id} value={String(i.id)}>
                          {i.item_code} - {i.item_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      className="input text-right text-sm w-full"
                      value={l.qty}
                      onChange={(e) =>
                        handleLineChange(l.id, "qty", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <select
                      className="input text-sm w-full"
                      value={l.uom_id}
                      onChange={(e) =>
                        handleLineChange(l.id, "uom_id", e.target.value)
                      }
                    >
                      <option value="">Select UOM</option>
                      {uoms.map((u) => (
                        <option key={u.id} value={String(u.id)}>
                          {u.uom_name
                            ? `${u.uom_name} (${u.uom_code})`
                            : u.uom_code}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      className="input text-right text-sm w-full"
                      value={l.unit_price}
                      onChange={(e) =>
                        handleLineChange(l.id, "unit_price", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="input text-right text-sm w-full"
                      value={l.discount_percent}
                      onChange={(e) =>
                        handleLineChange(
                          l.id,
                          "discount_percent",
                          e.target.value,
                        )
                      }
                    />
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <select
                        className="input text-sm w-full"
                        value={l.tax_code_id || ""}
                        onChange={(e) =>
                          handleLineChange(l.id, "tax_code_id", e.target.value)
                        }
                      >
                        <option value="">No Tax</option>
                        {taxCodes.map((t) => (
                          <option key={t.id} value={String(t.id)}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      <span className="text-right w-32">
                        {Number(l.tax_amount || 0).toFixed(2)}
                      </span>
                    </div>
                  </td>
                  <td className="text-right font-medium">
                    {Number(l.line_total).toFixed(2)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="text-red-500 hover:text-red-700 p-1"
                      onClick={() => removeLine(l.id)}
                      title="Remove"
                    >
                      <Trash size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="hidden md:block"></div>
        <div className="card">
          <div className="card-header bg-gray-100 px-4 py-2 border-b">
            <h3 className="font-semibold text-gray-700">Summary</h3>
          </div>
          <div className="card-body p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Sub Total:</span>
              <span className="font-semibold">
                {totals.subTotal.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center text-red-600">
              <span className="text-gray-600">
                Discount Amount (Items + Global):
              </span>
              <span>
                -{" "}
                {(
                  totals.itemDiscounts + Number(formData.discount_amount) || 0
                ).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Global Discount Input:</span>
              <input
                type="number"
                className="input w-32 text-right"
                name="discount_amount"
                value={formData.discount_amount}
                onChange={handleChange}
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Tax Amount:</span>
              <span className="font-semibold">
                {totals.lineTaxTotal.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Freight Charges:</span>
              <input
                type="number"
                className="input w-32 text-right"
                name="freight_charges"
                value={formData.freight_charges}
                onChange={handleChange}
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Other Charges:</span>
              <input
                type="number"
                className="input w-32 text-right"
                name="other_charges"
                value={formData.other_charges}
                onChange={handleChange}
              />
            </div>
            <div className="border-t pt-2 mt-2 flex justify-between items-center text-lg font-bold">
              <span>Grand Total:</span>
              <span>{totals.grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 justify-end">
        <button type="button" className="btn-secondary" onClick={handleClear}>
          Clear
        </button>
        <button
          type="button"
          className="btn-success"
          onClick={handlePostClick}
          disabled={saving}
        >
          Post
        </button>
      </div>
    </div>
  );
}
