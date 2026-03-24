import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";

export default function BulkAttendance() {
  const navigate = useNavigate();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [employees, setEmployees] = useState([]);
  const [filter, setFilter] = useState({ employee: "" });
  const [range, setRange] = useState({ from: "", to: "" }); // list filter range
  const [rangeEmpIds, setRangeEmpIds] = useState(null); // Set<number> | null
  const [attendance, setAttendance] = useState({}); // { employee_id: { status, remarks } }
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await api.get("/hr/employees");
        const empList = res?.data?.items || [];
        setEmployees(empList);
        await primeStatuses(empList, date);
      } catch (err) {
        toast.error("Failed to load employees");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!employees.length) return;
    primeStatuses(employees, date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    async function loadRange() {
      if (!range.from || !range.to) {
        setRangeEmpIds(null);
        return;
      }
      try {
        const ts = await api.get(
          `/hr/timesheets?from_date=${range.from}&to_date=${range.to}`,
        );
        const ids = new Set(
          (ts.data?.items || []).map((t) => Number(t.employee_id)),
        );
        setRangeEmpIds(ids);
      } catch {
        setRangeEmpIds(null);
      }
    }
    loadRange();
  }, [range.from, range.to]);

  async function primeStatuses(empList, workDate) {
    try {
      // Default all to PRESENT
      const initial = {};
      empList.forEach((e) => {
        initial[e.id] = { status: "PRESENT", remarks: "" };
      });
      // Get timesheets with short_hours > 0 for that date
      const ts = await api.get(
        `/hr/timesheets?from_date=${workDate}&to_date=${workDate}`,
      );
      const shorties = (ts.data?.items || []).filter(
        (t) => Number(t.short_hours || 0) > 0,
      );
      shorties.forEach((t) => {
        if (initial[t.employee_id]) {
          initial[t.employee_id] = {
            status: "ABSENT",
            remarks: "Auto-marked (short hours)",
          };
        }
      });
      setAttendance(initial);
    } catch {
      const initial = {};
      empList.forEach((e) => {
        initial[e.id] = { status: "PRESENT", remarks: "" };
      });
      setAttendance(initial);
    }
  }

  const updateStatus = (id, status) => {
    setAttendance((prev) => ({
      ...prev,
      [id]: { ...prev[id], status },
    }));
  };

  const updateRemarks = (id, remarks) => {
    setAttendance((prev) => ({
      ...prev,
      [id]: { ...prev[id], remarks },
    }));
  };

  const setAllStatus = (status) => {
    const next = { ...attendance };
    Object.keys(next).forEach((id) => {
      next[id].status = status;
    });
    setAttendance(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        date,
        attendance: Object.entries(attendance).map(([id, data]) => ({
          employee_id: Number(id),
          status: data.status,
          remarks: data.remarks,
        })),
      };
      await api.post("/hr/attendance/bulk", payload);
      toast.success("Bulk attendance saved successfully");
      navigate("/human-resources/attendance");
    } catch (err) {
      toast.error("Failed to save bulk attendance");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Link
              to="/human-resources/attendance"
              className="btn-secondary text-sm"
            >
              Back to Dashboard
            </Link>
            <h2 className="text-lg font-semibold">Mark Bulk Attendance</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <input
                type="text"
                placeholder="Filter by name/code"
                className="input w-56"
                value={filter.employee}
                onChange={(e) =>
                  setFilter((f) => ({ ...f, employee: e.target.value }))
                }
              />
              <input
                type="date"
                className="input w-36"
                value={range.from}
                onChange={(e) =>
                  setRange((r) => ({ ...r, from: e.target.value }))
                }
                placeholder="From"
                title="From date (list filter)"
              />
              <input
                type="date"
                className="input w-36"
                value={range.to}
                onChange={(e) =>
                  setRange((r) => ({ ...r, to: e.target.value }))
                }
                placeholder="To"
                title="To date (list filter)"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">Attendance Date</label>
              <input
                type="date"
                className="input w-36"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                title="Attendance date to save"
              />
            </div>
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Saving..." : "Save All"}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded shadow-sm overflow-hidden">
          <div className="p-3 bg-slate-50 dark:bg-slate-700 border-b flex gap-2">
            <span className="text-sm font-medium">Set all to:</span>
            <button
              onClick={() => setAllStatus("PRESENT")}
              className="btn-outline text-xs py-1 px-2"
            >
              Present
            </button>
            <button
              onClick={() => setAllStatus("ABSENT")}
              className="btn-outline text-xs py-1 px-2 text-red-600 border-red-200"
            >
              Absent
            </button>
            <button
              onClick={() => setAllStatus("LATE")}
              className="btn-outline text-xs py-1 px-2 text-orange-600 border-orange-200"
            >
              Late
            </button>
          </div>

          <table className="min-w-full">
            <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
              <tr className="text-left bg-slate-50 dark:bg-slate-900/50">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Employee
                </th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Code
                </th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Status
                </th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Remarks
                </th>
              </tr>
            </thead>
            <tbody>
              {employees
                .filter((e) => {
                  const q = filter.employee.trim().toLowerCase();
                  if (!q) return true;
                  const name = `${e.first_name} ${e.last_name}`.toLowerCase();
                  const code = String(e.emp_code || "").toLowerCase();
                  return name.includes(q) || code.includes(q);
                })
                .filter((e) => {
                  if (!rangeEmpIds) return true;
                  return rangeEmpIds.has(Number(e.id));
                })
                .map((emp) => (
                  <tr key={emp.id} className="border-t">
                    <td className="px-4 py-2 font-medium">
                      {emp.full_name || `${emp.first_name} ${emp.last_name}`}
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-500">
                      {emp.emp_code}
                    </td>
                    <td className="px-4 py-2">
                      <select
                        className="input py-1"
                        value={attendance[emp.id]?.status || "PRESENT"}
                        onChange={(e) => updateStatus(emp.id, e.target.value)}
                      >
                        <option value="PRESENT">Present</option>
                        <option value="ABSENT">Absent</option>
                        <option value="LATE">Late</option>
                        <option value="HALF_DAY">Half Day</option>
                        <option value="ON_LEAVE">On Leave</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        className="input py-1"
                        placeholder="Optional remarks"
                        value={attendance[emp.id]?.remarks || ""}
                        onChange={(e) => updateRemarks(emp.id, e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              {!employees.length && !loading && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No employees found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Guard>
  );
}
