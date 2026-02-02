import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";

export default function CompanyForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    code: "",
    name: "",
    isActive: true,
    address: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
    telephone: "",
    email: "",
    website: "",
    tax_id: "",
    registration_no: "",
    fiscal_year_start_month: 1,
    timezone: "",
    currency_id: "",
  });
  const [currencies, setCurrencies] = useState([]);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState("");

  useEffect(() => {
    fetchCurrencies();
    if (isEdit) {
      fetchCompany();
    }
  }, [id]);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  async function fetchCompany() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get(`/admin/companies/${id}`);
      if (response.data?.item) {
        const it = response.data.item;
        setForm({
          code: it.code || "",
          name: it.name || "",
          isActive: it.is_active === 1 || it.is_active === true,
          address: it.address || "",
          city: it.city || "",
          state: it.state || "",
          postal_code: it.postal_code || "",
          country: it.country || "",
          telephone: it.telephone || "",
          email: it.email || "",
          website: it.website || "",
          tax_id: it.tax_id || "",
          registration_no: it.registration_no || "",
          fiscal_year_start_month: it.fiscal_year_start_month || 1,
          timezone: it.timezone || "",
          currency_id: it.currency_id || "",
        });
        try {
          const logoResp = await api.get(`/admin/companies/${id}/logo`, {
            responseType: "blob",
          });
          const url = URL.createObjectURL(logoResp.data);
          setLogoPreview(url);
        } catch {}
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Error fetching company");
    } finally {
      setLoading(false);
    }
  }

  async function fetchCurrencies() {
    try {
      const resp = await api.get("/finance/currencies");
      const arr = Array.isArray(resp.data?.items) ? resp.data.items : [];
      setCurrencies(arr);
    } catch {}
  }

  function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    setLogoError("");
    if (!file) return;
    if (!String(file.type).startsWith("image/")) {
      setLogoError("Only image files are allowed");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("Image size must be less than 2MB");
      return;
    }
    setLogoFile(file);
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
  }

  async function uploadLogo() {
    if (!isEdit) {
      setLogoError("Save company first before uploading logo");
      return;
    }
    if (!logoFile) {
      setLogoError("Choose an image file to upload");
      return;
    }
    setLogoUploading(true);
    setLogoError("");
    try {
      const formData = new FormData();
      formData.append("logo", logoFile);
      await api.post(`/admin/companies/${id}/logo`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    } catch (err) {
      setLogoError(err?.response?.data?.message || "Failed to upload logo");
    } finally {
      setLogoUploading(false);
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
        name: form.name,
        code: form.code,
        is_active: form.isActive ? 1 : 0,
        address: form.address || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        postal_code: form.postal_code || undefined,
        country: form.country || undefined,
        telephone: form.telephone || undefined,
        email: form.email || undefined,
        website: form.website || undefined,
        tax_id: form.tax_id || undefined,
        registration_no: form.registration_no || undefined,
        fiscal_year_start_month:
          form.fiscal_year_start_month !== undefined &&
          form.fiscal_year_start_month !== null
            ? Number(form.fiscal_year_start_month)
            : undefined,
        timezone: form.timezone || undefined,
        currency_id:
          form.currency_id !== "" && form.currency_id !== null
            ? Number(form.currency_id)
            : undefined,
      };
      if (isEdit) {
        await api.put(`/admin/companies/${id}`, payload);
      } else {
        const res = await api.post("/admin/companies", payload);
        const newId = res.data?.id;
        if (newId) {
          await api.put(`/admin/companies/${newId}`, payload);
        }
      }
      navigate("/administration/companies");
    } catch (err) {
      setError(err?.response?.data?.message || "Error saving company");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/administration/companies"
          className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 mb-2 inline-block"
        >
          ← Back to Companies
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isEdit ? "Edit Company" : "New Company"}
        </h1>
        <p className="text-sm mt-1">Company profile</p>
      </div>

      <form onSubmit={submit}>
        <div className="card">
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Code *</label>
                <input
                  className="input"
                  value={form.code}
                  onChange={(e) => update("code", e.target.value)}
                  required
                />
              </div>
              <div>
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
              <div className="md:col-span-2">
                <label className="label">Address</label>
                <input
                  className="input"
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
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
              <div>
                <label className="label">Website</label>
                <input
                  className="input"
                  value={form.website}
                  onChange={(e) => update("website", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Tax ID</label>
                <input
                  className="input"
                  value={form.tax_id}
                  onChange={(e) => update("tax_id", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Registration No.</label>
                <input
                  className="input"
                  value={form.registration_no}
                  onChange={(e) => update("registration_no", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Fiscal Year Start Month</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="12"
                  value={form.fiscal_year_start_month}
                  onChange={(e) =>
                    update("fiscal_year_start_month", e.target.value)
                  }
                />
              </div>
              <div>
                <label className="label">Timezone</label>
                <input
                  className="input"
                  value={form.timezone}
                  onChange={(e) => update("timezone", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Currency</label>
                <select
                  className="input"
                  value={form.currency_id}
                  onChange={(e) => update("currency_id", e.target.value)}
                >
                  <option value="">Select Currency</option>
                  {currencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {(c.code || c.currency_code) +
                        " - " +
                        (c.name || c.currency_name)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="label">Company Logo</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 border border-gray-200 rounded-lg flex items-center justify-center bg-white dark:bg-slate-800">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo Preview"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-sm text-slate-500">No logo</span>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="input"
                    />
                    <div className="mt-2">
                      {logoFile && (
                        <button
                          type="button"
                          onClick={uploadLogo}
                          className="btn-success"
                          disabled={logoUploading}
                        >
                          {logoUploading ? "Uploading..." : "Upload Logo"}
                        </button>
                      )}
                    </div>
                    {logoError && (
                      <div className="text-red-600 text-xs mt-2">
                        {logoError}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Link to="/administration/companies" className="btn-success">
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
