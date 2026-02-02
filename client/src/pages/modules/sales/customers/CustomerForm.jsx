import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../../api/client";

export default function CustomerForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [priceTypes, setPriceTypes] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [form, setForm] = useState({
    customer_code: "",
    customer_name: "",
    email: "",
    phone: "",
    is_active: true,
    address: "",
    city: "",
    state: "",
    zone: "",
    country: "",
    price_type_id: "",
    currency_id: "",
  });

  useEffect(() => {
    fetchPriceTypes();
    fetchCurrencies();
    if (isEdit) {
      fetchCustomer();
    } else {
      fetchNextCode();
    }
  }, [id]);

  async function fetchNextCode() {
    try {
      const response = await api.get("/sales/customers/next-code");
      if (response.data?.code) {
        update("customer_code", response.data.code);
      }
    } catch (err) {
      console.error("Error fetching next customer code", err);
    }
  }

  async function fetchPriceTypes() {
    try {
      const response = await api.get("/sales/price-types");
      setPriceTypes(
        Array.isArray(response.data?.items) ? response.data.items : []
      );
    } catch (err) {
      console.error("Error fetching price types", err);
    }
  }

  async function fetchCurrencies() {
    try {
      const response = await api.get("/finance/currencies");
      const arr = Array.isArray(response.data?.items) ? response.data.items : [];
      setCurrencies(arr);
      const base = arr.find((c) => Number(c.is_base) === 1);
      if (!isEdit && base) {
        update("currency_id", String(base.id));
      }
    } catch (err) {
      console.error("Error fetching currencies", err);
    }
  }

  async function fetchCustomer() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get(`/sales/customers/${id}`);
      if (response.data?.item) {
        setForm(response.data.item);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Error fetching customer");
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
        await api.put(`/sales/customers/${id}`, form);
      } else {
        await api.post("/sales/customers", form);
      }
      navigate("/sales/customers");
    } catch (err) {
      setError(err?.response?.data?.message || "Error saving customer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              {isEdit ? "Edit Customer" : "New Customer"}
            </h1>
          </div>
          <Link to="/sales/customers" className="btn-success">
            Back
          </Link>
        </div>
      </div>

      <form onSubmit={submit}>
        <div className="card">
          <div className="card-body space-y-4">
            {error && <div className="alert alert-error">{error}</div>}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form Section */}
              <div className="lg:col-span-2 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Customer Code</label>
                    <input
                      className="input"
                      value={form.customer_code || ""}
                      onChange={(e) => update("customer_code", e.target.value)}
                      placeholder="Auto-generated if empty"
                    />
                  </div>
                  <div>
                    <label className="label">Customer Name *</label>
                    <input
                      className="input"
                      value={form.customer_name || ""}
                      onChange={(e) => update("customer_name", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Customer Type</label>
                    <select
                      className="input"
                      value={form.customer_type || "Individual"}
                      onChange={(e) => update("customer_type", e.target.value)}
                    >
                      <option value="Individual">Individual</option>
                      <option value="Business">Business</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Contact Person</label>
                    <input
                      className="input"
                      value={form.contact_person || ""}
                      onChange={(e) => update("contact_person", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input
                      className="input"
                      type="email"
                      value={form.email || ""}
                      onChange={(e) => update("email", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <input
                      className="input"
                      value={form.phone || ""}
                      onChange={(e) => update("phone", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Mobile</label>
                    <input
                      className="input"
                      value={form.mobile || ""}
                      onChange={(e) => update("mobile", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Credit Limit</label>
                    <input
                      className="input"
                      type="number"
                      value={form.credit_limit || ""}
                      onChange={(e) => update("credit_limit", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Payment Terms</label>
                    <select
                      className="input"
                      value={form.payment_terms || "Net 30"}
                      onChange={(e) => update("payment_terms", e.target.value)}
                    >
                      <option value="Immediate">Immediate</option>
                      <option value="Net 15">Net 15</option>
                      <option value="Net 30">Net 30</option>
                      <option value="Net 45">Net 45</option>
                      <option value="Net 60">Net 60</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <select
                      className="input"
                      value={form.is_active ? "1" : "0"}
                      onChange={(e) =>
                        update("is_active", e.target.value === "1")
                      }
                    >
                      <option value="1">Active</option>
                      <option value="0">Inactive</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Address</label>
                    <textarea
                      className="input"
                      rows="3"
                      value={form.address || ""}
                      onChange={(e) => update("address", e.target.value)}
                    ></textarea>
                  </div>
                  <div>
                    <label className="label">City</label>
                    <input
                      className="input"
                      value={form.city || ""}
                      onChange={(e) => update("city", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">State</label>
                    <input
                      className="input"
                      value={form.state || ""}
                      onChange={(e) => update("state", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Zone</label>
                    <input
                      className="input"
                      value={form.zone || ""}
                      onChange={(e) => update("zone", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Country</label>
                    <input
                      className="input"
                      value={form.country || ""}
                      onChange={(e) => update("country", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Price Type</label>
                    <select
                      className="input"
                      value={form.price_type_id || ""}
                      onChange={(e) => update("price_type_id", e.target.value)}
                    >
                      <option value="">-- Select Price Type --</option>
                      {priceTypes.map((pt) => (
                        <option key={pt.id} value={pt.id}>
                          {pt.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Currency</label>
                    <select
                      className="input"
                      value={form.currency_id || ""}
                      onChange={(e) => update("currency_id", e.target.value)}
                    >
                      <option value="">-- Select Currency --</option>
                      {currencies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {(c.code || c.currency_code) +
                            " - " +
                            (c.name || c.currency_name || "")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Link to="/sales/customers" className="btn btn-secondary">
                    Cancel
                  </Link>
                  <button className="btn-success" disabled={loading}>
                    {loading ? "Saving..." : "Save Customer"}
                  </button>
                </div>
              </div>

              {/* Preview Section */}
              <div className="lg:col-span-1">
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-700 sticky top-4">
                  <h3 className="text-lg font-bold mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                    Customer Preview
                  </h3>

                  {!form.customer_code && !form.customer_name ? (
                    <div className="text-center py-10 text-slate-400">
                      <div className="text-5xl mb-3">👤</div>
                      <p>Fill in the form to preview customer details</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                          Customer Code
                        </span>
                        <div className="font-mono text-brand-600 font-medium">
                          {form.customer_code || "(Auto-generated)"}
                        </div>
                      </div>

                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                          Customer Name
                        </span>
                        <div className="text-lg font-bold">
                          {form.customer_name}
                        </div>
                        {form.customer_type && (
                          <span className="inline-block bg-slate-200 dark:bg-slate-700 text-xs px-2 py-0.5 rounded mt-1">
                            {form.customer_type}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                            Contact
                          </span>
                          <div className="text-sm">
                            {form.contact_person || "-"}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                            Phone
                          </span>
                          <div className="text-sm">{form.phone || "-"}</div>
                        </div>
                      </div>

                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                          Email
                        </span>
                        <div className="text-sm break-all text-brand-500">
                          {form.email || "-"}
                        </div>
                      </div>

                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                          Credit Limit
                        </span>
                        <div className="font-medium text-green-600">
                          {form.credit_limit
                            ? `${Number(form.credit_limit).toLocaleString()}`
                            : "0.00"}
                        </div>
                      </div>

                      {form.address && (
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                            Address
                          </span>
                          <div className="text-sm whitespace-pre-wrap">
                            {form.address}
                          </div>
                        </div>
                      )}

                      {(form.city ||
                        form.state ||
                        form.country ||
                        form.zone) && (
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                            Location
                          </span>
                          <div className="text-sm">
                            {[form.city, form.state, form.country]
                              .filter(Boolean)
                              .join(", ")}
                            {form.zone && (
                              <div className="text-xs text-slate-500 mt-1">
                                Zone: {form.zone}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {form.price_type_id && (
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                            Price Type
                          </span>
                          <div className="text-sm">
                            {priceTypes.find(
                              (pt) =>
                                String(pt.id) === String(form.price_type_id)
                            )?.name || form.price_type_id}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
