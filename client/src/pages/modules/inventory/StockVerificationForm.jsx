import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";
import { Save, X, Plus, Trash2, ArrowLeft } from "lucide-react";

export default function StockVerificationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [availableItems, setAvailableItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  const [formData, setFormData] = useState({
    verification_number: "",
    verification_date: new Date().toISOString().split("T")[0],
    warehouse_id: "",
    verification_type: "PHYSICAL_COUNT",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    status: "DRAFT",
    remarks: "",
  });

  const [items, setItems] = useState([]);

  const verificationTypes = [
    { value: "PHYSICAL_COUNT", label: "Physical Count" },
    { value: "CYCLE_COUNT", label: "Cycle Count" },
    { value: "SPOT_CHECK", label: "Spot Check" },
  ];

  const statusOptions = [
    { value: "DRAFT", label: "Draft" },
    { value: "IN_PROGRESS", label: "In Progress" },
    { value: "COMPLETED", label: "Completed" },
    { value: "ADJUSTED", label: "Adjusted" },
  ];

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
            Array.isArray(itemsRes.data?.items) ? itemsRes.data.items : []
          );
          setWarehouses(
            Array.isArray(warehousesRes.data?.items)
              ? warehousesRes.data.items
              : []
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
      .get(`/inventory/stock-adjustments/${id}`)
      .then((res) => {
        if (!mounted) return;
        const a = res.data?.item;
        const details = Array.isArray(res.data?.details)
          ? res.data.details
          : [];

        if (a) {
          setFormData({
            verification_number: a.adjustment_no,
            verification_date: a.adjustment_date
              ? a.adjustment_date.split("T")[0]
              : "",
            warehouse_id: a.warehouse_id || "",
            verification_type: a.adjustment_type || "PHYSICAL_COUNT",
            start_date: new Date().toISOString().split("T")[0], // Not persisted in DB currently
            end_date: "",
            status: a.status || "DRAFT",
            remarks: a.reason || "",
          });

          setItems(
            details.map((d) => ({
              id: d.id || Date.now() + Math.random(),
              item_id: d.item_id,
              qty: Number(d.qty) || 0,
              uom: "", // Should fetch from item details ideally
            }))
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
        qty: 0,
        uom: "PCS",
      },
    ]);
  };

  const removeItem = (rowId) => {
    setItems(items.filter((item) => item.id !== rowId));
  };

  const updateItem = (rowId, field, value) => {
    setItems(
      items.map((item) => {
        if (item.id === rowId) {
          const updated = { ...item, [field]: value };
          if (field === "item_id") {
            const selectedItem = availableItems.find(
              (i) => String(i.id) === String(value)
            );
            if (selectedItem) {
              updated.uom = selectedItem.uom || "";
            }
          }
          return updated;
        }
        return item;
      })
    );
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
      // Map form data to backend payload
      // Backend expects: adjustment_no, adjustment_date, warehouse_id, adjustment_type, reason, status, details
      const payload = {
        adjustment_no: isNew ? undefined : formData.verification_number,
        adjustment_date: formData.verification_date,
        warehouse_id: Number(formData.warehouse_id),
        adjustment_type: formData.verification_type,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        status: formData.status,
        reason: formData.remarks, // We map remarks to reason
        details: items
          .filter((i) => i.item_id)
          .map((i) => ({
            item_id: Number(i.item_id),
            qty: Number(i.qty),
            // current_stock and adjusted_stock logic would go here if we were doing full adjustment calculation
          })),
      };

      if (isNew) {
        await api.post("/inventory/stock-adjustments", payload);
      } else {
        await api.put(`/inventory/stock-adjustments/${id}`, payload);
      }

      navigate("/inventory/stock-verification");
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to save verification");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link
              to="/inventory/stock-verification"
              className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
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
            <Link
              to="/inventory/stock-verification"
              className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              style={{ backgroundColor: "#0E3646" }}
            >
              <Save className="w-5 h-5" />
              {saving ? "Saving..." : "Save Verification"}
            </button>
          </div>
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
                    Start Date
                  </label>
                  <input
                    type="date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Item
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                        Variance Qty
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                        UOM
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
                          colSpan="4"
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
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="">Select Item</option>
                              {availableItems.map((ai) => (
                                <option key={ai.id} value={ai.id}>
                                  {ai.item_code} - {ai.item_name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              value={item.qty}
                              onChange={(e) =>
                                updateItem(
                                  item.id,
                                  "qty",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              step="1"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={item.uom}
                              readOnly
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
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
      </div>
    </div>
  );
}
