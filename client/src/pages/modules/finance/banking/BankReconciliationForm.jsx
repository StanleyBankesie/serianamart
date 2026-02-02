import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";
import * as XLSX from "xlsx";

export default function BankReconciliationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [header, setHeader] = useState(null);
  const [lines, setLines] = useState([]);

  const [hdrDraft, setHdrDraft] = useState({});
  const [newLine, setNewLine] = useState({
    voucherId: "",
    statementDate: "",
    description: "",
    amount: "",
    cleared: false,
  });
  const [lineDraft, setLineDraft] = useState({});
  const [vouchers, setVouchers] = useState([]);
  const [voucherSearch, setVoucherSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [headerCandidates, setHeaderCandidates] = useState([]);
  const [advancedMapping, setAdvancedMapping] = useState(false);
  const [mapping, setMapping] = useState({
    date: "",
    description: "",
    amount: "",
    cleared: "",
    voucher_no: "",
  });
  const [summary, setSummary] = useState(null);

  async function load() {
    try {
      setLoading(true);
      const res = await api.get(`/finance/bank-reconciliations/${id}`);
      setHeader(res.data?.header || null);
      setLines(res.data?.lines || []);
      setHdrDraft({});
      setLineDraft({});
      try {
        const sRes = await api.get(
          `/finance/bank-reconciliations/${id}/summary`
        );
        setSummary(sRes.data || null);
      } catch {
        setSummary(null);
      }
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to load reconciliation"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/finance/vouchers");
        setVouchers(res.data?.items || []);
      } catch {
        // ignore
      }
    })();
  }, []);

  async function saveHeader() {
    const from = hdrDraft.statement_from || header?.statement_from;
    const to = hdrDraft.statement_to || header?.statement_to;
    if (from && to) {
      const dFrom = new Date(from);
      const dTo = new Date(to);
      if (dFrom > dTo) {
        toast.error("Statement From must be before or equal to Statement To");
        return;
      }
    }
    try {
      await api.put(`/finance/bank-reconciliations/${id}`, {
        statementFrom: hdrDraft.statement_from || undefined,
        statementTo: hdrDraft.statement_to || undefined,
        statementEndingBalance:
          hdrDraft.statement_ending_balance === "" ||
          hdrDraft.statement_ending_balance === null
            ? undefined
            : Number(hdrDraft.statement_ending_balance),
        status: hdrDraft.status || undefined,
      });
      toast.success("Header updated");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update header");
    }
  }

  async function addLine(e) {
    e.preventDefault();
    if (!newLine.statementDate) {
      toast.error("Statement Date is required");
      return;
    }
    if (!newLine.amount || Number(newLine.amount) === 0) {
      toast.error("Amount must be non-zero");
      return;
    }
    if (header?.statement_from && header?.statement_to) {
      const d = new Date(newLine.statementDate);
      const from = new Date(header.statement_from);
      const to = new Date(header.statement_to);
      if (d < from || d > to) {
        toast.error("Line date must be within reconciliation date range");
        return;
      }
    }
    try {
      await api.post(`/finance/bank-reconciliations/${id}/lines`, {
        voucherId: newLine.voucherId ? Number(newLine.voucherId) : undefined,
        statementDate: newLine.statementDate,
        description: newLine.description || undefined,
        amount: Number(newLine.amount),
        cleared: newLine.cleared ? 1 : 0,
      });
      toast.success("Line added");
      setNewLine({
        voucherId: "",
        statementDate: "",
        description: "",
        amount: "",
        cleared: false,
      });
      load();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Failed to add line");
    }
  }

  async function saveLine(l) {
    const d = lineDraft[l.id] || {};
    if (d.amount !== undefined && (d.amount === "" || Number(d.amount) === 0)) {
      toast.error("Amount must be non-zero");
      return;
    }
    if (d.statement_date) {
      const ds = new Date(d.statement_date);
      const from = new Date(header.statement_from);
      const to = new Date(header.statement_to);
      if (ds < from || ds > to) {
        toast.error("Line date must be within reconciliation date range");
        return;
      }
    }
    try {
      await api.put(`/finance/bank-reconciliation-lines/${l.id}`, {
        voucherId:
          d.voucher_id === undefined ? undefined : Number(d.voucher_id || 0),
        statementDate: d.statement_date || undefined,
        description: d.description || undefined,
        amount:
          d.amount === undefined || d.amount === ""
            ? undefined
            : Number(d.amount),
        cleared: d.cleared === undefined ? undefined : d.cleared ? 1 : 0,
      });
      toast.success("Line updated");
      setLineDraft((p) => {
        const n = { ...p };
        delete n[l.id];
        return n;
      });
      load();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Failed to update line");
    }
  }

  async function deleteLine(l) {
    if (!window.confirm("Delete this line?")) return;
    try {
      await api.delete(`/finance/bank-reconciliation-lines/${l.id}`);
      toast.success("Line deleted");
      setLineDraft((p) => {
        const n = { ...p };
        delete n[l.id];
        return n;
      });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to delete line");
    }
  }

  async function importLines(e) {
    e.preventDefault();
    if (!importFile) {
      toast.error("Choose a CSV or XLSX file");
      return;
    }
    try {
      setImporting(true);
      const fd = new FormData();
      fd.append("file", importFile);
      if (advancedMapping) {
        const map = {};
        if (mapping.date) map.date = mapping.date;
        if (mapping.description) map.description = mapping.description;
        if (mapping.amount) map.amount = mapping.amount;
        if (mapping.cleared) map.cleared = mapping.cleared;
        if (mapping.voucher_no) map.voucher_no = mapping.voucher_no;
        fd.append("mapping", JSON.stringify(map));
      }
      const res = await api.post(
        `/finance/bank-reconciliations/${id}/lines/import`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      const ins = res.data?.insertedCount || 0;
      const skp = res.data?.skippedCount || 0;
      toast.success(`Imported ${ins} lines, skipped ${skp}`);
      setImportFile(null);
      load();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Failed to import lines");
    } finally {
      setImporting(false);
    }
  }

  async function downloadTemplate(format) {
    try {
      const res = await api.get(
        `/finance/bank-reconciliations/lines/import-template?format=${format}`,
        { responseType: "blob" }
      );
      const blob = new Blob([res.data], {
        type:
          format === "xlsx"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "text/csv",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        format === "xlsx"
          ? "reconciliation_import_template.xlsx"
          : "reconciliation_import_template.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Failed to download template");
    }
  }

  function onFileChange(file) {
    setImportFile(file);
    setHeaderCandidates([]);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const wb = XLSX.read(reader.result, { type: "binary" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const headersRow = Array.isArray(rows?.[0]) ? rows[0] : [];
        const cols = headersRow
          .map((h) => String(h || "").trim())
          .filter((h) => h.length > 0);
        setHeaderCandidates(cols);
      } catch {
        // ignore
      }
    };
    reader.readAsBinaryString(file);
  }

  if (!header && !loading) {
    return (
      <div className="space-y-4">
        <div className="card">
          <div className="card-header">
            <h1 className="text-2xl font-bold">Reconciliation Not Found</h1>
          </div>
          <div className="card-body">
            <Link to="/finance/bank-reconciliation" className="btn">
              Back to List
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const totals = summary
    ? {
        cleared: Number(summary.clearedTotal || 0),
        uncleared: Number(summary.unclearedTotal || 0),
        ending: Number(summary.statementEndingBalance || 0),
        openingBook: Number(summary.openingBookBalance || 0),
        periodMovement: Number(summary.periodBookMovement || 0),
        endingBook: Number(summary.endingBookBalance || 0),
        diffBankVsCleared: Number(summary.diffBankVsCleared || 0),
        diffBankVsBook: Number(summary.diffBankVsBook || 0),
        outstandingEstimate: Number(summary.outstandingEstimate || 0),
      }
    : {
        cleared: lines
          .filter((l) => Number(l.cleared))
          .reduce((acc, l) => acc + Number(l.amount || 0), 0),
        uncleared: lines
          .filter((l) => !Number(l.cleared))
          .reduce((acc, l) => acc + Number(l.amount || 0), 0),
        ending: Number(header?.statement_ending_balance || 0),
        openingBook: 0,
        periodMovement: 0,
        endingBook: 0,
        diffBankVsCleared:
          Number(header?.statement_ending_balance || 0) -
          lines
            .filter((l) => Number(l.cleared))
            .reduce((acc, l) => acc + Number(l.amount || 0), 0),
        diffBankVsBook: 0,
        outstandingEstimate: 0,
      };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Bank Reconciliation Details
            </h1>
            <p className="text-sm mt-1">
              {header?.bank_account_name}{" "}
              {header?.account_number ? `(${header.account_number})` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/finance" className="btn btn-secondary">
              Return to Menu
            </Link>
            <Link
              to="/finance/bank-reconciliation"
              className="btn btn-secondary"
            >
              Back to List
            </Link>
            <button
              className="btn btn-secondary"
              disabled={loading}
              onClick={load}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {header && (
        <div className="card">
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <div>
                <label className="label">Statement From</label>
                <input
                  className="input"
                  type="date"
                  value={
                    hdrDraft.statement_from === undefined
                      ? header.statement_from?.slice(0, 10)
                      : hdrDraft.statement_from
                  }
                  onChange={(e) =>
                    setHdrDraft((p) => ({
                      ...p,
                      statement_from: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="label">Statement To</label>
                <input
                  className="input"
                  type="date"
                  value={
                    hdrDraft.statement_to === undefined
                      ? header.statement_to?.slice(0, 10)
                      : hdrDraft.statement_to
                  }
                  onChange={(e) =>
                    setHdrDraft((p) => ({
                      ...p,
                      statement_to: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="label">Ending Balance</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={
                    hdrDraft.statement_ending_balance === undefined
                      ? header.statement_ending_balance ?? ""
                      : hdrDraft.statement_ending_balance
                  }
                  onChange={(e) =>
                    setHdrDraft((p) => ({
                      ...p,
                      statement_ending_balance: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={
                    hdrDraft.status === undefined
                      ? header.status
                      : hdrDraft.status
                  }
                  onChange={(e) =>
                    setHdrDraft((p) => ({ ...p, status: e.target.value }))
                  }
                >
                  <option value="DRAFT">Draft</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
              <div className="flex items-end">
                <button className="btn-success" onClick={saveHeader}>
                  Save Header
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div>
              <div className="label">Cleared Total</div>
              <div className="text-xl font-semibold">
                {totals.cleared.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
            <div>
              <div className="label">Uncleared Total</div>
              <div className="text-xl font-semibold">
                {totals.uncleared.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
            <div>
              <div className="label">Statement Ending Balance</div>
              <div className="text-xl font-semibold">
                {totals.ending.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
            <div>
              <div className="label">Diff (Ending − Cleared)</div>
              <div
                className={`text-xl font-semibold ${
                  totals.diffBankVsCleared === 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {totals.diffBankVsCleared.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
            <div>
              <div className="label">Book Opening</div>
              <div className="text-xl font-semibold">
                {totals.openingBook.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
            <div>
              <div className="label">Book Movement</div>
              <div className="text-xl font-semibold">
                {totals.periodMovement.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
            <div>
              <div className="label">Book Ending</div>
              <div className="text-xl font-semibold">
                {totals.endingBook.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
            <div>
              <div className="label">Diff (Ending − Book)</div>
              <div
                className={`text-xl font-semibold ${
                  totals.diffBankVsBook === 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {totals.diffBankVsBook.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
            <div>
              <div className="label">Outstanding Estimate (Book − Cleared)</div>
              <div className="text-xl font-semibold">
                {totals.outstandingEstimate.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-slate-50 rounded-t-lg">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Statement Lines</h2>
              <p className="text-sm">
                Add bank statement lines and mark cleared
              </p>
            </div>
          </div>
        </div>
        <div className="card-body space-y-4">
          <form
            onSubmit={importLines}
            className="grid grid-cols-1 md:grid-cols-6 gap-3"
          >
            <div className="md:col-span-3">
              <label className="label">Import Lines (CSV/XLSX)</label>
              <input
                className="input"
                type="file"
                accept=".csv,.xlsx"
                onChange={(e) => onFileChange(e.target.files?.[0] || null)}
              />
            </div>
            <div className="flex items-end">
              <button className="btn-secondary" disabled={importing}>
                {importing ? "Importing..." : "Import"}
              </button>
            </div>
            <div className="flex items-end gap-2">
              <button
                type="button"
                className="btn"
                onClick={() => downloadTemplate("csv")}
              >
                Download CSV Template
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => downloadTemplate("xlsx")}
              >
                Download XLSX Template
              </button>
            </div>
            <div className="md:col-span-6">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={advancedMapping}
                  onChange={(e) => setAdvancedMapping(e.target.checked)}
                />
                Advanced Mapping
              </label>
              {advancedMapping && (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-2">
                  <div>
                    <label className="label">Date Column</label>
                    <select
                      className="input"
                      value={mapping.date}
                      onChange={(e) =>
                        setMapping((p) => ({ ...p, date: e.target.value }))
                      }
                    >
                      <option value="">Auto</option>
                      {headerCandidates.map((h) => (
                        <option key={`date-${h}`} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Description Column</label>
                    <select
                      className="input"
                      value={mapping.description}
                      onChange={(e) =>
                        setMapping((p) => ({
                          ...p,
                          description: e.target.value,
                        }))
                      }
                    >
                      <option value="">Auto</option>
                      {headerCandidates.map((h) => (
                        <option key={`desc-${h}`} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Amount Column</label>
                    <select
                      className="input"
                      value={mapping.amount}
                      onChange={(e) =>
                        setMapping((p) => ({ ...p, amount: e.target.value }))
                      }
                    >
                      <option value="">Auto</option>
                      {headerCandidates.map((h) => (
                        <option key={`amt-${h}`} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Cleared Column</label>
                    <select
                      className="input"
                      value={mapping.cleared}
                      onChange={(e) =>
                        setMapping((p) => ({ ...p, cleared: e.target.value }))
                      }
                    >
                      <option value="">Auto</option>
                      {headerCandidates.map((h) => (
                        <option key={`clr-${h}`} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Voucher No. Column</label>
                    <select
                      className="input"
                      value={mapping.voucher_no}
                      onChange={(e) =>
                        setMapping((p) => ({
                          ...p,
                          voucher_no: e.target.value,
                        }))
                      }
                    >
                      <option value="">Auto</option>
                      {headerCandidates.map((h) => (
                        <option key={`vno-${h}`} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </form>

          <form
            onSubmit={addLine}
            className="grid grid-cols-1 md:grid-cols-6 gap-3"
          >
            <div>
              <label className="label">Voucher (optional)</label>
              <input
                className="input mb-2"
                placeholder="Search voucher no."
                value={voucherSearch}
                onChange={(e) => setVoucherSearch(e.target.value)}
              />
              <select
                className="input"
                value={newLine.voucherId}
                onChange={(e) =>
                  setNewLine((p) => ({ ...p, voucherId: e.target.value }))
                }
              >
                <option value="">None</option>
                {(voucherSearch
                  ? vouchers.filter((v) =>
                      String(v.voucher_no || "")
                        .toLowerCase()
                        .includes(voucherSearch.toLowerCase())
                    )
                  : vouchers
                )
                  .slice(0, 50)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.voucher_no} ({v.voucher_type_code}) -{" "}
                      {String(v.voucher_date).slice(0, 10)}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="label">Statement Date *</label>
              <input
                className="input"
                type="date"
                value={newLine.statementDate}
                onChange={(e) =>
                  setNewLine((p) => ({ ...p, statementDate: e.target.value }))
                }
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Description</label>
              <input
                className="input"
                value={newLine.description}
                onChange={(e) =>
                  setNewLine((p) => ({ ...p, description: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">Amount *</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={newLine.amount}
                onChange={(e) =>
                  setNewLine((p) => ({ ...p, amount: e.target.value }))
                }
                required
              />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newLine.cleared}
                  onChange={(e) =>
                    setNewLine((p) => ({ ...p, cleared: e.target.checked }))
                  }
                />
                Cleared
              </label>
            </div>
            <div className="flex items-end">
              <button className="btn-success">Add Line</button>
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Voucher</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th className="text-right">Amount</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const d = lineDraft[l.id] || {};
                  const isEdit = !!lineDraft[l.id];
                  return (
                    <tr key={l.id}>
                      <td className="font-medium">
                        {isEdit ? (
                          <input
                            className="input"
                            type="number"
                            min="0"
                            value={
                              d.voucher_id === undefined
                                ? l.voucher_id ?? ""
                                : d.voucher_id
                            }
                            onChange={(e) =>
                              setLineDraft((p) => ({
                                ...p,
                                [l.id]: {
                                  ...(p[l.id] || {}),
                                  voucher_id: e.target.value,
                                },
                              }))
                            }
                          />
                        ) : l.voucher_no ? (
                          `${l.voucher_no}`
                        ) : (
                          ""
                        )}
                      </td>
                      <td>
                        {isEdit ? (
                          <input
                            className="input"
                            type="date"
                            value={
                              d.statement_date === undefined
                                ? l.statement_date?.slice(0, 10)
                                : d.statement_date
                            }
                            onChange={(e) =>
                              setLineDraft((p) => ({
                                ...p,
                                [l.id]: {
                                  ...(p[l.id] || {}),
                                  statement_date: e.target.value,
                                },
                              }))
                            }
                          />
                        ) : (
                          String(l.statement_date).slice(0, 10)
                        )}
                      </td>
                      <td>
                        {isEdit ? (
                          <input
                            className="input"
                            value={
                              d.description === undefined
                                ? l.description ?? ""
                                : d.description
                            }
                            onChange={(e) =>
                              setLineDraft((p) => ({
                                ...p,
                                [l.id]: {
                                  ...(p[l.id] || {}),
                                  description: e.target.value,
                                },
                              }))
                            }
                          />
                        ) : (
                          l.description
                        )}
                      </td>
                      <td className="text-right">
                        {isEdit ? (
                          <input
                            className="input"
                            type="number"
                            step="0.01"
                            value={
                              d.amount === undefined ? l.amount ?? "" : d.amount
                            }
                            onChange={(e) =>
                              setLineDraft((p) => ({
                                ...p,
                                [l.id]: {
                                  ...(p[l.id] || {}),
                                  amount: e.target.value,
                                },
                              }))
                            }
                          />
                        ) : (
                          Number(l.amount || 0).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })
                        )}
                      </td>
                      <td>
                        {isEdit ? (
                          <select
                            className="input"
                            value={d.cleared ?? l.cleared ? "1" : "0"}
                            onChange={(e) =>
                              setLineDraft((p) => ({
                                ...p,
                                [l.id]: {
                                  ...(p[l.id] || {}),
                                  cleared: e.target.value === "1",
                                },
                              }))
                            }
                          >
                            <option value="1">Cleared</option>
                            <option value="0">Uncleared</option>
                          </select>
                        ) : l.cleared ? (
                          <span className="badge badge-success">Cleared</span>
                        ) : (
                          <span className="badge badge-error">Uncleared</span>
                        )}
                      </td>
                      <td className="text-right">
                        {!isEdit ? (
                          <div className="flex justify-end gap-2">
                            <button
                              className="btn btn-secondary"
                              onClick={() =>
                                setLineDraft((p) => ({
                                  ...p,
                                  [l.id]: {
                                    voucher_id: l.voucher_id,
                                    statement_date: String(
                                      l.statement_date
                                    ).slice(0, 10),
                                    description: l.description,
                                    amount: l.amount,
                                    cleared: !!l.cleared,
                                  },
                                }))
                              }
                            >
                              Edit
                            </button>
                            <button
                              className="btn"
                              onClick={() => deleteLine(l)}
                            >
                              Delete
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button
                              className="btn-success"
                              onClick={() => saveLine(l)}
                            >
                              Save
                            </button>
                            <button
                              className="btn"
                              onClick={() =>
                                setLineDraft((p) => {
                                  const n = { ...p };
                                  delete n[l.id];
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
                {lines.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-600">
                      No lines yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
