import React, { useState, useEffect } from 'react';
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";
import { Link } from 'react-router-dom';

export default function HRReports() {
  const [reportType, setReportType] = useState('employees');
  const [fromDate, setFromDate] = useState(new Date(new Date().setDate(1)).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [filterDept, setFilterDept] = useState('');

  const reportTypes = [
    { id: 'employees', label: 'Employee Information', icon: '👥' },
    { id: 'ssf', label: 'SSF (SSNIT) Contributions', icon: '🛡️' },
    { id: 'paye', label: 'Income Tax (PAYE)', icon: '🧾' },
    { id: 'loans', label: 'Employee Loans', icon: '💳' },
    { id: 'allowances', label: 'Employee Allowances', icon: '🎁' },
  ];

  useEffect(() => {
    loadDepartments();
    loadReport();
  }, [reportType]);

  const loadDepartments = async () => {
    try {
      const res = await api.get("/hr/departments");
      setDepartments(res.data?.items || []);
    } catch {}
  };

  const loadReport = async () => {
    setLoading(true);
    try {
      let endpoint = '';
      const params = { from_date: fromDate, to_date: toDate, dept_id: filterDept };
      if (reportType === 'employees') endpoint = '/hr/reports/employees';
      else if (reportType === 'ssf') endpoint = '/hr/reports/ssf';
      else if (reportType === 'paye') endpoint = '/hr/reports/paye';
      else if (reportType === 'loans') endpoint = '/hr/reports/loans';
      else if (reportType === 'allowances') endpoint = '/hr/reports/allowances';
      else endpoint = '/hr/reports/employees';
      const res = await api.get(endpoint, { params });
      setItems(res.data?.items || []);
    } catch {
      toast.error("Failed to load report data");
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!items.length) return;
    const headers = Object.keys(items[0]).join(",");
    const rows = items.map(it => Object.values(it).join(",")).join("\n");
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `HR_Report_${reportType}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">HR Module Reporting</h1>
            <p className="text-sm text-slate-500">Comprehensive insights into workforce and operations</p>
          </div>
          <Link to="/human-resources" className="btn-secondary text-sm">Back to Menu</Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">Report Categories</h3>
            {reportTypes.map(t => (
              <button
                key={t.id}
                onClick={() => setReportType(t.id)}
                className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all ${
                  reportType === t.id 
                    ? "bg-brand text-white shadow-md shadow-brand/20" 
                    : "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                <span>{t.icon}</span>
                <span className="font-medium text-sm">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Main View */}
          <div className="lg:col-span-3 space-y-4">
            {/* Filters */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm flex flex-wrap items-end gap-4 border border-slate-200 dark:border-slate-700">
              <div className="flex-1 min-w-[150px]">
                <label className="label text-[10px]">Department</label>
                <select className="input text-sm h-9" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                  <option value="">All Departments</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.dept_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label text-[10px]">From Date</label>
                <input type="date" className="input text-sm h-9" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              </div>
              <div>
                <label className="label text-[10px]">To Date</label>
                <input type="date" className="input text-sm h-9" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
              <button onClick={loadReport} className="btn-primary h-9 px-4 text-sm">Generate</button>
              <button onClick={exportCSV} className="btn-secondary h-9 px-4 text-sm">Export CSV</button>
            </div>

            {/* Results */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                <h2 className="font-semibold text-sm uppercase">{reportType.replace("-", " ")} Report Results</h2>
                <span className="text-xs text-slate-500 font-medium">{items.length} records found</span>
              </div>
              <div className="overflow-x-auto max-h-[500px]">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10">
                    <tr className="text-left text-[10px] font-bold uppercase text-slate-500 border-b">
                      {items.length > 0 && Object.keys(items[0]).slice(0, 8).map(key => (
                        <th key={key} className="px-4 py-3">{key.replace("_", " ")}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {items.map((row, idx) => (
                      <tr className="text-left bg-slate-50 dark:bg-slate-900/50">
                        {Object.values(row).slice(0, 8).map((val, i) => (
                          <td key={i} className="px-4 py-3 truncate max-w-[200px]">
                            {typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val || '-')}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {items.length === 0 && !loading && (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-slate-500 italic">
                          No records found for this criteria. Try changing filters or report type.
                        </td>
                      </tr>
                    )}
                    {loading && (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center">
                          <div className="animate-spin inline-block w-6 h-6 border-2 border-brand border-t-transparent rounded-full"></div>
                          <p className="text-xs mt-2 text-slate-500">Generating report...</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Guard>
  );
}
