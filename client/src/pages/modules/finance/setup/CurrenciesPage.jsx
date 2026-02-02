import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Link } from "react-router-dom";

export default function CurrenciesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [isBase, setIsBase] = useState(false);
  const [isActive, setIsActive] = useState(true);

  async function load() {
    try {
      setLoading(true);
      const res = await api.get("/finance/currencies");
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load currencies");
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
      await api.post("/finance/currencies", {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        symbol: symbol.trim() || null,
        isBase,
        isActive,
      });
      toast.success("Currency created");
      setCode("");
      setName("");
      setSymbol("");
      setIsBase(false);
      setIsActive(true);
      load();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Failed to create currency");
    }
  }

  async function setBase(id) {
    try {
      await api.put(`/finance/currencies/${id}`, {
        isBase: 1,
      });
      toast.success("Base currency updated");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to set base currency");
    }
  }

  async function toggleActive(r) {
    try {
      await api.put(`/finance/currencies/${r.id}`, {
        isActive: r.is_active ? 0 : 1,
      });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to toggle status");
    }
  }

  async function saveRow(r) {
    try {
      await api.put(`/finance/currencies/${r.id}`, {
        name: r._name ?? r.name,
        symbol: r._symbol ?? r.symbol,
      });
      toast.success("Currency updated");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update currency");
    }
  }

  function setRowDraft(id, field, value) {
    setItems((p) =>
      p.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Currencies
            </h1>
            <p className="text-sm mt-1">
              Manage currencies and base currency for the company
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/finance" className="btn btn-secondary">
              Return to Menu
            </Link>
            <button
              className="btn btn-secondary"
              onClick={load}
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <form
            onSubmit={create}
            className="grid grid-cols-1 md:grid-cols-6 gap-3"
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
              <label className="label">Symbol</label>
              <input
                className="input"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isBase}
                  onChange={(e) => setIsBase(e.target.checked)}
                />
                Set as Base
              </label>
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Active
              </label>
            </div>
            <div className="flex items-end">
              <button className="btn-success">Create</button>
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Symbol</th>
                  <th>Base</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.code}</td>
                    <td>
                      <input
                        className="input"
                        value={r._name ?? r.name ?? ""}
                        onChange={(e) =>
                          setRowDraft(r.id, "_name", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        value={r._symbol ?? r.symbol ?? ""}
                        onChange={(e) =>
                          setRowDraft(r.id, "_symbol", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      {r.is_base ? (
                        <span className="badge badge-success">Base</span>
                      ) : (
                        <button className="btn" onClick={() => setBase(r.id)}>
                          Set Base
                        </button>
                      )}
                    </td>
                    <td>
                      {r.is_active ? (
                        <span className="badge badge-success">Active</span>
                      ) : (
                        <span className="badge badge-error">Inactive</span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="btn-success"
                          onClick={() => saveRow(r)}
                        >
                          Save
                        </button>
                        <button className="btn" onClick={() => toggleActive(r)}>
                          {r.is_active ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-slate-50 rounded-t-lg">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Currency Rates</h2>
              <p className="text-sm">Maintain exchange rate history</p>
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn-secondary"
                disabled={false}
                onClick={() => {}}
              >
                Help
              </button>
            </div>
          </div>
        </div>
        <div className="card-body space-y-4">
          <RatesSection items={items} />
        </div>
      </div>
    </div>
  );
}

function RatesSection({ items }) {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fltFromId, setFltFromId] = useState("");
  const [fltToId, setFltToId] = useState("");
  const [fltFromDate, setFltFromDate] = useState("");
  const [fltToDate, setFltToDate] = useState("");
  const [newFromId, setNewFromId] = useState("");
  const [newToId, setNewToId] = useState("");
  const [newRate, setNewRate] = useState("");
  const [newDate, setNewDate] = useState("");
  const [rateEditing, setRateEditing] = useState({});

  async function loadRates() {
    try {
      setLoading(true);
      const res = await api.get("/finance/currency-rates", {
        params: {
          fromCurrencyId: fltFromId || null,
          toCurrencyId: fltToId || null,
          from: fltFromDate || null,
          to: fltToDate || null,
        },
      });
      setRates(res.data?.items || []);
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to load currency rates"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRates();
  }, [fltFromId, fltToId, fltFromDate, fltToDate]);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <div>
          <label className="label">From Currency</label>
          <select
            className="input"
            value={fltFromId}
            onChange={(e) => setFltFromId(e.target.value)}
          >
            <option value="">All</option>
            {items.map((c) => (
              <option key={`f-${c.id}`} value={c.id}>
                {c.code} - {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">To Currency</label>
          <select
            className="input"
            value={fltToId}
            onChange={(e) => setFltToId(e.target.value)}
          >
            <option value="">All</option>
            {items.map((c) => (
              <option key={`t-${c.id}`} value={c.id}>
                {c.code} - {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">From Date</label>
          <input
            className="input"
            type="date"
            value={fltFromDate}
            onChange={(e) => setFltFromDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label">To Date</label>
          <input
            className="input"
            type="date"
            value={fltToDate}
            onChange={(e) => setFltToDate(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <button
            className="btn btn-secondary"
            onClick={loadRates}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api.post("/finance/currency-rates", {
              fromCurrencyId: Number(newFromId),
              toCurrencyId: Number(newToId),
              rate: Number(newRate),
              rateDate: newDate || undefined,
            });
            toast.success("Rate added");
            setNewFromId("");
            setNewToId("");
            setNewRate("");
            setNewDate("");
            loadRates();
          } catch (e2) {
            toast.error(
              e2?.response?.data?.message || "Failed to add currency rate"
            );
          }
        }}
        className="grid grid-cols-1 md:grid-cols-6 gap-3 mt-2"
      >
        <div>
          <label className="label">From *</label>
          <select
            className="input"
            value={newFromId}
            onChange={(e) => setNewFromId(e.target.value)}
            required
          >
            <option value="">Select</option>
            {items.map((c) => (
              <option key={`n-f-${c.id}`} value={c.id}>
                {c.code} - {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">To *</label>
          <select
            className="input"
            value={newToId}
            onChange={(e) => setNewToId(e.target.value)}
            required
          >
            <option value="">Select</option>
            {items.map((c) => (
              <option key={`n-t-${c.id}`} value={c.id}>
                {c.code} - {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Rate *</label>
          <input
            className="input"
            type="number"
            step="0.000001"
            min="0"
            value={newRate}
            onChange={(e) => setNewRate(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Effective Date</label>
          <input
            className="input"
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <button className="btn-success">Add Rate</button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th>Rate</th>
              <th>Date</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => {
              const d = rateEditing[r.id] || {};
              const isEdit = !!rateEditing[r.id];
              return (
                <tr key={r.id}>
                  <td className="font-medium">{r.from_code}</td>
                  <td>{r.to_code}</td>
                  <td>
                    {isEdit ? (
                      <input
                        className="input"
                        type="number"
                        step="0.000001"
                        min="0"
                        value={d.rate === undefined ? r.rate : d.rate}
                        onChange={(e) =>
                          setRateEditing((p) => ({
                            ...p,
                            [r.id]: {
                              ...(p[r.id] || {}),
                              rate: e.target.value,
                            },
                          }))
                        }
                      />
                    ) : (
                      Number(r.rate).toFixed(6)
                    )}
                  </td>
                  <td>
                    {isEdit ? (
                      <input
                        className="input"
                        type="date"
                        value={
                          d.rate_date === undefined
                            ? r.rate_date
                              ? String(r.rate_date).slice(0, 10)
                              : ""
                            : d.rate_date
                        }
                        onChange={(e) =>
                          setRateEditing((p) => ({
                            ...p,
                            [r.id]: {
                              ...(p[r.id] || {}),
                              rate_date: e.target.value,
                            },
                          }))
                        }
                      />
                    ) : r.rate_date ? (
                      String(r.rate_date).slice(0, 10)
                    ) : (
                      ""
                    )}
                  </td>
                  <td className="text-right">
                    {!isEdit ? (
                      <div className="flex justify-end gap-2">
                        <button
                          className="btn btn-secondary"
                          onClick={() =>
                            setRateEditing((p) => ({
                              ...p,
                              [r.id]: {
                                rate: r.rate,
                                rate_date: String(r.rate_date).slice(0, 10),
                              },
                            }))
                          }
                        >
                          Edit
                        </button>
                        <button
                          className="btn"
                          onClick={async () => {
                            if (!window.confirm("Delete this rate?")) return;
                            try {
                              await api.delete(
                                `/finance/currency-rates/${r.id}`
                              );
                              toast.success("Rate deleted");
                              setRateEditing((p) => {
                                const n = { ...p };
                                delete n[r.id];
                                return n;
                              });
                              loadRates();
                            } catch (e) {
                              toast.error(
                                e?.response?.data?.message ||
                                  "Failed to delete rate"
                              );
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button
                          className="btn-success"
                          onClick={async () => {
                            try {
                              await api.put(`/finance/currency-rates/${r.id}`, {
                                rate:
                                  d.rate === "" || d.rate === null
                                    ? undefined
                                    : Number(d.rate),
                                rateDate: d.rate_date || undefined,
                              });
                              toast.success("Rate updated");
                              setRateEditing((p) => {
                                const n = { ...p };
                                delete n[r.id];
                                return n;
                              });
                              loadRates();
                            } catch (e) {
                              toast.error(
                                e?.response?.data?.message ||
                                  "Failed to update rate"
                              );
                            }
                          }}
                        >
                          Save
                        </button>
                        <button
                          className="btn"
                          onClick={() =>
                            setRateEditing((p) => {
                              const n = { ...p };
                              delete n[r.id];
                              return n;
                            })
                          }
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {rates.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="text-center py-6 text-slate-600">
                  No rates found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
