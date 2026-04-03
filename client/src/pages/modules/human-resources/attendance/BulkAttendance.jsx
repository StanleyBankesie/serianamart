import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";

export default function BulkAttendance() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState("");
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [filter, setFilter] = useState({
    employee_id: "",
    dept_id: "",
    location_id: "",
  }); // search by employee/filters
  const [rows, setRows] = useState([]); // [{ employee_id, name, code, attendance_date, status, remarks }]
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [resEmps, resPeriods, resDepts, resLocs] = await Promise.all([
          api.get("/hr/employees"),
          api.get("/hr/payroll/periods"),
          api.get("/admin/departments"),
          api.get("/hr/setup/locations"),
        ]);
        setEmployees(resEmps?.data?.items || []);
        setPeriods(resPeriods?.data?.items || []);
        setDepartments(resDepts?.data?.items || []);
        setLocations(resLocs?.data?.items || []);
      } catch (err) {
        toast.error("Failed to load employees");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const selectedPeriod = useMemo(
    () => periods.find((p) => String(p.id) === String(periodId)),
    [periods, periodId],
  );

  useEffect(() => {
    if (!selectedPeriod || !employees.length) {
      setRows([]);
      return;
    }
    // Filter employees by department/location if selected
    const base = employees.filter((e) => {
      if (filter.dept_id && String(e.dept_id || "") !== String(filter.dept_id))
        return false;
      if (
        filter.location_id &&
        String(e.location_id || "") !== String(filter.location_id)
      )
        return false;
      return true;
    });
    primeRangeStatuses(
      base,
      selectedPeriod.start_date,
      selectedPeriod.end_date,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodId, employees, filter.dept_id, filter.location_id]);

  function buildDateRange(start, end) {
    const out = [];
    const s = new Date(start);
    const e = new Date(end);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      out.push(new Date(d).toISOString().slice(0, 10));
    }
    return out;
  }

  async function primeRangeStatuses(empList, from, to) {
    try {
      const dates = buildDateRange(from, to);
      const ts = await api.get(
        `/hr/timesheets?from_date=${from}&to_date=${to}`,
      );
      const shortSet = new Set(
        (ts.data?.items || [])
          .filter((t) => Number(t.short_hours || 0) > 0)
          .map((t) => `${t.employee_id}|${t.work_date}`),
      );
      const next = [];
      empList.forEach((e) => {
        const name = `${e.first_name} ${e.last_name}`.trim();
        dates.forEach((d) => {
          const key = `${e.id}|${d}`;
          const isShort = shortSet.has(key);
          next.push({
            employee_id: e.id,
            name,
            code: e.emp_code,
            attendance_date: d,
            status: isShort ? "ABSENT" : "PRESENT",
            remarks: isShort ? "Auto-marked (short hours)" : "",
          });
        });
      });
      setRows(next);
    } catch {
      const dates = buildDateRange(from, to);
      const next = [];
      empList.forEach((e) => {
        const name = `${e.first_name} ${e.last_name}`.trim();
        dates.forEach((d) => {
          next.push({
            employee_id: e.id,
            name,
            code: e.emp_code,
            attendance_date: d,
            status: "PRESENT",
            remarks: "",
          });
        });
      });
      setRows(next);
    }
  }

  const filteredRows = useMemo(() => {
    let r = rows;
    if (filter.employee_id) {
      r = r.filter((x) => String(x.employee_id) === String(filter.employee_id));
    }
    return r;
  }, [rows, filter.employee_id]);

  const updateRow = (employee_id, dateStr, patch) => {
    setRows((prev) =>
      prev.map((r) =>
        r.employee_id === employee_id && r.attendance_date === dateStr
          ? { ...r, ...patch }
          : r,
      ),
    );
  };

  const setAllStatus = (status) => {
    setRows((prev) => prev.map((r) => ({ ...r, status })));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        attendance: rows.map((r) => ({
          employee_id: r.employee_id,
          attendance_date: r.attendance_date,
          status: r.status,
          remarks: r.remarks || "",
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
              <select
                className="input w-72"
                value={filter.employee_id}
                onChange={(e) =>
                  setFilter((f) => ({ ...f, employee_id: e.target.value }))
                }
              >
                <option value="">All Employees</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.first_name} {e.last_name}
                  </option>
                ))}
              </select>
              <select
                className="input w-60"
                value={filter.dept_id}
                onChange={(e) =>
                  setFilter((f) => ({ ...f, dept_id: e.target.value }))
                }
                title="Filter by Department"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.dept_name}
                  </option>
                ))}
              </select>
              <select
                className="input w-60"
                value={filter.location_id}
                onChange={(e) =>
                  setFilter((f) => ({ ...f, location_id: e.target.value }))
                }
                title="Filter by Location"
              >
                <option value="">All Locations</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.location_name}
                  </option>
                ))}
              </select>
              <select
                className="input w-80"
                value={periodId}
                onChange={(e) => setPeriodId(e.target.value)}
              >
                <option value="">Select Month</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.period_name}
                  </option>
                ))}
              </select>
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
                  Attendance Date
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
              {filteredRows.map((r, idx) => (
                <tr
                  key={`${r.employee_id}-${r.attendance_date}-${idx}`}
                  className="border-t"
                >
                  <td className="px-4 py-2 font-medium">{r.name}</td>
                  <td className="px-4 py-2 text-sm text-slate-500">{r.code}</td>
                  <td className="px-4 py-2 text-sm">{r.attendance_date}</td>
                  <td className="px-4 py-2">
                    <select
                      className="input py-1"
                      value={r.status}
                      onChange={(e) =>
                        updateRow(r.employee_id, r.attendance_date, {
                          status: e.target.value,
                        })
                      }
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
                      value={r.remarks || ""}
                      onChange={(e) =>
                        updateRow(r.employee_id, r.attendance_date, {
                          remarks: e.target.value,
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No rows — select a month
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
