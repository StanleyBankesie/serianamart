import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client";
import { toast } from "react-toastify";
import "./DiscountSchemeList.css";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";

export default function BogoCampaignList() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => { fetchCampaigns(); }, []);

  async function fetchCampaigns() {
    try {
      setLoading(true);
      const res = await api.get("/sales/bogo-campaigns");
      setCampaigns(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (err) {
      toast.error("Failed to load BOGO campaigns");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (!searchTerm) return campaigns;
    const q = searchTerm.toLowerCase();
    return campaigns.filter((c) =>
      c.campaign_name?.toLowerCase().includes(q)
    );
  }, [campaigns, searchTerm]);

  const { sorted, sortKey, sortDir, toggle } = useSort(filtered, "created_at", "desc");

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this BOGO campaign?")) return;
    try {
      await api.delete(`/sales/bogo-campaigns/${id}`);
      toast.success("BOGO campaign deleted");
      fetchCampaigns();
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  if (loading && !campaigns.length)
    return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="promo-campaign-container">
      <header className="ds-header">
        <div className="ds-header-top">
          <div>
            <h1>🎁 Purchase Reward Campaigns</h1>
            <p>Manage BOGO buy-one-get-one-free campaigns</p>
          </div>
          <div className="ds-header-actions">
            <Link to="/sales/discount-schemes" className="ds-btn ds-btn-secondary">
              Back to Campaign Types
            </Link>
            <button className="ds-btn ds-btn-primary" onClick={() => navigate("/sales/discount-schemes/bogo/new")}>
              ➕ New BOGO Campaign
            </button>
          </div>
        </div>
      </header>

      <div className="ds-card">
        <div className="ds-action-bar">
          <div className="ds-search-box">
            <input
              type="text"
              placeholder="Search BOGO campaigns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="ds-table">
            <thead>
              <tr>
                <SortableHeader label="Name" sortKey="campaign_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Total Qty" sortKey="campaign_qty" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Used Qty" sortKey="used_qty" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Remaining" sortKey="remaining_qty" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Valid From" sortKey="effective_from" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Valid To" sortKey="effective_to" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Status" sortKey="is_active" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <th>Actions</th>
                <SortableHeader label="Created By" sortKey="created_by_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Created Date" sortKey="created_at" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan="10" className="ds-empty-state">No BOGO campaigns found</td>
                </tr>
              ) : (
                sorted.map((c) => {
                  const remaining = Number(c.campaign_qty || 0) - Number(c.used_qty || 0);
                  const isExpired = c.effective_to && new Date(c.effective_to) < new Date();
                  const isExhausted = remaining <= 0;
                  const active = c.is_active && !isExpired && !isExhausted;
                  return (
                    <tr key={c.id}
                      onClick={() => navigate(`/sales/discount-schemes/bogo/${c.id}`)}
                      style={{ cursor: "pointer" }}
                    >
                      <td><strong>{c.campaign_name}</strong></td>
                      <td>{Number(c.campaign_qty).toFixed(0)}</td>
                      <td>{Number(c.used_qty || 0).toFixed(0)}</td>
                      <td>
                        <span className={`ds-badge ds-badge-${remaining > 0 ? "active" : "inactive"}`}>
                          {remaining > 0 ? remaining.toFixed(0) : "Exhausted"}
                        </span>
                      </td>
                      <td>{new Date(c.effective_from).toLocaleDateString()}</td>
                      <td>{c.effective_to ? new Date(c.effective_to).toLocaleDateString() : "No expiry"}</td>
                      <td>
                        <span className={`ds-badge ds-badge-${active ? "active" : "inactive"}`}>
                          {active ? "ACTIVE" : isExpired ? "EXPIRED" : isExhausted ? "EXHAUSTED" : "INACTIVE"}
                        </span>
                      </td>
                      <td>
                        <button className="ds-icon-btn" onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }} title="Delete">Delete</button>
                      </td>
                      <td>{c.created_by_name || "-"}</td>
                      <td>{c.created_at ? new Date(c.created_at).toLocaleDateString() : "-"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
