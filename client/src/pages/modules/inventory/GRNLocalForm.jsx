import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";

import { api } from "api/client";
import { useUoms } from "@/hooks/useUoms";

function toISODate(v) {
  if (!v) return "";
  try {
    return new Date(v).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export default function GRNLocalForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = id === "new";
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

  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const { uoms, loading: uomsLoading } = useUoms();
  const [standardPrices, setStandardPrices] = useState([]);

  const [formData, setFormData] = useState({
    grn_no: "",
    grn_date: toISODate(new Date()),
    supplier_id: "",
    warehouse_id: "",
    po_id: "",
    invoice_no: "",
    invoice_date: "",
    invoice_amount: "",
    invoice_due_date: "",
    delivery_number: "",
    delivery_date: "",
    status: "DRAFT",
    remarks: "",
    details: [],
  });
  const isApproved = String(formData.status || "").toUpperCase() === "APPROVED";
  const shouldDisable = isView && isApproved;
  const allowPoPopulateRef = useRef(isNew);

  useEffect(() => {
    let mounted = true;
    setError("");

    Promise.all([
      api.get("/inventory/items"),
      api.get("/purchase/suppliers"),
      api.get("/inventory/warehouses"),
      api.get("/purchase/orders", { params: { status: "APPROVED" } }),
      api.get("/sales/prices/standard"),
    ])
      .then(([itemsRes, suppliersRes, whRes, poRes, stdRes]) => {
        if (!mounted) return;
        setItems(
          Array.isArray(itemsRes.data?.items) ? itemsRes.data.items : [],
        );
        setSuppliers(
          Array.isArray(suppliersRes.data?.items)
            ? suppliersRes.data.items.filter(
                (s) => String(s.supplier_type || "").toUpperCase() === "LOCAL",
              )
            : [],
        );
        setWarehouses(Array.isArray(whRes.data?.items) ? whRes.data.items : []);
        const allPOs = Array.isArray(poRes.data?.items) ? poRes.data.items : [];
        setPurchaseOrders(
          allPOs.filter(
            (po) =>
              String(po.po_type || "").toUpperCase() === "LOCAL" &&
              String(po.status || "").toUpperCase() === "APPROVED",
          ),
        );
        setStandardPrices(
          Array.isArray(stdRes.data?.items) ? stdRes.data.items : [],
        );
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load lookups");
      });

    return () => {
      mounted = false;
    };
  }, []);

  const defaultUomCode = useMemo(() => {
    const list = Array.isArray(uoms) ? uoms : [];
    const pcs =
      list.find((u) => String(u.uom_code || "").toUpperCase() === "PCS") ||
      list[0];
    if (pcs && pcs.uom_code) return pcs.uom_code;
    return "PCS";
  }, [uoms]);

  const pickStandardCost = useCallback(
    (productId, uom) => {
      const list = Array.isArray(standardPrices) ? standardPrices : [];
      const pid = String(productId || "");
      const u = uom ? String(uom) : "";
      const filtered = list
        .filter(
          (p) =>
            String(p.product_id) === pid &&
            (u ? String(p.uom || "") === u : true),
        )
        .sort((a, b) => {
          const ad = a.effective_date
            ? new Date(a.effective_date).getTime()
            : 0;
          const bd = b.effective_date
            ? new Date(b.effective_date).getTime()
            : 0;
          return (
            bd - ad ||
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        });
      if (filtered.length > 0 && filtered[0].cost_price != null) {
        return String(filtered[0].cost_price);
      }
      const any = list
        .filter((p) => String(p.product_id) === pid)
        .sort((a, b) => {
          const ad = a.effective_date
            ? new Date(a.effective_date).getTime()
            : 0;
          const bd = b.effective_date
            ? new Date(b.effective_date).getTime()
            : 0;
          return (
            bd - ad ||
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        });
      if (any.length > 0 && any[0].cost_price != null) {
        return String(any[0].cost_price);
      }
      const it = (Array.isArray(items) ? items : []).find(
        (i) => String(i.id) === pid,
      );
      if (it && it.cost_price != null) {
        return String(it.cost_price);
      }
      return "";
    },
    [standardPrices, items],
  );

  const standardPriceByProduct = useMemo(() => {
    const m = new Map();
    for (const p of Array.isArray(standardPrices) ? standardPrices : []) {
      const key = String(p.product_id);
      if (!m.has(key)) m.set(key, p);
    }
    return m;
  }, [standardPrices]);

  useEffect(() => {
    if (!isNew) return;
    api
      .get("/inventory/grn/next-no?type=LOCAL")
      .then((res) => {
        if (res.data?.nextNo) {
          setFormData((prev) => ({ ...prev, grn_no: res.data.nextNo }));
        }
      })
      .catch(console.error);
  }, [isNew]);

  useEffect(() => {
    if (isNew) return;

    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get(`/inventory/grn/${id}`)
      .then((res) => {
        if (!mounted) return;
        const g = res.data?.item;
        const details = Array.isArray(g?.details) ? g.details : [];
        if (!g) return;

        setFormData({
          grn_no: g.grn_no || "",
          grn_date: toISODate(g.grn_date),
          supplier_id: g.supplier_id ? String(g.supplier_id) : "",
          warehouse_id: g.warehouse_id ? String(g.warehouse_id) : "",
          po_id: g.po_id ? String(g.po_id) : "",
          invoice_no: g.invoice_no || "",
          invoice_date: toISODate(g.invoice_date),
          invoice_amount:
            g.invoice_amount != null ? String(g.invoice_amount) : "",
          invoice_due_date: toISODate(g.invoice_due_date),
          delivery_number: g.delivery_number || "",
          delivery_date: toISODate(g.delivery_date),
          status: g.status || "DRAFT",
          remarks: g.remarks || "",
          details: details.map((d) => ({
            item_id: d.item_id ? String(d.item_id) : "",
            qty_ordered: d.qty_ordered ?? "",
            qty_received: d.qty_received ?? "",
            qty_accepted: d.qty_accepted ?? "",
            qty_rejected: d.qty_rejected ?? "",
            uom: d.uom || "",
            unit_price: d.unit_price != null ? String(d.unit_price) : "",
            amount:
              d.line_amount != null
                ? String(d.line_amount)
                : (() => {
                    const up = d.unit_price != null ? Number(d.unit_price) : 0;
                    const qa =
                      d.qty_accepted != null
                        ? Number(d.qty_accepted)
                        : d.qty_received != null
                          ? Number(d.qty_received)
                          : d.qty_ordered != null
                            ? Number(d.qty_ordered)
                            : 0;
                    return String(Number(qa || 0) * Number(up || 0));
                  })(),
            batch_serial: d.batch_serial || d.batch_number || "",
            mfg_date: toISODate(d.mfg_date),
            expiry_date: toISODate(d.expiry_date),
            inspection_status: d.inspection_status || "PENDING",
            line_remarks: d.remarks || "",
          })),
        });
        allowPoPopulateRef.current = false;
        if (g.po_id) {
          api
            .get(`/purchase/orders/${g.po_id}`)
            .then((poRes) => {
              const po = poRes.data?.item;
              if (!po) return;
              setPurchaseOrders((prev) => {
                const exists = prev.some((p) => String(p.id) === String(po.id));
                if (exists) return prev;
                return [...prev, po];
              });
            })
            .catch(() => {});
        }
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load GRN");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id, isNew]);

  const itemById = useMemo(() => {
    const m = new Map();
    for (const it of items) m.set(String(it.id), it);
    return m;
  }, [items]);

  const filteredPOs = useMemo(() => {
    const supplierId = formData.supplier_id ? String(formData.supplier_id) : "";
    if (!supplierId) return purchaseOrders;
    return purchaseOrders.filter((po) => String(po.supplier_id) === supplierId);
  }, [purchaseOrders, formData.supplier_id]);

  useEffect(() => {
    if (!formData.po_id) return;
    if (!isNew) return;
    const exists = filteredPOs.some(
      (po) => String(po.id) === String(formData.po_id),
    );
    if (!exists) {
      setFormData((prev) => ({
        ...prev,
        po_id: "",
      }));
    }
  }, [filteredPOs, formData.po_id]);

  const addLine = () => {
    setFormData((prev) => ({
      ...prev,
      details: [
        ...prev.details,
        {
          item_id: items[0]?.id ? String(items[0].id) : "",
          qty_ordered: "",
          qty_received: "",
          uom:
            (items[0]?.uom && String(items[0].uom)) ||
            (defaultUomCode ? String(defaultUomCode) : ""),
          unit_price: String(items[0]?.cost_price ?? ""),
        },
      ],
    }));
  };

  const removeLine = (idx) => {
    setFormData((prev) => ({
      ...prev,
      details: prev.details.filter((_, i) => i !== idx),
    }));
  };

  const updateLine = (idx, patch) => {
    setFormData((prev) => {
      const details = prev.details.map((d, i) =>
        i === idx ? { ...d, ...patch } : d,
      );
      let row = details[idx];
      if (Object.prototype.hasOwnProperty.call(patch, "item_id")) {
        const it = itemById.get(String(patch.item_id));
        const nextUom =
          (it?.uom && String(it.uom)) ||
          (row.uom && String(row.uom)) ||
          (defaultUomCode ? String(defaultUomCode) : "");
        const nextUnitPrice = String(it?.cost_price ?? "");
        row = { ...row, uom: nextUom, unit_price: nextUnitPrice };
        details[idx] = row;
      }
      const unitPrice = row.unit_price === "" ? 0 : Number(row.unit_price || 0);
      const qtyAccepted =
        row.qty_accepted === "" || row.qty_accepted == null
          ? null
          : Number(row.qty_accepted || 0);
      const qtyReceived =
        row.qty_received === "" || row.qty_received == null
          ? null
          : Number(row.qty_received || 0);
      const qtyOrdered =
        row.qty_ordered === "" || row.qty_ordered == null
          ? null
          : Number(row.qty_ordered || 0);
      const effectiveQty =
        (qtyAccepted != null ? qtyAccepted : null) ??
        (qtyReceived != null ? qtyReceived : null) ??
        (qtyOrdered != null ? qtyOrdered : 0);
      details[idx] = {
        ...row,
        amount: String(Number(effectiveQty || 0) * unitPrice),
      };
      return { ...prev, details };
    });
  };

  const handleItemSelect = (idx, newItemId) => {
    const selected = newItemId ? itemById.get(String(newItemId)) : null;
    const fallbackUom =
      (selected?.uom && String(selected.uom)) ||
      (defaultUomCode ? String(defaultUomCode) : "");
    const unitPrice = String(selected?.cost_price ?? "");
    updateLine(idx, {
      item_id: newItemId,
      uom: fallbackUom,
      unit_price: unitPrice,
    });
  };

  useEffect(() => {
    if (!formData.po_id || !allowPoPopulateRef.current) return;
    let mounted = true;
    setLoading(true);
    api
      .get(`/purchase/orders/${formData.po_id}`)
      .then((res) => {
        if (!mounted) return;
        const po = res.data?.item;
        const details = Array.isArray(res.data?.item?.details)
          ? res.data.item.details
          : [];
        if (!po) return;
        setFormData((prev) => ({
          ...prev,
          supplier_id: po.supplier_id
            ? String(po.supplier_id)
            : prev.supplier_id,
          warehouse_id: po.warehouse_id
            ? String(po.warehouse_id)
            : prev.warehouse_id,
          details: details.map((d) => {
            const it = items.find((i) => String(i.id) === String(d.item_id));
            return {
              item_id: d.item_id ? String(d.item_id) : "",
              qty_ordered: d.qty ?? "",
              qty_received: "",
              qty_accepted: "",
              qty_rejected: "",
              uom: it?.uom || "",
              unit_price: String(it?.cost_price ?? ""),
              amount: "",
              batch_serial: "",
              mfg_date: "",
              expiry_date: "",
              inspection_status: "PENDING",
              line_remarks: "",
            };
          }),
        }));
      })
      .catch((e) => {
        setError(e?.response?.data?.message || "Failed to load PO details");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.po_id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        grn_no: formData.grn_no || null,
        grn_date: formData.grn_date,
        grn_type: "LOCAL",
        supplier_id: formData.supplier_id ? Number(formData.supplier_id) : null,
        warehouse_id: formData.warehouse_id
          ? Number(formData.warehouse_id)
          : null,
        po_id: formData.po_id ? Number(formData.po_id) : null,
        invoice_no: formData.invoice_no || null,
        invoice_date: formData.invoice_date || null,
        invoice_amount:
          formData.invoice_amount === "" || formData.invoice_amount == null
            ? null
            : Number(formData.invoice_amount),
        invoice_due_date: formData.invoice_due_date || null,
        delivery_number: formData.delivery_number || null,
        delivery_date: formData.delivery_date || null,
        remarks: formData.remarks || null,
        details: (formData.details || []).map((d) => ({
          item_id: d.item_id ? Number(d.item_id) : null,
          qty_ordered: d.qty_ordered === "" ? null : Number(d.qty_ordered),
          qty_received: d.qty_received === "" ? null : Number(d.qty_received),
          qty_accepted: d.qty_accepted === "" ? null : Number(d.qty_accepted),
          uom: d.uom || null,
          unit_price: d.unit_price === "" ? null : Number(d.unit_price),
          line_amount: d.amount === "" ? null : Number(d.amount),
          batch_serial: d.batch_serial || null,
          mfg_date: d.mfg_date || null,
          expiry_date: d.expiry_date || null,
          inspection_status: d.inspection_status || "PENDING",
          remarks: d.line_remarks || null,
        })),
      };

      if (!payload.grn_date || !payload.supplier_id) {
        throw new Error("GRN date and supplier are required");
      }
      if (!payload.po_id) {
        throw new Error("Purchase order is required");
      }
      if (!payload.invoice_no || !payload.invoice_date) {
        throw new Error("Invoice number and date are required");
      }

      if (isNew) {
        await api.post("/inventory/grn", payload);
      } else {
        await api.put(`/inventory/grn/${id}`, payload);
      }

      navigate("/inventory/grn-local");
    } catch (e2) {
      setError(
        e2?.response?.data?.message || e2?.message || "Failed to save GRN",
      );
    } finally {
      setSaving(false);
    }
  };

  const forwardForApproval = async () => {
    if (isNew) return;
    setSubmittingForward(true);
    setWfError("");
    try {
      const res = await api.post(`/inventory/grn/${id}/submit`, {
        amount:
          formData.invoice_amount === "" || formData.invoice_amount == null
            ? null
            : Number(formData.invoice_amount || 0),
        workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
        target_user_id: targetApproverId || null,
      });
      const newStatus = res?.data?.status || "PENDING_APPROVAL";
      setFormData((prev) => ({ ...prev, status: newStatus }));
      setShowForwardModal(false);
    } catch (e) {
      setWfError(
        e?.response?.data?.message || "Failed to forward for approval",
      );
    } finally {
      setSubmittingForward(false);
    }
  };
  const openForwardModal = async () => {
    if (isNew) return;
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
    const route = "/inventory/grn-local";
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
          ["GOODS_RECEIPT", "GRN", "GOODS_RECEIPT_NOTE"].includes(
            normalize(w.document_type),
          ),
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
    const route = "/inventory/grn-local";
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
          ["GOODS_RECEIPT", "GRN", "GOODS_RECEIPT_NOTE"].includes(
            normalize(w.document_type),
          ),
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

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {isNew
                  ? "New GRN (Local)"
                  : isView
                    ? "View GRN (Local)"
                    : "Edit GRN (Local)"}
              </h1>
              <p className="text-sm mt-1">
                Goods receipt note for local purchases
              </p>
            </div>
            <Link to="/inventory/grn-local" className="btn-success">
              Back to List
            </Link>
          </div>
        </div>

        <div className="card-body">
          <form onSubmit={handleSubmit} className="space-y-6">
            <fieldset
              disabled={isView}
              className={isView ? "disabled-light-blue" : ""}
            >
              {loading ? <div className="text-sm">Loading...</div> : null}
              {error ? (
                <div className="text-sm text-red-600">{error}</div>
              ) : null}

              <div className="card">
                <div className="card-body">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="label">GRN No</label>
                      <input
                        type="text"
                        className="input w-full"
                        value={formData.grn_no}
                        onChange={(e) =>
                          setFormData({ ...formData, grn_no: e.target.value })
                        }
                        placeholder="Auto-generated if blank"
                      />
                    </div>
                    <div>
                      <label className="label">GRN Date *</label>
                      <input
                        type="date"
                        className="input w-full"
                        value={formData.grn_date}
                        onChange={(e) =>
                          setFormData({ ...formData, grn_date: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Warehouse</label>
                      <select
                        className="input w-full"
                        value={formData.warehouse_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            warehouse_id: e.target.value,
                          })
                        }
                      >
                        <option value="">Select warehouse...</option>
                        {warehouses.map((w) => (
                          <option key={w.id} value={String(w.id)}>
                            {(w.warehouse_code
                              ? `${w.warehouse_code} - `
                              : "") + w.warehouse_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-body">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Supplier *</label>
                      <select
                        className="input w-full"
                        value={formData.supplier_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            supplier_id: e.target.value,
                          })
                        }
                        required
                      >
                        <option value="">Select supplier...</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={String(s.id)}>
                            {s.supplier_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Purchase Order *</label>
                      <select
                        className="input w-full"
                        value={formData.po_id}
                        onChange={(e) =>
                          setFormData({ ...formData, po_id: e.target.value })
                        }
                        required
                      >
                        <option value="">Select purchase order...</option>
                        {filteredPOs.map((po) => (
                          <option key={po.id} value={String(po.id)}>
                            {po.po_no}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header bg-brand text-white rounded-t-lg">
                  <h2 className="text-lg font-semibold text-white">
                    Invoice & Delivery Details
                  </h2>
                </div>
                <div className="card-body">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="label">
                        Supplier's Invoice Number *
                      </label>
                      <input
                        type="text"
                        className="input w-full"
                        value={formData.invoice_no}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            invoice_no: e.target.value,
                          })
                        }
                        placeholder="Enter number"
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Invoice Date *</label>
                      <input
                        type="date"
                        className="input w-full"
                        value={formData.invoice_date}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            invoice_date: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Due Date</label>
                      <input
                        type="date"
                        className="input w-full"
                        value={formData.invoice_due_date}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            invoice_due_date: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Delivery Number</label>
                      <input
                        type="text"
                        className="input w-full"
                        value={formData.delivery_number}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            delivery_number: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Delivery Date</label>
                      <input
                        type="date"
                        className="input w-full"
                        value={formData.delivery_date}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            delivery_date: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Remarks</label>
                <textarea
                  className="input"
                  rows="3"
                  value={formData.remarks}
                  onChange={(e) =>
                    setFormData({ ...formData, remarks: e.target.value })
                  }
                />
              </div>

              <div className="card">
                <div className="card-header bg-brand text-white rounded-t-lg">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-white">Items</h2>
                    <button
                      type="button"
                      className="btn-success"
                      onClick={addLine}
                    >
                      + Add Item
                    </button>
                  </div>
                </div>
                <div className="card-body">
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Ordered Qty</th>
                          <th>Received Qty</th>
                          <th>Accepted Qty</th>
                          <th>UOM</th>
                          <th>Unit Price</th>
                          <th>Amount</th>
                          <th>Batch/Serial</th>
                          <th>Mfg Date</th>
                          <th>Expiry Date</th>
                          <th>Inspection</th>
                          <th>Remarks</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {!formData.details.length ? (
                          <tr>
                            <td
                              colSpan="13"
                              className="text-center py-6 text-slate-500 dark:text-slate-400"
                            >
                              No items. Click "Add Item" to begin.
                            </td>
                          </tr>
                        ) : null}

                        {formData.details.map((d, idx) => {
                          const it = d.item_id
                            ? itemById.get(String(d.item_id))
                            : null;
                          const label = it
                            ? `${it.item_code} - ${it.item_name}`
                            : "Select item...";

                          return (
                            <tr key={idx}>
                              <td>
                                <select
                                  className="input min-w-[320px] w-[480px]"
                                  value={d.item_id}
                                  onChange={(e) =>
                                    handleItemSelect(idx, e.target.value)
                                  }
                                >
                                  <option value="">Select item...</option>
                                  {items.map((i) => (
                                    <option key={i.id} value={String(i.id)}>
                                      {i.item_code} - {i.item_name}
                                    </option>
                                  ))}
                                </select>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  {label}
                                </div>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="1"
                                  className="input min-w-[140px]"
                                  value={d.qty_ordered}
                                  onChange={(e) =>
                                    updateLine(idx, {
                                      qty_ordered: e.target.value,
                                    })
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="1"
                                  className="input min-w-[140px]"
                                  value={d.qty_received}
                                  onChange={(e) =>
                                    updateLine(idx, {
                                      qty_received: e.target.value,
                                    })
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="1"
                                  className="input min-w-[140px]"
                                  value={d.qty_accepted}
                                  onChange={(e) =>
                                    updateLine(idx, {
                                      qty_accepted: e.target.value,
                                    })
                                  }
                                />
                              </td>
                              <td>
                                <select
                                  className="input min-w-[160px]"
                                  value={d.uom || defaultUomCode || ""}
                                  onChange={(e) =>
                                    updateLine(idx, { uom: e.target.value })
                                  }
                                >
                                  <option value="">Select UOM</option>
                                  {(Array.isArray(uoms) ? uoms : []).map(
                                    (u) => (
                                      <option key={u.id} value={u.uom_code}>
                                        {u.uom_name
                                          ? `${u.uom_name} (${u.uom_code})`
                                          : u.uom_code}
                                      </option>
                                    ),
                                  )}
                                </select>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="1"
                                  className="input min-w-[140px]"
                                  value={d.unit_price}
                                  onChange={(e) =>
                                    updateLine(idx, {
                                      unit_price: e.target.value,
                                    })
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="1"
                                  className="input min-w-[160px]"
                                  value={d.amount}
                                  onChange={(e) =>
                                    updateLine(idx, { amount: e.target.value })
                                  }
                                  readOnly
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="input min-w-[160px]"
                                  value={d.batch_serial}
                                  onChange={(e) =>
                                    updateLine(idx, {
                                      batch_serial: e.target.value,
                                    })
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  type="date"
                                  className="input min-w-[160px]"
                                  value={d.mfg_date}
                                  onChange={(e) =>
                                    updateLine(idx, {
                                      mfg_date: e.target.value,
                                    })
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  type="date"
                                  className="input min-w-[160px]"
                                  value={d.expiry_date}
                                  onChange={(e) =>
                                    updateLine(idx, {
                                      expiry_date: e.target.value,
                                    })
                                  }
                                />
                              </td>
                              <td>
                                <select
                                  className="input min-w-[140px]"
                                  value={d.inspection_status || "PENDING"}
                                  onChange={(e) =>
                                    updateLine(idx, {
                                      inspection_status: e.target.value,
                                    })
                                  }
                                >
                                  <option value="PENDING">Pending</option>
                                  <option value="PASSED">Passed</option>
                                  <option value="FAILED">Failed</option>
                                </select>
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="input min-w-[200px]"
                                  value={d.line_remarks}
                                  onChange={(e) =>
                                    updateLine(idx, {
                                      line_remarks: e.target.value,
                                    })
                                  }
                                />
                              </td>
                              <td className="text-right">
                                <button
                                  type="button"
                                  className="btn-success"
                                  onClick={() => removeLine(idx)}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <Link to="/inventory/grn-local" className="btn-success">
                  Cancel
                </Link>
                <button
                  type="submit"
                  className="btn-success"
                  disabled={saving || isView}
                >
                  {saving ? "Saving..." : "Save GRN"}
                </button>
                <button
                  type="button"
                  className="btn-success ml-2"
                  onClick={openForwardModal}
                  disabled={saving || isNew || shouldDisable}
                >
                  {String(formData.status || "").toUpperCase() ===
                  "APPROVED" ? (
                    <span className="px-2 py-1 rounded bg-green-500 text-white text-sm font-medium">
                      Approved
                    </span>
                  ) : (
                    "Forward for Approval"
                  )}
                </button>
              </div>
            </fieldset>
          </form>
        </div>
      </div>
      {showForwardModal ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-[640px] max-w-[95%]">
            <div className="p-4 border-b flex justify-between items-center bg-brand text-white rounded-t-lg">
              <div className="font-semibold">Forward GRN for Approval</div>
              <button
                type="button"
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
                <span className="font-semibold">{formData.grn_no}</span>
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
                onClick={forwardForApproval}
                disabled={submittingForward || isNew}
              >
                {submittingForward ? "Forwarding..." : "Forward"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
