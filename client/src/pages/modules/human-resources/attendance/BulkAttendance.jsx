import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";

export default function BulkAttendance() {
  const navigate = useNavigate();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [employees, setEmployees] = useState([]);
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
        
        // Initialize attendance with PRESENT status for all
        const initial = {};
        empList.forEach(e => {
          initial[e.id] = { status: "PRESENT", remarks: "" };
        });
        setAttendance(initial);
      } catch (err) {
        toast.error("Failed to load employees");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const updateStatus = (id, status) => {
    setAttendance(prev => ({
      ...prev,
      [id]: { ...prev[id], status }
    }));
  };

  const updateRemarks = (id, remarks) => {
    setAttendance(prev => ({
      ...prev,
      [id]: { ...prev[id], remarks }
    }));
  };

  const setAllStatus = (status) => {
    const next = { ...attendance };
    Object.keys(next).forEach(id => {
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
          remarks: data.remarks
        }))
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
            <Link to="/human-resources/attendance" className="btn-secondary text-sm">
              Back to Dashboard
            </Link>
            <h2 className="text-lg font-semibold">Mark Bulk Attendance</h2>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              className="input w-40"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
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
            <button onClick={() => setAllStatus("PRESENT")} className="btn-outline text-xs py-1 px-2">Present</button>
            <button onClick={() => setAllStatus("ABSENT")} className="btn-outline text-xs py-1 px-2 text-red-600 border-red-200">Absent</button>
            <button onClick={() => setAllStatus("LATE")} className="btn-outline text-xs py-1 px-2 text-orange-600 border-orange-200">Late</button>
          </div>
          
          <table className="min-w-full">
            <thead>
              <tr className="text-left bg-slate-50 dark:bg-slate-700">
                <th className="px-4 py-2">Employee</th>
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{emp.full_name || `${emp.first_name} ${emp.last_name}`}</td>
                  <td className="px-4 py-2 text-sm text-slate-500">{emp.emp_code}</td>
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
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
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
