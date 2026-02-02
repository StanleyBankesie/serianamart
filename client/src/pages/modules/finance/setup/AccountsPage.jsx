import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

import { api } from "api/client";

export default function AccountsPage() {
  const [items, setItems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterGroupId, setFilterGroupId] = useState("");
  const [natureFilter, setNatureFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [postableFilter, setPostableFilter] = useState("");

  const [groupId, setGroupId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [isPostable, setIsPostable] = useState(true);
  const [editId, setEditId] = useState("");
  const [editGroupId, setEditGroupId] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editCurrencyId, setEditCurrencyId] = useState("");
  const [editIsPostable, setEditIsPostable] = useState(true);

  async function load() {
    try {
      setLoading(true);
      const [accRes, gRes, cRes] = await Promise.all([
        api.get("/finance/accounts", {
          params: {
            search: searchTerm || null,
            groupId: filterGroupId || null,
            nature: natureFilter || null,
            active: activeFilter || null,
            postable: postableFilter || null,
          },
        }),
        api.get("/finance/account-groups"),
        api.get("/finance/currencies"),
      ]);
      setItems(accRes.data?.items || []);
      setGroups(gRes.data?.items || []);
      setCurrencies(cRes.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }

  async function autosync() {
    try {
      await api.post("/finance/accounts/sync");
    } catch (e) {
      toast.error(
        e?.response?.data?.message ||
          "Failed to sync accounts from customers/suppliers"
      );
    }
  }

  useEffect(() => {
    (async () => {
      await autosync();
      await load();
    })();
  }, []);

  async function create(e) {
    e.preventDefault();
    try {
      await api.post("/finance/accounts", {
        groupId: Number(groupId),
        code,
        name,
        currencyId: currencyId ? Number(currencyId) : null,
        isPostable,
        isControlAccount: 0,
        isActive: 1,
      });
      toast.success("Account created");
      setCode("");
      setName("");
      setGroupId("");
      setCurrencyId("");
      setIsPostable(true);
      load();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Failed to create account");
    }
  }

  async function handleToggleActive(id, isActive) {
    try {
      setLoading(true);
      await api.put(`/finance/accounts/${id}/active`, {
        isActive: Number(Boolean(isActive)),
      });
      toast.success("Status updated");
      await load();
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to update active status"
      );
    } finally {
      setLoading(false);
    }
  }

  function startEdit(a) {
    setEditId(String(a.id));
    setEditGroupId(String(a.group_id));
    setEditCode(a.code || "");
    setEditName(a.name || "");
    setEditCurrencyId(a.currency_id ? String(a.currency_id) : "");
    setEditIsPostable(Boolean(a.is_postable));
  }
  function cancelEdit() {
    setEditId("");
    setEditGroupId("");
    setEditCode("");
    setEditName("");
    setEditCurrencyId("");
    setEditIsPostable(true);
  }
  async function saveEdit() {
    try {
      setLoading(true);
      await api.put(`/finance/accounts/${editId}`, {
        groupId: editGroupId ? Number(editGroupId) : null,
        code: editCode,
        name: editName,
        currencyId: editCurrencyId ? Number(editCurrencyId) : null,
        isPostable: editIsPostable ? 1 : 0,
      });
      toast.success("Account updated");
      cancelEdit();
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update account");
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
                Chart of Accounts
              </h1>
              <p className="text-sm mt-1">Create and manage ledger accounts</p>
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
                className="input w-48"
                value={filterGroupId}
                onChange={(e) => setFilterGroupId(e.target.value)}
              >
                <option value="">All Groups</option>
                {groups.map((g) => (
                  <option key={`flt-${g.id}`} value={g.id}>
                    {g.code} - {g.name}
                  </option>
                ))}
              </select>
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
              <select
                className="input w-40"
                value={postableFilter}
                onChange={(e) => setPostableFilter(e.target.value)}
              >
                <option value="">All Posting</option>
                <option value="1">Postable</option>
                <option value="0">Non-postable</option>
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
            className="grid grid-cols-1 md:grid-cols-6 gap-3"
          >
            <div className="md:col-span-2">
              <label className="label">Group *</label>
              <select
                className="input"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                required
              >
                <option value="">Select group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.code} - {g.name}
                  </option>
                ))}
              </select>
            </div>
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
              <label className="label">Currency</label>
              <select
                className="input"
                value={currencyId}
                onChange={(e) => setCurrencyId(e.target.value)}
              >
                <option value="">Default</option>
                {currencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Posting</label>
              <select
                className="input"
                value={isPostable ? "1" : "0"}
                onChange={(e) => setIsPostable(e.target.value === "1")}
              >
                <option value="1">Postable</option>
                <option value="0">Non-postable</option>
              </select>
            </div>
            <div className="md:col-span-6 flex justify-end">
              <button className="btn-success" type="submit">
                Create Account
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
                    <th>Group</th>
                    <th>Nature</th>
                    <th>Currency</th>
                    <th>Postable</th>
                    <th>Active</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => (
                    <tr key={a.id}>
                      {String(editId) === String(a.id) ? (
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
                              value={editGroupId}
                              onChange={(e) => setEditGroupId(e.target.value)}
                            >
                              {groups.map((g) => (
                                <option key={`g-${g.id}`} value={g.id}>
                                  {g.code} - {g.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>{a.nature}</td>
                          <td>
                            <select
                              className="input"
                              value={editCurrencyId}
                              onChange={(e) =>
                                setEditCurrencyId(e.target.value)
                              }
                            >
                              <option value="">Default</option>
                              {currencies.map((c) => (
                                <option key={`c-${c.id}`} value={c.id}>
                                  {c.code}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              className="input"
                              value={editIsPostable ? "1" : "0"}
                              onChange={(e) =>
                                setEditIsPostable(e.target.value === "1")
                              }
                            >
                              <option value="1">Yes</option>
                              <option value="0">No</option>
                            </select>
                          </td>
                          <td>{a.is_active ? "Yes" : "No"}</td>
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
                          <td className="font-medium">{a.code}</td>
                          <td>{a.name}</td>
                          <td>{a.group_name}</td>
                          <td>{a.nature}</td>
                          <td>{a.currency_code || "-"}</td>
                          <td>{a.is_postable ? "Yes" : "No"}</td>
                          <td>{a.is_active ? "Yes" : "No"}</td>
                          <td>
                            <div className="flex gap-2">
                              <button
                                className="btn btn-secondary"
                                disabled={loading}
                                onClick={() => startEdit(a)}
                              >
                                Edit
                              </button>
                              {a.is_active ? (
                                <button
                                  className="btn btn-secondary"
                                  disabled={loading}
                                  onClick={() => handleToggleActive(a.id, 0)}
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button
                                  className="btn-success"
                                  disabled={loading}
                                  onClick={() => handleToggleActive(a.id, 1)}
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




