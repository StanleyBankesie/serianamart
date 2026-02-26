import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

import { api } from "api/client";

export default function AccountGroupsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [natureFilter, setNatureFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [showTotals, setShowTotals] = useState(true);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [nature, setNature] = useState("ASSET");
  const [parentId, setParentId] = useState("");
  const [editId, setEditId] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editNature, setEditNature] = useState("ASSET");
  const [editParentId, setEditParentId] = useState("");

  async function load() {
    try {
      setLoading(true);
      const res = await api.get("/finance/account-groups", {
        params: {
          search: searchTerm || null,
          nature: natureFilter || null,
          active: activeFilter || null,
          includeTotals: showTotals ? "1" : "0",
        },
      });
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to load account groups",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e) {
    e.preventDefault();
    try {
      await api.post("/finance/account-groups", {
        code,
        name,
        nature,
        parentId: parentId ? Number(parentId) : null,
        isActive: 1,
      });
      toast.success("Account group created");
      setCode("");
      setName("");
      setParentId("");
      load();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Failed to create group");
    }
  }

  async function handleToggleActive(id, isActive) {
    try {
      setLoading(true);
      await api.put(`/finance/account-groups/${id}/active`, {
        isActive: Number(Boolean(isActive)),
      });
      toast.success("Status updated");
      await load();
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to update active status",
      );
    } finally {
      setLoading(false);
    }
  }

  function startEdit(g) {
    setEditId(String(g.id));
    setEditCode(g.code || "");
    setEditName(g.name || "");
    setEditNature(g.nature || "ASSET");
    setEditParentId(g.parent_id ? String(g.parent_id) : "");
  }
  function cancelEdit() {
    setEditId("");
    setEditCode("");
    setEditName("");
    setEditNature("ASSET");
    setEditParentId("");
  }
  async function saveEdit() {
    try {
      setLoading(true);
      const payload = {
        code: editCode,
        name: editName,
        nature: editNature,
        parentId: editParentId ? Number(editParentId) : null,
      };
      await api.put(`/finance/account-groups/${editId}`, payload);
      toast.success("Group updated");
      cancelEdit();
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update group");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Chart of Account Groups
              </h1>
              <p className="text-sm mt-1">Maintain account group hierarchy</p>
            </div>
            <div className="flex gap-2 items-center">
              <Link to="/finance" className="btn btn-secondary">
                Return to Menu
              </Link>
              <input
                className="input w-48"
                placeholder="Search code/name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                className="input w-40"
                value={natureFilter}
                onChange={(e) => setNatureFilter(e.target.value)}
              >
                <option value="">All Nature</option>
                <option value="ASSET">Asset</option>
                <option value="LIABILITY">Liability</option>
                <option value="EQUITY">Equity</option>
                <option value="INCOME">Income</option>
                <option value="EXPENSE">Expense</option>
              </select>
              <select
                className="input w-32"
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
              <button className="btn-success" onClick={load} disabled={loading}>
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <form
            onSubmit={create}
            className="grid grid-cols-1 md:grid-cols-5 gap-3"
          >
            <div>
              <label className="label">Code *</label>
              <input
                className="input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Name *</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Nature *</label>
              <select
                className="input"
                value={nature}
                onChange={(e) => setNature(e.target.value)}
              >
                <option value="ASSET">Asset</option>
                <option value="LIABILITY">Liability</option>
                <option value="EQUITY">Equity</option>
                <option value="INCOME">Income</option>
                <option value="EXPENSE">Expense</option>
              </select>
            </div>
            <div>
              <label className="label">Parent</label>
              <select
                className="input"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                <option value="">None</option>
                {items.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.code} - {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-5 flex justify-end">
              <button className="btn-success" type="submit">
                Create Group
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="text-center py-10">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Nature</th>
                    <th>Parent</th>
                    <th className="text-right">Accounts</th>
                    <th>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((g) => (
                    <tr key={g.id}>
                      {String(editId) === String(g.id) ? (
                        <>
                          <td>
                            <input
                              className="input"
                              value={editCode}
                              onChange={(e) => setEditCode(e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              className="input"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                            />
                          </td>
                          <td>
                            <select
                              className="input"
                              value={editNature}
                              onChange={(e) => setEditNature(e.target.value)}
                            >
                              <option value="ASSET">Asset</option>
                              <option value="LIABILITY">Liability</option>
                              <option value="EQUITY">Equity</option>
                              <option value="INCOME">Income</option>
                              <option value="EXPENSE">Expense</option>
                            </select>
                          </td>
                          <td>
                            <select
                              className="input"
                              value={editParentId}
                              onChange={(e) => setEditParentId(e.target.value)}
                            >
                              <option value="">None</option>
                              {items.map((pg) => (
                                <option key={`p-${pg.id}`} value={pg.id}>
                                  {pg.code} - {pg.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="text-right">
                            {typeof g.account_count === "number"
                              ? g.account_count
                              : "-"}
                          </td>
                          <td>
                            <div className="flex gap-2">
                              <button
                                className="btn-success"
                                disabled={loading}
                                onClick={saveEdit}
                              >
                                Save
                              </button>
                              <button
                                className="btn btn-secondary"
                                disabled={loading}
                                onClick={cancelEdit}
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="font-medium">{g.code}</td>
                          <td>{g.name}</td>
                          <td>{g.nature}</td>
                          <td>{g.parent_name || "-"}</td>
                          <td className="text-right">
                            {typeof g.account_count === "number"
                              ? g.account_count
                              : "-"}
                          </td>
                          <td>
                            <div className="flex gap-2">
                              {g.is_active ? (
                                <button
                                  className="btn btn-secondary"
                                  disabled={
                                    loading ||
                                    (typeof g.active_account_count ===
                                      "number" &&
                                      g.active_account_count > 0)
                                  }
                                  onClick={() => {
                                    if (
                                      window.confirm("Deactivate this group?")
                                    ) {
                                      handleToggleActive(g.id, 0);
                                    }
                                  }}
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button
                                  className="btn-success"
                                  disabled={loading}
                                  onClick={() => handleToggleActive(g.id, 1)}
                                >
                                  Activate
                                </button>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
