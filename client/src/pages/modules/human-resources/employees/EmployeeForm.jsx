import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";

export default function EmployeeForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    emp_code: "",
    first_name: "",
    last_name: "",
    middle_name: "",
    gender: "MALE",
    dob: "",
    joining_date: new Date().toISOString().split("T")[0],
    email: "",
    phone: "",
    dept_id: "",
    pos_id: "",
    manager_id: "",
    employment_type: "FULL_TIME",
    status: "PROBATION",
    base_salary: 0,
    address: "",
  });
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);

  useEffect(() => {
    async function loadOptions() {
      try {
        const [depts, pos] = await Promise.all([
          api.get("/hr/departments"),
          api.get("/hr/positions")
        ]);
        setDepartments(depts.data?.items || []);
        setPositions(pos.data?.items || []);
      } catch {}
    }
    loadOptions();
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    fetchEmployee();
  }, [id]);

  async function fetchEmployee() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get(`/hr/employees/${id}`);
      if (response.data?.item) {
        setForm(response.data.item);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Error fetching employee");
    } finally {
      setLoading(false);
    }
  }

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (isEdit) {
        await api.post("/hr/employees", { ...form, id }); // saveEmployee handles both based on presence of id
      } else {
        await api.post("/hr/employees", form);
      }
      navigate("/human-resources/employees");
    } catch (err) {
      setError(err?.response?.data?.message || "Error saving employee");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white"><div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                {isEdit ? "Edit Employee" : "New Employee"}
              </h1>
              <p className="text-sm mt-1">
                Comprehensive employee record
              </p>
            </div>
            <Link to="/human-resources/employees" className="btn-secondary">
              Back to List
            </Link>
          </div>
        </div>
      </div>

      <form onSubmit={submit}>
        <div className="card">
          <div className="card-body">
            {error && <div className="alert alert-error mb-4">{error}</div>}
            
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="label">First Name *</label>
                <input className="input" value={form.first_name || ""} onChange={(e) => update("first_name", e.target.value)} required />
              </div>
              <div>
                <label className="label">Middle Name</label>
                <input className="input" value={form.middle_name || ""} onChange={(e) => update("middle_name", e.target.value)} />
              </div>
              <div>
                <label className="label">Last Name *</label>
                <input className="input" value={form.last_name || ""} onChange={(e) => update("last_name", e.target.value)} required />
              </div>
              <div>
                <label className="label">Gender</label>
                <select className="input" value={form.gender || ""} onChange={(e) => update("gender", e.target.value)}>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="label">Date of Birth</label>
                <input className="input" type="date" value={form.dob ? form.dob.slice(0,10) : ""} onChange={(e) => update("dob", e.target.value)} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={form.email || ""} onChange={(e) => update("email", e.target.value)} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={form.phone || ""} onChange={(e) => update("phone", e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="label">Address</label>
                <textarea className="input" rows={2} value={form.address || ""} onChange={(e) => update("address", e.target.value)} />
              </div>
            </div>

            <h3 className="text-lg font-semibold mb-4 border-b pb-2">Employment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="label">Employee Code *</label>
                <input className="input" value={form.emp_code || ""} onChange={(e) => update("emp_code", e.target.value)} required />
              </div>
              <div>
                <label className="label">Department</label>
                <select className="input" value={form.dept_id || ""} onChange={(e) => update("dept_id", e.target.value)}>
                  <option value="">Select Department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.dept_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Position</label>
                <select className="input" value={form.pos_id || ""} onChange={(e) => update("pos_id", e.target.value)}>
                  <option value="">Select Position</option>
                  {positions.map(p => <option key={p.id} value={p.id}>{p.pos_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Joining Date *</label>
                <input className="input" type="date" value={form.joining_date ? form.joining_date.slice(0,10) : ""} onChange={(e) => update("joining_date", e.target.value)} required />
              </div>
              <div>
                <label className="label">Employment Type</label>
                <select className="input" value={form.employment_type || ""} onChange={(e) => update("employment_type", e.target.value)}>
                  <option value="FULL_TIME">Full Time</option>
                  <option value="PART_TIME">Part Time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERN">Intern</option>
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status || ""} onChange={(e) => update("status", e.target.value)}>
                  <option value="PROBATION">Probation</option>
                  <option value="ACTIVE">Active</option>
                  <option value="TERMINATED">Terminated</option>
                  <option value="RESIGNED">Resigned</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>
              <div>
                <label className="label">Base Salary</label>
                <input className="input" type="number" step="0.01" value={form.base_salary || 0} onChange={(e) => update("base_salary", e.target.value)} />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t pt-4">
              <Link to="/human-resources/employees" className="btn-secondary">Cancel</Link>
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Employee"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}







