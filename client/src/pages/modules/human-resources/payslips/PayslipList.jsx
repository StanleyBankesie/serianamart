import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { toast } from "react-toastify";

export default function PayslipList() {
  const { canPerformAction } = usePermission();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [companyInfo, setCompanyInfo] = useState({
    name: "",
    address: "",
    logoUrl: "",
  });

  // Filters
  const [periods, setPeriods] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [branches, setBranches] = useState([]);
  const [filterPeriod, setFilterPeriod] = useState("");
  const [filterEmp, setFilterEmp] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterBranch, setFilterBranch] = useState("");

  const loadData = async () => {
    try {
      const [pRes, dRes, bRes] = await Promise.all([
        api.get("/hr/payroll/periods"),
        api.get("/admin/departments"),
        api.get("/admin/branches"),
      ]);
      setPeriods(pRes.data?.items || []);
      setDepartments(dRes.data?.items || []);
      setBranches(bRes.data?.items || []);
    } catch {}
  };

  const loadPayslips = async () => {
    setLoading(true);
    try {
      const params = {
        period_id: filterPeriod,
        employee_query: filterEmp,
        dept_id: filterDept,
        branch_id: filterBranch,
      };
      const res = await api.get("/hr/payslips", { params });
      setItems(res?.data?.items || []);
    } catch {
      toast.error("Failed to load payslips");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadPayslips();
  }, [filterPeriod, filterDept, filterBranch]);

  const sendBulkEmails = async () => {
    if (!items.length) return;
    if (!window.confirm(`Send emails to ${items.length} employees?`)) return;
    
    setSendingBulk(true);
    try {
      const ids = items.map(it => it.id);
      await api.post("/hr/payslips/send-email-bulk", { payslipIds: ids });
      toast.success("Bulk emails initiated");
    } catch (err) {
      toast.error("Failed to send bulk emails");
    } finally {
      setSendingBulk(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    async function loadCompany() {
      try {
        const meResp = await api.get("/admin/me");
        const companyId = meResp.data?.scope?.companyId;
        if (!companyId) return;
        const cResp = await api.get(`/admin/companies/${companyId}`);
        const item = cResp.data?.item || {};
        const logoUrl =
          item.has_logo === 1 || item.has_logo === true
            ? `/api/admin/companies/${companyId}/logo`
            : "";
        if (!mounted) return;
        setCompanyInfo({
          name: String(item.name || ""),
          address: String(item.address || ""),
          logoUrl: String(logoUrl || ""),
        });
      } catch {}
    }
    loadCompany();
    return () => {
      mounted = false;
    };
  }, []);

  const sendEmail = async (r) => {
    try {
      await api.post("/hr/payslips/send-email", { payslipId: r.id });
      toast.success(`Payslip sent to ${r.email}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send email");
    }
  };

  async function printPayslip(r) {
    try {
      const res = await api.post(`/documents/salary-slip/${r.id}/render`, {
        format: "html",
      });
      const html = res.data;
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
      const doc =
        iframe.contentWindow?.document || iframe.contentDocument || null;
      if (!doc) {
        document.body.removeChild(iframe);
        return;
      }
      doc.open();
      doc.write(html);
      doc.close();
      const win = iframe.contentWindow || window;
      const handlePrint = () => {
        win.focus();
        try {
          win.print();
        } catch {}
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 100);
      };
      setTimeout(handlePrint, 200);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to print payslip");
    }
  }

  async function downloadPayslipPdf(r) {
    try {
      const res = await api.post(
        `/documents/salary-slip/${r.id}/render?format=pdf`,
        {},
        { responseType: "blob" }
      );
      const blob = res.data;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const fname =
        "Payslip_" +
        (String(r.period_name || "")
          .replace(/\s+/g, "_") ||
          new Date().toISOString().slice(0, 10)) +
        "_" +
        (r.emp_code || r.id) +
        ".pdf";
      a.download = fname;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to download PDF");
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Payslips</h1>
          <p className="text-sm text-slate-500">View and manage employee salary slips</p>
        </div>
        <div className="flex gap-2">
          <Link to="/human-resources" className="btn-secondary">Back to Menu</Link>
          <button 
            onClick={sendBulkEmails} 
            disabled={sendingBulk || !items.length} 
            className="btn-primary"
          >
            {sendingBulk ? "Sending..." : "📧 Bulk Email"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap items-end gap-4">
        <div className="w-48">
          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Period</label>
          <select className="input h-9 text-sm" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
            <option value="">All Periods</option>
            {periods.map(p => <option key={p.id} value={p.id}>{p.period_name}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Search Employee</label>
          <input 
            className="input h-9 text-sm" 
            placeholder="Name or Code..." 
            value={filterEmp} 
            onChange={e => setFilterEmp(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && loadPayslips()}
          />
        </div>
        <div className="w-40">
          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Department</label>
          <select className="input h-9 text-sm" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
            <option value="">All</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.dept_name}</option>)}
          </select>
        </div>
        <div className="w-40">
          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Location</label>
          <select className="input h-9 text-sm" value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
            <option value="">All</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
          </select>
        </div>
        <button onClick={loadPayslips} className="btn-secondary h-9 px-4">Search</button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
            <tr className="bg-slate-50 dark:bg-slate-900/50 text-left border-b border-slate-200 dark:border-slate-700">
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Period</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Employee</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Dept/Location</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Net Pay</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {items.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <td className="px-4 py-3 text-sm">{r.period_name}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-sm">{r.first_name} {r.last_name}</div>
                  <div className="text-[10px] text-slate-500">{r.emp_code}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-xs">{r.dept_name || '-'}</div>
                  <div className="text-[10px] text-slate-400">{r.branch_name || '-'}</div>
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm font-bold text-brand">
                  {Number(r.net_salary || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    r.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => printPayslip(r)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors" title="Print">🖨️</button>
                    <button onClick={() => downloadPayslipPdf(r)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors" title="PDF">📄</button>
                    <button onClick={() => sendEmail(r)} className="p-1.5 hover:bg-brand/10 text-brand rounded transition-colors" title="Email">📧</button>
                  </div>
                </td>
              </tr>
            ))}
            {!items.length && !loading && (
              <tr><td colSpan={6} className="text-center py-12 text-slate-500 italic">No payslips found for the current selection.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}






