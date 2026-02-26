import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { api } from "../../../../api/client";

function toISODate(v) {
  if (!v) return "";
  try {
    return new Date(v).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export default function ServiceConfirmationForm() {
  const { id } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const isNew = id === "new";
  const mode =
    new URLSearchParams(search).get("mode") || (isNew ? "edit" : "view");

  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [suppliers, setSuppliers] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [selectedExecutionId, setSelectedExecutionId] = useState("");
  const selectedExecution = useMemo(
    () => executions.find((x) => String(x.id) === String(selectedExecutionId)),
    [executions, selectedExecutionId],
  );

  const [formData, setFormData] = useState({
    sc_no: "",
    sc_date: toISODate(new Date()),
    supplier_id: "",
    status: "DRAFT",
    remarks: "",
    details: [],
  });
  const [appointmentTime, setAppointmentTime] = useState("");
  const [depositPercent, setDepositPercent] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [accept1, setAccept1] = useState(false);
  const [accept2, setAccept2] = useState(false);
  const [accept3, setAccept3] = useState(false);
  const [accept4, setAccept4] = useState(false);
  const [accept5, setAccept5] = useState(false);
  const [satisfaction, setSatisfaction] = useState("");
  const [customerFeedback, setCustomerFeedback] = useState("");
  const [warrantyProvided, setWarrantyProvided] = useState(false);
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const readyToConfirm = useMemo(() => {
    const checksOk = accept1 && accept2 && accept3 && accept4 && accept5;
    const hasSatisfaction = !!satisfaction;
    const hasExec = !!selectedExecutionId;
    const hasSupplier = !!formData.supplier_id;
    const hasDate = !!formData.sc_date;
    return checksOk && hasSatisfaction && hasExec && hasSupplier && hasDate;
  }, [
    accept1,
    accept2,
    accept3,
    accept4,
    accept5,
    satisfaction,
    selectedExecutionId,
    formData.supplier_id,
    formData.sc_date,
  ]);

  useEffect(() => {
    let mounted = true;
    api
      .get("/purchase/suppliers", { params: { contractor: "Y" } })
      .then((res) => {
        if (!mounted) return;
        const rows = Array.isArray(res.data?.items) ? res.data.items : [];
        const filtered = rows.filter(
          (s) => String(s.service_contractor || "").toUpperCase() === "Y",
        );
        setSuppliers(filtered);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load suppliers");
      });

    api
      .get("/purchase/service-orders", { params: { type: "EXTERNAL" } })
      .then((res) => {
        if (!mounted) return;
        const arr = Array.isArray(res.data?.items) ? res.data.items : [];
        const mapped = arr.map((x) => ({
          id: x.id,
          order_no: x.order_no,
          status: x.status || "",
          assigned_supervisor_username: x.assigned_supervisor_username || "",
          order_date: x.order_date || "",
        }));
        setExecutions(mapped);
      })
      .catch(() => {
        if (!mounted) return;
        setExecutions([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (isNew) return;

    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get(`/purchase/service-confirmations/${id}`)
      .then((res) => {
        if (!mounted) return;
        const c = res.data?.item;
        const details = Array.isArray(res.data?.details)
          ? res.data.details
          : [];
        if (!c) return;

        setFormData({
          sc_no: c.sc_no || "",
          sc_date: toISODate(c.sc_date),
          supplier_id: c.supplier_id ? String(c.supplier_id) : "",
          status: c.status || "DRAFT",
          remarks: c.remarks || "",
          details: details.map((d) => ({
            description: d.description || "",
            qty: d.qty ?? "",
            unit_price: d.unit_price ?? "",
          })),
        });
      })
      .catch((e) => {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Failed to load service confirmation",
        );
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id, isNew]);

  const servicesCatalog = useMemo(
    () => [
      { key: "diagnosis", name: "Diagnosis", icon: "🔎", price: 50 },
      { key: "repair", name: "Repair", icon: "🛠️", price: 150 },
      { key: "maintenance", name: "Maintenance", icon: "🔧", price: 100 },
      { key: "installation", name: "Installation", icon: "⚙️", price: 200 },
      { key: "consultation", name: "Consultation", icon: "💬", price: 75 },
      { key: "upgrade", name: "Upgrade", icon: "⬆️", price: 220 },
    ],
    [],
  );

  const computedTotal = useMemo(() => {
    const lines = formData.details || [];
    let total = 0;
    for (const d of lines) {
      const qty = Number(d.qty);
      const unitPrice = Number(d.unit_price);
      if (!Number.isFinite(qty) || !Number.isFinite(unitPrice)) continue;
      total += qty * unitPrice;
    }
    return total;
  }, [formData.details]);

  const tax = useMemo(() => computedTotal * 0.125, [computedTotal]);
  const grandTotal = useMemo(() => computedTotal + tax, [computedTotal, tax]);
  const depositAmount = useMemo(
    () => grandTotal * (Number(depositPercent) / 100),
    [grandTotal, depositPercent],
  );

  function handlePrint() {
    window.print();
  }
  function handleDownload() {
    alert("Downloading confirmation PDF (demo)");
  }
  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert("Link copied to clipboard");
    } catch {
      alert("Unable to copy link");
    }
  }

  const addLine = () => {
    setFormData((prev) => ({
      ...prev,
      details: [...prev.details, { description: "", qty: "", unit_price: "" }],
    }));
  };

  const removeLine = (idx) => {
    setFormData((prev) => ({
      ...prev,
      details: prev.details.filter((_, i) => i !== idx),
    }));
  };

  const updateLine = (idx, patch) => {
    setFormData((prev) => ({
      ...prev,
      details: prev.details.map((d, i) => (i === idx ? { ...d, ...patch } : d)),
    }));
  };

  const toggleService = (svc) => {
    const existsIdx = formData.details.findIndex(
      (d) => String(d.description || "").trim() === svc.name,
    );
    if (existsIdx >= 0) {
      removeLine(existsIdx);
      return;
    }
    setFormData((prev) => ({
      ...prev,
      details: [
        ...prev.details,
        { description: svc.name, qty: 1, unit_price: svc.price },
      ],
    }));
  };

  const isServiceSelected = (svc) => {
    return formData.details.some(
      (d) => String(d.description || "").trim() === svc.name,
    );
  };

  const handleSubmit = async (e) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (!selectedExecutionId) {
        throw new Error("Select completed external service order");
      }
      if (!(accept1 && accept2 && accept3 && accept4 && accept5)) {
        throw new Error("Check all acceptance items");
      }
      if (!satisfaction) {
        throw new Error("Select satisfaction rating");
      }
      const payload = {
        sc_no:
          formData.sc_no ||
          `SC-${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`,
        sc_date: formData.sc_date,
        supplier_id: formData.supplier_id ? Number(formData.supplier_id) : null,
        status: "CONFIRMED",
        remarks:
          (formData.remarks || "") +
          (additionalNotes ? `\nNotes: ${additionalNotes}` : "") +
          (warrantyProvided ? `\nWarranty provided` : "") +
          (followUpRequired && followUpNotes
            ? `\nFollow-up: ${followUpNotes}`
            : ""),
        details: (formData.details || []).map((d) => ({
          description: String(d.description || "").trim(),
          qty: d.qty === "" ? null : Number(d.qty),
          unit_price: d.unit_price === "" ? null : Number(d.unit_price),
        })),
        satisfaction: Number(satisfaction),
        customer_feedback: customerFeedback || null,
      };

      if (!payload.sc_date || !payload.supplier_id) {
        throw new Error("Date and supplier are required");
      }

      if (isNew) {
        await api.post("/purchase/service-confirmations", payload);
      } else {
        await api.put(`/purchase/service-confirmations/${id}`, payload);
      }

      navigate("/purchase/service-confirmation");
    } catch (e2) {
      setError(
        e2?.response?.data?.message ||
          e2?.message ||
          "Failed to save service confirmation",
      );
    } finally {
      setSaving(false);
    }
  };

  const supplierName = useMemo(() => {
    const sid = formData.supplier_id ? Number(formData.supplier_id) : null;
    if (!sid) return "";
    const s = suppliers.find((x) => Number(x.id) === sid);
    return s ? s.supplier_name || "" : "";
  }, [formData.supplier_id, suppliers]);

  const resetForm = () => {
    setFormData({
      sc_no: "",
      sc_date: toISODate(new Date()),
      supplier_id: "",
      status: "DRAFT",
      remarks: "",
      details: [],
    });
    setAppointmentTime("");
    setDepositPercent(0);
  };

  if (mode === "view" && !isNew) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-4">
          <div className="flex justify-center mb-2">
            <div className="bg-green-100 rounded-full p-3">
              <span className="text-3xl">✓</span>
            </div>
          </div>
          <div className="text-2xl font-bold" style={{ color: "#0E3646" }}>
            Service Confirmation
          </div>
          <div className="text-sm mt-1">Confirmation saved successfully</div>
        </div>

        <div
          className="bg-white rounded-2xl shadow-lg p-6 mb-4 border-l-4"
          style={{ borderLeftColor: "#0E3646" }}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500">Confirmation Number</div>
              <div className="text-xl font-bold" style={{ color: "#0E3646" }}>
                {formData.sc_no || "-"}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-2 border-2 border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                onClick={handlePrint}
              >
                🖨️ <span className="text-sm font-medium">Print</span>
              </button>
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-2 border-2 border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                onClick={handleDownload}
              >
                📄 <span className="text-sm font-medium">Download</span>
              </button>
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-2 border-2 border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                onClick={handleShare}
              >
                🔗 <span className="text-sm font-medium">Share</span>
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg">
            <div className="flex justify-between items-center">
              <div className="font-semibold">Status</div>
              <span className="badge badge-info">
                {formData.status || "DRAFT"}
              </span>
            </div>
          </div>
          <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-xs text-slate-500">Supplier</div>
              <div className="font-semibold">{supplierName || "-"}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Appointment</div>
              <div className="font-semibold">{formData.sc_date || "-"}</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-xs text-slate-500">Remarks</div>
              <div className="font-semibold">{formData.remarks || "-"}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg">
            <div className="font-semibold">Selected Services</div>
          </div>
          <div className="card-body">
            {!formData.details.length ? (
              <div className="text-center text-slate-600 p-6">
                <div className="text-3xl">🔧</div>
                <div className="text-sm mt-2">No services selected</div>
              </div>
            ) : (
              <div className="space-y-2">
                {formData.details.map((d, idx) => {
                  const qty = Math.max(1, Number(d.qty || 1));
                  const unit = Number(d.unit_price || 0);
                  const amount = qty * unit;
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-slate-200 bg-white"
                    >
                      <div className="flex justify-between items-center">
                        <div className="font-medium text-brand-700">
                          {d.description}
                        </div>
                        <div className="font-semibold">
                          {`GH₵ ${amount.toFixed(2)}`}
                        </div>
                      </div>
                      <div className="text-xs text-slate-600">
                        {`GH₵ ${unit.toFixed(2)} × ${qty}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg">
            <div className="font-semibold">Totals</div>
          </div>
          <div className="card-body space-y-2">
            <div className="flex justify-between">
              <div>Services Subtotal</div>
              <div>{`GH₵ ${computedTotal.toFixed(2)}`}</div>
            </div>
            <div className="flex justify-between">
              <div>Tax (12.5%)</div>
              <div>{`GH₵ ${tax.toFixed(2)}`}</div>
            </div>
            <div className="flex justify-between border-t pt-2 font-bold">
              <div>Total</div>
              <div>{`GH₵ ${grandTotal.toFixed(2)}`}</div>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Link to="/purchase/service-confirmation" className="btn-secondary">
            Back to List
          </Link>
          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              navigate(`/purchase/service-confirmation/${id}?mode=edit`)
            }
          >
            Edit Confirmation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div className="flex items-center gap-3">
              <Link
                to="/purchase/service-confirmation"
                className="px-3 py-1 rounded bg-white text-brand hover:bg-slate-100"
              >
                ← Back
              </Link>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                {isNew
                  ? "New Service Confirmation"
                  : "Edit Service Confirmation"}
              </h1>
              <p className="text-sm mt-1">Confirm service receipts</p>
            </div>
            <div className="text-right">
              <div className="text-sm">
                {now.toLocaleDateString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
              <div className="text-sm font-semibold">
                {now.toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="card">
                <div className="card-body space-y-4">
                  <div className="text-lg font-semibold">
                    Service Order Reference
                  </div>
                  <div>
                    <label className="label">Completed Service Order *</label>
                    <select
                      className="input"
                      value={selectedExecutionId}
                      onChange={(e) => setSelectedExecutionId(e.target.value)}
                      required
                    >
                      <option value="">Select external service order...</option>
                      {executions.map((ex) => (
                        <option key={ex.id} value={String(ex.id)}>
                          {ex.order_no || ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedExecution ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-blue-50 border border-blue-200 rounded p-3">
                      <div>
                    <div className="text-xs text-slate-500">Order</div>
                        <div className="font-semibold">
                          {selectedExecution.order_no || "-"}
                        </div>
                      </div>
                      <div>
                    <div className="text-xs text-slate-500">Status</div>
                        <div className="font-semibold">
                      {selectedExecution.status || "-"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Supervisor</div>
                        <div className="font-semibold">
                          {selectedExecution.assigned_supervisor_username ||
                            "-"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Date</div>
                        <div className="font-semibold">
                          {selectedExecution.order_date || "-"}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="card">
                <div className="card-body space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="label">Date *</label>
                      <input
                        type="date"
                        className="input"
                        value={formData.sc_date}
                        onChange={(e) =>
                          setFormData({ ...formData, sc_date: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="label">Supplier *</label>
                      <select
                        className="input"
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
                            {(s.supplier_code ? `${s.supplier_code} - ` : "") +
                              s.supplier_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Time</label>
                      <input
                        type="time"
                        className="input"
                        value={appointmentTime}
                        onChange={(e) => setAppointmentTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Select Services section removed */}

              

              <div className="card">
                <div className="card-body space-y-4">
                  <div className="text-lg font-semibold">
                    Service Acceptance
                  </div>
                  <div className="space-y-2">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={accept1}
                        onChange={(e) => setAccept1(e.target.checked)}
                      />
                      <span>
                        All services listed were completed as specified
                      </span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={accept2}
                        onChange={(e) => setAccept2(e.target.checked)}
                      />
                      <span>Work quality meets agreed standards</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={accept3}
                        onChange={(e) => setAccept3(e.target.checked)}
                      />
                      <span>Materials used were as specified or approved</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={accept4}
                        onChange={(e) => setAccept4(e.target.checked)}
                      />
                      <span>Service location was left clean and tidy</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={accept5}
                        onChange={(e) => setAccept5(e.target.checked)}
                      />
                      <span>
                        All documentation, warranties, and instructions received
                      </span>
                    </label>
                  </div>
                  <div>
                    <label className="label">Overall Satisfaction *</label>
                    <div className="flex flex-wrap gap-3 mt-1">
                      {[5, 4, 3, 2, 1].map((n) => (
                        <label
                          key={n}
                          className="inline-flex items-center gap-2 text-sm"
                        >
                          <input
                            type="radio"
                            name="satisfaction"
                            value={String(n)}
                            checked={satisfaction === String(n)}
                            onChange={(e) => setSatisfaction(e.target.value)}
                          />
                          {Array.from({ length: n })
                            .map(() => "⭐")
                            .join("")}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label">
                      Customer Feedback{" "}
                      <span className="text-slate-500">(Optional)</span>
                    </label>
                    <textarea
                      className="input"
                      value={customerFeedback}
                      onChange={(e) => setCustomerFeedback(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-body space-y-3">
                  <div className="text-lg font-semibold">
                    Additional Information
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={warrantyProvided}
                        onChange={(e) => setWarrantyProvided(e.target.checked)}
                      />
                      <span>Warranty documentation provided</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={followUpRequired}
                        onChange={(e) => setFollowUpRequired(e.target.checked)}
                      />
                      <span>Follow-up visit required</span>
                    </label>
                  </div>
                  {followUpRequired ? (
                    <div>
                      <label className="label">Follow-up Details</label>
                      <textarea
                        className="input"
                        value={followUpNotes}
                        onChange={(e) => setFollowUpNotes(e.target.value)}
                      />
                    </div>
                  ) : null}
                  <div>
                    <label className="label">
                      Additional Notes{" "}
                      <span className="text-slate-500">(Optional)</span>
                    </label>
                    <textarea
                      className="input"
                      value={additionalNotes}
                      onChange={(e) => setAdditionalNotes(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="card">
                <div className="card-header bg-brand text-white rounded-t-lg">
                  <div className="font-semibold">Confirmation Summary</div>
                </div>
                <div className="card-body space-y-2">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <div className="text-sm">Supplier</div>
                    <div className="text-sm font-semibold">
                      {supplierName || "-"}
                    </div>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <div className="text-sm">Appointment</div>
                    <div className="text-sm font-semibold">
                      {(formData.sc_date || "") +
                        (appointmentTime ? ` ${appointmentTime}` : "")}
                    </div>
                  </div>
                  <div className="flex justify-between py-1">
                    <div className="text-sm">Location</div>
                    <div className="text-sm font-semibold">In Shop</div>
                  </div>
                  <div className="flex justify-between py-1 border-t pt-2">
                    <div className="text-sm">Total</div>
                    <div className="text-sm font-semibold">{`GH₵ ${computedTotal.toFixed(2)}`}</div>
                  </div>
                  <div className="mt-2">
                    <span
                      className={
                        "inline-block px-3 py-1 rounded-full text-xs font-semibold " +
                        (readyToConfirm
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700")
                      }
                    >
                      {readyToConfirm
                        ? "Ready to Confirm"
                        : "Pending Confirmation"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Selected Services card removed */}

              {/* Deposit card removed */}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Link
              to="/service-management/service-confirmation"
              className="btn-secondary"
            >
              Cancel
            </Link>
            <button
              type="button"
              className="btn-danger px-4 py-2"
              onClick={() => {
                setRejectionReason("");
                setShowRejectModal(true);
              }}
            >
              Reject Service
            </button>
            <button
              type="button"
              className="btn-success"
              onClick={handleSubmit}
              disabled={saving || !readyToConfirm}
            >
              Confirm Service Completion
            </button>
          </div>
          {error ? (
            <div className="text-sm text-red-600 mt-3">{error}</div>
          ) : null}
        </div>
      </div>
      {showRejectModal ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="card w-full max-w-lg">
            <div className="card-header bg-brand text-white rounded-t-lg">
              <div className="font-semibold">Service Rejection</div>
            </div>
            <div className="card-body space-y-3">
              <div>
                <label className="label">Reason for Rejection *</label>
                <textarea
                  className="input"
                  rows="4"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowRejectModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => {
                    if (!rejectionReason.trim()) {
                      alert("Please provide a reason for rejection.");
                      return;
                    }
                    alert("Service rejection has been recorded.");
                    setShowRejectModal(false);
                  }}
                >
                  Submit Rejection
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
