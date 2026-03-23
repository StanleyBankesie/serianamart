import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";

export default function TaxConfigList() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [incomeTaxes, setIncomeTaxes] = useState([]);
  const [ssfTaxes, setSsfTaxes] = useState([]);
  const [tier3Taxes, setTier3Taxes] = useState([]);
  const [deletedIds, setDeletedIds] = useState([]);
  const [allowances, setAllowances] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [taxRes, alwRes] = await Promise.all([
        api.get("/hr/tax-configs"),
        api.get("/hr/allowances"),
      ]);
      const items = taxRes.data.items || [];
      setAllowances(alwRes.data.items || []);

      setIncomeTaxes(
        items
          .filter((i) => i.tax_type === "INCOME_TAX")
          .sort((a, b) => Number(a.min_amount) - Number(b.min_amount)),
      );
      setSsfTaxes(items.filter((i) => i.tax_type === "SOCIAL_SECURITY"));
      setTier3Taxes(items.filter((i) => i.tax_type === "PROVIDENT_FUND"));
      setDeletedIds([]);
    } catch {
      toast.error("Failed to load tax configurations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddRow = (type, setter) => {
    setter((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        tax_name:
          type === "INCOME_TAX"
            ? "Income Tax Bracket"
            : type === "SOCIAL_SECURITY"
              ? "SSF Tier"
              : "Tier 3",
        tax_type: type,
        min_amount: 0,
        max_amount: "",
        tax_rate: 0,
        fixed_amount: 0,
        employee_contribution_rate: 0,
        employer_contribution_rate: 0,
        is_active: true,
      },
    ]);
  };

  const handleRemoveRow = (id, setter) => {
    if (!String(id).startsWith("new")) {
      setDeletedIds((prev) => [...prev, id]);
    }
    setter((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdate = (id, field, value, setter) => {
    setter((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const allConfigs = [...incomeTaxes, ...ssfTaxes, ...tier3Taxes];
      await api.post("/hr/tax-configs", {
        configs: allConfigs,
        idsToDelete: deletedIds,
      });
      toast.success("Statutory configurations saved successfully");
      loadData();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to save configurations",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4 space-y-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold">
              Statutory Contributions & Taxes
            </h1>
            <p className="text-sm text-slate-500">
              Configure multiple brackets and tiers for income tax, SSF, and
              Tier 3
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/human-resources" className="btn-secondary">
              Back to Menu
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">
            Loading configurations...
          </div>
        ) : (
          <div className="space-y-8">
            {/* Income Tax Brackets */}
            <section className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                <h2 className="text-lg font-bold text-brand">
                  Income Tax Bracket Setup
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAddRow("INCOME_TAX", setIncomeTaxes)}
                    className="btn-secondary py-1 text-xs"
                  >
                    + Add Bracket
                  </button>
                  <button
                    onClick={async () => {
                      setSaving(true);
                      try {
                        await api.post("/hr/tax-configs", {
                          configs: incomeTaxes,
                          idsToDelete: deletedIds,
                        });
                        toast.success("Income Tax saved");
                        loadData();
                      } catch (err) {
                        toast.error(
                          err?.response?.data?.message ||
                            "Failed to save income tax",
                        );
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving || loading}
                    className="btn-primary py-1 text-xs"
                  >
                    Save Income Tax
                  </button>
                </div>
              </div>
              <div className="p-4 space-y-6">
                {Object.values(
                  incomeTaxes.reduce((acc, item) => {
                    const key = String(
                      item.tax_name || `BRACKET-${item.id || "new"}`,
                    );
                    if (!acc[key]) acc[key] = { name: key, rows: [] };
                    acc[key].rows.push(item);
                    return acc;
                  }, {}),
                ).map((group) => (
                  <div
                    key={group.name}
                    className="border rounded-lg overflow-hidden"
                  >
                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/40 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm uppercase text-slate-500">
                          Bracket Name
                        </span>
                        <input
                          className="input h-8 text-sm"
                          value={group.name}
                          onChange={(e) => {
                            const newName = e.target.value;
                            setIncomeTaxes((prev) =>
                              prev.map((it) =>
                                String(
                                  it.tax_name || `BRACKET-${it.id || "new"}`,
                                ) === group.name
                                  ? { ...it, tax_name: newName }
                                  : it,
                              ),
                            );
                          }}
                        />
                      </div>
                      <button
                        className="btn-secondary py-1 text-xs"
                        onClick={() => {
                          const first = group.rows[0];
                          const newRow = {
                            id: `new-${Date.now()}`,
                            tax_name: group.name,
                            tax_type: "INCOME_TAX",
                            min_amount: 0,
                            max_amount: "",
                            tax_rate: 0,
                            taxable_components: Array.isArray(
                              first.taxable_components,
                            )
                              ? first.taxable_components
                              : [],
                            is_active: true,
                          };
                          setIncomeTaxes((prev) => [...prev, newRow]);
                        }}
                      >
                        + Add Slab
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
                          <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            <th className="px-4 py-3">Min Amount</th>
                            <th className="px-4 py-3">Max Amount</th>
                            <th className="px-4 py-3">Tax Rate (%)</th>
                            <th className="px-4 py-3">Taxable Components</th>
                            <th className="px-4 py-3 w-16"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {group.rows.map((tax) => {
                            let comps = [];
                            try {
                              comps = Array.isArray(tax.taxable_components)
                                ? tax.taxable_components
                                : JSON.parse(tax.taxable_components || "[]");
                            } catch {}
                            return (
                              <tr key={tax.id}>
                                <td className="px-4 py-2">
                                  <input
                                    type="number"
                                    className="input py-1 text-sm"
                                    value={tax.min_amount}
                                    onChange={(e) =>
                                      handleUpdate(
                                        tax.id,
                                        "min_amount",
                                        e.target.value,
                                        setIncomeTaxes,
                                      )
                                    }
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="number"
                                    className="input py-1 text-sm"
                                    placeholder="No limit"
                                    value={tax.max_amount}
                                    onChange={(e) =>
                                      handleUpdate(
                                        tax.id,
                                        "max_amount",
                                        e.target.value,
                                        setIncomeTaxes,
                                      )
                                    }
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="number"
                                    step="0.01"
                                    className="input py-1 text-sm text-brand font-bold"
                                    value={tax.tax_rate}
                                    onChange={(e) =>
                                      handleUpdate(
                                        tax.id,
                                        "tax_rate",
                                        e.target.value,
                                        setIncomeTaxes,
                                      )
                                    }
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <div className="space-y-1">
                                    <label className="inline-flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={comps.includes("BASIC")}
                                        onChange={(e) => {
                                          const set = new Set(comps);
                                          if (e.target.checked)
                                            set.add("BASIC");
                                          else set.delete("BASIC");
                                          handleUpdate(
                                            tax.id,
                                            "taxable_components",
                                            Array.from(set),
                                            setIncomeTaxes,
                                          );
                                        }}
                                      />
                                      <span className="text-xs">BASIC</span>
                                    </label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1 max-h-24 overflow-auto pr-1">
                                      {allowances.map((a) => {
                                        const key = `ALLOWANCE:${a.id}`;
                                        const checked = comps.includes(key);
                                        return (
                                          <label
                                            key={a.id}
                                            className="inline-flex items-center gap-2"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              onChange={(e) => {
                                                const set = new Set(comps);
                                                if (e.target.checked)
                                                  set.add(key);
                                                else set.delete(key);
                                                handleUpdate(
                                                  tax.id,
                                                  "taxable_components",
                                                  Array.from(set),
                                                  setIncomeTaxes,
                                                );
                                              }}
                                            />
                                            <span className="text-xs">
                                              {a.allowance_name}
                                            </span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-right">
                                  <button
                                    onClick={() =>
                                      handleRemoveRow(tax.id, setIncomeTaxes)
                                    }
                                    className="text-red-500 hover:text-red-700 font-bold px-2"
                                  >
                                    &times;
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
                {incomeTaxes.length === 0 && (
                  <div className="px-4 py-8 text-center text-slate-500 text-sm">
                    No brackets defined.
                  </div>
                )}
              </div>
            </section>

            {/* Social Security Fund */}
            <section className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                <h2 className="text-lg font-bold text-brand">
                  Social Security Fund (SSF) Setup
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAddRow("SOCIAL_SECURITY", setSsfTaxes)}
                    className="btn-secondary py-1 text-xs"
                  >
                    + Add SSF Tier
                  </button>
                  <button
                    onClick={async () => {
                      setSaving(true);
                      try {
                        await api.post("/hr/tax-configs", {
                          configs: ssfTaxes,
                          idsToDelete: deletedIds,
                        });
                        toast.success("SSF saved");
                        loadData();
                      } catch (err) {
                        toast.error(
                          err?.response?.data?.message || "Failed to save SSF",
                        );
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving || loading}
                    className="btn-primary py-1 text-xs"
                  >
                    Save SSF
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
                    <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="px-4 py-3">Tier Name</th>
                      <th className="px-4 py-3">Employee Contribution (%)</th>
                      <th className="px-4 py-3">Employer Contribution (%)</th>
                      <th className="px-4 py-3 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {ssfTaxes.map((tax) => (
                      <tr key={tax.id}>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            className="input py-1 text-sm"
                            value={tax.tax_name}
                            onChange={(e) =>
                              handleUpdate(
                                tax.id,
                                "tax_name",
                                e.target.value,
                                setSsfTaxes,
                              )
                            }
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            step="0.01"
                            className="input py-1 text-sm font-mono"
                            value={tax.employee_contribution_rate}
                            onChange={(e) =>
                              handleUpdate(
                                tax.id,
                                "employee_contribution_rate",
                                e.target.value,
                                setSsfTaxes,
                              )
                            }
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            step="0.01"
                            className="input py-1 text-sm font-mono bg-emerald-50 dark:bg-emerald-900/20"
                            value={tax.employer_contribution_rate}
                            onChange={(e) =>
                              handleUpdate(
                                tax.id,
                                "employer_contribution_rate",
                                e.target.value,
                                setSsfTaxes,
                              )
                            }
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => handleRemoveRow(tax.id, setSsfTaxes)}
                            className="text-red-500 hover:text-red-700 font-bold px-2"
                          >
                            &times;
                          </button>
                        </td>
                      </tr>
                    ))}
                    {ssfTaxes.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-8 text-center text-slate-500 text-sm"
                        >
                          No SSF tiers defined.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Provident Fund Tier 3 */}
            <section className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                <h2 className="text-lg font-bold text-brand">
                  Provident Fund (Tier 3) Setup
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      handleAddRow("PROVIDENT_FUND", setTier3Taxes)
                    }
                    className="btn-secondary py-1 text-xs"
                  >
                    + Add Tier 3 Profile
                  </button>
                  <button
                    onClick={async () => {
                      setSaving(true);
                      try {
                        await api.post("/hr/tax-configs", {
                          configs: tier3Taxes,
                          idsToDelete: deletedIds,
                        });
                        toast.success("Tier 3 saved");
                        loadData();
                      } catch (err) {
                        toast.error(
                          err?.response?.data?.message ||
                            "Failed to save Tier 3",
                        );
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving || loading}
                    className="btn-primary py-1 text-xs"
                  >
                    Save Tier 3
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
                    <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="px-4 py-3">Profile Name</th>
                      <th className="px-4 py-3">Employee Contribution (%)</th>
                      <th className="px-4 py-3">Employer Contribution (%)</th>
                      <th className="px-4 py-3 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {tier3Taxes.map((tax) => (
                      <tr key={tax.id}>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            className="input py-1 text-sm"
                            value={tax.tax_name}
                            onChange={(e) =>
                              handleUpdate(
                                tax.id,
                                "tax_name",
                                e.target.value,
                                setTier3Taxes,
                              )
                            }
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            step="0.01"
                            className="input py-1 text-sm font-mono"
                            value={tax.employee_contribution_rate}
                            onChange={(e) =>
                              handleUpdate(
                                tax.id,
                                "employee_contribution_rate",
                                e.target.value,
                                setTier3Taxes,
                              )
                            }
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            step="0.01"
                            className="input py-1 text-sm font-mono bg-emerald-50 dark:bg-emerald-900/20"
                            value={tax.employer_contribution_rate}
                            onChange={(e) =>
                              handleUpdate(
                                tax.id,
                                "employer_contribution_rate",
                                e.target.value,
                                setTier3Taxes,
                              )
                            }
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() =>
                              handleRemoveRow(tax.id, setTier3Taxes)
                            }
                            className="text-red-500 hover:text-red-700 font-bold px-2"
                          >
                            &times;
                          </button>
                        </td>
                      </tr>
                    ))}
                    {tier3Taxes.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-8 text-center text-slate-500 text-sm"
                        >
                          No Tier 3 profiles defined.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </Guard>
  );
}
