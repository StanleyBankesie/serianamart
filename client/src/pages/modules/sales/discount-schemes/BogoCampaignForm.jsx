import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../../api/client";
import { toast } from "react-toastify";
import "./DiscountSchemeList.css";

export default function BogoCampaignForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState({
    campaign_name: "",
    campaign_qty: "",
    effective_from: "",
    effective_to: "",
    status: "ACTIVE",
    rows: [{ item_id: "", item_qty: "", free_item_id: "", free_qty: "" }],
  });

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);
      const itemsRes = await api.get("/inventory/items");
      setItems(itemsRes.data.items || []);

      if (isEdit) {
        const res = await api.get(`/sales/bogo-campaigns/${id}`);
        const data = res.data;
        setFormData({
          campaign_name: data.campaign_name,
          campaign_qty: data.campaign_qty || "",
          effective_from: data.effective_from ? data.effective_from.split("T")[0] : "",
          effective_to: data.effective_to ? data.effective_to.split("T")[0] : "",
          status: data.is_active ? "ACTIVE" : "INACTIVE",
          rows: data.rows?.length
            ? data.rows
            : [{ item_id: "", item_qty: "", free_item_id: "", free_qty: "" }],
        });
      }
    } catch (err) {
      toast.error("Failed to load data");
      if (isEdit) navigate("/sales/discount-schemes/bogo");
    } finally {
      setLoading(false);
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const handleRowChange = (index, field, value) => {
    setFormData((p) => {
      const rows = [...p.rows];
      rows[index] = { ...rows[index], [field]: value };
      return { ...p, rows };
    });
  };

  const addRow = () => {
    setFormData((p) => ({
      ...p,
      rows: [...p.rows, { item_id: "", item_qty: "", free_item_id: "", free_qty: "" }],
    }));
  };

  const removeRow = (index) => {
    setFormData((p) => ({
      ...p,
      rows: p.rows.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        ...formData,
        is_active: formData.status === "ACTIVE" ? 1 : 0,
      };

      if (isEdit) {
        await api.put(`/sales/bogo-campaigns/${id}`, payload);
        toast.success("BOGO campaign updated");
      } else {
        await api.post("/sales/bogo-campaigns", payload);
        toast.success("BOGO campaign created");
      }
      navigate("/sales/discount-schemes/bogo");
    } catch (err) {
      toast.error(err.response?.data?.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="promo-campaign-container">
      <header className="ds-header">
        <div className="ds-header-top">
          <div>
            <h1>{isEdit ? "Edit BOGO Campaign" : "New BOGO Campaign"}</h1>
            <p>Buy one get one free promotional campaign</p>
          </div>
          <div className="ds-header-actions">
            <Link to="/sales/discount-schemes/bogo" className="ds-btn ds-btn-secondary">
              Back to Campaigns
            </Link>
          </div>
        </div>
      </header>

      <div className="ds-card">
        <form onSubmit={handleSubmit}>
          <div className="ds-form-row">
            <div className="ds-form-group">
              <label>Campaign Name *</label>
              <input
                name="campaign_name"
                value={formData.campaign_name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="ds-form-group">
              <label>Campaign Qty *</label>
              <input
                type="number"
                name="campaign_qty"
                value={formData.campaign_qty}
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <label style={{ margin: 0 }}>Campaign Items</label>
              <button type="button" className="ds-btn ds-btn-primary" onClick={addRow}>
                + Add Row
              </button>
            </div>
            {formData.rows.map((row, index) => (
              <div key={index} className="ds-bogo-row">
                <div className="ds-bogo-row-inner">
                  <div className="ds-form-group" style={{ marginBottom: 0 }}>
                    <label>Purchase Item</label>
                    <select
                      value={row.item_id}
                      onChange={(e) => handleRowChange(index, "item_id", e.target.value)}
                      required
                    >
                      <option value="">Select Item</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.item_code} - {item.item_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="ds-form-group" style={{ marginBottom: 0 }}>
                    <label>Purchase Qty</label>
                    <input
                      type="number"
                      value={row.item_qty}
                      onChange={(e) => handleRowChange(index, "item_qty", e.target.value)}
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>
                  <div className="ds-form-group" style={{ marginBottom: 0 }}>
                    <label>Free Item</label>
                    <select
                      value={row.free_item_id}
                      onChange={(e) => handleRowChange(index, "free_item_id", e.target.value)}
                      required
                    >
                      <option value="">Select Free Item</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.item_code} - {item.item_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="ds-form-group" style={{ marginBottom: 0 }}>
                    <label>Free Qty</label>
                    <input
                      type="number"
                      value={row.free_qty}
                      onChange={(e) => handleRowChange(index, "free_qty", e.target.value)}
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>
                  <button
                    type="button"
                    className="ds-btn ds-btn-danger"
                    style={{ alignSelf: "flex-end", padding: "8px 12px" }}
                    onClick={() => removeRow(index)}
                    disabled={formData.rows.length === 1}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="ds-action-buttons">
            <button type="submit" className="ds-btn ds-btn-success" disabled={saving}>
              {saving ? "Saving..." : "💾 Save BOGO Campaign"}
            </button>
            <Link to="/sales/discount-schemes/bogo" className="ds-btn ds-btn-secondary">
              ✖ Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
