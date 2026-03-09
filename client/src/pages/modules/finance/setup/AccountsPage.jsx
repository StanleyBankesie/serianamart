import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

import { api } from "api/client";
import { filterAndSort } from "@/utils/searchUtils.js";

export default function AccountsPage() {
  const [items, setItems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterGroupId, setFilterGroupId] = useState("");
  const [natureFilter, setNatureFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  // removed posting filter per request

  const [groupId, setGroupId] = useState("");
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
            postable: null,
          },
        }),
        api.get("/finance/account-groups"),
        api.get("/finance/currencies"),
      ]);
      const arr = accRes.data?.items || [];
      setItems(arr);
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
      // Ensure all existing accounts are postable
      await api.put("/finance/accounts/force-postable");
    } catch (e) {
      toast.error(
        e?.response?.data?.message ||
          "Failed to sync accounts from customers/suppliers",
      );
    }
  }

  useEffect(() => {
    (async () => {
      await autosync();
      await load();
    })();
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterGroupId, natureFilter, activeFilter]);

  async function create(e) {
    e.preventDefault();
    try {
      const payload = {
        groupId: Number(groupId),
        name,
        currencyId: currencyId ? Number(currencyId) : null,
        isPostable: 1,
        isControlAccount: 0,
        isActive: 1,
      };
      const resp = await api.post("/finance/accounts", payload);
      const id = Number(resp?.data?.id || 0);
      const newCode = resp?.data?.code || "";
      // Optimistically update list without full reload
      const g = groups.find((x) => String(x.id) === String(groupId));
      const c = currencies.find((x) => String(x.id) === String(currencyId));
      const newItem = {
        id: id || Math.random(),
        code: newCode,
        name,
        group_id: Number(groupId),
        group_code: g?.code || "",
        group_name: g?.name || "",
        nature: g?.nature || "",
        currency_id: currencyId ? Number(currencyId) : null,
        currency_code: c?.code || "",
        is_control_account: 0,
        is_postable: 1,
        is_active: 1,
      };
      setItems((prev) => {
        const next = [newItem, ...prev];
        return next;
      });
      toast.success("Account created");
      setName("");
      setGroupId("");
      setCurrencyId("");
      setIsPostable(true);
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
        e?.response?.data?.message || "Failed to update active status",
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
        isPostable: 1,
      });
      // Update local state quickly without reload
      setItems((prev) =>
        prev.map((a) =>
          String(a.id) === String(editId)
            ? {
                ...a,
                code: editCode,
                name: editName,
                group_id: editGroupId ? Number(editGroupId) : a.group_id,
                group_name:
                  groups.find((g) => String(g.id) === String(editGroupId))
                    ?.name || a.group_name,
                group_code:
                  groups.find((g) => String(g.id) === String(editGroupId))
                    ?.code || a.group_code,
                nature:
                  groups.find((g) => String(g.id) === String(editGroupId))
                    ?.nature || a.nature,
                currency_id: editCurrencyId
                  ? Number(editCurrencyId)
                  : a.currency_id,
                currency_code:
                  currencies.find(
                    (c) => String(c.id) === String(editCurrencyId),
                  )?.code || a.currency_code,
                is_postable: editIsPostable ? 1 : 0,
              }
            : a,
        ),
      );
      toast.success("Account updated");
      cancelEdit();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update account");
    } finally {
      setLoading(false);
    }
  }

  const rankedItems = useMemo(() => {
    const q = String(searchTerm || "").trim();
    if (!q) return items.slice();
    return filterAndSort(items, {
      query: q,
      getKeys: (a) => [a.code, a.name],
    });
  }, [items, searchTerm]);

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
              {/* Posting filter removed */}
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
            <div className="flex items-end justify-end">
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
                  {rankedItems.map((a) => (
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
                          <td>Yes</td>
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
                              <button
                                className="btn-success"
                                disabled={loading}
                                onClick={() => handleToggleActive(a.id, 1)}
                              >
                                Activate
                              </button>
                              <button
                                className="btn btn-secondary"
                                disabled={loading}
                                onClick={() => handleToggleActive(a.id, 0)}
                              >
                                Deactivate
                              </button>
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
