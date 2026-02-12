import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import { useUoms } from "@/hooks/useUoms";

export default function UnitConversionForm() {
  const [activeTab, setActiveTab] = useState("conversions");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { uoms, loading: uomsLoading } = useUoms();

  const [items, setItems] = useState([]);
  const [conversions, setConversions] = useState([]);

  const [searchItem, setSearchItem] = useState("");
  const [filterFromUom, setFilterFromUom] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [formData, setFormData] = useState({
    item_id: "",
    from_uom: "",
    to_uom: "",
    conversion_factor: "1",
    is_active: true,
  });

  const [calcItemId, setCalcItemId] = useState("");
  const [calcValue, setCalcValue] = useState("");
  const [calcFromUom, setCalcFromUom] = useState("");
  const [calcToUom, setCalcToUom] = useState("");
  const [calcResult, setCalcResult] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    Promise.all([
      api.get("/inventory/items"),
      api.get("/inventory/unit-conversions"),
    ])
      .then(([itemsRes, convRes]) => {
        if (!mounted) return;
        setItems(
          Array.isArray(itemsRes.data?.items) ? itemsRes.data.items : []
        );
        setConversions(
          Array.isArray(convRes.data?.items) ? convRes.data.items : []
        );
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load data");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const itemById = useMemo(() => {
    const m = new Map();
    for (const it of items) m.set(String(it.id), it);
    return m;
  }, [items]);

  const refreshData = async () => {
    setLoading(true);
    setError("");
    try {
      const [itemsRes, convRes] = await Promise.all([
        api.get("/inventory/items"),
        api.get("/inventory/unit-conversions"),
      ]);
      setItems(Array.isArray(itemsRes.data?.items) ? itemsRes.data.items : []);
      setConversions(
        Array.isArray(convRes.data?.items) ? convRes.data.items : []
      );
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to refresh data");
    } finally {
      setLoading(false);
    }
  };

  const filteredConversions = useMemo(() => {
    const q = searchItem.toLowerCase();
    return conversions
      .filter((c) => {
        const matchSearch =
          String(c.item_code || "")
            .toLowerCase()
            .includes(q) ||
          String(c.item_name || "")
            .toLowerCase()
            .includes(q);
        const matchFrom = filterFromUom
          ? String(c.from_uom || "") === filterFromUom
          : true;
        const matchStatus =
          filterStatus === ""
            ? true
            : filterStatus === "Y"
            ? Boolean(c.is_active)
            : !Boolean(c.is_active);
        return matchSearch && matchFrom && matchStatus;
      })
      .sort((a, b) =>
        String(a.item_name || "").localeCompare(String(b.item_name || ""))
      );
  }, [conversions, searchItem, filterFromUom, filterStatus]);

  const openConversionModal = (mode, existing = null) => {
    setModalMode(mode);
    if (mode === "create") {
      setFormData({
        item_id: "",
        from_uom: "",
        to_uom: "",
        conversion_factor: "1",
        is_active: true,
      });
    } else if (existing) {
      setFormData({
        item_id: existing.item_id ? String(existing.item_id) : "",
        from_uom: existing.from_uom || "",
        to_uom: existing.to_uom || "",
        conversion_factor:
          existing.conversion_factor != null
            ? String(existing.conversion_factor)
            : "1",
        is_active: Boolean(existing.is_active),
        id: existing.id,
      });
    }
    setShowModal(true);
  };

  const saveConversion = async () => {
    const payload = {
      item_id: formData.item_id ? Number(formData.item_id) : null,
      from_uom: String(formData.from_uom || "").trim(),
      to_uom: String(formData.to_uom || "").trim(),
      conversion_factor: Number(formData.conversion_factor),
      is_active: formData.is_active ? 1 : 0,
    };
    if (!payload.item_id) return alert("Item is required");
    if (!payload.from_uom) return alert("From UOM is required");
    if (!payload.to_uom) return alert("To UOM is required");
    if (
      !Number.isFinite(payload.conversion_factor) ||
      payload.conversion_factor <= 0
    )
      return alert("Conversion factor must be a positive number");
    try {
      if (modalMode === "create") {
        await api.post("/inventory/unit-conversions", payload);
      } else {
        await api.put(`/inventory/unit-conversions/${formData.id}`, payload);
      }
      setShowModal(false);
      await refreshData();
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to save unit conversion");
    }
  };

  const deleteConversion = async (id) => {
    alert("Delete is not currently supported for Unit Conversions.");
  };

  const itemConversions = useMemo(() => {
    const id = calcItemId ? Number(calcItemId) : null;
    return id ? conversions.filter((c) => Number(c.item_id) === id) : [];
  }, [conversions, calcItemId]);

  const calcFromOptions = useMemo(() => {
    const s = new Set();
    for (const c of itemConversions) s.add(c.from_uom);
    return Array.from(s);
  }, [itemConversions]);

  const calcToOptions = useMemo(() => {
    const s = new Set();
    for (const c of itemConversions) s.add(c.to_uom);
    return Array.from(s);
  }, [itemConversions]);

  useEffect(() => {
    if (!calcItemId || !calcFromUom || !calcToUom || !calcValue) {
      setCalcResult(null);
      return;
    }
    const c = itemConversions.find(
      (x) =>
        String(x.from_uom) === String(calcFromUom) &&
        String(x.to_uom) === String(calcToUom)
    );
    if (!c) {
      setCalcResult(null);
      return;
    }
    const v = Number(calcValue);
    if (!Number.isFinite(v)) {
      setCalcResult(null);
      return;
    }
    setCalcResult(v * Number(c.conversion_factor || 0));
  }, [calcItemId, calcFromUom, calcToUom, calcValue, itemConversions]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">
                Unit Conversion Management
              </h1>
              <p className="text-gray-600">
                Define and calculate item unit conversions
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/inventory" className="btn btn-secondary">
                Back to Menu
              </Link>
              <button className="btn-success" onClick={refreshData}>
                Refresh
              </button>
              <button
                className="btn-success"
                onClick={() => openConversionModal("create")}
              >
                + New Conversion
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="text-sm text-red-600 mb-4">{error}</div>
        ) : null}

        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab("conversions")}
                className={`py-4 px-6 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === "conversions"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Unit Conversions
              </button>
              <button
                onClick={() => setActiveTab("uom")}
                className={`py-4 px-6 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === "uom"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Units of Measure
              </button>
              <button
                onClick={() => setActiveTab("calculator")}
                className={`py-4 px-6 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === "calculator"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Quick Calculator
              </button>
            </nav>
          </div>

          <div className="p-4">
            {activeTab === "conversions" && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <input
                    className="input"
                    placeholder="Search by item name or code"
                    value={searchItem}
                    onChange={(e) => setSearchItem(e.target.value)}
                  />
                  <select
                    className="input"
                    value={filterFromUom}
                    onChange={(e) => setFilterFromUom(e.target.value)}
                  >
                    <option value="">All Units</option>
                    {Array.from(
                      new Set(conversions.map((c) => c.from_uom))
                    ).map((u) =>
                      u ? (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ) : null
                    )}
                  </select>
                  <select
                    className="input"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="">All Status</option>
                    <option value="Y">Active</option>
                    <option value="N">Inactive</option>
                  </select>
                  <div className="flex gap-2">
                    <button className="btn-success" onClick={() => {}}>
                      Search
                    </button>
                    <button
                      className="btn-outline"
                      onClick={() => {
                        setSearchItem("");
                        setFilterFromUom("");
                        setFilterStatus("");
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Item Code</th>
                        <th>Item Name</th>
                        <th>From UOM</th>
                        <th>To UOM</th>
                        <th>Conversion Factor</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td
                            colSpan="7"
                            className="text-center py-8 text-slate-500"
                          >
                            Loading...
                          </td>
                        </tr>
                      ) : null}
                      {!loading && !filteredConversions.length ? (
                        <tr>
                          <td
                            colSpan="7"
                            className="text-center py-8 text-slate-500"
                          >
                            No conversions found
                          </td>
                        </tr>
                      ) : null}
                      {filteredConversions.map((c) => (
                        <tr key={c.id}>
                          <td className="font-medium text-brand-700 dark:text-brand-300">
                            {c.item_code}
                          </td>
                          <td>{c.item_name}</td>
                          <td>{c.from_uom}</td>
                          <td>{c.to_uom}</td>
                          <td>{Number(c.conversion_factor || 0).toString()}</td>
                          <td>
                            <span
                              className={`badge ${
                                c.is_active ? "badge-success" : "badge-error"
                              }`}
                            >
                              {c.is_active ? "ACTIVE" : "INACTIVE"}
                            </span>
                          </td>
                          <td>
                            <div className="flex gap-2">
                              <button
                                className="btn-outline"
                                onClick={() => openConversionModal("edit", c)}
                              >
                                Edit
                              </button>
                              <button
                                className="btn-outline"
                                onClick={() => deleteConversion(c.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "uom" && (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>UOM Code</th>
                      <th>UOM Name</th>
                      <th>UOM Type</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uomsLoading ? (
                      <tr>
                        <td
                          colSpan="4"
                          className="text-center py-8 text-slate-500"
                        >
                          Loading...
                        </td>
                      </tr>
                    ) : null}
                    {!uomsLoading && !uoms.length ? (
                      <tr>
                        <td
                          colSpan="4"
                          className="text-center py-8 text-slate-500"
                        >
                          No UOMs found
                        </td>
                      </tr>
                    ) : null}
                    {uoms.map((u) => (
                      <tr key={u.id}>
                        <td className="font-medium text-brand-700 dark:text-brand-300">
                          {u.uom_code}
                        </td>
                        <td>{u.uom_name}</td>
                        <td>{u.uom_type}</td>
                        <td>{u.is_active ? "Active" : "Inactive"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "calculator" && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="label">Select Item</label>
                    <select
                      className="input"
                      value={calcItemId}
                      onChange={(e) => {
                        setCalcItemId(e.target.value);
                        setCalcFromUom("");
                        setCalcToUom("");
                        setCalcResult(null);
                      }}
                    >
                      <option value="">Choose an item...</option>
                      {items.map((i) => (
                        <option key={i.id} value={String(i.id)}>
                          {(i.item_code || "") + " - " + (i.item_name || "")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="bg-slate-50 border rounded p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-1">
                      <label className="label">Value to Convert</label>
                      <input
                        type="number"
                        step="0.000001"
                        className="input"
                        value={calcValue}
                        onChange={(e) => setCalcValue(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">From Unit</label>
                      <select
                        className="input"
                        value={calcFromUom}
                        onChange={(e) => setCalcFromUom(e.target.value)}
                      >
                        <option value="">Select unit</option>
                        {calcFromOptions.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">To Unit</label>
                      <select
                        className="input"
                        value={calcToUom}
                        onChange={(e) => setCalcToUom(e.target.value)}
                      >
                        <option value="">Select unit</option>
                        {calcToOptions.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <button className="btn-success w-full" onClick={() => {}}>
                        Calculate
                      </button>
                    </div>
                  </div>
                  <div className="mt-4">
                    {calcResult != null ? (
                      <div className="p-3 border-2 rounded text-center text-lg font-semibold">
                        {calcValue || 0} {calcFromUom || ""} = {calcResult}{" "}
                        {calcToUom || ""}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">
                        Select item and units to calculate
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {showModal ? (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow max-w-xl w-full">
              <div className="px-5 py-4 border-b flex justify-between items-center">
                <h2 className="text-lg font-semibold">
                  {modalMode === "create"
                    ? "New Conversion"
                    : "Edit Conversion"}
                </h2>
                <button
                  className="btn-outline"
                  onClick={() => setShowModal(false)}
                >
                  ×
                </button>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Item *</label>
                    <select
                      className="input"
                      value={formData.item_id}
                      onChange={(e) =>
                        setFormData({ ...formData, item_id: e.target.value })
                      }
                    >
                      <option value="">Select item...</option>
                      {items.map((i) => (
                        <option key={i.id} value={String(i.id)}>
                          {(i.item_code || "") + " - " + (i.item_name || "")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          is_active: e.target.checked,
                        })
                      }
                    />
                    <span className="text-sm">Active</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="label">From UOM *</label>
                    <select
                      className="input"
                      value={formData.from_uom}
                      onChange={(e) =>
                        setFormData({ ...formData, from_uom: e.target.value })
                      }
                    >
                      <option value="">Select unit</option>
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
                  </div>
                  <div>
                    <label className="label">To UOM *</label>
                    <select
                      className="input"
                      value={formData.to_uom}
                      onChange={(e) =>
                        setFormData({ ...formData, to_uom: e.target.value })
                      }
                    >
                      <option value="">Select unit</option>
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
                  </div>
                  <div>
                    <label className="label">Factor *</label>
                    <input
                      type="number"
                      step="0.000001"
                      className="input"
                      value={formData.conversion_factor}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          conversion_factor: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="px-5 py-4 border-t flex justify-end gap-2">
                <button
                  className="btn-outline"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button className="btn-success" onClick={saveConversion}>
                  Save
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
