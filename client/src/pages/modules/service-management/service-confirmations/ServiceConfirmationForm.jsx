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

  useEffect(() => {
    let mounted = true;
    api
      .get("/purchase/suppliers")
      .then((res) => {
        if (!mounted) return;
        setSuppliers(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load suppliers");
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
      const payload = {
        sc_no: formData.sc_no || null,
        sc_date: formData.sc_date,
        supplier_id: formData.supplier_id ? Number(formData.supplier_id) : null,
        status: formData.status || "DRAFT",
        remarks: formData.remarks || null,
        details: (formData.details || []).map((d) => ({
          description: String(d.description || "").trim(),
          qty: d.qty === "" ? null : Number(d.qty),
          unit_price: d.unit_price === "" ? null : Number(d.unit_price),
        })),
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
            <div>
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="label">No</label>
                      <input
                        type="text"
                        className="input"
                        value={formData.sc_no}
                        onChange={(e) =>
                          setFormData({ ...formData, sc_no: e.target.value })
                        }
                        placeholder="Auto-generated if blank"
                      />
                    </div>
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
                    <div>
                      <label className="label">Status</label>
                      <select
                        className="input"
                        value={formData.status}
                        onChange={(e) =>
                          setFormData({ ...formData, status: e.target.value })
                        }
                      >
                        <option value="DRAFT">DRAFT</option>
                        <option value="CONFIRMED">CONFIRMED</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
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

              <div className="card">
                <div className="card-body space-y-4">
                  <div className="text-lg font-semibold">Select Services</div>
                  <div className="rounded-lg border border-sky-200 bg-sky-50 text-sky-900 p-3 text-sm">
                    Click on services to select them. You can select multiple
                    services.
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                    {servicesCatalog.map((svc) => {
                      const active = isServiceSelected(svc);
                      return (
                        <button
                          key={svc.key}
                          type="button"
                          className={`p-4 rounded-lg border transition-colors text-left ${
                            active
                              ? "border-brand-500 bg-brand text-white"
                              : "border-slate-200 bg-white hover:bg-slate-800 hover:text-white"
                          }`}
                          onClick={() => toggleService(svc)}
                        >
                          <div className="text-2xl">{svc.icon}</div>
                          <div className="font-semibold mt-1">{svc.name}</div>
                          <div className="mt-2 font-bold">
                            {`GH₵ ${Number(svc.price).toFixed(2)}`}
                          </div>
                        </button>
                      );
                    })}
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
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="card">
                <div className="card-header bg-brand text-white rounded-t-lg">
                  <div className="font-semibold">Service Summary</div>
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
                </div>
              </div>

              <div className="card">
                <div className="card-body space-y-2">
                  <div className="text-lg font-semibold">Selected Services</div>
                  {!formData.details.length ? (
                    <div className="text-center text-slate-600 p-6">
                      <div className="text-3xl">🔧</div>
                      <div className="text-sm mt-2">No services selected</div>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
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
                            <div className="flex items-center gap-2 mt-2">
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                onClick={() =>
                                  updateLine(idx, {
                                    qty: Math.max(1, qty - 1),
                                  })
                                }
                              >
                                -
                              </button>
                              <span className="text-sm font-semibold">
                                {qty}
                              </span>
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                onClick={() =>
                                  updateLine(idx, { qty: qty + 1 })
                                }
                              >
                                +
                              </button>
                              <button
                                type="button"
                                className="btn-danger btn-sm ml-auto"
                                onClick={() => removeLine(idx)}
                              >
                                Remove
                              </button>
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
                  <div className="font-semibold">Deposit</div>
                </div>
                <div className="card-body space-y-2">
                  <label className="label">Deposit Percent</label>
                  <input
                    type="number"
                    className="input"
                    value={depositPercent}
                    onChange={(e) => setDepositPercent(e.target.value)}
                    placeholder="0"
                  />
                  <div className="text-sm">
                    Deposit Amount: {`GH₵ ${depositAmount.toFixed(2)}`}
                  </div>
                </div>
              </div>
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
              className="btn-primary"
              onClick={handleSubmit}
              disabled={saving}
            >
              Save Confirmation
            </button>
          </div>
          {error ? (
            <div className="text-sm text-red-600 mt-3">{error}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
