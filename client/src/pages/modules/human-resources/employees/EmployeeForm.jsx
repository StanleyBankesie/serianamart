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
    emp_no: "",
    full_name: "",
    designation: "",
    department: "",
    email: "",
    contact_no: "",
    employment_type: "PERMANENT",
    date_joined: new Date().toISOString().split("T")[0],
    is_active: 1,
  });

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
        await api.put(`/hr/employees/${id}`, form);
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
                Employee setup and configuration
              </p>
            </div>
            <Link to="/human-resources/employees" className="btn-success">
              Back
            </Link>
          </div>
        </div>
      </div>

      <form onSubmit={submit}>
        <div className="card">
          <div className="card-body">
            {error && <div className="alert alert-error mb-4">{error}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Employee No</label>
                <input
                  className="input"
                  value={form.emp_no}
                  onChange={(e) => update("emp_no", e.target.value)}
                  placeholder="Auto-generated"
                />
              </div>
              <div>
                <label className="label">Full Name *</label>
                <input
                  className="input"
                  value={form.full_name}
                  onChange={(e) => update("full_name", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Designation</label>
                <input
                  className="input"
                  value={form.designation}
                  onChange={(e) => update("designation", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Department</label>
                <input
                  className="input"
                  value={form.department}
                  onChange={(e) => update("department", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Contact No</label>
                <input
                  className="input"
                  value={form.contact_no}
                  onChange={(e) => update("contact_no", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Employment Type</label>
                <select
                  className="input"
                  value={form.employment_type}
                  onChange={(e) => update("employment_type", e.target.value)}
                >
                  <option value="PERMANENT">Permanent</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="TEMPORARY">Temporary</option>
                  <option value="INTERN">Intern</option>
                </select>
              </div>
              <div>
                <label className="label">Date Joined</label>
                <input
                  className="input"
                  type="date"
                  value={form.date_joined}
                  onChange={(e) => update("date_joined", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Active</label>
                <select
                  className="input"
                  value={String(form.is_active)}
                  onChange={(e) => update("is_active", Number(e.target.value))}
                >
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Link to="/human-resources/employees" className="btn-success">
                Cancel
              </Link>
              <button className="btn-success" type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Employee"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}







