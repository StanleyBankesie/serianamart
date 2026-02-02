import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";

export default function BranchForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    company_id: 1,
    code: "",
    name: "",
    isActive: true,
    address: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
    location: "",
    telephone: "",
    email: "",
    remarks: "",
  });

  useEffect(() => {
    if (!isEdit) return;
    fetchBranch();
  }, [id]);

  async function fetchBranch() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get(`/admin/branches/${id}`);
      if (response.data?.item) {
        const item = response.data.item;
        setForm({
          company_id: item.company_id,
          code: item.code,
          name: item.name,
          isActive: item.is_active,
          address: item.address || "",
          city: item.city || "",
          state: item.state || "",
          postal_code: item.postal_code || "",
          country: item.country || "",
          location: item.location || "",
          telephone: item.telephone || "",
          email: item.email || "",
          remarks: item.remarks || "",
        });
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Error fetching branch");
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
      const payload = {
        company_id: form.company_id,
        name: form.name,
        code: form.code,
        is_active: form.isActive,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        postal_code: form.postal_code || null,
        country: form.country || null,
        location: form.location || null,
        telephone: form.telephone || null,
        email: form.email || null,
        remarks: form.remarks || null,
      };
      if (isEdit) {
        await api.put(`/admin/branches/${id}`, payload);
      } else {
        await api.post("/admin/branches", payload);
      }
      navigate("/administration/branches");
    } catch (err) {
      setError(err?.response?.data?.message || "Error saving branch");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 [&::-webkit-scrollbar]:hidden">
      <div>
        <Link
          to="/administration/branches"
          className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 mb-2 inline-block"
        >
          ← Back to Branches
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isEdit ? "Edit Branch" : "New Branch"}
        </h1>
        <p className="text-sm mt-1">Branch profile</p>
      </div>

      <form onSubmit={submit}>
        <div className="card">
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Company ID</label>
                <input
                  className="input"
                  type="number"
                  value={form.company_id}
                  onChange={(e) =>
                    update("company_id", parseInt(e.target.value) || 1)
                  }
                  disabled
                />
              </div>
              <div>
                <label className="label">Code *</label>
                <input
                  className="input"
                  value={form.code}
                  onChange={(e) => update("code", e.target.value)}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">Name *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={form.isActive ? "1" : "0"}
                  onChange={(e) => update("isActive", e.target.value === "1")}
                >
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>
              <div>
                <label className="label">Address</label>
                <input
                  className="input"
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Location</label>
                <input
                  className="input"
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                />
              </div>
              <div>
                <label className="label">City</label>
                <input
                  className="input"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                />
              </div>
              <div>
                <label className="label">State</label>
                <input
                  className="input"
                  value={form.state}
                  onChange={(e) => update("state", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Postal Code</label>
                <input
                  className="input"
                  value={form.postal_code}
                  onChange={(e) => update("postal_code", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Country</label>
                <input
                  className="input"
                  value={form.country}
                  onChange={(e) => update("country", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Telephone</label>
                <input
                  className="input"
                  value={form.telephone}
                  onChange={(e) => update("telephone", e.target.value)}
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
              <div className="md:col-span-2">
                <label className="label">Remarks</label>
                <textarea
                  className="input"
                  rows="3"
                  value={form.remarks}
                  onChange={(e) => update("remarks", e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Link to="/administration/branches" className="btn-success">
                Cancel
              </Link>
              <button className="btn-success" type="submit" disabled={loading}>
                {loading ? "Saving..." : isEdit ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
