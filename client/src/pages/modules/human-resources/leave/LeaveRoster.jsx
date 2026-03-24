import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";

export default function LeaveRoster() {
  const [departments, setDepartments] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [department_id, setDepartmentId] = useState("");
  const [rosters, setRosters] = useState([]);
  const [details, setDetails] = useState([]);

  const filteredDetails = useMemo(() => {
    return details.filter((d) =>
      department_id
        ? rosters.find((r) => r.id === d.roster_id)?.department_id ==
          department_id
        : true,
    );
  }, [details, rosters, department_id]);

  useEffect(() => {
    const load = async () => {
      try {
        const [depts, r] = await Promise.all([
          api.get("/admin/departments"),
          api.get(`/hr/leave-roster?year=${year}`),
        ]);
        setDepartments(depts.data?.items || []);
        setRosters(r.data?.rosters || []);
        setDetails(r.data?.details || []);
      } catch {
        toast.error("Failed to load roster");
      }
    };
    load();
  }, [year]);

  async function generate() {
    try {
      const res = await api.post("/hr/leave-roster/generate", {
        year,
        department_id: department_id || null,
      });
      toast.success("Roster generated");
      const r = await api.get(`/hr/leave-roster?year=${year}`);
      setRosters(r.data?.rosters || []);
      setDetails(r.data?.details || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to generate");
    }
  }

  function exportExcel() {
    const rows = filteredDetails.map((d) => ({
      Employee: `${d.first_name} ${d.last_name}`,
      "Leave Type": d.type_name,
      "Start Date": d.start_date,
      "End Date": d.end_date,
      Days: d.total_days,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Roster");
    XLSX.writeFile(wb, `leave_roster_${year}.xlsx`);
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/human-resources/leave" className="btn-secondary text-sm">
          Back
        </Link>
        <h1 className="text-xl font-semibold">Leave Roster</h1>
      </div>
      <div className="bg-white dark:bg-slate-800 p-4 rounded shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="label">Year</label>
            <input
              className="input"
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">Department</label>
            <select
              className="input"
              value={department_id}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">All</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.dept_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 items-end">
            <button className="btn-primary" onClick={generate}>
              Generate Roster
            </button>
            <button className="btn-secondary" onClick={exportExcel}>
              Export Excel
            </button>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50 dark:bg-slate-900/50">
              <tr className="text-left">
                <th className="px-4 py-2 text-xs uppercase">Employee</th>
                <th className="px-4 py-2 text-xs uppercase">Type</th>
                <th className="px-4 py-2 text-xs uppercase">Start</th>
                <th className="px-4 py-2 text-xs uppercase">End</th>
                <th className="px-4 py-2 text-xs uppercase">Days</th>
              </tr>
            </thead>
            <tbody>
              {filteredDetails.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-4 py-2">
                    {d.first_name} {d.last_name}
                  </td>
                  <td className="px-4 py-2">{d.type_name}</td>
                  <td className="px-4 py-2">{d.start_date}</td>
                  <td className="px-4 py-2">{d.end_date}</td>
                  <td className="px-4 py-2">{d.total_days}</td>
                </tr>
              ))}
              {filteredDetails.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No roster entries
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

