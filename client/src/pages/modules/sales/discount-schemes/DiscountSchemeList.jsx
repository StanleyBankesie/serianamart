import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client";
import { toast } from "react-toastify";
import "./DiscountSchemeList.css";

const initialFormState = {
  scheme_code: "",
  scheme_name: "",
  discount_type: "",
  discount_value: "",
  effective_from: "",
  effective_to: "",
  min_quantity: "",
  min_purchase_amount: "",
  max_discount_amount: "",
  description: "",
  status: "ACTIVE", // "ACTIVE" or "INACTIVE" mapped to is_active boolean or string? Schema has is_active boolean.
  itemIds: [],
};

// Schema uses is_active (TINYINT/boolean). UI uses status string. I'll map them.

export default function DiscountSchemeList() {
  const [schemes, setSchemes] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(initialFormState);

  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [itemSearch, setItemSearch] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [schemesRes, itemsRes] = await Promise.all([
        api.get("/sales/discount-schemes"),
        api.get("/inventory/items"),
      ]);
      setSchemes(
        Array.isArray(schemesRes.data?.items) ? schemesRes.data.items : []
      );
      setItems(itemsRes.data.items || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  const filteredSchemes = useMemo(() => {
    return schemes.filter((s) => {
      const matchesStatus = filterStatus
        ? filterStatus === "ACTIVE"
          ? s.is_active
          : !s.is_active
        : true;
      const matchesType = filterType ? s.discount_type === filterType : true;
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        s.scheme_code.toLowerCase().includes(searchLower) ||
        s.scheme_name.toLowerCase().includes(searchLower) ||
        (s.description && s.description.toLowerCase().includes(searchLower));
      return matchesStatus && matchesType && matchesSearch;
    });
  }, [schemes, filterStatus, filterType, searchTerm]);

  const stats = useMemo(() => {
    const total = schemes.length;
    const active = schemes.filter((s) => s.is_active).length;
    const pctSchemes = schemes.filter((s) => s.discount_type === "PERCENTAGE");
    const avgDiscount =
      pctSchemes.length > 0
        ? (
            pctSchemes.reduce((sum, s) => sum + Number(s.discount_value), 0) /
            pctSchemes.length
          ).toFixed(1)
        : 0;

    const now = new Date();
    const thisMonth = schemes.filter((s) => {
      const from = new Date(s.effective_from);
      return (
        from.getMonth() === now.getMonth() &&
        from.getFullYear() === now.getFullYear()
      );
    }).length;

    return { total, active, avgDiscount, thisMonth };
  }, [schemes]);

  const openModal = async (id = null) => {
    if (id) {
      setEditingId(id);
      try {
        const res = await api.get(`/sales/discount-schemes/${id}`);
        const data = res.data;
        setFormData({
          scheme_code: data.scheme_code,
          scheme_name: data.scheme_name,
          discount_type: data.discount_type,
          discount_value: data.discount_value,
          effective_from: data.effective_from
            ? data.effective_from.split("T")[0]
            : "",
          effective_to: data.effective_to
            ? data.effective_to.split("T")[0]
            : "",
          min_quantity: data.min_quantity || "",
          min_purchase_amount: data.min_purchase_amount || "",
          max_discount_amount: data.max_discount_amount || "",
          description: data.description || "",
          status: data.is_active ? "ACTIVE" : "INACTIVE",
          itemIds: data.items ? data.items.map((i) => i.id) : [],
        });
      } catch (err) {
        toast.error("Failed to load details");
        return;
      }
    } else {
      setEditingId(null);
      setFormData(initialFormState);
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setFormData(initialFormState);
    setEditingId(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const toggleItem = (itemId) => {
    setFormData((p) => {
      const current = p.itemIds || [];
      if (current.includes(itemId)) {
        return { ...p, itemIds: current.filter((id) => id !== itemId) };
      } else {
        return { ...p, itemIds: [...current, itemId] };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        is_active: formData.status === "ACTIVE" ? 1 : 0,
      };

      if (editingId) {
        await api.put(`/sales/discount-schemes/${editingId}`, payload);
        toast.success("Discount scheme updated");
      } else {
        await api.post("/sales/discount-schemes", payload);
        toast.success("Discount scheme created");
      }
      closeModal();
      fetchData(); // Refresh list
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Operation failed");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this scheme?")) return;
    try {
      await api.delete(`/sales/discount-schemes/${id}`);
      toast.success("Deleted successfully");
      fetchData();
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  const filteredItems = useMemo(() => {
    if (!itemSearch) return items;
    const lower = itemSearch.toLowerCase();
    return items.filter(
      (i) =>
        i.item_code.toLowerCase().includes(lower) ||
        i.item_name.toLowerCase().includes(lower)
    );
  }, [items, itemSearch]);

  if (loading && !schemes.length)
    return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="discount-scheme-container">
      <header className="ds-header">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h1>💰 Discount Scheme Management</h1>
            <p>Manage and configure discount schemes for sales operations</p>
          </div>
          <Link to="/sales" className="ds-btn ds-btn-secondary">
            Return to Menu
          </Link>
        </div>
      </header>

      <div className="ds-stats-grid">
        <div className="ds-stat-card">
          <h3>Total Schemes</h3>
          <div className="value">{stats.total}</div>
        </div>
        <div className="ds-stat-card">
          <h3>Active Schemes</h3>
          <div className="value">{stats.active}</div>
        </div>
        <div className="ds-stat-card">
          <h3>Avg Discount %</h3>
          <div className="value">{stats.avgDiscount}%</div>
        </div>
        <div className="ds-stat-card">
          <h3>This Month</h3>
          <div className="value">{stats.thisMonth}</div>
        </div>
      </div>

      <div className="ds-card">
        <div className="ds-action-bar">
          <div className="ds-search-box">
            <input
              type="text"
              placeholder="Search by code, name, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="ds-btn ds-btn-primary" onClick={() => openModal()}>
            ➕ New Discount Scheme
          </button>
        </div>

        <div className="ds-filter-section">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED">Fixed Amount</option>
          </select>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="ds-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Scheme Name</th>
                <th>Type</th>
                <th>Value</th>
                <th>Valid From</th>
                <th>Valid To</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSchemes.length === 0 ? (
                <tr>
                  <td colSpan="8" className="ds-empty-state">
                    No discount schemes found
                  </td>
                </tr>
              ) : (
                filteredSchemes.map((scheme) => (
                  <tr key={scheme.id}>
                    <td>
                      <strong>{scheme.scheme_code}</strong>
                    </td>
                    <td>{scheme.scheme_name}</td>
                    <td>
                      <span
                        className={`ds-badge ds-badge-${
                          scheme.discount_type === "PERCENTAGE"
                            ? "percentage"
                            : "fixed"
                        }`}
                      >
                        {scheme.discount_type}
                      </span>
                    </td>
                    <td>
                      <strong>
                        {scheme.discount_type === "PERCENTAGE"
                          ? Number(scheme.discount_value) + "%"
                          : "$" + Number(scheme.discount_value).toFixed(2)}
                      </strong>
                    </td>
                    <td>
                      {new Date(scheme.effective_from).toLocaleDateString()}
                    </td>
                    <td>
                      {scheme.effective_to
                        ? new Date(scheme.effective_to).toLocaleDateString()
                        : "No expiry"}
                    </td>
                    <td>
                      <span
                        className={`ds-badge ds-badge-${
                          scheme.is_active ? "active" : "inactive"
                        }`}
                      >
                        {scheme.is_active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td>
                      <div className="ds-action-buttons">
                        <button
                          className="ds-icon-btn"
                          onClick={() => openModal(scheme.id)}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          className="ds-icon-btn"
                          onClick={() => handleDelete(scheme.id)}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="ds-modal-overlay">
          <div className="ds-modal-content">
            <div className="ds-modal-header">
              <h2>
                {editingId ? "Edit Discount Scheme" : "New Discount Scheme"}
              </h2>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="ds-form-row">
                <div className="ds-form-group">
                  <label>Scheme Code *</label>
                  <input
                    name="scheme_code"
                    value={formData.scheme_code}
                    onChange={handleChange}
                    required
                    disabled={!!editingId}
                  />
                </div>
                <div className="ds-form-group">
                  <label>Scheme Name *</label>
                  <input
                    name="scheme_name"
                    value={formData.scheme_name}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="ds-form-row">
                <div className="ds-form-group">
                  <label>Discount Type *</label>
                  <select
                    name="discount_type"
                    value={formData.discount_type}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select Type</option>
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="FIXED">Fixed Amount</option>
                  </select>
                </div>
                <div className="ds-form-group">
                  <label>Discount Value *</label>
                  <input
                    type="number"
                    name="discount_value"
                    value={formData.discount_value}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
              </div>

              <div className="ds-form-row">
                <div className="ds-form-group">
                  <label>Valid From *</label>
                  <input
                    type="date"
                    name="effective_from"
                    value={formData.effective_from}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="ds-form-group">
                  <label>Valid To</label>
                  <input
                    type="date"
                    name="effective_to"
                    value={formData.effective_to}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="ds-form-row">
                <div className="ds-form-group">
                  <label>Min Quantity</label>
                  <input
                    type="number"
                    name="min_quantity"
                    value={formData.min_quantity}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                  />
                </div>
                <div className="ds-form-group">
                  <label>Min Purchase Amount</label>
                  <input
                    type="number"
                    name="min_purchase_amount"
                    value={formData.min_purchase_amount}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>

              <div className="ds-form-row">
                <div className="ds-form-group">
                  <label>Max Discount Amount</label>
                  <input
                    type="number"
                    name="max_discount_amount"
                    value={formData.max_discount_amount}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>

              <div className="ds-form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                ></textarea>
              </div>

              <div className="ds-form-group">
                <label>Status *</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  required
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              <div className="ds-form-group">
                <label>Linked Items (Search to filter)</label>
                <input
                  type="text"
                  placeholder="Search items..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="mb-2"
                />
                <div className="ds-item-selection">
                  {filteredItems.slice(0, 100).map((item) => (
                    <div key={item.id} className="ds-item-checkbox">
                      <input
                        type="checkbox"
                        checked={formData.itemIds.includes(item.id)}
                        onChange={() => toggleItem(item.id)}
                      />
                      <span>
                        {item.item_code} - {item.item_name}
                      </span>
                    </div>
                  ))}
                  {filteredItems.length > 100 && (
                    <div className="p-2 text-gray-500 italic">
                      Showing first 100 matches...
                    </div>
                  )}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Selected: {formData.itemIds.length} items
                </div>
              </div>

              <div className="ds-action-buttons">
                <button type="submit" className="ds-btn ds-btn-success">
                  💾 Save Scheme
                </button>
                <button
                  type="button"
                  className="ds-btn ds-btn-secondary"
                  onClick={closeModal}
                >
                  ✖ Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
