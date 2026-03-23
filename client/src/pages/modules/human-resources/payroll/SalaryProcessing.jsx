import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";

export default function SalaryProcessing() {
  const navigate = useNavigate();
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    async function loadPeriods() {
      try {
        const res = await api.get("/hr/payroll/periods"); // I need to make sure this route exists
        setPeriods(res?.data?.items || []);
      } catch (err) {
        toast.error("Failed to load payroll periods");
      }
    }
    loadPeriods();
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const loadPreview = async () => {
    if (!selectedPeriod) return toast.error("Select a period");
    setLoading(true);
    try {
      // We can use the existing employees list and join with their salary configuration
      const res = await api.get("/hr/employees");
      setEmployees(res?.data?.items || []);
    } catch (err) {
      toast.error("Failed to load employee preview");
    } finally {
      setLoading(false);
    }
  };

  const processSalaries = async () => {
    if (!selectedPeriod) return toast.error("Select a period");
    setProcessing(true);
    try {
      await api.post("/hr/payroll/generate", {
        period_id: Number(selectedPeriod)
      });
      toast.success("Salaries processed successfully");
      navigate("/human-resources/payslips");
    } catch (err) {
      toast.error("Failed to process salaries");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Link to="/human-resources" className="btn-secondary text-sm">
            Back to Menu
          </Link>
          <h2 className="text-lg font-semibold">Process Salaries</h2>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded shadow-sm mb-6">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Payroll Period</label>
              <select 
                className="input" 
                value={selectedPeriod} 
                onChange={(e) => setSelectedPeriod(e.target.value)}
              >
                <option value="">Select Period</option>
                {periods.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.period_name} ({formatDate(p.start_date)} to {formatDate(p.end_date)})
                  </option>
                ))}
              </select>
            </div>
            <button className="btn-primary h-10" onClick={loadPreview} disabled={loading}>
              {loading ? "Loading..." : "Preview Salaries"}
            </button>
            <button 
              className="btn-success h-10" 
              onClick={processSalaries} 
              disabled={processing || !selectedPeriod}
            >
              {processing ? "Processing..." : "Generate Payroll"}
            </button>
          </div>
        </div>

        {employees.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded shadow-sm overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
                <tr className="text-left bg-slate-50 dark:bg-slate-900/50">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Employee</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Emp Code</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Base Salary</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Net Salary (Est)</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <tr key={emp.id} className="border-t">
                    <td className="px-4 py-2">{emp.full_name || `${emp.first_name} ${emp.last_name}`}</td>
                    <td className="px-4 py-2 text-sm text-slate-500">{emp.emp_code}</td>
                    <td className="px-4 py-2 text-right">{Number(emp.base_salary || 0).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-medium">
                      {/* For preview we just show base salary as a simple estimate */}
                      {Number(emp.base_salary || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Guard>
  );
}
