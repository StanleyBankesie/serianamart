import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client.js";

function toYmd(date) {
  const d = date instanceof Date ? date : new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function ServiceExecutionForm() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [executionDate, setExecutionDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [assignedSupervisor, setAssignedSupervisor] = useState("");

  const [materials, setMaterials] = useState([]);
  const [requisitionNotes, setRequisitionNotes] = useState("");
  const [invItems, setInvItems] = useState([]);
  const [supervisors, setSupervisors] = useState([]);

  const [assignedTechs, setAssignedTechs] = useState(new Set());
  const [actualStartTime, setActualStartTime] = useState("");
  const [estimatedDuration, setEstimatedDuration] = useState("");
  const [workPerformed, setWorkPerformed] = useState("");
  const [executionFiles, setExecutionFiles] = useState([]);

  const [qualityChecks, setQualityChecks] = useState({
    qc1: false,
    qc2: false,
    qc3: false,
    qc4: false,
    qc5: false,
    qc6: false,
  });
  const [actualEndTime, setActualEndTime] = useState("");
  const totalDuration = useMemo(() => {
    try {
      const [sh, sm] = (actualStartTime || "00:00")
        .split(":")
        .map((x) => Number(x || 0));
      const [eh, em] = (actualEndTime || "00:00")
        .split(":")
        .map((x) => Number(x || 0));
      const start = sh + sm / 60;
      const end = eh + em / 60;
      const diff = end - start;
      return diff > 0 ? diff.toFixed(2) : "";
    } catch {
      return "";
    }
  }, [actualStartTime, actualEndTime]);
  const [qualityNotes, setQualityNotes] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [customerFeedback, setCustomerFeedback] = useState("");
  const [satisfaction, setSatisfaction] = useState("");
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [closingRemarks, setClosingRemarks] = useState("");
  const [closingFiles, setClosingFiles] = useState([]);
  const [confirmClosure, setConfirmClosure] = useState(false);

  const [showSuccess, setShowSuccess] = useState(false);
  const [executionNumber, setExecutionNumber] = useState("");

  const filteredOrders = useMemo(() => {
    const s = search.toLowerCase();
    return orders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(s) ||
        o.customer.toLowerCase().includes(s) ||
        o.serviceType.toLowerCase().includes(s),
    );
  }, [search]);

  useEffect(() => {
    let mounted = true;
    async function fetchOrders() {
      try {
        const resp = await api.get("/purchase/service-orders", {
          params: { type: "INTERNAL" },
        });
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        const mapped = rows.map((r) => ({
          id: r.id,
          orderNumber: r.order_no,
          customer: r.customer_name || "",
          serviceType: r.service_type || "",
          location: r.work_location || "",
          scheduledDate: r.order_date || "",
          status: r.status || "",
          estimatedCost: Number(r.total_amount || 0),
          assigned_supervisor_username: r.assigned_supervisor_username || "",
          assigned_supervisor_user_id: r.assigned_supervisor_user_id || null,
        }));
        if (mounted) setOrders(mapped);
      } catch {
        if (mounted) setOrders([]);
      }
    }
    const now = new Date();
    setExecutionDate(toYmd(now));
    setScheduledTime(
      `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    );
    fetchOrders();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (selectedOrder) {
      setAssignedSupervisor(selectedOrder.assigned_supervisor_username || "");
    }
  }, [selectedOrder]);

  function nextStep(n) {
    setStep(n);
  }
  function previousStep(n) {
    setStep(n);
  }
  function addMaterialItem() {
    setMaterials((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        code: "",
        name: "",
        qty: 1,
        unit: "",
        note: "",
      },
    ]);
  }
  function updateMaterial(id, key, value) {
    setMaterials((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [key]: value } : m)),
    );
  }
  function removeMaterial(id) {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  }
  function toggleTech(id) {
    setAssignedTechs((prev) => {
      const next = new Set(Array.from(prev));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function onFileAdd(setter) {
    return (e) => {
      const incoming = Array.from(e.target.files || []);
      setter((prev) => [...prev, ...incoming]);
      e.target.value = "";
    };
  }
  function formatMoney(n) {
    return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
  }
  useEffect(() => {
    let mounted = true;
    async function fetchItems() {
      try {
        const resp = await api.get("/inventory/items", {
          params: { active: 1 },
        });
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        if (mounted) setInvItems(rows);
      } catch {
        if (mounted) setInvItems([]);
      }
    }
    async function fetchSupervisors() {
      try {
        const resp = await api.get("/purchase/service-setup/supervisors");
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        if (mounted) setSupervisors(rows);
      } catch {
        if (mounted) setSupervisors([]);
      }
    }
    fetchItems();
    fetchSupervisors();
    return () => {
      mounted = false;
    };
  }, []);
  async function submit(e) {
    e.preventDefault();
    const orderId = selectedOrder?.id || null;
    const payload = {
      order_id: orderId,
      execution_no: "",
      execution_date: executionDate || null,
      scheduled_time: scheduledTime || null,
      assigned_supervisor_user_id:
        selectedOrder?.assigned_supervisor_user_id || null,
      assigned_supervisor_username:
        selectedOrder?.assigned_supervisor_username || null,
      requisition_notes: requisitionNotes || null,
      status: "PENDING",
      materials: materials.map((m) => ({
        code: m.code || null,
        name: m.name || "",
        unit: m.unit || "",
        qty: Number(m.qty || 0) || 0,
        note: m.note || "",
      })),
    };
    try {
      const res = await api.post("/purchase/service-executions", payload);
      const num =
        res.data?.execution_no || `EXEC-${Date.now().toString().slice(-8)}`;
      setExecutionNumber(num);
      navigate("/service-management/service-executions", {
        state: { success: "Service execution saved successfully" },
      });
    } catch (err) {
      alert("Failed to save service execution");
      setExecutionNumber("");
    }
  }

  const summaryHtml = useMemo(() => {
    if (!selectedOrder) {
      return '<p style="text-align:center;color:#64748b;padding:20px;">Select a service order to begin</p>';
    }
    const mCount = materials.length;
    const qPassed = Object.values(qualityChecks).filter(Boolean).length;
    return `
      <div class="space-y-2">
        <div class="summary-item"><span class="label">Order</span><span class="value">${selectedOrder.orderNumber}</span></div>
        <div class="summary-item"><span class="label">Customer</span><span class="value">${selectedOrder.customer}</span></div>
        <div class="summary-item"><span class="label">Type</span><span class="value">${selectedOrder.serviceType}</span></div>
        <div class="summary-item"><span class="label">Scheduled</span><span class="value">${selectedOrder.scheduledDate}</span></div>
        <div class="summary-item"><span class="label">Materials</span><span class="value">${mCount}</span></div>
        <div class="summary-item"><span class="label">Techs</span><span class="value">${Array.from(assignedTechs).length}</span></div>
        <div class="summary-item"><span class="label">QC Checks</span><span class="value">${qPassed} / 6</span></div>
        <div class="summary-item"><span class="label">Est. Cost</span><span class="value">$${formatMoney(selectedOrder.estimatedCost)}</span></div>
        <div class="status-badge ${step < 3 ? "status-pending" : step < 5 ? "status-in-progress" : "status-completed"}">
          ${step < 3 ? "Pending" : step < 5 ? "In Progress" : "Completed"}
        </div>
      </div>
    `;
  }, [selectedOrder, materials, assignedTechs, qualityChecks, step]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/service-management/service-executions"
            className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back
          </Link>
          <h1 className="text-2xl font-bold mt-2">
            Service Execution Management
          </h1>
          <p className="text-sm mt-1">
            Track and manage service execution from assignment to completion
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div className="font-semibold">Execution Progress</div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={step === n ? "btn-primary" : "btn-secondary"}
                  onClick={() => setStep(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_380px] gap-6">
            <div>
              <form onSubmit={submit} className="space-y-4">
                {step === 1 && (
                  <div className="card">
                    <div className="card-body space-y-3">
                      <div className="text-lg font-semibold">
                        📋 Service Order Reference
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="md:col-span-2">
                          <label className="label">
                            Search Service Order{" "}
                            <span className="text-red-600">*</span>
                          </label>
                          <select
                            className="input"
                            value={selectedOrder?.id || ""}
                            onChange={(e) => {
                              const id = e.target.value;
                              const o = orders.find(
                                (x) => String(x.id) === String(id),
                              );
                              if (o) {
                                setSelectedOrder(o);
                                setSearch(o.orderNumber);
                              } else {
                                setSelectedOrder(null);
                                setSearch("");
                              }
                            }}
                          >
                            <option value="">
                              -- Select Internal Service Order --
                            </option>
                            {orders.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.orderNumber} • {o.customer} • {o.serviceType}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">
                            Execution Date{" "}
                            <span className="text-red-600">*</span>
                          </label>
                          <input
                            className="input"
                            type="date"
                            value={executionDate}
                            onChange={(e) => setExecutionDate(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="label">
                            Scheduled Time{" "}
                            <span className="text-red-600">*</span>
                          </label>
                          <input
                            className="input"
                            type="time"
                            value={scheduledTime}
                            onChange={(e) => setScheduledTime(e.target.value)}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="label">
                            Assigned Supervisor{" "}
                            <span className="text-red-600">*</span>
                          </label>
                          <input
                            className="input"
                            value={assignedSupervisor}
                            onChange={(e) =>
                              setAssignedSupervisor(e.target.value)
                            }
                            placeholder="Auto-filled from service order"
                            readOnly
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => nextStep(2)}
                        >
                          Next: Material Requisition →
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="card">
                    <div className="card-body space-y-3">
                      <div className="text-lg font-semibold">
                        📦 Material Requisition from Stores
                      </div>
                      <div className="text-sm bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                        Materials will be checked against store inventory.
                        Unavailable items will be flagged for procurement.
                      </div>
                      <div className="space-y-2">
                        {materials.map((m) => (
                          <div
                            key={m.id}
                            className="grid grid-cols-1 md:grid-cols-[2fr_1fr_120px_120px_40px] gap-2 items-end p-3 bg-slate-50 rounded border"
                          >
                            <div>
                              <label className="label">Description</label>
                              <select
                                className="input"
                                value={m.code}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const item = invItems.find(
                                    (it) => String(it.id) === String(val),
                                  );
                                  updateMaterial(m.id, "code", val);
                                  updateMaterial(
                                    m.id,
                                    "name",
                                    item?.item_name || "",
                                  );
                                  updateMaterial(m.id, "unit", item?.uom || "");
                                }}
                              >
                                <option value="">-- Select Item --</option>
                                {invItems.map((it) => (
                                  <option key={it.id} value={it.id}>
                                    {it.item_name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="label">Qty</label>
                              <input
                                className="input"
                                type="number"
                                min="1"
                                value={m.qty}
                                onChange={(e) =>
                                  updateMaterial(m.id, "qty", e.target.value)
                                }
                              />
                            </div>
                            <div>
                              <label className="label">Unit</label>
                              <input
                                className="input"
                                value={m.unit}
                                readOnly
                              />
                            </div>
                            <div>
                              <label className="label">Note</label>
                              <input
                                className="input"
                                value={m.note}
                                onChange={(e) =>
                                  updateMaterial(m.id, "note", e.target.value)
                                }
                                placeholder="Optional note"
                              />
                            </div>
                            <button
                              type="button"
                              className="btn-danger"
                              onClick={() => removeMaterial(m.id)}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={addMaterialItem}
                        >
                          + Add Material Item
                        </button>
                      </div>
                      <div>
                        <label className="label">Requisition Notes</label>
                        <textarea
                          className="input"
                          value={requisitionNotes}
                          onChange={(e) => setRequisitionNotes(e.target.value)}
                          placeholder="Any special requirements or notes"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => previousStep(1)}
                        >
                          ← Back
                        </button>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => nextStep(3)}
                        >
                          Next: Execution Details →
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="card">
                    <div className="card-body space-y-3">
                      <div className="text-lg font-semibold">
                        🔧 Service Execution Details
                      </div>
                      <div className="space-y-2">
                        {supervisors.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between p-3 bg-slate-50 rounded border"
                          >
                            <div className="font-medium text-brand-700">
                              {s.username}
                            </div>
                            <input
                              type="checkbox"
                              checked={assignedTechs.has(s.user_id)}
                              onChange={() => toggleTech(s.user_id)}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="label">
                            Actual Start Time{" "}
                            <span className="text-red-600">*</span>
                          </label>
                          <input
                            className="input"
                            type="time"
                            value={actualStartTime}
                            onChange={(e) => setActualStartTime(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="label">
                            Estimated Duration (hours){" "}
                            <span className="text-red-600">*</span>
                          </label>
                          <input
                            className="input"
                            type="number"
                            step="0.5"
                            min="0"
                            value={estimatedDuration}
                            onChange={(e) =>
                              setEstimatedDuration(e.target.value)
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <label className="label">
                          Work Performed Description{" "}
                          <span className="text-red-600">*</span>
                        </label>
                        <textarea
                          className="input"
                          value={workPerformed}
                          onChange={(e) => setWorkPerformed(e.target.value)}
                          placeholder="Detailed description of work performed"
                        />
                      </div>
                      <div>
                        <label className="label">
                          Service Execution Photos
                        </label>
                        <input
                          type="file"
                          multiple
                          accept=".jpg,.jpeg,.png"
                          onChange={onFileAdd(setExecutionFiles)}
                        />
                        {executionFiles.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {executionFiles.map((f) => (
                              <div
                                key={f.name}
                                className="flex items-center justify-between p-2 border rounded"
                              >
                                <div className="text-xs">
                                  {f.name} • {(f.size / 1024).toFixed(1)} KB
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => previousStep(2)}
                        >
                          ← Back
                        </button>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => nextStep(4)}
                        >
                          Next: Quality Check →
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="card">
                    <div className="card-body space-y-3">
                      <div className="text-lg font-semibold">
                        ✅ Quality Check & Verification
                      </div>
                      <div className="space-y-2">
                        {Object.keys(qualityChecks).map((key, idx) => (
                          <label
                            key={key}
                            className="inline-flex items-center gap-2 text-sm p-2 border rounded"
                          >
                            <input
                              type="checkbox"
                              checked={qualityChecks[key]}
                              onChange={(e) =>
                                setQualityChecks((prev) => ({
                                  ...prev,
                                  [key]: e.target.checked,
                                }))
                              }
                            />
                            {
                              [
                                "All work completed as per service order specifications",
                                "All materials used are documented and accounted for",
                                "Work area cleaned and restored to original condition",
                                "All safety protocols followed during execution",
                                "Equipment/systems tested and functioning properly",
                                "No additional issues or defects identified",
                              ][idx]
                            }
                          </label>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="label">
                            Actual End Time{" "}
                            <span className="text-red-600">*</span>
                          </label>
                          <input
                            className="input"
                            type="time"
                            value={actualEndTime}
                            onChange={(e) => setActualEndTime(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="label">
                            Total Duration (hours)
                          </label>
                          <input
                            className="input"
                            value={totalDuration}
                            readOnly
                          />
                        </div>
                      </div>
                      <div>
                        <label className="label">Quality Check Notes</label>
                        <textarea
                          className="input"
                          value={qualityNotes}
                          onChange={(e) => setQualityNotes(e.target.value)}
                          placeholder="Any observations, recommendations, or issues"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => previousStep(3)}
                        >
                          ← Back
                        </button>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => nextStep(5)}
                        >
                          Next: Service Closing →
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {step === 5 && (
                  <div className="card">
                    <div className="card-body space-y-3">
                      <div className="text-lg font-semibold">
                        🏁 Service Closing
                      </div>
                      {/* Customer fields removed */}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={followUpRequired}
                          onChange={(e) =>
                            setFollowUpRequired(e.target.checked)
                          }
                        />
                        <span>Follow-up service required</span>
                      </div>
                      {followUpRequired && (
                        <div>
                          <label className="label">Follow-up Details</label>
                          <textarea
                            className="input"
                            value={followUpNotes}
                            onChange={(e) => setFollowUpNotes(e.target.value)}
                          />
                        </div>
                      )}
                      <div>
                        <label className="label">
                          Closing Remarks{" "}
                          <span className="text-red-600">*</span>
                        </label>
                        <textarea
                          className="input"
                          value={closingRemarks}
                          onChange={(e) => setClosingRemarks(e.target.value)}
                          placeholder="Final summary and recommendations"
                        />
                      </div>
                      <div>
                        <label className="label">
                          Completion Certificate/Photos
                        </label>
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={onFileAdd(setClosingFiles)}
                        />
                        {closingFiles.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {closingFiles.map((f) => (
                              <div
                                key={f.name}
                                className="flex items-center justify-between p-2 border rounded"
                              >
                                <div className="text-xs">
                                  {f.name} • {(f.size / 1024).toFixed(1)} KB
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={confirmClosure}
                          onChange={(e) => setConfirmClosure(e.target.checked)}
                        />
                        <span>
                          I confirm that all work has been completed
                          satisfactorily and customer has approved the service
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => previousStep(4)}
                        >
                          ← Back
                        </button>
                        <button
                          type="submit"
                          className="btn-success"
                          disabled={!confirmClosure}
                        >
                          Complete Service Execution
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </div>
            <div>
              <div className="card">
                <div className="card-body">
                  <h2 className="text-lg font-semibold mb-2">
                    Execution Summary
                  </h2>
                  <div dangerouslySetInnerHTML={{ __html: summaryHtml }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success modal removed; navigation occurs after save */}
    </div>
  );
}
