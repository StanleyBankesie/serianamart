import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";
import { Eye, EyeOff } from "lucide-react";

export default function UserForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    companyId: "",
    branchIds: [],
    username: "",
    email: "",
    fullName: "",
    password: "",
    isActive: true,
    profilePictureUrl: "",
    isEmployee: false,
    userType: "Internal",
    validFrom: "",
    validTo: "",
    roleId: "",
  });

  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [roles, setRoles] = useState([]);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchDependencies();
    if (isEdit) {
      fetchUser();
    }
  }, [id]);

  async function fetchDependencies() {
    try {
      const [compRes, branchRes, roleRes] = await Promise.all([
        api.get("/admin/companies"),
        api.get("/admin/branches"),
        api.get("/admin/roles").catch(() => ({ data: { items: [] } })), // Handle if roles endpoint fails or empty
      ]);
      setCompanies(
        (compRes.data && compRes.data.data && compRes.data.data.items) ||
          compRes.data?.items ||
          [],
      );
      setBranches(
        (branchRes.data && branchRes.data.data && branchRes.data.data.items) ||
          branchRes.data?.items ||
          [],
      );
      setRoles(
        (roleRes.data && roleRes.data.data && roleRes.data.data.items) ||
          roleRes.data?.items ||
          [],
      );
    } catch (err) {
      console.error("Error fetching dependencies:", err);
    }
  }

  async function fetchUser() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get(`/admin/users/${id}`);
      if (response.data?.data?.item) {
        const u = response.data.data.item;
        setForm({
          companyId: u.company_id || "",
          branchIds: u.branch_id ? [String(u.branch_id)] : [],
          username: u.username || "",
          email: u.email || "",
          fullName: u.full_name || "",
          isActive: Boolean(u.is_active),
          password: "", // Don't populate password
          profilePictureUrl: u.profile_picture_url || "",
          isEmployee: Boolean(u.is_employee),
          userType: u.user_type || "Internal",
          validFrom: u.valid_from ? u.valid_from.split("T")[0] : "",
          validTo: u.valid_to ? u.valid_to.split("T")[0] : "",
          roleId: u.role_id || "",
        });
        try {
          const br = await api.get(`/admin/users/${id}/branches`);
          const assigned = Array.isArray(br.data?.data?.items)
            ? br.data.data.items
            : [];
          setForm((prev) => ({
            ...prev,
            branchIds: assigned.map((b) => String(b.id)),
          }));
        } catch {
          // ignore
        }
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Error fetching user");
    } finally {
      setLoading(false);
    }
  }

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploading(true);
      const res = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      update("profilePictureUrl", res.data.url);
    } catch (err) {
      console.error("Upload failed", err);
      setError("Failed to upload profile picture");
    } finally {
      setUploading(false);
    }
  }

  function validatePassword(pwd) {
    if (!pwd) return true; // Optional on edit
    const minLength = 8;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);

    if (pwd.length < minLength)
      return "Password must be at least 8 characters long.";
    if (!hasUpper)
      return "Password must contain at least one uppercase letter.";
    if (!hasNumber) return "Password must contain at least one number.";
    if (!hasSpecial)
      return "Password must contain at least one special character.";

    return true;
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Password validation
    if (!isEdit || form.password) {
      const pwdValid = validatePassword(form.password);
      if (pwdValid !== true) {
        setError(pwdValid);
        setLoading(false);
        return;
      }
    }

    try {
      const payload = {
        company_id: form.companyId,
        branch_id: form.branchIds?.[0] ? Number(form.branchIds[0]) : undefined,
        branch_ids: form.branchIds.map((x) => Number(x)),
        username: form.username,
        email: form.email,
        full_name: form.fullName,
        is_active: form.isActive,
        profile_picture_url: form.profilePictureUrl,
        is_employee: form.isEmployee,
        user_type: form.userType,
        valid_from: form.validFrom || null,
        valid_to: form.validTo || null,
        role_id: form.roleId || null,
      };

      if (!payload.branch_id) {
        setError("Select at least one branch");
        setLoading(false);
        return;
      }

      if (form.password) {
        payload.password_hash = form.password;
      }

      if (isEdit) {
        await api.put(`/admin/users/${id}`, payload);
      } else {
        await api.post("/admin/users", payload);
      }
      navigate("/administration/users");
    } catch (err) {
      setError(err?.response?.data?.message || "Error saving user");
    } finally {
      setLoading(false);
    }
  }

  // Filter branches based on selected company
  const filteredBranches = form.companyId
    ? branches.filter((b) => String(b.company_id) === String(form.companyId))
    : [];

  // Filter roles based on selected company (assuming roles are company-specific)
  const filteredRoles = form.companyId
    ? roles.filter((r) => String(r.company_id) === String(form.companyId))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/administration/users"
          className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 mb-2 inline-block"
        >
          ← Back to Users
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isEdit ? "Edit User" : "New User"}
        </h1>
        <p className="text-sm mt-1">Create and manage system users</p>
      </div>

      <form onSubmit={submit}>
        <div className="card">
          <div className="card-body space-y-4">
            {error && <div className="alert alert-error mb-4">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Company & Branch */}
              <div>
                <label className="label">Company *</label>
                <select
                  className="input"
                  value={form.companyId}
                  onChange={(e) => {
                    update("companyId", e.target.value);
                    update("branchIds", []); // Reset branches
                    update("roleId", ""); // Reset role
                  }}
                  required
                >
                  <option value="">-- Select Company --</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Branches *</label>
                <div className="space-y-2 border rounded-md p-2 max-h-48 overflow-auto">
                  {filteredBranches.map((b) => {
                    const checked = form.branchIds.includes(String(b.id));
                    return (
                      <label key={b.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-brand rounded focus:ring-brand"
                          checked={checked}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            setForm((prev) => {
                              const arr = new Set(prev.branchIds);
                              if (isChecked) arr.add(String(b.id));
                              else arr.delete(String(b.id));
                              return { ...prev, branchIds: Array.from(arr) };
                            });
                          }}
                          disabled={!form.companyId}
                        />
                        <span className="text-sm">
                          {b.name} ({b.code})
                        </span>
                      </label>
                    );
                  })}
                  {filteredBranches.length === 0 ? (
                    <div className="text-xs text-slate-500">
                      Select a company to see branches
                    </div>
                  ) : null}
                </div>
              </div>

              {/* User Details */}
              <div>
                <label className="label">Username *</label>
                <input
                  className="input"
                  value={form.username}
                  onChange={(e) => update("username", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Email *</label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label">Full Name *</label>
                <input
                  className="input"
                  value={form.fullName}
                  onChange={(e) => update("fullName", e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label">Role</label>
                <select
                  className="input"
                  value={form.roleId}
                  onChange={(e) => update("roleId", e.target.value)}
                  disabled={!form.companyId}
                >
                  <option value="">-- Select Role --</option>
                  {filteredRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Profile Picture</label>
                <div className="flex items-center gap-4">
                  {form.profilePictureUrl && (
                    <div className="w-16 h-16 rounded-full overflow-hidden border border-slate-200">
                      <img
                        src={form.profilePictureUrl}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 text-sm text-slate-500"
                      onChange={handleFileChange}
                      accept="image/*"
                      disabled={uploading}
                    />
                    {uploading && (
                      <span className="text-xs text-brand ml-2">
                        Uploading...
                      </span>
                    )}
                  </div>
                </div>
                <input type="hidden" value={form.profilePictureUrl} />
              </div>

              <div>
                <label className="label">User Type</label>
                <select
                  className="input"
                  value={form.userType}
                  onChange={(e) => update("userType", e.target.value)}
                >
                  <option value="Internal">Internal</option>
                  <option value="External">External</option>
                  <option value="Vendor">Vendor</option>
                  <option value="Customer">Customer</option>
                  <option value="Contractor">Contractor</option>
                </select>
              </div>

              {/* Checkboxes */}
              <div className="flex items-center gap-6 mt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isEmployee}
                    onChange={(e) => update("isEmployee", e.target.checked)}
                    className="w-4 h-4 text-brand rounded focus:ring-brand"
                  />
                  <span className="text-sm font-medium">Is Employee</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => update("isActive", e.target.checked)}
                    className="w-4 h-4 text-brand rounded focus:ring-brand"
                  />
                  <span className="text-sm font-medium">Active Status</span>
                </label>
              </div>

              {/* Validity Dates */}
              <div>
                <label className="label">Valid From</label>
                <input
                  type="date"
                  className="input"
                  value={form.validFrom}
                  onChange={(e) => update("validFrom", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Valid To</label>
                <input
                  type="date"
                  className="input"
                  value={form.validTo}
                  onChange={(e) => update("validTo", e.target.value)}
                />
              </div>

              <div className="md:col-span-2 border-t pt-4 mt-2">
                <label className="label">
                  {isEdit
                    ? "New Password (leave blank to keep current)"
                    : "Password *"}
                </label>
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    required={!isEdit}
                    placeholder={
                      !isEdit ? "Enter password..." : "Enter new password..."
                    }
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-2 flex items-center text-slate-500"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Must be at least 8 characters, include 1 uppercase, 1 number,
                  and 1 special character.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Link to="/administration/users" className="btn-success">
                Cancel
              </Link>
              <button className="btn-success" type="submit" disabled={loading}>
                {loading ? "Saving..." : isEdit ? "Update User" : "Create User"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
