import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../../api/client.js";
import { useAuth } from "../../../../auth/AuthContext.jsx";

export default function PosDayManagement() {
  const { user, scope } = useAuth();
  function toLocalInputDateTime(value) {
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return "";
      const pad = (n) => String(n).padStart(2, "0");
      const yyyy = d.getFullYear();
      const mm = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      const hh = pad(d.getHours());
      const mi = pad(d.getMinutes());
      const ss = pad(d.getSeconds());
      return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
    } catch {
      return "";
    }
  }
  const [now, setNow] = useState(new Date());
  const [terminalId, setTerminalId] = useState("");
  const [terminalOptions, setTerminalOptions] = useState([]);
  const [terminalsLoading, setTerminalsLoading] = useState(false);
  const [supervisorUsers, setSupervisorUsers] = useState([]);
  const [sessionDetail, setSessionDetail] = useState({
    open: false,
    mode: "details",
    index: -1,
    item: null,
    actualCash: "",
    notes: "",
  });
  const userId = useMemo(() => Number(user?.sub || user?.id || 0), [user]);
  const cashierName = useMemo(() => {
    const name = user?.username || user?.name || user?.fullName || "Cashier";
    return String(name);
  }, [user]);
  const [dayOpen, setDayOpen] = useState(false);
  const [openData, setOpenData] = useState({
    dateTime: toLocalInputDateTime(new Date()),
    float: "",
    supervisor: "",
    notes: "",
  });
  const [openChecklist, setOpenChecklist] = useState(new Array(6).fill(false));
  const openProgress = useMemo(() => {
    const total = openChecklist.length || 1;
    const done = openChecklist.filter(Boolean).length;
    return Math.round((done / total) * 100);
  }, [openChecklist]);

  const [salesData, setSalesData] = useState({
    cash: { count: 0, amount: 0 },
    card: { count: 0, amount: 0 },
    mobile: { count: 0, amount: 0 },
  });
  const totals = useMemo(() => {
    const totalAmount =
      Number(salesData.cash.amount || 0) +
      Number(salesData.card.amount || 0) +
      Number(salesData.mobile.amount || 0);
    const totalCount =
      Number(salesData.cash.count || 0) +
      Number(salesData.card.count || 0) +
      Number(salesData.mobile.count || 0);
    return { totalAmount, totalCount };
  }, [salesData]);
  const expectedCash = useMemo(() => {
    return Number(openData.float || 0) + Number(salesData.cash.amount || 0);
  }, [openData.float, salesData.cash.amount]);
  const [closing, setClosing] = useState({
    dateTime: toLocalInputDateTime(new Date()),
    actualCash: "",
    notes: "",
  });
  const cashVariance = useMemo(() => {
    const v = Number(closing.actualCash || 0) - Number(expectedCash || 0);
    return v;
  }, [closing.actualCash, expectedCash]);

  const [timeline, setTimeline] = useState([
    { time: new Date(), title: "Waiting", description: "No activity yet" },
  ]);
  const [modal, setModal] = useState({
    open: false,
    title: "",
    icon: "",
    message: "",
  });
  const [sessionHistory, setSessionHistory] = useState([]);
  const currentSalesSummary = useMemo(() => {
    return {
      cashCount: Number(salesData.cash.count || 0),
      cashAmount: Number(salesData.cash.amount || 0),
      cardCount: Number(salesData.card.count || 0),
      cardAmount: Number(salesData.card.amount || 0),
      mobileCount: Number(salesData.mobile.count || 0),
      mobileAmount: Number(salesData.mobile.amount || 0),
    };
  }, [salesData]);
  const sessionModalItem = useMemo(() => {
    if (!sessionDetail.open) return null;
    if (
      sessionDetail.index >= 0 &&
      sessionDetail.index < sessionHistory.length
    ) {
      return sessionHistory[sessionDetail.index];
    }
    return sessionDetail.item;
  }, [
    sessionDetail.open,
    sessionDetail.index,
    sessionDetail.item,
    sessionHistory,
  ]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const uname = String(user?.username || "").trim();
    if (uname && !openData.supervisor) {
      setOpenData((prev) => ({ ...prev, supervisor: uname }));
    }
  }, [user?.username]);

  useEffect(() => {
    let cancelled = false;
    async function loadTerminals() {
      if (!userId) return;
      setTerminalsLoading(true);
      try {
        const [termsRes, linksRes] = await Promise.all([
          api.get("/pos/terminals"),
          api.get("/pos/terminal-users"),
        ]);
        if (cancelled) return;

        const allTerminals = Array.isArray(termsRes.data?.items)
          ? termsRes.data.items
          : [];
        const links = Array.isArray(linksRes.data?.items)
          ? linksRes.data.items
          : [];
        const assignedTerminalIds = new Set(
          links
            .filter((x) => Number(x?.user_id) === Number(userId))
            .map((x) => Number(x?.terminal_id))
            .filter((n) => Number.isFinite(n) && n > 0),
        );
        const assigned = allTerminals.filter((t) =>
          assignedTerminalIds.has(Number(t?.id)),
        );
        setTerminalOptions(assigned);

        const currentOk = assigned.some(
          (t) => String(t?.code || "") === String(terminalId || ""),
        );
        const nextCode = currentOk ? terminalId : assigned[0]?.code || "";
        if (nextCode) {
          setTerminalId(String(nextCode));
        } else {
          setTerminalId("");
        }
      } catch {
        if (cancelled) return;
        setTerminalOptions([]);
        setTerminalId("");
      } finally {
        if (!cancelled) setTerminalsLoading(false);
      }
    }
    loadTerminals();
    return () => {
      cancelled = true;
    };
  }, [userId, cashierName]);

  useEffect(() => {
    let cancelled = false;
    async function loadSupervisors() {
      try {
        const companyId = Number(scope?.companyId || 0) || undefined;
        const branchId = Number(scope?.branchId || 0) || undefined;
        const res = await api.get("/admin/users", {
          params: {
            ...(companyId ? { company_id: companyId } : {}),
            ...(branchId ? { branch_id: branchId } : {}),
            active: 1,
            limit: 100,
          },
        });
        if (cancelled) return;
        setSupervisorUsers(
          Array.isArray(res.data?.items) ? res.data.items : [],
        );
      } catch {
        if (cancelled) return;
        setSupervisorUsers([]);
      }
    }
    loadSupervisors();
    return () => {
      cancelled = true;
    };
  }, [scope?.companyId, scope?.branchId]);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/pos/analytics/day-summary")
      .then((res) => {
        if (cancelled) return;
        const s = res?.data?.summary || {};
        const next = {
          cash: {
            count: Number(s.cashCount || 0),
            amount: Number(s.cashAmount || 0),
          },
          card: {
            count: Number(s.cardCount || 0),
            amount: Number(s.cardAmount || 0),
          },
          mobile: {
            count: Number(s.mobileCount || 0),
            amount: Number(s.mobileAmount || 0),
          },
        };
        setSalesData(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const term = terminalId;
    if (!term) return undefined;
    api
      .get("/pos/day/status", { params: { terminal: term } })
      .then((res) => {
        if (cancelled) return;
        const item = res?.data?.item;
        if (!item) {
          setDayOpen(false);
          setSessionHistory([]);
          return;
        }
        const isOpen = String(item.status || "").toUpperCase() === "OPEN";
        setDayOpen(isOpen);
        setOpenData({
          dateTime: toLocalInputDateTime(item.open_datetime || ""),
          float:
            item.opening_float === null || item.opening_float === undefined
              ? ""
              : String(item.opening_float),
          supervisor: item.supervisor_name || "",
          notes: item.open_notes || "",
        });
        setClosing((prev) => ({
          ...prev,
          dateTime: toLocalInputDateTime(item.close_datetime || ""),
          actualCash:
            item.actual_cash === null || item.actual_cash === undefined
              ? ""
              : String(item.actual_cash),
          notes: item.close_notes || "",
        }));
        const row = {
          dayStatusId: Number(item.id || 0) || null,
          no: `DAY-${String(item.id || "").padStart(6, "0")}`,
          terminal: String(item.terminal_code || term || ""),
          cashier: cashierName,
          start: item.open_datetime
            ? new Date(item.open_datetime).toLocaleString()
            : "-",
          startTime: item.open_datetime || null,
          end: item.close_datetime
            ? new Date(item.close_datetime).toLocaleString()
            : "-",
          endTime: item.close_datetime || null,
          opening: Number(item.opening_float || 0),
          status: isOpen ? "Open" : "Closed",
          startSummary: normalizeDaySummary({}),
          endSummary: isOpen ? null : currentSalesSummary,
          expectedCash: null,
          actualCash:
            item.actual_cash === null || item.actual_cash === undefined
              ? null
              : Number(item.actual_cash || 0),
          cashVariance: null,
          closeNotes: item.close_notes || "",
        };
        if (!isOpen && row.actualCash !== null) {
          const expectedAtClose =
            Number(row.opening || 0) +
            Number(currentSalesSummary.cashAmount || 0);
          row.expectedCash = expectedAtClose;
          row.cashVariance = Number(row.actualCash || 0) - expectedAtClose;
        }
        setSessionHistory([row]);
        addToTimeline(
          isOpen ? "Day Status" : "Last Day Status",
          isOpen ? "Day is currently open" : "Last day is closed",
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [terminalId]);

  function addToTimeline(title, description) {
    const item = { time: new Date(), title, description };
    setTimeline((prev) => {
      const first =
        prev.length === 1 && String(prev[0]?.title).includes("Waiting");
      const base = first ? [] : prev.slice();
      return [item, ...base].slice(0, 50);
    });
  }

  function showSuccessModal(title, icon, message) {
    setModal({ open: true, title, icon, message });
  }
  function closeModal() {
    setModal((prev) => ({ ...prev, open: false }));
  }

  function handleOpenChecklistToggle(index) {
    setOpenChecklist((prev) => {
      const next = prev.slice();
      next[index] = !next[index];
      const label = [
        "Verify cash float count",
        "Check POS system connectivity",
        "Verify printer and receipt paper",
        "Test card payment terminal",
        "Review pending transactions",
        "Confirm inventory sync",
      ][index];
      addToTimeline(
        next[index] ? "Checklist Completed" : "Checklist Unchecked",
        label,
      );
      return next;
    });
  }

  async function handleOpenSubmit(e) {
    e.preventDefault();
    const allChecked = openChecklist.every(Boolean);
    if (!allChecked) {
      toast.warn("Complete all opening checklist items");
      return;
    }
    if (!openData.dateTime || !openData.supervisor) {
      toast.warn("Provide opening date/time and supervisor");
      return;
    }
    try {
      const payload = {
        terminal: terminalId,
        openingDateTime: openData.dateTime,
        openingFloat: Number(openData.float || 0),
        supervisor: openData.supervisor,
        notes: openData.notes,
      };
      const res = await api.post("/pos/day/open", payload);
      const item = res?.data?.item;
      if (item) {
        setDayOpen(String(item.status || "").toUpperCase() === "OPEN");
        setOpenData({
          dateTime:
            toLocalInputDateTime(item.open_datetime || "") || openData.dateTime,
          float:
            item.opening_float === null || item.opening_float === undefined
              ? String(openData.float || "")
              : String(item.opening_float),
          supervisor: item.supervisor_name || openData.supervisor,
          notes: item.open_notes || openData.notes,
        });
        setSessionHistory([
          {
            dayStatusId: Number(item.id || 0) || null,
            no: `DAY-${String(item.id || "").padStart(6, "0")}`,
            terminal: String(item.terminal_code || terminalId || ""),
            cashier: cashierName,
            start: item.open_datetime
              ? new Date(item.open_datetime).toLocaleString()
              : new Date(openData.dateTime).toLocaleString(),
            startTime: item.open_datetime || openData.dateTime,
            end: "-",
            endTime: null,
            opening: Number(item.opening_float ?? openData.float ?? 0),
            status: "Open",
            startSummary: normalizeDaySummary({}),
            endSummary: null,
            expectedCash: null,
            actualCash: null,
            cashVariance: null,
            closeNotes: "",
          },
        ]);
      } else {
        setDayOpen(true);
      }
      showSuccessModal(
        "Day Opened",
        "🌅",
        "Day is open. Complete transactions and close day when finished.",
      );
      addToTimeline("Day Opened", "Operations started");
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Failed to open day";
      toast.error(message);
    }
  }

  async function handleCloseSubmit(e) {
    e.preventDefault();
    if (!dayOpen) {
      toast.error("Open the day first");
      return;
    }
    if (!closing.dateTime) {
      toast.warn("Provide closing date/time");
      return;
    }
    try {
      const payload = {
        terminal: terminalId,
        closingDateTime: closing.dateTime,
        actualCash: Number(closing.actualCash || 0),
        notes: closing.notes,
      };
      const res = await api.post("/pos/day/close", payload);
      const item = res?.data?.item;
      if (item) {
        setClosing((prev) => ({
          ...prev,
          dateTime:
            toLocalInputDateTime(item.close_datetime || "") ||
            closing.dateTime,
          actualCash:
            item.actual_cash === null || item.actual_cash === undefined
              ? String(closing.actualCash || "")
              : String(item.actual_cash),
          notes: item.close_notes || closing.notes,
        }));
        setDayOpen(
          String(item.status || "").toUpperCase() === "OPEN" ? true : false,
        );
        let endSummary = currentSalesSummary;
        try {
          const sRes = await api.get("/pos/analytics/day-summary");
          endSummary = normalizeDaySummary(sRes?.data?.summary || {});
        } catch {}
        setSessionHistory((prev) => {
          const base = Array.isArray(prev) && prev.length ? prev[0] : {};
          const opening = Number(
            base.opening ?? openData.float ?? item.opening_float ?? 0,
          );
          const expectedAtClose = opening + Number(endSummary.cashAmount || 0);
          const actualCash = Number(
            item.actual_cash ?? closing.actualCash ?? 0,
          );
          const updated = {
            ...base,
            dayStatusId: Number(item.id || base.dayStatusId || 0) || null,
            no: base.no || `DAY-${String(item.id || "").padStart(6, "0")}`,
            terminal: String(
              item.terminal_code || terminalId || base.terminal || "",
            ),
            cashier: cashierName,
            start:
              base.start ||
              (openData.dateTime
                ? new Date(openData.dateTime).toLocaleString()
                : "-"),
            startTime: base.startTime || openData.dateTime || null,
            end: item.close_datetime
              ? new Date(item.close_datetime).toLocaleString()
              : new Date(closing.dateTime).toLocaleString(),
            endTime: item.close_datetime || closing.dateTime,
            opening,
            status: "Closed",
            startSummary: base.startSummary || normalizeDaySummary({}),
            endSummary,
            expectedCash: expectedAtClose,
            actualCash,
            cashVariance: actualCash - expectedAtClose,
            closeNotes: item.close_notes || closing.notes || "",
          };
          return [updated];
        });
      } else {
        setDayOpen(false);
      }
      showSuccessModal(
        "Day Closed",
        "🌙",
        "End-of-day reconciliation complete. See report summary below.",
      );
      addToTimeline("Day Closed", "Operations ended");
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Failed to close day";
      toast.error(message);
    }
  }

  function fmtCurrency(n) {
    return `₵${Number(n || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  function normalizeDaySummary(summary) {
    const s = summary || {};
    return {
      cashCount: Number(s.cashCount || 0),
      cashAmount: Number(s.cashAmount || 0),
      cardCount: Number(s.cardCount || 0),
      cardAmount: Number(s.cardAmount || 0),
      mobileCount: Number(s.mobileCount || 0),
      mobileAmount: Number(s.mobileAmount || 0),
    };
  }
  function diffDaySummary(endSummary, startSummary) {
    const end = normalizeDaySummary(endSummary);
    const start = normalizeDaySummary(startSummary);
    const diff = (a, b) => Math.max(0, Number(a || 0) - Number(b || 0));
    return {
      cashCount: diff(end.cashCount, start.cashCount),
      cashAmount: diff(end.cashAmount, start.cashAmount),
      cardCount: diff(end.cardCount, start.cardCount),
      cardAmount: diff(end.cardAmount, start.cardAmount),
      mobileCount: diff(end.mobileCount, start.mobileCount),
      mobileAmount: diff(end.mobileAmount, start.mobileAmount),
    };
  }
  function sessionSalesTotals(session) {
    const hasStartSummary =
      session?.startSummary !== null && session?.startSummary !== undefined;
    const end = session?.endSummary || currentSalesSummary;
    const d = hasStartSummary
      ? diffDaySummary(end, session?.startSummary || null)
      : {
          cashCount: 0,
          cashAmount: 0,
          cardCount: 0,
          cardAmount: 0,
          mobileCount: 0,
          mobileAmount: 0,
        };
    const totalCount =
      Number(d.cashCount || 0) +
      Number(d.cardCount || 0) +
      Number(d.mobileCount || 0);
    const computedTotalAmount =
      Number(d.cashAmount || 0) +
      Number(d.cardAmount || 0) +
      Number(d.mobileAmount || 0);
    const totalAmount = hasStartSummary
      ? computedTotalAmount
      : Number(session?.sales || 0);
    const expectedCashAtClose =
      session?.status === "Closed" &&
      session?.expectedCash !== null &&
      session?.expectedCash !== undefined
        ? Number(session.expectedCash || 0)
        : Number(session?.opening || 0) + Number(d.cashAmount || 0);
    const actualCashAtClose =
      session?.status === "Closed" &&
      session?.actualCash !== null &&
      session?.actualCash !== undefined
        ? Number(session.actualCash || 0)
        : session?.actualCash === null || session?.actualCash === undefined
          ? null
          : Number(session.actualCash || 0);
    const cashVarianceAtClose =
      session?.status === "Closed" &&
      session?.cashVariance !== null &&
      session?.cashVariance !== undefined
        ? Number(session.cashVariance || 0)
        : actualCashAtClose === null
          ? null
          : actualCashAtClose - expectedCashAtClose;
    return {
      diff: d,
      totalCount,
      totalAmount,
      expectedCashAtClose,
      actualCashAtClose,
      cashVarianceAtClose,
    };
  }
  function fmtTime(d) {
    try {
      return new Date(d).toLocaleTimeString();
    } catch {
      return "--:--";
    }
  }
  function fmtDate(d) {
    try {
      return new Date(d).toLocaleDateString();
    } catch {
      return "";
    }
  }

  function handlePrint() {
    const totalSales = totals.totalAmount;
    const totalTxn = totals.totalCount;
    const w = window.open("", "_blank");
    if (!w) return;
    const dateStr = now.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>POS End of Day Report</title>
        <style>
          body { font-family: 'Courier New', monospace; padding: 20px; max-width: 700px; margin: 0 auto; }
          h1 { text-align: center; border-bottom: 2px solid #0E3646; padding-bottom: 10px; color: #0E3646; }
          .row { display: flex; justify-content: space-between; margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #0E3646; color: white; }
          .totals { background: #f0f0f0; font-weight: bold; }
          .footer { margin-top: 20px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <h1>END OF DAY REPORT</h1>
        <div class="row"><strong>Terminal:</strong><span>${terminalId}</span></div>
        <div class="row"><strong>Cashier:</strong><span>${cashierName}</span></div>
        <div class="row"><strong>Date:</strong><span>${dateStr}</span></div>
        <div class="row"><strong>Opening Float:</strong><span>${fmtCurrency(
          openData.float,
        )}</span></div>
        <table>
          <thead>
            <tr><th>Payment Method</th><th>Transactions</th><th>Amount Received</th></tr>
          </thead>
          <tbody>
            <tr><td>Cash</td><td>${salesData.cash.count}</td><td>${fmtCurrency(
              salesData.cash.amount,
            )}</td></tr>
            <tr><td>Card</td><td>${salesData.card.count}</td><td>${fmtCurrency(
              salesData.card.amount,
            )}</td></tr>
            <tr><td>Mobile Money</td><td>${
              salesData.mobile.count
            }</td><td>${fmtCurrency(salesData.mobile.amount)}</td></tr>
            <tr class="totals"><td><strong>TOTAL</strong></td><td><strong>${totalTxn}</strong></td><td><strong>${fmtCurrency(
              totalSales,
            )}</strong></td></tr>
          </tbody>
        </table>
        <div class="footer">
          <div class="row"><strong>Expected Cash:</strong><span>${fmtCurrency(
            expectedCash,
          )}</span></div>
          <div class="row"><strong>Actual Cash Count:</strong><span>${fmtCurrency(
            closing.actualCash || 0,
          )}</span></div>
          <div class="row"><strong>Variance:</strong><span>${fmtCurrency(
            cashVariance,
          )}</span></div>
        </div>
        <button onclick="window.print()">Print</button>
      </body>
      </html>
    `;
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/pos"
            className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to POS
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            POS Day Management
          </h1>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Open and close POS business day with reconciliation
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-slate-700 dark:text-slate-300">
            {now.toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
          <div className="text-sm font-semibold text-brand-700 dark:text-brand-300">
            {now.toLocaleTimeString()}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-slate-500 text-sm">Terminal</div>
            <div className="space-y-1">
              <select
                className="input py-1 px-2 text-sm"
                value={terminalId}
                onChange={(e) => setTerminalId(e.target.value)}
                disabled={terminalsLoading || !terminalOptions.length}
              >
                {!terminalOptions.length && (
                  <option value="">
                    {terminalsLoading ? "Loading..." : "No terminals assigned"}
                  </option>
                )}
                {terminalOptions.map((t) => (
                  <option key={t.id} value={String(t.code || "")}>
                    {String(t.code || "")}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-slate-500 text-sm">Cashier</div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              {cashierName}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-slate-500 text-sm">Date</div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              {now.toLocaleDateString()}
            </div>
          </div>
          <div>
            <span className={dayOpen ? "badge-success" : "badge-danger"}>
              {dayOpen ? "OPEN" : "CLOSED"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Open Day</div>
            <div className="text-2xl">🌅</div>
          </div>
          <div className="card-body">
            {!dayOpen && (
              <form onSubmit={handleOpenSubmit} className="space-y-4">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm">
                  <div className="font-semibold text-blue-900 mb-1">
                    Day Opening Procedure
                  </div>
                  <div className="text-blue-800">
                    Complete the checklist and verify opening float before
                    starting operations.
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Opening Date & Time</label>
                    <input
                      type="datetime-local"
                      className="input"
                      value={openData.dateTime}
                      onChange={(e) =>
                        setOpenData((p) => ({ ...p, dateTime: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Opening Float (₵)</label>
                    <input
                      type="number"
                      className="input"
                      step="1"
                      value={openData.float}
                      onChange={(e) =>
                        setOpenData((p) => ({
                          ...p,
                          float: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Supervisor Name</label>
                    <select
                      className="input"
                      value={openData.supervisor}
                      onChange={(e) =>
                        setOpenData((p) => ({
                          ...p,
                          supervisor: e.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Select supervisor</option>
                      {openData.supervisor &&
                        !supervisorUsers.some(
                          (u) =>
                            String(u?.username || "") ===
                            String(openData.supervisor),
                        ) && (
                          <option value={openData.supervisor}>
                            {openData.supervisor}
                          </option>
                        )}
                      {supervisorUsers.map((u) => (
                        <option key={u.id} value={String(u.username || "")}>
                          {String(u.username || "")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Notes</label>
                    <textarea
                      className="input"
                      rows={3}
                      value={openData.notes}
                      onChange={(e) =>
                        setOpenData((p) => ({ ...p, notes: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-slate-700">
                      Opening Checklist
                    </div>
                    <div className="font-semibold text-brand-700">
                      {openProgress}%
                    </div>
                  </div>
                  <div className="w-full h-3 bg-slate-200 rounded">
                    <div
                      className="h-3 rounded bg-gradient-to-r from-brand-700 to-brand-500"
                      style={{ width: `${openProgress}%` }}
                    />
                  </div>
                  <ul className="mt-3 space-y-2">
                    {[
                      "Verify cash float count",
                      "Check POS system connectivity",
                      "Verify printer and receipt paper",
                      "Test card payment terminal",
                      "Review pending transactions",
                      "Confirm inventory sync",
                    ].map((label, idx) => (
                      <li
                        key={idx}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          openChecklist[idx]
                            ? "bg-green-50 border-green-200"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={openChecklist[idx]}
                          onChange={() => handleOpenChecklistToggle(idx)}
                        />
                        <div
                          className={`text-sm ${
                            openChecklist[idx] ? "line-through" : ""
                          }`}
                        >
                          {label}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <button type="submit" className="btn-success w-full">
                  🌅 Open Day
                </button>
              </form>
            )}
            {dayOpen && (
              <div className="space-y-4">
                <div className="alert-success rounded-lg p-4 flex items-center gap-2">
                  <span>✓</span>
                  <div>
                    Day is currently open. Complete transactions and close day
                    when finished.
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="text-xs text-slate-600">Opened At</div>
                    <div className="font-semibold">
                      {fmtTime(openData.dateTime)}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="text-xs text-slate-600">Opening Float</div>
                    <div className="font-bold">
                      {fmtCurrency(openData.float)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Close Day</div>
            <div className="text-2xl">🌙</div>
          </div>
          <div className="card-body">
            <form onSubmit={handleCloseSubmit} className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm">
                <div className="font-semibold text-blue-900 mb-1">
                  Day Closing Procedure
                </div>
                <div className="text-blue-800">
                  Complete end-of-day reconciliation and verify all transactions
                  before closing.
                </div>
              </div>
              <div>
                <label className="label">Closing Date & Time</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={closing.dateTime}
                  onChange={(e) =>
                    setClosing((p) => ({ ...p, dateTime: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="text-xs text-slate-600">Total Sales</div>
                  <div className="font-bold">
                    {fmtCurrency(totals.totalAmount)}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="text-xs text-slate-600">Transactions</div>
                  <div className="font-semibold">{totals.totalCount}</div>
                </div>
              </div>

              <div>
                <label className="label">Actual Cash Count (₵)</label>
                <input
                  type="number"
                  className="input"
                  step="1"
                  value={closing.actualCash}
                  onChange={(e) =>
                    setClosing((p) => ({
                      ...p,
                      actualCash: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Expected Cash</label>
                  <input
                    type="text"
                    className="input"
                    disabled
                    value={fmtCurrency(expectedCash)}
                  />
                </div>
                <div>
                  <label className="label">Cash Variance</label>
                  <input
                    type="text"
                    className="input"
                    disabled
                    value={fmtCurrency(cashVariance)}
                    style={{
                      color: cashVariance >= 0 ? "#28a745" : "#dc3545",
                      fontWeight: 700,
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="label">Closing Notes</label>
                <textarea
                  className="input"
                  rows={3}
                  value={closing.notes}
                  onChange={(e) =>
                    setClosing((p) => ({ ...p, notes: e.target.value }))
                  }
                />
              </div>

              <div className="rounded-lg border border-slate-200">
                <div className="p-3 font-semibold">Sales Report</div>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Payment Method</th>
                        <th>Transactions</th>
                        <th>Amount Received</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Cash</td>
                        <td>{salesData.cash.count}</td>
                        <td>{fmtCurrency(salesData.cash.amount)}</td>
                      </tr>
                      <tr>
                        <td>Card</td>
                        <td>{salesData.card.count}</td>
                        <td>{fmtCurrency(salesData.card.amount)}</td>
                      </tr>
                      <tr>
                        <td>Mobile Money</td>
                        <td>{salesData.mobile.count}</td>
                        <td>{fmtCurrency(salesData.mobile.amount)}</td>
                      </tr>
                      <tr className="bg-blue-50 font-semibold">
                        <td>TOTAL</td>
                        <td>{totals.totalCount}</td>
                        <td>{fmtCurrency(totals.totalAmount)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-2">
                <button type="submit" className="btn-danger flex-1">
                  🌙 Close Day
                </button>
                <button
                  type="button"
                  className="btn-info flex-1"
                  onClick={handlePrint}
                >
                  🖨️ Print Report
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Activity Timeline</div>
          <div className="text-2xl">🕘</div>
        </div>
        <div className="card-body">
          <div className="space-y-3">
            {timeline.map((t, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50"
              >
                <div className="text-sm font-semibold text-brand-700">
                  {new Date(t.time).toLocaleTimeString()} - {t.title}
                </div>
                <div className="text-sm">{t.description}</div>
              </div>
            ))}
            {!timeline.length && (
              <div className="text-sm text-slate-500">No activity yet</div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Sessions/Shifts</div>
          <div className="text-2xl">📊</div>
        </div>
        <div className="card-body space-y-4">
          <div>
            <div className="text-lg font-semibold text-slate-900 mb-2">
              Session History
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full">
                <thead className="bg-slate-800 text-white">
                  <tr>
                    <th className="text-left p-2 text-xs uppercase">
                      Session #
                    </th>
                    <th className="text-left p-2 text-xs uppercase">
                      Terminal
                    </th>
                    <th className="text-left p-2 text-xs uppercase">Cashier</th>
                    <th className="text-left p-2 text-xs uppercase">
                      Start Time
                    </th>
                    <th className="text-left p-2 text-xs uppercase">
                      End Time
                    </th>
                    <th className="text-left p-2 text-xs uppercase">
                      Opening Cash
                    </th>
                    <th className="text-left p-2 text-xs uppercase">
                      Total Sales
                    </th>
                    <th className="text-left p-2 text-xs uppercase">Status</th>
                    <th className="text-left p-2 text-xs uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {sessionHistory.map((h, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2">{h.no}</td>
                      <td className="p-2">{h.terminal}</td>
                      <td className="p-2">{h.cashier}</td>
                      <td className="p-2">{h.start}</td>
                      <td className="p-2">{h.end}</td>
                      <td className="p-2">
                        {Number(h.opening).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-2">
                        {Number(h.sales).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            h.status === "Open"
                              ? "bg-blue-100 text-blue-700"
                              : h.status === "Closed"
                                ? "bg-green-100 text-green-700"
                                : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {h.status}
                        </span>
                      </td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn btn-info"
                            onClick={() =>
                              setSessionDetail({
                                open: true,
                                mode: "details",
                                index: idx,
                                item: h,
                                actualCash: "",
                                notes: "",
                              })
                            }
                          >
                            Details
                          </button>
                          {h.status === "Open" ? (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => {
                                setSessionDetail({
                                  open: true,
                                  mode: "close",
                                  index: idx,
                                  item: h,
                                  actualCash: "",
                                  notes: "",
                                });
                              }}
                            >
                              Close
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-info"
                              disabled
                            >
                              Closed
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {sessionDetail.open && sessionModalItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-xl bg-white dark:bg-slate-800 shadow-lg w-full max-w-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {sessionDetail.mode === "close"
                  ? `Close ${sessionModalItem.no}`
                  : `Session ${sessionModalItem.no}`}
              </div>
              <button
                type="button"
                className="btn btn-sm btn-link"
                onClick={() =>
                  setSessionDetail({
                    open: false,
                    mode: "details",
                    index: -1,
                    item: null,
                    actualCash: "",
                    notes: "",
                  })
                }
              >
                ✖
              </button>
            </div>

            {(() => {
              const s = sessionModalItem;
              const t = sessionSalesTotals(s);
              const startLabel =
                s.start ||
                (s.startTime ? new Date(s.startTime).toLocaleString() : "-");
              const endLabel =
                s.end && s.end !== "-"
                  ? s.end
                  : s.endTime
                    ? new Date(s.endTime).toLocaleString()
                    : "-";
              const showVariance = t.cashVarianceAtClose !== null;

              if (sessionDetail.mode === "close") {
                return (
                  <div className="max-h-[70vh] overflow-y-auto p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                        <div className="text-xs text-slate-600">Terminal</div>
                        <div className="font-semibold">{s.terminal}</div>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                        <div className="text-xs text-slate-600">Cashier</div>
                        <div className="font-semibold">{s.cashier}</div>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                        <div className="text-xs text-slate-600">Start Time</div>
                        <div className="font-semibold">{startLabel}</div>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                        <div className="text-xs text-slate-600">
                          Expected Cash
                        </div>
                        <div className="font-bold">
                          {fmtCurrency(t.expectedCashAtClose)}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                      <div className="p-3 font-semibold bg-slate-50">
                        Sales (Since Session Start)
                      </div>
                      <div className="overflow-x-auto">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Payment Method</th>
                              <th>Transactions</th>
                              <th>Amount Received</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>Cash</td>
                              <td>{t.diff.cashCount}</td>
                              <td>{fmtCurrency(t.diff.cashAmount)}</td>
                            </tr>
                            <tr>
                              <td>Card</td>
                              <td>{t.diff.cardCount}</td>
                              <td>{fmtCurrency(t.diff.cardAmount)}</td>
                            </tr>
                            <tr>
                              <td>Mobile Money</td>
                              <td>{t.diff.mobileCount}</td>
                              <td>{fmtCurrency(t.diff.mobileAmount)}</td>
                            </tr>
                            <tr className="bg-blue-50 font-semibold">
                              <td>TOTAL</td>
                              <td>{t.totalCount}</td>
                              <td>{fmtCurrency(t.totalAmount)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Actual Cash Count (₵)</label>
                        <input
                          type="number"
                          className="input"
                          step="1"
                          value={sessionDetail.actualCash}
                          onChange={(e) =>
                            setSessionDetail((p) => ({
                              ...p,
                              actualCash: e.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="label">Closing Notes</label>
                        <textarea
                          className="input"
                          rows={3}
                          value={sessionDetail.notes}
                          onChange={(e) =>
                            setSessionDetail((p) => ({
                              ...p,
                              notes: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          setSessionDetail({
                            open: false,
                            mode: "details",
                            index: -1,
                            item: null,
                            actualCash: "",
                            notes: "",
                          })
                        }
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={async () => {
                          const idx = sessionDetail.index;
                          if (idx < 0 || idx >= sessionHistory.length) return;
                          if (
                            String(sessionDetail.actualCash || "").trim() === ""
                          ) {
                            toast.warn("Provide actual cash count");
                            return;
                          }
                          let endSummary = currentSalesSummary;
                          try {
                            const res = await api.get(
                              "/pos/analytics/day-summary",
                            );
                            endSummary = normalizeDaySummary(
                              res?.data?.summary || {},
                            );
                          } catch {}

                          const endAt = new Date();
                          const actualCash = Number(
                            sessionDetail.actualCash || 0,
                          );

                          setSessionHistory((prev) =>
                            prev.map((row, i) => {
                              if (i !== idx) return row;
                              const d = diffDaySummary(
                                endSummary,
                                row?.startSummary || null,
                              );
                              const totalSales =
                                Number(d.cashAmount || 0) +
                                Number(d.cardAmount || 0) +
                                Number(d.mobileAmount || 0);
                              const expectedCashAtClose =
                                Number(row?.opening || 0) +
                                Number(d.cashAmount || 0);
                              const variance = actualCash - expectedCashAtClose;
                              return {
                                ...row,
                                end: endAt.toLocaleString(),
                                endTime: endAt.toISOString(),
                                status: "Closed",
                                sales: totalSales,
                                endSummary,
                                expectedCash: expectedCashAtClose,
                                actualCash,
                                cashVariance: variance,
                                closeNotes: sessionDetail.notes || "",
                              };
                            }),
                          );

                          addToTimeline(
                            "Session Closed",
                            `${sessionModalItem.cashier} on ${sessionModalItem.terminal}`,
                          );
                          setSessionDetail({
                            open: false,
                            mode: "details",
                            index: -1,
                            item: null,
                            actualCash: "",
                            notes: "",
                          });
                        }}
                      >
                        Close Session
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div className="max-h-[70vh] overflow-y-auto p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="text-xs text-slate-600">Terminal</div>
                      <div className="font-semibold">{s.terminal}</div>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="text-xs text-slate-600">Cashier</div>
                      <div className="font-semibold">{s.cashier}</div>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="text-xs text-slate-600">Status</div>
                      <div className="font-semibold">{s.status}</div>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="text-xs text-slate-600">Start Time</div>
                      <div className="font-semibold">{startLabel}</div>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="text-xs text-slate-600">End Time</div>
                      <div className="font-semibold">{endLabel}</div>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="text-xs text-slate-600">Opening Cash</div>
                      <div className="font-bold">{fmtCurrency(s.opening)}</div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className="p-3 font-semibold bg-slate-50">
                      Sales Breakdown
                    </div>
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Payment Method</th>
                            <th>Transactions</th>
                            <th>Amount Received</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>Cash</td>
                            <td>{t.diff.cashCount}</td>
                            <td>{fmtCurrency(t.diff.cashAmount)}</td>
                          </tr>
                          <tr>
                            <td>Card</td>
                            <td>{t.diff.cardCount}</td>
                            <td>{fmtCurrency(t.diff.cardAmount)}</td>
                          </tr>
                          <tr>
                            <td>Mobile Money</td>
                            <td>{t.diff.mobileCount}</td>
                            <td>{fmtCurrency(t.diff.mobileAmount)}</td>
                          </tr>
                          <tr className="bg-blue-50 font-semibold">
                            <td>TOTAL</td>
                            <td>{t.totalCount}</td>
                            <td>{fmtCurrency(t.totalAmount)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className="p-3 font-semibold bg-slate-50">
                      Cash Reconciliation
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
                      <div className="p-3 rounded-lg border border-slate-200 bg-white">
                        <div className="text-xs text-slate-600">
                          Expected Cash
                        </div>
                        <div className="font-bold">
                          {fmtCurrency(t.expectedCashAtClose)}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200 bg-white">
                        <div className="text-xs text-slate-600">
                          Actual Cash
                        </div>
                        <div className="font-bold">
                          {t.actualCashAtClose === null
                            ? "-"
                            : fmtCurrency(t.actualCashAtClose)}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200 bg-white">
                        <div className="text-xs text-slate-600">Variance</div>
                        <div
                          className="font-bold"
                          style={{
                            color:
                              t.cashVarianceAtClose === null
                                ? undefined
                                : t.cashVarianceAtClose >= 0
                                  ? "#28a745"
                                  : "#dc3545",
                          }}
                        >
                          {showVariance
                            ? fmtCurrency(t.cashVarianceAtClose)
                            : "-"}
                        </div>
                      </div>
                    </div>
                    {(s.closeNotes || sessionModalItem?.closeNotes) && (
                      <div className="px-4 pb-4 text-sm text-slate-700">
                        {s.closeNotes || sessionModalItem?.closeNotes}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() =>
                        setSessionDetail({
                          open: false,
                          mode: "details",
                          index: -1,
                          item: null,
                          actualCash: "",
                          notes: "",
                        })
                      }
                    >
                      Close
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {modal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-xl bg-white dark:bg-slate-800 shadow-lg w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {modal.title}
              </div>
              <button
                type="button"
                className="btn btn-sm btn-link"
                onClick={closeModal}
              >
                ✖
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-center text-6xl">{modal.icon}</div>
              <div className="text-center">{modal.message}</div>
              <div className="flex gap-2 justify-center">
                <Link to="/pos" className="btn-secondary">
                  Return to POS
                </Link>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={closeModal}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
