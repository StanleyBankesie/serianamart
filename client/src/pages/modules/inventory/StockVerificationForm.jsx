import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";
import { Save, Plus, Trash2, ArrowLeft, Check } from "lucide-react";

export default function StockVerificationForm({
  isModal = false,
  modalId = null,
  onClose = null,
}) {
  const { id: routeId } = useParams();
  const id = isModal ? modalId : routeId;
  const navigate = useNavigate();
  const isNew = id === "new" || !id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isWfActive, setIsWfActive] = useState(false);
  const [checkingWf, setCheckingWf] = useState(false);
  const [availableItems, setAvailableItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  const [formData, setFormData] = useState({
    verification_number: "",
    verification_date: new Date().toISOString().split("T")[0],
    warehouse_id: "",
    verification_type: "PHYSICAL_COUNT",
    status: "DRAFT",
    remarks: "",
  });

  const [items, setItems] = useState([]);

  const verificationTypes = [
    { value: "PHYSICAL_COUNT", label: "Physical Count" },
    { value: "CYCLE_COUNT", label: "Cycle Count" },
    { value: "SPOT_CHECK", label: "Spot Check" },
    { value: "PERIODIC", label: "Periodic" },
  ];

  const statusOptions = [
    { value: "DRAFT", label: "Draft" },
    { value: "PENDING_APPROVAL", label: "Pending Approval" },
    { value: "APPROVED", label: "Approved" },
    { value: "REJECTED", label: "Rejected" },
  ];

  const checkWorkflowStatus = async () => {
    setCheckingWf(true);
    try {
      const res = await api.get("/workflows");
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      const active = items.some(
        (w) =>
          Number(w.is_active) === 1 &&
          (String(w.document_route) === "/inventory/stock-verification" ||
            String(w.document_type).toUpperCase() === "STOCK_VERIFICATION" ||
            String(w.document_type).toUpperCase() === "STOCK VERIFICATION"),
      );
      setIsWfActive(active);
    } catch (e) {
      console.error("Workflow status check failed", e);
    } finally {
      setCheckingWf(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const [itemsRes, warehousesRes] = await Promise.all([
          api.get("/inventory/items"),
          api.get("/inventory/warehouses"),
        ]);

        if (mounted) {
          setAvailableItems(
            Array.isArray(itemsRes.data?.items) ? itemsRes.data.items : [],
          );
          setWarehouses(
            Array.isArray(warehousesRes.data?.items)
              ? warehousesRes.data.items
              : [],
          );
        }
      } catch (e) {
        if (mounted) {
          setError("Failed to load initial data");
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

    api
      .get(`/inventory/stock-verification/${id}`)
      .then((res) => {
        if (!mounted) return;
        const a = res.data?.item;
        const details = Array.isArray(res.data?.details)
          ? res.data.details
          : [];

        if (a) {
          setFormData({
            verification_number: a.verification_no || "",
            verification_date: a.verification_date
              ? a.verification_date.split("T")[0]
              : "",
            warehouse_id: a.warehouse_id || "",
            verification_type: a.verification_type || "PHYSICAL_COUNT",
            status: a.status || "DRAFT",
            remarks: a.remarks || a.reason || "",
          });

          setItems(
            details.map((d) => ({
              id: d.id || Date.now() + Math.random(),
              item_id: d.item_id ? String(d.item_id) : "",
              system_qty: Number(d.system_qty || 0),
              reserve_qty: Number(d.reserve_qty || 0),
              counted_qty: Number(d.counted_qty),
              uom: d.uom || "",
              remarks: d.remarks || "",
            })),
          );
        }
      })
      .catch((e) => {
        if (mounted)
          setError(e?.response?.data?.message || "Failed to load verification");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id, isNew]);

  useEffect(() => {
    if (!isNew) return;
    let mounted = true;
    api
      .get("/inventory/stock-verification/next-no")
      .then((res) => {
        if (!mounted) return;
        const no = res.data?.verification_no || "";
        setFormData((prev) => ({
          ...prev,
          verification_number: prev.verification_number || no,
        }));
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [isNew]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        id: Date.now(),
        item_id: "",
        system_qty: 0,
        reserve_qty: 0,
        verified_qty: 0,
        uom: "PCS",
        remarks: "",
      },
    ]);
  };

  const removeItem = (rowId) => {
    setItems(items.filter((item) => item.id !== rowId));
  };

  const fetchSystemStock = async (itemId, warehouseId) => {
    const iid = itemId ? Number(itemId) : 0;
    const wid = warehouseId ? Number(warehouseId) : 0;
    if (!iid || !wid) return { qty: 0, reserved: 0 };
    try {
      const res = await api.get("/inventory/stock/balance", {
        params: { item_id: iid, warehouse_id: wid },
      });
      return {
        qty: Number(res.data?.available || 0),
        reserved: Number(res.data?.reserved || 0),
      };
    } catch {
      return { qty: 0, reserved: 0 };
    }
  };

  const updateItem = (rowId, field, value) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== rowId) return item;
        const updated = { ...item, [field]: value };
        if (field === "item_id") {
          const selectedItem = availableItems.find(
            (i) => String(i.id) === String(value),
          );
          if (selectedItem) {
            updated.uom = selectedItem.uom || "";
          }
          updated.system_qty = 0;
          updated.verified_qty = 0;
        }
        return updated;
      }),
    );

    if (field === "item_id" && value && formData.warehouse_id) {
      fetchSystemStock(value, formData.warehouse_id).then((stock) => {
        setItems((prev) =>
          prev.map((item) =>
            item.id === rowId
              ? { ...item, system_qty: stock.qty, reserve_qty: stock.reserved }
              : item,
          ),
        );
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.warehouse_id || !formData.verification_date) {
      alert("Please fill in all required fields");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        verification_no: formData.verification_number,
        verification_date: formData.verification_date,
        warehouse_id: Number(formData.warehouse_id),
        verification_type: formData.verification_type,
        status: formData.status,
        remarks: formData.remarks,
        details: items
          .filter((i) => i.item_id)
          .map((i) => ({
            item_id: Number(i.item_id),
            system_qty: Number(i.system_qty || 0),
            reserve_qty: Number(i.reserve_qty || 0),
            verified_qty: Number(i.verified_qty || 0),
            variance_qty:
              Number(i.verified_qty || 0) -
              (Number(i.system_qty || 0) + Number(i.reserve_qty || 0)),
            uom: i.uom || "PCS",
            remarks: i.remarks || null,
          })),
      };

      if (isNew) {
        await api.post("/inventory/stock-verification", payload);
      } else {
        await api.put(`/inventory/stock-verification/${id}`, payload);
      }

      if (isModal) {
        onClose && onClose(true);
      } else {
        navigate("/inventory/stock-verification");
      }
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to save verification");
    } finally {
      setSaving(false);
    }
  };

  const formContent = (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {!isModal && (
            <Link
              to="/inventory/stock-verification"
              className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isNew ? "New Stock Verification" : "Edit Stock Verification"}
            </h1>
            <p className="text-sm text-gray-600">
              {isNew
                ? "Create a new stock verification record"
                : `Editing ${formData.verification_number}`}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() =>
              isModal
                ? onClose && onClose()
                : navigate("/inventory/stock-verification")
            }
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          {!formData.status || formData.status === "DRAFT" ? (
            <>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: "#15803d" }}
              >
                <Save className="w-5 h-5" />
                {saving ? "Saving..." : "Save"}
              </button>
              {((!isWfActive && !checkingWf) || id !== "new") &&
                (!formData.status || formData.status === "DRAFT") && (
                  <button
                    onClick={async () => {
                      try {
                        setSaving(true);
                        let currentId = id;
                        if (isNew) {
                          const saveRes = await api.post(
                            "/inventory/stock-verification",
                            {
                              verification_no: formData.verification_number,
                              verification_date: formData.verification_date,
                              warehouse_id: Number(formData.warehouse_id),
                              verification_type: formData.verification_type,
                              remarks: formData.remarks,
                              details: items
                                .filter((i) => i.item_id)
                                .map((i) => ({
                                  item_id: Number(i.item_id),
                                  system_qty: Number(i.system_qty || 0),
                                  reserve_qty: Number(i.reserve_qty || 0),
                                  verified_qty: Number(i.verified_qty || 0),
                                  uom: i.uom || "PCS",
                                  remarks: i.remarks || null,
                                })),
                            },
                          );
                          currentId = saveRes.data?.id;
                        } else {
                          await api.put(`/inventory/stock-verification/${id}`, {
                            verification_date: formData.verification_date,
                            warehouse_id: Number(formData.warehouse_id),
                            verification_type: formData.verification_type,
                            remarks: formData.remarks,
                            details: items
                              .filter((i) => i.item_id)
                              .map((i) => ({
                                item_id: Number(i.item_id),
                                system_qty: Number(i.system_qty || 0),
                                reserve_qty: Number(i.reserve_qty || 0),
                                verified_qty: Number(i.verified_qty || 0),
                                uom: i.uom || "PCS",
                                remarks: i.remarks || null,
                              })),
                          });
                        }

                        if (!currentId)
                          throw new Error("Could not resolve document ID");

                        await api.post(
                          `/inventory/stock-verification/${currentId}/submit`,
                        );
                        alert("Verification confirmed and approved");
                        if (isModal) onClose && onClose(true);
                        else navigate("/inventory/stock-verification");
                      } catch (e) {
                        setError(
                          e?.response?.data?.message || "Confirmation failed",
                        );
                      } finally {
                        setSaving(false);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                    style={{ backgroundColor: "#4f46e5" }}
                  >
                    <Check className="w-5 h-5" />
                    {saving ? "Confirming..." : "Confirm Verification"}
                  </button>
                )}
            </>
          ) : null}
        </div>
        {isModal && (
          <button
            type="button"
            onClick={() => onClose && onClose()}
            className="text-slate-400 hover:text-slate-600 text-3xl pb-1"
          >
            ×
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : (
        <div className="space-y-6">
          {/* Main Info Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
              Verification Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Verification Number
                </label>
                <input
                  type="text"
                  name="verification_number"
                  value={formData.verification_number}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Verification Date *
                </label>
                <input
                  type="date"
                  name="verification_date"
                  value={formData.verification_date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Warehouse *
                </label>
                <select
                  name="warehouse_id"
                  value={formData.warehouse_id}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
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
                  Verification Type *
                </label>
                <select
                  name="verification_type"
                  value={formData.verification_type}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  {verificationTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status *
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  {statusOptions.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Remarks
              </label>
              <textarea
                name="remarks"
                value={formData.remarks}
                onChange={handleInputChange}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter any additional remarks..."
              />
            </div>
          </div>

          {/* Items Card */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">Items</h2>
              <button
                onClick={addItem}
                className="flex items-center gap-2 px-3 py-1.5 text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "#0E3646" }}
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Item
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-blue-600 uppercase tracking-wider w-24">
                      Available Qty
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-amber-600 uppercase tracking-wider w-24">
                      Reserve Qty
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                      Verified Qty
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-indigo-600 uppercase tracking-wider w-24">
                      Balance Qty
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                      Variance
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                      UOM
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Remarks
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan="9"
                        className="px-6 py-8 text-center text-gray-500"
                      >
                        No items added yet. Click "Add Item" to start.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-6 py-4">
                          <select
                            value={item.item_id}
                            onChange={(e) =>
                              updateItem(item.id, "item_id", e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[250px]"
                          >
                            <option value="">Select Item</option>
                            {availableItems.map((ai) => (
                              <option key={ai.id} value={ai.id}>
                                {ai.item_code} - {ai.item_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-4 text-center">
                          <span className="font-mono font-bold text-blue-600">
                            {Number(item.system_qty || 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-center">
                          <span className="font-mono font-bold text-amber-600">
                            {Number(item.reserve_qty || 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-center">
                          <input
                            type="number"
                            value={item.verified_qty}
                            onChange={(e) =>
                              updateItem(
                                item.id,
                                "verified_qty",
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center font-bold"
                            step="1"
                          />
                        </td>
                        <td className="px-3 py-4 text-center">
                          <span className="font-mono font-bold text-indigo-600">
                            {(
                              Number(item.system_qty || 0) +
                              Number(item.reserve_qty || 0)
                            ).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          <div
                            className={`w-full px-3 py-2 border rounded-lg font-bold text-center ${
                              Number(item.verified_qty || 0) -
                                (Number(item.system_qty || 0) +
                                  Number(item.reserve_qty || 0)) <
                              0
                                ? "bg-red-50 text-red-700 border-red-200"
                                : Number(item.verified_qty || 0) -
                                      (Number(item.system_qty || 0) +
                                        Number(item.reserve_qty || 0)) >
                                    0
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : "bg-gray-50 text-gray-500 border-gray-300"
                            }`}
                          >
                            {Number(item.verified_qty || 0) -
                              (Number(item.system_qty || 0) +
                                Number(item.reserve_qty || 0)) >
                            0
                              ? "+"
                              : ""}
                            {Number(item.verified_qty || 0) -
                              (Number(item.system_qty || 0) +
                                Number(item.reserve_qty || 0))}
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600 font-medium">
                              {item.uom || "PCS"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={item.remarks || ""}
                            onChange={(e) =>
                              updateItem(item.id, "remarks", e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Optional"
                          />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-full transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto relative animate-in fade-in zoom-in duration-200 p-6">
          {formContent}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">{formContent}</div>
    </div>
  );
}
