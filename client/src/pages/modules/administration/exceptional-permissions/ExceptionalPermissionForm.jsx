import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";

export default function ExceptionalPermissionForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const response = await api.get("/admin/users");
      const items =
        (response.data && response.data.data && response.data.data.items) ||
        response.data?.items ||
        [];
      setUsers(items);
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  }

  const [form, setForm] = useState({
    username: "",
    permissionCode: "",
    effect: "ALLOW",
    reason: "",
    is_active: true,
    effective_from: "",
    effective_to: "",
    exception_type: "TEMPORARY",
  });

  const permissionOptions = [
    "Clearing Bill Cancellation",
    "Direct Purchase Cancellation",
    "Discount in Sales Invoice",
    "Discount in Sales Order",
    "Discount in Sales Quotation",
    "GRN Cancellation",
    "Price Editable in Sales Invoice",
    "Price Editable in Sales Order",
    "Price Editable in Sales Quotation",
    "Import Bill cancellation",
    "Leave Requet Approval -Stage",
    "Local Bill cancellation",
    "POS DELIVERY CANCEL",
    "POS DISCOUNT",
    "Sales Invoice cancellation",
  ];

  useEffect(() => {
    if (!isEdit) return;
    fetchPermission();
  }, [id]);

  async function fetchPermission() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get(`/admin/exceptional-permissions/${id}`);
      if (response.data?.item) {
        const item = response.data.item;
        // Format dates for input type="date"
        if (item.effective_from)
          item.effective_from = item.effective_from.split("T")[0];
        if (item.effective_to)
          item.effective_to = item.effective_to.split("T")[0];

        // Ensure we map back username if it wasn't returned directly as username property
        // The backend should return 'username' now
        if (!item.username && item.user_name) item.username = item.user_name; // Fallback? No, user_name is full name.
        // If backend returns username, use it.

        if (!item.permissionCode && item.permission_code)
          item.permissionCode = item.permission_code;

        setForm(item);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Error fetching permission");
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
        await api.put(`/admin/exceptional-permissions/${id}`, form);
      } else {
        await api.post("/admin/exceptional-permissions", form);
      }
      navigate("/administration/users");
    } catch (err) {
      setError(err?.response?.data?.message || "Error saving permission");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/administration/exceptional-permissions"
          className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 mb-2 inline-block"
        >
          ← Back to Exceptional Permissions
        </Link>
        <Link
          to="/administration/users"
          className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 mb-2 inline-block ml-4"
        >
          ← Back to Users
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isEdit
            ? "Edit Exceptional Permission"
            : "New Exceptional Permission"}
        </h1>
        <p className="text-sm mt-1">Temporary user-specific overrides</p>
      </div>

      <form onSubmit={submit}>
        <div className="card">
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Username *</label>
                <select
                  className="input"
                  value={form.username}
                  onChange={(e) => update("username", e.target.value)}
                  required
                >
                  <option value="">-- Select User --</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.username}>
                      {user.username}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Permission *</label>
                <select
                  className="input"
                  value={form.permissionCode}
                  onChange={(e) => update("permissionCode", e.target.value)}
                  required
                >
                  <option value="">-- Select Permission --</option>
                  {permissionOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Effect</label>
                <select
                  className="input"
                  value={form.effect}
                  onChange={(e) => update("effect", e.target.value)}
                >
                  <option value="ALLOW">Allow</option>
                  <option value="DENY">Deny</option>
                </select>
              </div>
              <div>
                <label className="label">Exception Type</label>
                <select
                  className="input"
                  value={form.exception_type}
                  onChange={(e) => update("exception_type", e.target.value)}
                >
                  <option value="TEMPORARY">Temporary</option>
                  <option value="PERMANENT">Permanent</option>
                </select>
              </div>
              <div>
                <label className="label">Effective From</label>
                <input
                  type="date"
                  className="input"
                  value={form.effective_from}
                  onChange={(e) => update("effective_from", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Effective To</label>
                <input
                  type="date"
                  className="input"
                  value={form.effective_to}
                  onChange={(e) => update("effective_to", e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">Reason</label>
                <input
                  className="input"
                  value={form.reason}
                  onChange={(e) => update("reason", e.target.value)}
                  placeholder="Reason for this exception"
                />
              </div>
              <div className="flex items-center mt-8">
                <input
                  type="checkbox"
                  id="is_active"
                  className="w-5 h-5 text-brand rounded focus:ring-brand-500 border-gray-300"
                  checked={form.is_active}
                  onChange={(e) => update("is_active", e.target.checked)}
                />
                <label
                  htmlFor="is_active"
                  className="ml-2 block text-sm text-slate-900 dark:text-white"
                >
                  Active
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Link
                to="/administration/exceptional-permissions"
                className="btn-success"
              >
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
