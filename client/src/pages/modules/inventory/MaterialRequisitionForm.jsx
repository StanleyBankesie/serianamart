import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "api/client";
import { useUoms } from "@/hooks/useUoms";
import "./MaterialRequisitionForm.css";

function normalizeDate(v) {
  if (!v) return new Date().toISOString().split("T")[0];
  const s = String(v);
  return s.includes("T") ? s.split("T")[0] : s;
}

export default function MaterialRequisitionForm() {
  const { uoms, loading: uomsLoading } = useUoms();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [availableItems, setAvailableItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemSearch, setItemSearch] = useState("");

  const [formData, setFormData] = useState({
    requisitionNo: isNew ? "Auto-generated" : "",
    requisitionDate: new Date().toISOString().split("T")[0],
    warehouseId: "",
    departmentId: "",
    requisitionType: "INTERNAL",
    priority: "MEDIUM",
    requestedBy: "",
    remarks: "",
    status: "DRAFT",
  });

  const [items, setItems] = useState([
    {
      id: 1,
      item_id: "",
      itemCode: "",
      itemName: "",
      qtyRequested: 0,
      qtyIssued: 0,
      uom: "PCS",
    },
  ]);

  useEffect(() => {
    let mounted = true;

    // Fetch users
    api
      .get("/admin/users")
      .then((res) => {
        if (!mounted) return;
        setUsers(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((err) => console.error("Failed to load users", err));

    // Fetch warehouses
    api
      .get("/inventory/warehouses")
      .then((res) => {
        if (!mounted) return;
        setWarehouses(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((err) => console.error("Failed to load warehouses", err));

    // Fetch departments
    api
      .get("/admin/departments")
      .then((res) => {
        if (!mounted) return;
        setDepartments(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((err) => console.error("Failed to load departments", err));

    api
      .get("/inventory/items")
      .then((res) => {
        if (!mounted) return;
        setAvailableItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load items");
      });

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
      .get(`/inventory/material-requisitions/${id}`)
      .then((res) => {
        if (!mounted) return;
        const r = res.data?.item;
        const details = Array.isArray(res.data?.details)
          ? res.data.details
          : [];
        if (!r) return;

        setFormData({
          requisitionNo: r.requisition_no || "",
          requisitionDate: normalizeDate(r.requisition_date),
          warehouseId: r.warehouse_id || "",
          departmentId: r.department_id || "",
          requisitionType: r.requisition_type || "INTERNAL",
          priority: r.priority || "MEDIUM",
          requestedBy: r.requested_by || "",
          remarks: r.remarks || "",
          status: r.status || "DRAFT",
        });

        setItems(
          details.length
            ? details.map((d) => ({
                id: d.id || Date.now() + Math.random(),
                item_id: d.item_id ? String(d.item_id) : "",
                itemCode: d.item_code || "",
                itemName: d.item_name || "",
                qtyRequested: Number(d.qty_requested) || 0,
                qtyIssued: Number(d.qty_issued) || 0,
                uom: d.uom || "PCS",
              }))
            : [
                {
                  id: 1,
                  item_id: "",
                  itemCode: "",
                  itemName: "",
                  qtyRequested: 0,
                  qtyIssued: 0,
                  uom: "PCS",
                },
              ]
        );
      })
      .catch((e) => {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Failed to load material requisition"
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

  const normalizedDetails = useMemo(() => {
    return items
      .filter((r) => r.item_id)
      .map((r) => ({
        item_id: Number(r.item_id),
        qty_requested: Math.max(0, parseInt(r.qtyRequested, 10) || 0),
        qty_issued: Number(r.qtyIssued) || 0,
      }));
  }, [items]);

  const statusColors = {
    DRAFT: "bg-gray-500 text-white",
    PENDING: "bg-yellow-400 text-black",
    PENDING_APPROVAL: "bg-yellow-400 text-black",
    SUBMITTED: "bg-yellow-300 text-black",
    APPROVED: "bg-green-500 text-white",
    ISSUED: "bg-blue-500 text-white",
    REJECTED: "bg-red-500 text-white",
  };

  const handleSubmit = async (e, statusOverride) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        requisition_no: isNew ? undefined : formData.requisitionNo,
        requisition_date: normalizeDate(formData.requisitionDate),
        warehouse_id: formData.warehouseId || null,
        department_id: formData.departmentId || null,
        requisition_type: formData.requisitionType,
        priority: formData.priority,
        requested_by: formData.requestedBy || null,
        remarks: formData.remarks || null,
        status: statusOverride || formData.status,
        details: normalizedDetails,
      };

      if (isNew) {
        await api.post("/inventory/material-requisitions", payload);
      } else {
        await api.put(`/inventory/material-requisitions/${id}`, payload);
      }

      navigate("/inventory/material-requisitions");
    } catch (e2) {
      setError(
        e2?.response?.data?.message || "Failed to save material requisition"
      );
    } finally {
      setSaving(false);
    }
  };

  const forwardForApproval = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        requisition_no: isNew ? undefined : formData.requisitionNo,
        requisition_date: normalizeDate(formData.requisitionDate),
        warehouse_id: formData.warehouseId || null,
        department_id: formData.departmentId || null,
        requisition_type: formData.requisitionType,
        priority: formData.priority,
        requested_by: formData.requestedBy || null,
        remarks: formData.remarks || null,
        status: formData.status || "DRAFT",
        details: normalizedDetails,
      };
      let newId = id;
      if (isNew) {
        const res = await api.post("/inventory/material-requisitions", payload);
        newId = res?.data?.id ? String(res.data.id) : null;
        if (!newId) throw new Error("Failed to create requisition");
      } else {
        await api.put(`/inventory/material-requisitions/${id}`, payload);
      }
      const targetId = newId || id;
      const submitRes = await api.post(
        `/inventory/material-requisitions/${targetId}/submit`,
        { amount: null }
      );
      const instanceId = submitRes?.data?.instanceId;
      setFormData((prev) => ({
        ...prev,
        status: submitRes?.data?.status || "PENDING_APPROVAL",
      }));
      if (instanceId) {
        navigate(`/administration/workflows/approvals/${instanceId}`);
      } else {
        navigate("/inventory/material-requisitions");
      }
    } catch (e2) {
      setError(
        e2?.response?.data?.message ||
          e2?.message ||
          "Failed to forward for approval"
      );
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => {
    setShowItemModal(true);
    setItemSearch("");
  };

  const handleSelectItem = (item) => {
    setItems([
      ...items,
      {
        id: Date.now(),
        item_id: String(item.id),
        itemCode: item.item_code || "",
        itemName: item.item_name || "",
        qtyRequested: 0,
        qtyIssued: 0,
        uom: item.uom || "PCS",
      },
    ]);
    setShowItemModal(false);
  };

  const filteredItems = useMemo(() => {
    if (!itemSearch) return availableItems;
    const lower = itemSearch.toLowerCase();
    return availableItems.filter(
      (i) =>
        (i.item_code && i.item_code.toLowerCase().includes(lower)) ||
        (i.item_name && i.item_name.toLowerCase().includes(lower))
    );
  }, [availableItems, itemSearch]);

  const removeItem = (id) => {
    setItems(items.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                {isNew
                  ? "New Material Requisition"
                  : "Edit Material Requisition"}
              </h1>
              <p className="text-sm mt-1">
                Request materials from warehouse inventory
              </p>
            </div>
            <Link to="/inventory/material-requisitions" className="btn-success">
              Back to List
            </Link>
          </div>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit} className="space-y-6">
            {loading ? <div className="text-sm">Loading...</div> : null}
            {error ? <div className="text-sm text-red-600">{error}</div> : null}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="label">Requisition No</label>
                <input
                  type="text"
                  className="input bg-slate-100 dark:bg-slate-700"
                  value={formData.requisitionNo}
                  disabled
                />
              </div>
              <div>
                <label className="label">Requisition Date *</label>
                <input
                  type="date"
                  className="input"
                  value={formData.requisitionDate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      requisitionDate: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div>
                <label className="label">Priority</label>
                <select
                  className="input"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: e.target.value })
                  }
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <div className="pt-2">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      statusColors[formData.status] || "bg-gray-500 text-white"
                    }`}
                  >
                    {formData.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Source Warehouse</label>
                <select
                  className="input"
                  value={formData.warehouseId}
                  onChange={(e) =>
                    setFormData({ ...formData, warehouseId: e.target.value })
                  }
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
                <label className="label">Destination Department</label>
                <select
                  className="input"
                  value={formData.departmentId}
                  onChange={(e) =>
                    setFormData({ ...formData, departmentId: e.target.value })
                  }
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Requisition Type</label>
                <select
                  className="input"
                  value={formData.requisitionType}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      requisitionType: e.target.value,
                    })
                  }
                >
                  <option value="INTERNAL">Internal Use</option>
                  <option value="PROJECT">Project</option>
                  <option value="SALES">Sales Order</option>
                  <option value="PRODUCTION">Production</option>
                </select>
              </div>
              <div>
                <label className="label">Requested By *</label>
                <select
                  className="input"
                  value={formData.requestedBy}
                  onChange={(e) =>
                    setFormData({ ...formData, requestedBy: e.target.value })
                  }
                  required
                >
                  <option value="">Select User</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.username}>
                      {u.username}
                    </option>
                  ))}
                </select>
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
                placeholder="Enter any additional notes..."
              ></textarea>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Items
                </h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="btn-success text-sm"
                >
                  + Add Item
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Item Code</th>
                      <th>Item Name</th>
                      <th>Qty Requested</th>
                      <th>Qty Issued</th>
                      <th>UOM</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <select
                            className="input"
                            value={item.item_id}
                            onChange={(e) => {
                              const selectedId = e.target.value;
                              const selected = availableItems.find(
                                (ai) => String(ai.id) === String(selectedId)
                              );
                              const updated = items.map((i) =>
                                i.id === item.id
                                  ? {
                                      ...i,
                                      item_id: selectedId,
                                      itemCode: selected?.item_code || "",
                                      itemName: selected?.item_name || "",
                                    }
                                  : i
                              );
                              setItems(updated);
                            }}
                            required
                          >
                            <option value="">Select Item</option>
                            {!availableItems.some(
                              (ai) => String(ai.id) === String(item.item_id)
                            ) &&
                              item.item_id && (
                                <option value={item.item_id}>
                                  {item.itemCode || item.item_id}
                                </option>
                              )}
                            {availableItems.map((ai) => (
                              <option key={ai.id} value={ai.id}>
                                {ai.item_code || ai.id}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="input"
                            value={item.itemName}
                            disabled
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="input"
                            value={item.qtyRequested}
                            onChange={(e) => {
                              const updated = items.map((i) =>
                                i.id === item.id
                                  ? {
                                      ...i,
                                      qtyRequested: Math.max(
                                        0,
                                        parseInt(e.target.value, 10) || 0
                                      ),
                                    }
                                  : i
                              );
                              setItems(updated);
                            }}
                            min="0"
                            step="1"
                            inputMode="numeric"
                            pattern="[0-9]*"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="input bg-slate-100 dark:bg-slate-700"
                            value={item.qtyIssued}
                            disabled
                          />
                        </td>
                        <td>
                          <select
                            className="input"
                            value={item.uom}
                            onChange={(e) => {
                              const updated = items.map((i) =>
                                i.id === item.id
                                  ? { ...i, uom: e.target.value }
                                  : i
                              );
                              setItems(updated);
                            }}
                          >
                            <option value="EA">EA</option>
                            <option value="PCS">PCS</option>
                            <option value="KG">KG</option>
                            <option value="LTR">LTR</option>
                            <option value="MTR">MTR</option>
                          </select>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Link
                to="/inventory/material-requisitions"
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, "DRAFT")}
                className="btn-success"
                disabled={saving}
              >
                {saving ? "Saving..." : "💾 Save Draft"}
              </button>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, "PENDING")}
                className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
                disabled={saving}
              >
                {saving ? "Saving..." : "🟡 Save as Pending"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Item Selection Modal */}
      {showItemModal && (
        <div
          className="custom-modal-overlay"
          onClick={() => setShowItemModal(false)}
        >
          <div
            className="custom-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-brand text-white rounded-t-lg flex justify-between items-center">
              <h2 className="text-xl font-bold">Select Item</h2>
              <button
                onClick={() => setShowItemModal(false)}
                className="text-white hover:text-gray-200 text-2xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-4 flex-1 overflow-hidden flex flex-col">
              <div className="mb-4">
                <label className="label">Search Items</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Search by item code or name..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="item-list-container flex-1 overflow-y-auto">
                {filteredItems.length === 0 ? (
                  <div className="text-center p-4 text-gray-500">
                    No items found
                  </div>
                ) : (
                  filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className="item-card cursor-pointer hover:bg-slate-100 mb-2 p-3 border rounded"
                      onClick={() => handleSelectItem(item)}
                    >
                      <div className="font-bold text-brand">
                        {item.item_code || "N/A"}
                      </div>
                      <div className="text-gray-800">
                        {item.item_name || "Unnamed Item"}
                      </div>
                      <div className="text-xs text-gray-500">
                        UOM: {item.uom || "N/A"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="p-4 border-t flex justify-end bg-gray-50 rounded-b-lg">
              <button
                type="button"
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                onClick={() => setShowItemModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
