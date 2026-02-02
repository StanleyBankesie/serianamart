import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useUoms } from "@/hooks/useUoms";

import { api } from "api/client";

export default function IssueToRequirementForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const toDateOnly = (v) => {
    if (!v) return "";
    const s = String(v);
    return s.includes("T") ? s.split("T")[0] : s;
  };

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [availableItems, setAvailableItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [requisitions, setRequisitions] = useState([]);

  const [formData, setFormData] = useState({
    issueNo: isNew ? "Auto-generated" : "ISS-000",
    issueDate: new Date().toISOString().split("T")[0],
    warehouseId: "",
    issuedTo: "",
    departmentId: "",
    issueType: "GENERAL",
    requisitionId: "",
    status: "DRAFT",
    remarks: "",
  });

  const [lines, setLines] = useState([
    {
      id: 1,
      item_id: "",
      itemCode: "",
      itemName: "",
      qtyIssued: 0,
      uom: "",
      batchNumber: "",
      serialNumber: "",
    },
  ]);

  const mapIssueTypeFromReq = (reqType) => {
    const t = String(reqType || "").toUpperCase();
    if (t === "PRODUCTION") return "PRODUCTION";
    if (t === "MAINTENANCE") return "MAINTENANCE";
    return "GENERAL";
  };

  const populateFromRequisition = async (reqId) => {
    if (!reqId) return;
    try {
      const res = await api.get(`/inventory/material-requisitions/${reqId}`);
      const hdr = res.data?.item || null;
      const details = Array.isArray(res.data?.details) ? res.data.details : [];
      if (hdr) {
        setFormData((prev) => ({
          ...prev,
          requisitionId: String(reqId),
          warehouseId: hdr.warehouse_id
            ? String(hdr.warehouse_id)
            : prev.warehouseId,
          departmentId: hdr.department_id
            ? String(hdr.department_id)
            : prev.departmentId,
          issueType: mapIssueTypeFromReq(hdr.requisition_type),
          issuedTo: hdr.requested_by || prev.issuedTo,
          remarks: prev.remarks || "",
        }));
      }
      if (details.length) {
        const populatedLines = details.map((d) => {
          const remaining =
            Number(d.qty_requested || 0) - Number(d.qty_issued || 0);
          return {
            id: d.id || Date.now() + Math.random(),
            item_id: d.item_id ? String(d.item_id) : "",
            itemCode: d.item_code || "",
            itemName: d.item_name || "",
            qtyIssued: remaining > 0 ? remaining : Number(d.qty_requested || 0),
            uom: d.uom || "",
            batchNumber: "",
            serialNumber: "",
          };
        });
        setLines(populatedLines);
      }
    } catch (e) {
      // keep existing form; surface error for visibility
      setError(
        e?.response?.data?.message || "Failed to populate from requisition"
      );
    }
  };

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const [itemsRes, warehousesRes, deptsRes, reqRes] = await Promise.all([
          api.get("/inventory/items"),
          api.get("/inventory/warehouses"),
          api.get("/admin/departments"),
          api.get("/inventory/material-requisitions"),
        ]);

        if (mounted) {
          setAvailableItems(
            Array.isArray(itemsRes.data?.items) ? itemsRes.data.items : []
          );
          setWarehouses(
            Array.isArray(warehousesRes.data?.items)
              ? warehousesRes.data.items
              : []
          );
          setDepartments(
            Array.isArray(deptsRes.data?.items) ? deptsRes.data.items : []
          );
          setRequisitions(
            Array.isArray(reqRes.data?.items)
              ? reqRes.data.items.filter(
                  (r) => String(r.status || "").toUpperCase() === "APPROVED"
                )
              : []
          );
        }
      } catch (e) {
        if (mounted) {
          setError(e?.response?.data?.message || "Failed to load initial data");
        }
      }
    };

    fetchData();

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
      .get(`/inventory/issue-to-requirement/${id}`)
      .then((res) => {
        if (!mounted) return;
        const h = res.data?.item;
        const details = Array.isArray(res.data?.details)
          ? res.data.details
          : [];
        if (!h) return;

        setFormData({
          issueNo: h.issue_no || "",
          issueDate:
            toDateOnly(h.issue_date) || new Date().toISOString().split("T")[0],
          warehouseId: h.warehouse_id ? String(h.warehouse_id) : "",
          issuedTo: h.issued_to || "",
          departmentId: h.department_id ? String(h.department_id) : "",
          issueType: h.issue_type || "GENERAL",
          requisitionId: h.requisition_id ? String(h.requisition_id) : "",
          status: h.status || "DRAFT",
          remarks: h.remarks || "",
        });

        setLines(
          details.length
            ? details.map((d) => ({
                id: d.id || Date.now() + Math.random(),
                item_id: d.item_id ? String(d.item_id) : "",
                itemCode: d.item_code || "",
                itemName: d.item_name || "",
                qtyIssued: Number(d.qty_issued) || 0,
                uom: d.uom || "",
                batchNumber: d.batch_number || "",
                serialNumber: d.serial_number || "",
              }))
            : [
                {
                  id: 1,
                  item_id: "",
                  itemCode: "",
                  itemName: "",
                  qtyIssued: 0,
                  uom: "",
                  batchNumber: "",
                  serialNumber: "",
                },
              ]
        );
      })
      .catch((e) => {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Failed to load issue to requirement"
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
    return lines
      .filter((l) => l.item_id)
      .map((l) => ({
        item_id: Number(l.item_id),
        qty_issued: Number(l.qtyIssued) || 0,
        uom: l.uom || "",
        batch_number: l.batchNumber || null,
        serial_number: l.serialNumber || null,
      }));
  }, [lines]);

  const addLine = () => {
    setLines([
      ...lines,
      {
        id: Date.now(),
        item_id: "",
        itemCode: "",
        itemName: "",
        qtyIssued: 0,
        uom: "",
        batchNumber: "",
        serialNumber: "",
      },
    ]);
  };

  const removeLine = (lineId) => {
    setLines(lines.filter((l) => l.id !== lineId));
  };

  const handleSubmit = async (e, statusOverride) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError("");

    const finalStatus = statusOverride || formData.status;

    try {
      const payload = {
        issue_no: isNew ? undefined : formData.issueNo,
        issue_date: formData.issueDate,
        warehouse_id: formData.warehouseId
          ? Number(formData.warehouseId)
          : null,
        issued_to: formData.issuedTo || null,
        department_id: formData.departmentId
          ? Number(formData.departmentId)
          : null,
        issue_type: formData.issueType,
        requisition_id: formData.requisitionId
          ? Number(formData.requisitionId)
          : null,
        status: finalStatus,
        remarks: formData.remarks || null,
        details: normalizedDetails,
      };

      if (isNew) {
        await api.post("/inventory/issue-to-requirement", payload);
      } else {
        await api.put(`/inventory/issue-to-requirement/${id}`, payload);
      }

      navigate("/inventory/issue-to-requirement");
    } catch (e2) {
      setError(
        e2?.response?.data?.message || "Failed to save issue to requirement"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                {isNew
                  ? "New Issue to Requirement Area"
                  : "Edit Issue to Requirement Area"}
              </h1>
              <p className="text-sm mt-1">
                Issue materials to departments / requirement areas
              </p>
            </div>
            <Link to="/inventory/issue-to-requirement" className="btn-success">
              Back to List
            </Link>
          </div>
        </div>

        <div className="card-body">
          <form onSubmit={handleSubmit} className="space-y-6">
            {loading ? <div className="text-sm">Loading...</div> : null}
            {error ? <div className="text-sm text-red-600">{error}</div> : null}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Issue No</label>
                <input
                  type="text"
                  className="input bg-slate-100 dark:bg-slate-700"
                  value={formData.issueNo}
                  disabled
                />
              </div>
              <div>
                <label className="label">Issue Date *</label>
                <input
                  type="date"
                  className="input"
                  value={formData.issueDate}
                  onChange={(e) =>
                    setFormData({ ...formData, issueDate: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="label">Issue Type</label>
                <select
                  className="input"
                  value={formData.issueType}
                  onChange={(e) =>
                    setFormData({ ...formData, issueType: e.target.value })
                  }
                >
                  <option value="GENERAL">General</option>
                  <option value="PRODUCTION">Production</option>
                  <option value="MAINTENANCE">Maintenance</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Department</label>
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
                      {d.name || d.department_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Warehouse</label>
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
                      {w.warehouse_name || w.warehouse_code || w.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Requisition Reference</label>
                <select
                  className="input"
                  value={formData.requisitionId}
                  onChange={async (e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, requisitionId: val });
                    if (val) {
                      await populateFromRequisition(val);
                    }
                  }}
                >
                  <option value="">Select Requisition (Optional)</option>
                  {requisitions.map((req) => (
                    <option key={req.id} value={req.id}>
                      {req.requisition_no}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <option value="ISSUED">ISSUED</option>
                  <option value="POSTED">POSTED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Remarks</label>
                <input
                  type="text"
                  className="input"
                  value={formData.remarks}
                  onChange={(e) =>
                    setFormData({ ...formData, remarks: e.target.value })
                  }
                  placeholder="Enter any additional notes or remarks"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Items
                </h3>
                <button
                  type="button"
                  onClick={addLine}
                  className="btn-success text-sm"
                >
                  + Add Item
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="w-12">#</th>
                      <th>Item</th>
                      <th>Qty Issued</th>
                      <th>UOM</th>
                      <th>Batch No</th>
                      <th>Serial No</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => (
                      <tr key={line.id}>
                        <td className="text-center text-slate-500">
                          {index + 1}
                        </td>
                        <td className="w-1/3">
                          <select
                            className="input"
                            value={line.item_id}
                            onChange={(e) => {
                              const selectedId = e.target.value;
                              const selected = availableItems.find(
                                (ai) => String(ai.id) === String(selectedId)
                              );
                              setLines(
                                lines.map((l) =>
                                  l.id === line.id
                                    ? {
                                        ...l,
                                        item_id: selectedId,
                                        itemCode: selected?.item_code || "",
                                        itemName: selected?.item_name || "",
                                        uom: selected?.uom || "",
                                      }
                                    : l
                                )
                              );
                            }}
                            required
                          >
                            <option value="">Select Item</option>
                            {availableItems.map((ai) => (
                              <option key={ai.id} value={ai.id}>
                                {(ai.item_code || ai.id) +
                                  " - " +
                                  (ai.item_name || "")}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="w-24">
                          <input
                            type="number"
                            className="input"
                            value={line.qtyIssued}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              setLines(
                                lines.map((l) =>
                                  l.id === line.id
                                    ? {
                                        ...l,
                                        qtyIssued: Number.isFinite(v) ? v : 0,
                                      }
                                    : l
                                )
                              );
                            }}
                            min="0"
                            step="0.001"
                          />
                        </td>
                        <td className="w-24">
                          <input
                            type="text"
                            className="input bg-slate-100 dark:bg-slate-700"
                            value={line.uom || ""}
                            readOnly
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="input"
                            value={line.batchNumber}
                            onChange={(e) =>
                              setLines(
                                lines.map((l) =>
                                  l.id === line.id
                                    ? { ...l, batchNumber: e.target.value }
                                    : l
                                )
                              )
                            }
                            placeholder="Batch No"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="input"
                            value={line.serialNumber}
                            onChange={(e) =>
                              setLines(
                                lines.map((l) =>
                                  l.id === line.id
                                    ? { ...l, serialNumber: e.target.value }
                                    : l
                                )
                              )
                            }
                            placeholder="Serial No"
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => removeLine(line.id)}
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
                to="/inventory/issue-to-requirement"
                className="px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, "DRAFT")}
                className="px-4 py-2 bg-slate-500 text-white rounded hover:bg-slate-600"
                disabled={saving}
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, "POSTED")}
                className="btn-success"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save & Post"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
