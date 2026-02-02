import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";
import { useUoms } from "@/hooks/useUoms";

export default function StockTransferForm() {
  const { uoms, loading: uomsLoading } = useUoms();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [availableItems, setAvailableItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [fromBranchWarehouses, setFromBranchWarehouses] = useState([]);
  const [toBranchWarehouses, setToBranchWarehouses] = useState([]);

  const [formData, setFormData] = useState({
    transferNo: isNew ? "Auto-generated" : "ST-2024-001",
    transferDate: new Date().toISOString().split("T")[0],
    transferType: "INTER_WAREHOUSE",
    deliveryDate: "",
    driverName: "",
    vehicleNo: "",
    fromBranchId: "",
    toBranchId: "",
    fromWarehouseId: "",
    toWarehouseId: "",
    remarks: "",
    status: "DRAFT",
  });

  const [items, setItems] = useState([
    {
      id: 1,
      item_id: "",
      itemCode: "",
      itemName: "",
      qty: 0,
      uom: "PCS",
      batchNumber: "",
      remarks: "",
    },
  ]);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const [itemsRes, branchesRes, warehousesRes] = await Promise.all([
          api.get("/inventory/items"),
          api.get("/admin/branches"),
          api.get("/inventory/warehouses"),
        ]);

        if (mounted) {
          setAvailableItems(
            Array.isArray(itemsRes.data?.items) ? itemsRes.data.items : []
          );
          setBranches(
            Array.isArray(branchesRes.data?.items) ? branchesRes.data.items : []
          );
          setWarehouses(
            Array.isArray(warehousesRes.data?.items)
              ? warehousesRes.data.items
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
    if (!isNew) return;
    let mounted = true;
    api
      .get("/inventory/stock-transfers/next-no")
      .then((res) => {
        if (!mounted) return;
        const nextNo = res.data?.next_no;
        if (nextNo) {
          setFormData((prev) => ({ ...prev, transferNo: nextNo }));
        }
      })
      .catch(() => {
        // ignore
      });
    return () => {
      mounted = false;
    };
  }, [isNew]);

  useEffect(() => {
    if (isNew) return;

    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get(`/inventory/stock-transfers/${id}`)
      .then((res) => {
        if (!mounted) return;
        const t = res.data?.item;
        const details = Array.isArray(res.data?.details)
          ? res.data.details
          : [];
        if (!t) return;

        setFormData({
          transferNo: t.transfer_no || "",
          transferDate: t.transfer_date
            ? typeof t.transfer_date === "string"
              ? t.transfer_date.split("T")[0]
              : new Date(t.transfer_date).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
          transferType: t.transfer_type || "INTER_WAREHOUSE",
          deliveryDate: t.delivery_date ? t.delivery_date.split("T")[0] : "",
          driverName: t.driver_name || "",
          vehicleNo: t.vehicle_no || "",
          fromBranchId: t.from_branch_id ? String(t.from_branch_id) : "",
          toBranchId: t.to_branch_id ? String(t.to_branch_id) : "",
          remarks: t.remarks || "",
          status: t.status || "DRAFT",
        });

        setItems(
          details.length
            ? details.map((d) => ({
                id: d.id || Date.now() + Math.random(),
                item_id: d.item_id ? String(d.item_id) : "",
                itemCode: d.item_code || "",
                itemName: d.item_name || "",
                qty: Number(d.qty) || 0,
                uom: d.uom || "PCS",
                batchNumber: d.batch_number || "",
                remarks: d.remarks || "",
              }))
            : [
                {
                  id: 1,
                  item_id: "",
                  itemCode: "",
                  itemName: "",
                  qty: 0,
                  uom: "PCS",
                  batchNumber: "",
                  remarks: "",
                },
              ]
        );
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load stock transfer");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id, isNew]);

  useEffect(() => {
    if (formData.transferType !== "INTER_BRANCH") {
      setFromBranchWarehouses([]);
      return;
    }
    const bid = Number(formData.fromBranchId);
    if (!bid) {
      setFromBranchWarehouses([]);
      return;
    }
    const branch = branches.find((b) => String(b.id) === String(bid));
    const companyId = branch ? Number(branch.company_id) : undefined;
    api
      .get("/inventory/warehouses", {
        headers: {
          "x-branch-id": String(bid),
          ...(companyId ? { "x-company-id": String(companyId) } : {}),
        },
      })
      .then((res) => {
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setFromBranchWarehouses(items);
      })
      .catch(() => {
        setFromBranchWarehouses([]);
      });
  }, [formData.transferType, formData.fromBranchId, branches]);

  useEffect(() => {
    if (formData.transferType !== "INTER_BRANCH") {
      setToBranchWarehouses([]);
      return;
    }
    const bid = Number(formData.toBranchId);
    if (!bid) {
      setToBranchWarehouses([]);
      return;
    }
    const branch = branches.find((b) => String(b.id) === String(bid));
    const companyId = branch ? Number(branch.company_id) : undefined;
    api
      .get("/inventory/warehouses", {
        headers: {
          "x-branch-id": String(bid),
          ...(companyId ? { "x-company-id": String(companyId) } : {}),
        },
      })
      .then((res) => {
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setToBranchWarehouses(items);
      })
      .catch(() => {
        setToBranchWarehouses([]);
      });
  }, [formData.transferType, formData.toBranchId, branches]);

  useEffect(() => {
    setFormData((prev) =>
      String(prev.fromBranchId) ? prev : { ...prev, fromWarehouseId: "" }
    );
  }, [formData.fromBranchId]);

  useEffect(() => {
    setFormData((prev) =>
      String(prev.toBranchId) ? prev : { ...prev, toWarehouseId: "" }
    );
  }, [formData.toBranchId]);

  const normalizedDetails = useMemo(() => {
    return items
      .filter((r) => r.item_id)
      .map((r) => ({
        item_id: Number(r.item_id),
        qty: Number(r.qty) || 0,
        batch_number: r.batchNumber,
        remarks: r.remarks,
      }));
  }, [items]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const isInterBranch = formData.transferType === "INTER_BRANCH";
      const isInterWarehouse = formData.transferType === "INTER_WAREHOUSE";

      const fromWarehouseIdIW = isInterWarehouse
        ? Number(formData.fromBranchId) || null
        : Number(formData.fromWarehouseId) || null;
      const toWarehouseIdIW = isInterWarehouse
        ? Number(formData.toBranchId) || null
        : Number(formData.toWarehouseId) || null;

      let fromBranchIdNum = Number(formData.fromBranchId) || null;
      let toBranchIdNum = Number(formData.toBranchId) || null;

      if (isInterWarehouse) {
        const fromWh = warehouses.find(
          (w) => String(w.id) === String(fromWarehouseIdIW)
        );
        const toWh = warehouses.find(
          (w) => String(w.id) === String(toWarehouseIdIW)
        );
        fromBranchIdNum =
          fromWh && fromWh.branch_id
            ? Number(fromWh.branch_id)
            : fromBranchIdNum;
        toBranchIdNum =
          toWh && toWh.branch_id ? Number(toWh.branch_id) : toBranchIdNum;
      }

      const payload = {
        transfer_no: isNew ? undefined : formData.transferNo,
        transfer_date: formData.transferDate,
        transfer_type: formData.transferType,
        delivery_date: formData.deliveryDate,
        driver_name: formData.driverName || null,
        vehicle_no: formData.vehicleNo || null,
        from_branch_id: fromBranchIdNum,
        to_branch_id: toBranchIdNum,
        from_warehouse_id: fromWarehouseIdIW,
        to_warehouse_id: toWarehouseIdIW,
        status: formData.status,
        remarks: formData.remarks,
        details: normalizedDetails,
      };

      if (isNew) {
        await api.post("/inventory/stock-transfers", payload);
      } else {
        await api.put(`/inventory/stock-transfers/${id}`, payload);
      }

      navigate("/inventory/stock-transfers");
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to save stock transfer");
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        id: Date.now(),
        item_id: "",
        itemCode: "",
        itemName: "",
        qty: 0,
        uom: "PCS",
        batchNumber: "",
        remarks: "",
      },
    ]);
  };

  const removeItem = (id) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const getSourceDestName = (id) => {
    if (!id) return "";
    if (formData.transferType === "INTER_WAREHOUSE") {
      const w = warehouses.find((w) => String(w.id) === String(id));
      return w ? w.warehouse_name : "";
    }
    const b = branches.find((b) => String(b.id) === String(id));
    return b ? b.name : "";
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                {isNew ? "New Stock Transfer" : "Edit Stock Transfer"}
              </h1>
              <p className="text-sm mt-1">
                Transfer stock between warehouses and branches
              </p>
            </div>
            <Link to="/inventory/stock-transfers" className="btn-success">
              Back to List
            </Link>
          </div>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit} className="space-y-6">
            {loading ? <div className="text-sm">Loading...</div> : null}
            {error ? <div className="text-sm text-red-600">{error}</div> : null}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="label">Transfer No</label>
                <input
                  type="text"
                  className="input bg-slate-100 dark:bg-slate-700"
                  value={formData.transferNo}
                  disabled
                />
              </div>
              <div>
                <label className="label">Transfer Date *</label>
                <input
                  type="date"
                  className="input"
                  value={formData.transferDate}
                  onChange={(e) =>
                    setFormData({ ...formData, transferDate: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="label">Transfer Type *</label>
                <select
                  className="input"
                  value={formData.transferType}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      transferType: e.target.value,
                      fromBranchId: "",
                      toBranchId: "",
                      fromWarehouseId: "",
                      toWarehouseId: "",
                    })
                  }
                  required
                >
                  <option value="INTER_WAREHOUSE">Inter-Warehouse</option>
                  <option value="INTER_BRANCH">Inter-Branch</option>
                </select>
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
                  <option value="IN_TRANSIT">IN TRANSIT</option>
                  <option value="RECEIVED">RECEIVED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">
                  From{" "}
                  {formData.transferType === "INTER_WAREHOUSE"
                    ? "Warehouse"
                    : "Branch"}{" "}
                  *
                </label>
                <select
                  className="input"
                  value={formData.fromBranchId}
                  onChange={(e) =>
                    setFormData({ ...formData, fromBranchId: e.target.value })
                  }
                  required
                >
                  <option value="">
                    Select{" "}
                    {formData.transferType === "INTER_WAREHOUSE"
                      ? "Warehouse"
                      : "Branch"}
                  </option>
                  {(formData.transferType === "INTER_WAREHOUSE"
                    ? warehouses
                    : branches
                  ).map((item) => (
                    <option key={item.id} value={item.id}>
                      {formData.transferType === "INTER_WAREHOUSE"
                        ? item.warehouse_name
                        : item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">
                  To{" "}
                  {formData.transferType === "INTER_WAREHOUSE"
                    ? "Warehouse"
                    : "Branch"}{" "}
                  *
                </label>
                <select
                  className="input"
                  value={formData.toBranchId}
                  onChange={(e) =>
                    setFormData({ ...formData, toBranchId: e.target.value })
                  }
                  required
                >
                  <option value="">
                    Select{" "}
                    {formData.transferType === "INTER_WAREHOUSE"
                      ? "Warehouse"
                      : "Branch"}
                  </option>
                  {(formData.transferType === "INTER_WAREHOUSE"
                    ? warehouses
                    : branches
                  ).map((item) => (
                    <option key={item.id} value={item.id}>
                      {formData.transferType === "INTER_WAREHOUSE"
                        ? item.warehouse_name
                        : item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Delivery Date</label>
                <input
                  type="date"
                  className="input"
                  value={formData.deliveryDate}
                  onChange={(e) =>
                    setFormData({ ...formData, deliveryDate: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Driver Name</label>
                <input
                  type="text"
                  className="input"
                  value={formData.driverName}
                  onChange={(e) =>
                    setFormData({ ...formData, driverName: e.target.value })
                  }
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="label">Vehicle Number</label>
                <input
                  type="text"
                  className="input"
                  value={formData.vehicleNo}
                  onChange={(e) =>
                    setFormData({ ...formData, vehicleNo: e.target.value })
                  }
                  placeholder="Optional"
                />
              </div>
            </div>

            {formData.transferType === "INTER_BRANCH" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">
                    From Warehouse (in selected From Branch)
                  </label>
                  <select
                    className="input"
                    value={formData.fromWarehouseId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        fromWarehouseId: e.target.value,
                      })
                    }
                    disabled={!formData.fromBranchId}
                    required
                  >
                    <option value="">
                      {formData.fromBranchId
                        ? "Select Warehouse"
                        : "Select From Branch first"}
                    </option>
                    {fromBranchWarehouses.map((w) => (
                      <option key={w.id} value={String(w.id)}>
                        {w.warehouse_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">
                    To Warehouse (in selected To Branch)
                  </label>
                  <select
                    className="input"
                    value={formData.toWarehouseId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        toWarehouseId: e.target.value,
                      })
                    }
                    disabled={!formData.toBranchId}
                    required
                  >
                    <option value="">
                      {formData.toBranchId
                        ? "Select Warehouse"
                        : "Select To Branch first"}
                    </option>
                    {toBranchWarehouses.map((w) => (
                      <option key={w.id} value={String(w.id)}>
                        {w.warehouse_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}

            {/* Visualization of Flow */}
            <div className="flex items-center justify-center py-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="text-center">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                  Origin
                </div>
                <div className="font-bold text-lg text-slate-800 dark:text-slate-200">
                  {getSourceDestName(formData.fromBranchId) || "Select Source"}
                </div>
                {formData.transferType === "INTER_BRANCH" &&
                formData.fromWarehouseId ? (
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    {
                      (
                        fromBranchWarehouses.find(
                          (w) =>
                            String(w.id) === String(formData.fromWarehouseId)
                        ) || { warehouse_name: "" }
                      ).warehouse_name
                    }
                  </div>
                ) : null}
              </div>
              <div className="mx-8 flex flex-col items-center text-brand-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
                <span className="text-xs font-medium mt-1">
                  {formData.transferType.replace("_", " ")}
                </span>
              </div>
              <div className="text-center">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                  Destination
                </div>
                <div className="font-bold text-lg text-slate-800 dark:text-slate-200">
                  {getSourceDestName(formData.toBranchId) ||
                    "Select Destination"}
                </div>
                {formData.transferType === "INTER_BRANCH" &&
                formData.toWarehouseId ? (
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    {
                      (
                        toBranchWarehouses.find(
                          (w) => String(w.id) === String(formData.toWarehouseId)
                        ) || { warehouse_name: "" }
                      ).warehouse_name
                    }
                  </div>
                ) : null}
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
                  Items to Transfer
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
                      <th className="w-1/4 min-w-[200px]">Item Code</th>
                      <th className="w-1/4 min-w-[200px]">Item Name</th>
                      <th className="w-32 min-w-[120px]">Qty</th>
                      <th className="w-32 min-w-[120px]">UOM</th>
                      <th className="w-48 min-w-[180px]">Batch No</th>
                      <th className="w-64 min-w-[250px]">Remarks</th>
                      <th className="w-16"></th>
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
                            {availableItems.map((ai) => (
                              <option key={ai.id} value={ai.id}>
                                {(ai.item_code || ai.id) +
                                  " - " +
                                  (ai.item_name || "")}
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
                            value={item.qty}
                            onChange={(e) => {
                              const updated = items.map((i) =>
                                i.id === item.id
                                  ? {
                                      ...i,
                                      qty: parseFloat(e.target.value) || 0,
                                    }
                                  : i
                              );
                              setItems(updated);
                            }}
                            min="0"
                            step="1"
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
                            {uomsLoading ? (
                              <option>Loading...</option>
                            ) : (
                              uoms.map((u) => (
                                <option key={u.id} value={u.uom_code}>
                                  {u.uom_code}
                                </option>
                              ))
                            )}
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="input"
                            value={item.batchNumber}
                            onChange={(e) => {
                              const updated = items.map((i) =>
                                i.id === item.id
                                  ? { ...i, batchNumber: e.target.value }
                                  : i
                              );
                              setItems(updated);
                            }}
                            placeholder="Optional"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="input"
                            value={item.remarks}
                            onChange={(e) => {
                              const updated = items.map((i) =>
                                i.id === item.id
                                  ? { ...i, remarks: e.target.value }
                                  : i
                              );
                              setItems(updated);
                            }}
                            placeholder="Optional"
                          />
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
              <Link to="/inventory/stock-transfers" className="btn-success">
                Cancel
              </Link>
              <button type="submit" className="btn-success">
                {saving ? "Saving..." : "Save Transfer"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
