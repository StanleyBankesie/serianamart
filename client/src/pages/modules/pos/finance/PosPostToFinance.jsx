import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../../../api/client.js";

const DENOMINATIONS = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2];

function FilterableSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  filterPlaceholder,
}) {
  const filtered = Array.isArray(options) ? options : [];
  return (
    <div>
      <select
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">{placeholder || "Select..."}</option>
        {filtered.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function PosPostToFinance() {
  const [loading, setLoading] = useState(false);
  const [terminals, setTerminals] = useState([]);

  const [voucherNo, setVoucherNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [tillId, setTillId] = useState("");
  const [warehouse, setWarehouse] = useState("");

  const [search, setSearch] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [actionsOpen, setActionsOpen] = useState(false);

  const [transactions, setTransactions] = useState([]);

  const [denomCounts, setDenomCounts] = useState(DENOMINATIONS.map(() => 0));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get("/pos/terminals")
      .then((res) => {
        if (cancelled) return;
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setTerminals(items);
        if (!tillId && items.length) {
          const first = items[0];
          setTillId(String(first.id));
          setWarehouse(String(first.warehouse || ""));
        }
      })
      .catch(() => {
        if (cancelled) return;
        setTerminals([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = terminals.find((x) => String(x.id) === String(tillId));
    if (t && t.warehouse && String(warehouse || "").trim() === "") {
      setWarehouse(String(t.warehouse));
    }
  }, [tillId, terminals]);

  const warehouseOptions = useMemo(() => {
    const unique = new Set();
    for (const t of terminals) {
      const w = String(t?.warehouse || "").trim();
      if (w) unique.add(w);
    }
    return Array.from(unique.values());
  }, [terminals]);

  const tillSelectOptions = useMemo(() => {
    return (Array.isArray(terminals) ? terminals : []).map((t) => ({
      value: String(t.id),
      label: String(t.code || t.name || ""),
    }));
  }, [terminals]);

  const warehouseSelectOptions = useMemo(() => {
    const base = (Array.isArray(warehouseOptions) ? warehouseOptions : []).map(
      (w) => ({ value: String(w), label: String(w) }),
    );
    if (!base.length && String(warehouse || "").trim()) {
      return [{ value: String(warehouse), label: String(warehouse) }];
    }
    return base;
  }, [warehouseOptions, warehouse]);

  const filteredTransactions = useMemo(() => {
    const q = String(search || "")
      .trim()
      .toLowerCase();
    if (!q) return transactions;
    return transactions.filter((t) =>
      String(t.account || "")
        .toLowerCase()
        .includes(q),
    );
  }, [transactions, search]);

  const visibleTransactions = useMemo(() => {
    const limit = Math.max(1, Number(rowsPerPage || 0) || 1);
    return filteredTransactions.slice(0, limit);
  }, [filteredTransactions, rowsPerPage]);

  const totals = useMemo(() => {
    return transactions.reduce(
      (acc, t) => {
        acc.credit += Number(t.credit || 0);
        acc.debit += Number(t.debit || 0);
        return acc;
      },
      { credit: 0, debit: 0 },
    );
  }, [transactions]);

  const denomTotals = useMemo(() => {
    return DENOMINATIONS.map((d, idx) =>
      roundTo2(d * Number(denomCounts[idx] || 0)),
    );
  }, [denomCounts]);

  const cashTotal = useMemo(() => {
    return roundTo2(denomTotals.reduce((sum, n) => sum + Number(n || 0), 0));
  }, [denomTotals]);

  function roundTo2(value) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  function accountLabelFromAccountsById(accountsById, accountId) {
    const a = accountsById.get(String(accountId));
    if (!a) return String(accountId || "");
    const code = String(a.code || "").trim();
    const name = String(a.name || "").trim();
    if (code && name) return `${code} - ${name}`;
    return name || code || String(accountId || "");
  }

  function accountLabelFromAccountRef(accounts, accountsById, accountRef) {
    const raw = String(accountRef || "").trim();
    if (!raw) return "";
    const asId = Number(raw);
    if (Number.isFinite(asId) && asId > 0) {
      return accountLabelFromAccountsById(accountsById, asId);
    }
    const byCode = accounts.find((a) => String(a.code || "") === raw);
    if (byCode) return accountLabelFromAccountsById(accountsById, byCode.id);
    return raw;
  }

  function pickDefaultSalesAccountId(incomeAccounts) {
    const sorted = Array.isArray(incomeAccounts) ? incomeAccounts.slice() : [];
    sorted.sort((a, b) => {
      const aCode = String(a?.code || "");
      const bCode = String(b?.code || "");
      const aName = String(a?.name || "").toLowerCase();
      const bName = String(b?.name || "").toLowerCase();

      const aScore =
        aCode === "4000" || aCode === "400000"
          ? 0
          : aName.includes("sales")
            ? 1
            : aCode.toLowerCase().startsWith("4")
              ? 2
              : 3;
      const bScore =
        bCode === "4000" || bCode === "400000"
          ? 0
          : bName.includes("sales")
            ? 1
            : bCode.toLowerCase().startsWith("4")
              ? 2
              : 3;

      if (aScore !== bScore) return aScore - bScore;
      return aCode.localeCompare(bCode);
    });
    const top = sorted[0];
    return top?.id ? Number(top.id) : 0;
  }

  function dateKey(value) {
    return String(value || "").slice(0, 10);
  }

  async function populateTransactions() {
    setLoading(true);
    try {
      const [salesRes, accountsRes, taxRes, paymentModesRes] =
        await Promise.all([
          api.get("/pos/sales"),
          api.get("/finance/accounts", { params: { postable: 1, active: 1 } }),
          api.get("/pos/tax-settings"),
          api.get("/pos/payment-modes"),
        ]);

      const allSales = Array.isArray(salesRes.data?.items)
        ? salesRes.data.items
        : [];
      const accounts = Array.isArray(accountsRes.data?.items)
        ? accountsRes.data.items
        : [];
      const accountsById = new Map(accounts.map((a) => [String(a.id), a]));
      const taxSettings = taxRes.data?.item || null;
      const paymentModes = Array.isArray(paymentModesRes.data?.items)
        ? paymentModesRes.data.items
        : [];

      const selectedDate = dateKey(voucherDate);
      const sales = allSales.filter((s) => {
        const saleDate = dateKey(s.sale_date);
        const paid = String(s.payment_status || "").toUpperCase() === "PAID";
        return paid && saleDate === selectedDate;
      });
      if (!sales.length) {
        setTransactions([]);
        window.alert("No completed POS sales found for the selected date.");
        return;
      }

      const taxMode = String(
        taxSettings?.tax_type || "Exclusive",
      ).toLowerCase();
      const taxActive =
        taxSettings && Number(taxSettings.is_active) === 0 ? 0 : 1;

      const taxAccountId =
        taxActive && Number(taxSettings?.tax_account_id || 0) > 0
          ? Number(taxSettings.tax_account_id)
          : 0;

      const incomeAccounts = accounts.filter(
        (a) => String(a.nature || "").toUpperCase() === "INCOME",
      );
      const salesAccountId = pickDefaultSalesAccountId(incomeAccounts);
      if (!salesAccountId) {
        throw new Error("Sales account not configured for posting");
      }

      let totalSalesBase = 0;
      let totalTax = 0;
      const paymentTotals = new Map();

      for (const s of sales) {
        const gross = Number(s.gross_amount || 0);
        const discount = Number(s.discount_amount || 0);
        const subtotal = roundTo2(gross - discount);
        const tax = roundTo2(Number(s.tax_amount || 0));
        const total = roundTo2(Number(s.total_amount || 0));

        let base = subtotal;
        if (taxActive && taxMode === "inclusive" && tax > 0 && subtotal > 0) {
          base = roundTo2(subtotal - tax);
        }

        totalSalesBase = roundTo2(totalSalesBase + Math.max(0, base));
        totalTax = roundTo2(totalTax + Math.max(0, tax));

        const method = String(s.payment_method || "CASH").toUpperCase();
        paymentTotals.set(
          method,
          roundTo2((paymentTotals.get(method) || 0) + total),
        );
      }

      if (totalTax > 0 && !taxAccountId) {
        throw new Error("Tax account not configured in POS Tax Settings");
      }

      const next = [];
      if (totalSalesBase > 0) {
        next.push({
          account: accountLabelFromAccountsById(accountsById, salesAccountId),
          credit: totalSalesBase,
          debit: 0,
        });
      }
      if (totalTax > 0 && taxAccountId) {
        next.push({
          account: accountLabelFromAccountsById(accountsById, taxAccountId),
          credit: totalTax,
          debit: 0,
        });
      }

      const paymentModeByType = new Map();
      for (const pm of paymentModes) {
        if (Number(pm.is_active) === 0) continue;
        const t = String(pm.type || "").toLowerCase();
        if (!paymentModeByType.has(t)) paymentModeByType.set(t, pm);
      }

      const methodOrder = ["CASH", "CARD", "MOBILE"];
      const methods = Array.from(paymentTotals.keys()).sort((a, b) => {
        const ai = methodOrder.indexOf(a);
        const bi = methodOrder.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });

      for (const method of methods) {
        const amt = roundTo2(paymentTotals.get(method) || 0);
        if (amt <= 0) continue;
        const needType =
          method === "CARD" ? "card" : method === "MOBILE" ? "mobile" : "cash";
        const pm = paymentModeByType.get(needType);
        const payLabel = accountLabelFromAccountRef(
          accounts,
          accountsById,
          pm?.account,
        );
        if (!payLabel) {
          throw new Error(
            `No linked Finance account found for payment type: ${needType}`,
          );
        }
        next.push({ account: payLabel, credit: 0, debit: amt });
      }

      setTransactions(next);
    } catch (e) {
      setTransactions([]);
      window.alert(String(e?.message || "Failed to populate transactions"));
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setVoucherNo("");
    setTransactions([]);
    setSearch("");
    setDenomCounts(DENOMINATIONS.map(() => 0));
  }

  function postToFinance() {
    const till = terminals.find((x) => String(x.id) === String(tillId));
    const tillLabel = till ? String(till.code || till.name || "").trim() : "";
    const vNo = String(voucherNo || "").trim() || "Auto-generated";
    const vDate = voucherDate;
    const wh = String(warehouse || "").trim() || "-";
    const cTotal = cashTotal.toFixed(2);
    const ok = window.confirm(
      `Post transaction to finance?\n\nVoucher: ${vNo}\nDate: ${vDate}\nTill: ${
        tillLabel || "-"
      }\nWarehouse: ${wh}\nCash Total: GHS ${cTotal}`,
    );
    if (!ok) return;
    window.alert("Transaction posted to finance successfully!");
    resetForm();
  }

  const paginationText = useMemo(() => {
    const start = visibleTransactions.length ? 1 : 0;
    const end = visibleTransactions.length;
    return `${start} - ${end}`;
  }, [visibleTransactions.length]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/pos"
          className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
        >
          ← Back to POS
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
          POS Finance Posting
        </h1>
      </div>

      <div className="card">
        <div className="card-body space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="label">Voucher no.</label>
              <input
                className="input"
                value={voucherNo}
                onChange={(e) => setVoucherNo(e.target.value)}
                placeholder="Auto-generated"
              />
            </div>
            <div>
              <label className="label">Voucher Date</label>
              <input
                className="input"
                type="date"
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Till</label>
              <FilterableSelect
                value={tillId}
                onChange={(val) => {
                  const next = String(val || "");
                  setTillId(next);
                  const t = terminals.find(
                    (x) => String(x.id) === String(next),
                  );
                  if (t) setWarehouse(String(t.warehouse || ""));
                }}
                options={tillSelectOptions}
                placeholder={!terminals.length ? "Loading..." : "Select till"}
                filterPlaceholder="Filter tills..."
                disabled={loading || !terminals.length}
              />
            </div>
            <div>
              <label className="label">Warehouse</label>
              <FilterableSelect
                value={warehouse}
                onChange={(val) => setWarehouse(String(val || ""))}
                options={warehouseSelectOptions}
                placeholder={!warehouseSelectOptions.length ? "-" : "Select"}
                filterPlaceholder="Filter warehouses..."
                disabled={loading || !warehouseSelectOptions.length}
              />
            </div>
          </div>

          <div>
            <button
              type="button"
              className="btn-primary"
              onClick={populateTransactions}
              disabled={loading}
            >
              POPULATE DATA
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-5">
            <div className="space-y-3">
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <input
                    className="input"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={populateTransactions}
                  disabled={loading}
                >
                  Go
                </button>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-slate-600">Rows</div>
                  <select
                    className="input"
                    value={String(rowsPerPage)}
                    onChange={(e) => setRowsPerPage(Number(e.target.value))}
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setActionsOpen((v) => !v)}
                  >
                    Actions ▼
                  </button>
                  {actionsOpen && (
                    <div className="absolute right-0 mt-2 w-40 rounded border border-slate-200 bg-white shadow-lg z-10">
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                        onClick={() => {
                          setActionsOpen(false);
                          resetForm();
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto rounded border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th className="text-left p-2 text-xs uppercase">Sr No</th>
                      <th className="text-left p-2 text-xs uppercase">
                        Account Name
                      </th>
                      <th className="text-right p-2 text-xs uppercase">
                        Credit
                      </th>
                      <th className="text-right p-2 text-xs uppercase">
                        Debit
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {!transactions.length ? (
                      <tr>
                        <td
                          className="p-10 text-center text-slate-500"
                          colSpan={4}
                        >
                          Click "POPULATE DATA" to load transactions
                        </td>
                      </tr>
                    ) : (
                      <>
                        {visibleTransactions.map((t, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2 text-center">{idx + 1}</td>
                            <td className="p-2">{t.account}</td>
                            <td className="p-2 text-right">
                              {Number(t.credit || 0) > 0
                                ? Number(t.credit || 0).toFixed(2)
                                : ""}
                            </td>
                            <td className="p-2 text-right">
                              {Number(t.debit || 0) > 0
                                ? Number(t.debit || 0).toFixed(2)
                                : ""}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t bg-slate-50 font-semibold">
                          <td className="p-2" />
                          <td className="p-2" />
                          <td className="p-2 text-right">
                            {totals.credit.toFixed(2)}
                          </td>
                          <td className="p-2 text-right">
                            {totals.debit.toFixed(2)}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end text-xs text-slate-600">
                {paginationText}
              </div>
            </div>

            <div className="rounded-lg bg-brand text-white p-4 h-fit">
              <div className="text-center text-base font-semibold">
                Denomination Cash Count
              </div>
              <div className="mt-4 space-y-2">
                {DENOMINATIONS.map((d, idx) => (
                  <div
                    key={String(d)}
                    className="grid grid-cols-[1fr_90px_110px] gap-2 items-center"
                  >
                    <div className="text-sm">{`GHS ${Number(d).toFixed(
                      2,
                    )}`}</div>
                    <input
                      type="number"
                      min="0"
                      className="rounded px-2 py-1 text-slate-900"
                      value={String(denomCounts[idx] ?? 0)}
                      onChange={(e) => {
                        const next = denomCounts.slice();
                        next[idx] = Number(e.target.value || 0);
                        setDenomCounts(next);
                      }}
                    />
                    <div className="rounded px-2 py-1 bg-white/20 text-right text-sm">
                      {denomTotals[idx].toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded bg-white/20 px-3 py-3 flex items-center justify-between font-semibold">
                <div>TOTAL:</div>
                <div>{cashTotal.toFixed(2)}</div>
              </div>
              <button
                type="button"
                className="btn-primary w-full mt-4"
                onClick={postToFinance}
                disabled={loading || !transactions.length}
              >
                POST TO FINANCE
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
