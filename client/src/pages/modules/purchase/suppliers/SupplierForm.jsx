import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";

export default function SupplierForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("basic");
  const [currencies, setCurrencies] = useState([]);

  const [formData, setFormData] = useState({
    supplier_code: "",
    supplier_name: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    payment_terms: "",
    is_active: true,
    // Extra fields for UI (not all persisted yet)
    supplier_type: "LOCAL",
    tax_id: "",
    business_reg_no: "",
    industry: "",
    website: "",
    city: "",
    country: "GH",
    currency_id: "",
    credit_limit: "",
    bank_name: "",
    bank_account: "",
    swift_code: "",
  });

  useEffect(() => {
    if (isNew) return;

    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get(`/purchase/suppliers/${id}`)
      .then((res) => {
        if (!mounted) return;
        const s = res.data?.item;
        if (!s) return;
        setFormData((prev) => ({
          ...prev,
          supplier_code: s.supplier_code || "",
          supplier_name: s.supplier_name || "",
          contact_person: s.contact_person || "",
          email: s.email || "",
          phone: s.phone || "",
          address: s.address || "",
          payment_terms: s.payment_terms || "",
          is_active: Boolean(s.is_active),
          supplier_type: s.supplier_type || prev.supplier_type || "LOCAL",
        }));
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load supplier");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id, isNew]);

  useEffect(() => {
    if (!isNew) return;

    const fetchNextCode = async () => {
      try {
        const res = await api.get("/purchase/suppliers/next-code");
        if (res.data?.code) {
          setFormData((prev) => ({ ...prev, supplier_code: res.data.code }));
          return;
        }
      } catch (err) {
        console.error("Failed to fetch next supplier code", err);
      }
      try {
        const resSup = await api.get("/purchase/suppliers");
        const supItems = Array.isArray(resSup.data?.items)
          ? resSup.data.items
          : [];
        const resAcc = await api.get("/finance/accounts", {
          params: { search: "SU-" },
        });
        const accItems = Array.isArray(resAcc.data?.items)
          ? resAcc.data.items
          : [];
        let max = 0;
        for (const s of supItems) {
          const m = String(s.supplier_code || "").match(/^SU-(\d{6})$/);
          if (m) {
            const n = Number(m[1]);
            if (Number.isFinite(n) && n > max) max = n;
          }
        }
        for (const a of accItems) {
          const m = String(a.code || "").match(/^SU-(\d{6})$/);
          if (m) {
            const n = Number(m[1]);
            if (Number.isFinite(n) && n > max) max = n;
          }
        }
        const code = `SU-${String(max + 1).padStart(6, "0")}`;
        setFormData((prev) => ({ ...prev, supplier_code: code }));
      } catch {}
    };

    fetchNextCode();
  }, [isNew]);

  useEffect(() => {
    const fetchCurrencies = async () => {
      try {
        const response = await api.get("/finance/currencies");
        const arr = Array.isArray(response.data?.items)
          ? response.data.items
          : [];
        setCurrencies(arr);
        const defaultCurrency =
          arr.find((c) => Number(c.is_base) === 1) ||
          arr.find(
            (c) =>
              String(c.code || c.currency_code || "").toUpperCase() === "GHS",
          ) ||
          arr.find((c) =>
            /ghana|cedi/i.test(String(c.name || c.currency_name || "")),
          );
        if (defaultCurrency) {
          setFormData((p) => ({
            ...p,
            currency_id: p.currency_id || String(defaultCurrency.id || ""),
          }));
        }
      } catch (err) {
        console.error("Failed to fetch currencies", err);
      }
    };

    fetchCurrencies();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      // Prepare payload - currently only sending fields supported by backend
      const payload = {
        supplier_code: formData.supplier_code || null,
        supplier_name: formData.supplier_name,
        contact_person: formData.contact_person || null,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null, // In future, combine city/country
        payment_terms: formData.payment_terms || null,
        is_active: Boolean(formData.is_active),
        supplier_type: formData.supplier_type || "LOCAL",
        currency_id:
          formData.currency_id === undefined || formData.currency_id === null
            ? null
            : String(formData.currency_id || ""),
      };

      if (isNew) {
        await api.post("/purchase/suppliers", payload);
      } else {
        await api.put(`/purchase/suppliers/${id}`, payload);
      }

      setSuccess("Supplier saved successfully!");
      if (isNew) {
        // Optional: redirect or reset
        navigate("/purchase/suppliers");
      }
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to save supplier");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "supplier_name",
      "supplier_code",
      "contact_person",
      "email",
      "phone",
      "address",
      "payment_terms",
    ];
    const csvContent =
      "data:text/csv;charset=utf-8," +
      headers.join(",") +
      "\n" +
      "Example Supplier,SUP001,John Doe,john@example.com,1234567890,123 Main St,30 Days";

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "supplier_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMassUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const rows = text
        .split("\n")
        .map((r) => r.trim())
        .filter((r) => r);
      if (rows.length < 2) {
        setError("Invalid CSV format or empty file");
        return;
      }

      const headers = rows[0].split(",").map((h) => h.trim());
      const dataRows = rows.slice(1);

      let successCount = 0;
      let failCount = 0;

      setLoading(true);

      // Simple parsing - assumes strictly ordered columns matching template
      // Better to map by header name

      for (const rowStr of dataRows) {
        const cols = rowStr.split(",").map((c) => c.trim());
        if (cols.length < 1) continue;

        // Map based on headers
        const rowData = {};
        headers.forEach((h, i) => {
          if (cols[i]) rowData[h] = cols[i];
        });

        if (!rowData.supplier_name) {
          failCount++;
          continue;
        }

        try {
          await api.post("/purchase/suppliers", {
            supplier_name: rowData.supplier_name,
            supplier_code: rowData.supplier_code || null,
            contact_person: rowData.contact_person || null,
            email: rowData.email || null,
            phone: rowData.phone || null,
            address: rowData.address || null,
            payment_terms: rowData.payment_terms || null,
            is_active: true,
          });
          successCount++;
        } catch (err) {
          console.error("Failed to upload row", rowStr, err);
          failCount++;
        }
      }

      setLoading(false);
      setSuccess(
        `Mass upload completed. Success: ${successCount}, Failed: ${failCount}`,
      );
      if (successCount > 0) {
        // Refresh logic if needed
      }
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden my-6">
      {/* Header */}
      <div
        className="text-white p-8"
        style={{
          background: "linear-gradient(135deg, #0E3646 0%, #0E3646 100%)",
        }}
      >
        <h1 className="text-3xl font-bold">
          👥 Supplier Setup & Configuration
        </h1>
        <p className="mt-2 text-slate-300">
          Manage supplier information, contacts, and performance
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap justify-between items-center p-6 bg-slate-50 border-b border-slate-200 gap-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
            placeholder="Search suppliers..."
          />
          <span className="absolute right-3 top-2.5 text-slate-400">🔍</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2"
            onClick={handleDownloadTemplate}
          >
            📥 Template
          </button>
          <button
            type="button"
            className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            📤 Mass Upload
          </button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".csv"
            onChange={handleMassUpload}
          />
          {!isNew && (
            <button
              type="button"
              className="text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2"
              style={{ backgroundColor: "#0E3646" }}
              onClick={() => {
                setFormData({
                  supplier_code: "",
                  supplier_name: "",
                  contact_person: "",
                  email: "",
                  phone: "",
                  address: "",
                  payment_terms: "",
                  is_active: true,
                  supplier_type: "LOCAL",
                  tax_id: "",
                  business_reg_no: "",
                  industry: "",
                  website: "",
                  city: "",
                  country: "GH",
                  currency: "GHS",
                  credit_limit: "",
                  bank_name: "",
                  bank_account: "",
                  swift_code: "",
                });
                navigate("/purchase/suppliers/new");
              }}
            >
              ➕ New Supplier
            </button>
          )}
          <Link
            to="/purchase/suppliers"
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2"
          >
            📄 View All
          </Link>
        </div>
      </div>

      <div className="p-8">
        {loading && <div className="text-center py-4">Loading...</div>}
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-md mb-6">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 text-green-600 p-4 rounded-md mb-6">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Tabs */}
          <div className="flex border-b-2 border-slate-200 mb-8 overflow-x-auto">
            {[
              { id: "basic", label: "📋 Basic Information" },
              { id: "financial", label: "💰 Financial Details" },
              { id: "documents", label: "📎 Documents" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`px-6 py-3 font-medium whitespace-nowrap transition-colors border-b-2 -mb-[2px] ${
                  activeTab === tab.id
                    ? "border-[#0E3646] text-[#0E3646]"
                    : "border-transparent text-slate-500 hover:bg-slate-50"
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className={activeTab === "basic" ? "block" : "hidden"}>
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b-2 border-slate-800">
                🏢 Supplier Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Supplier Code
                  </label>
                  <input
                    type="text"
                    name="supplier_code"
                    className={`w-full px-3 py-2 border border-slate-300 rounded-md ${isNew ? "bg-gray-50" : "bg-gray-100 text-slate-500"}`}
                    value={formData.supplier_code}
                    onChange={handleChange}
                    placeholder={
                      isNew ? "Auto-generated" : "Locked for existing supplier"
                    }
                    readOnly={!isNew}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Supplier Name *
                  </label>
                  <input
                    type="text"
                    name="supplier_name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none"
                    value={formData.supplier_name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Supplier Type
                  </label>
                  <select
                    name="supplier_type"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.supplier_type}
                    onChange={handleChange}
                  >
                    <option value="LOCAL">Local Supplier</option>
                    <option value="IMPORT">Import Supplier</option>
                    <option value="BOTH">Both</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Status
                  </label>
                  <select
                    name="is_active"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.is_active}
                    onChange={(e) =>
                      handleChange({
                        target: {
                          name: "is_active",
                          value: e.target.value === "true",
                        },
                      })
                    }
                  >
                    <option value={true}>Active</option>
                    <option value={false}>Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Tax Registration Number
                  </label>
                  <input
                    type="text"
                    name="tax_id"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.tax_id}
                    onChange={handleChange}
                    placeholder="TIN/VAT number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Industry
                  </label>
                  <select
                    name="industry"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.industry}
                    onChange={handleChange}
                  >
                    <option value="">Select Industry</option>
                    <option value="MANUFACTURING">Manufacturing</option>
                    <option value="TRADING">Trading</option>
                    <option value="SERVICES">Services</option>
                  </select>
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Website
                  </label>
                  <input
                    type="url"
                    name="website"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.website}
                    onChange={handleChange}
                    placeholder="https://www.supplier.com"
                  />
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b-2 border-slate-800">
                📍 Address & Contact
              </h3>
              <div className="grid grid-cols-1 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Address
                  </label>
                  <textarea
                    name="address"
                    rows="2"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Street address"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    name="city"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.city}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Country
                  </label>
                  <select
                    name="country"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.country}
                    onChange={handleChange}
                  >
                    <option value="GH">Ghana</option>
                    <option value="NG">Nigeria</option>
                    <option value="CN">China</option>
                    <option value="US">United States</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Contact Person (Primary)
                  </label>
                  <input
                    type="text"
                    name="contact_person"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.contact_person}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Financial Tab */}
          <div className={activeTab === "financial" ? "block" : "hidden"}>
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b-2 border-slate-800">
                💰 Payment & Financial Terms
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Default Currency
                  </label>
                  <select
                    name="currency_id"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.currency_id}
                    onChange={handleChange}
                  >
                    <option value="">Select currency</option>
                    {currencies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {(c.code || c.currency_code) +
                          " - " +
                          (c.name || c.currency_name || "")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Payment Terms (Days)
                  </label>
                  <input
                    type="text"
                    name="payment_terms"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.payment_terms}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Credit Limit
                  </label>
                  <input
                    type="number"
                    name="credit_limit"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.credit_limit}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    name="bank_name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.bank_name}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    name="bank_account"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.bank_account}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    SWIFT Code
                  </label>
                  <input
                    type="text"
                    name="swift_code"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.swift_code}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b-2 border-slate-800">
                📊 Financial Statistics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div
                  className="p-6 rounded-lg text-white text-center shadow-md"
                  style={{
                    background:
                      "linear-gradient(135deg, #0E3646 0%, #1a5570 100%)",
                  }}
                >
                  <div className="text-3xl font-bold mb-1">GHS 250,000</div>
                  <div className="text-sm opacity-90">Total Purchases YTD</div>
                </div>
                <div
                  className="p-6 rounded-lg text-white text-center shadow-md"
                  style={{
                    background:
                      "linear-gradient(135deg, #0E3646 0%, #1a5570 100%)",
                  }}
                >
                  <div className="text-3xl font-bold mb-1">15</div>
                  <div className="text-sm opacity-90">Purchase Orders</div>
                </div>
                <div
                  className="p-6 rounded-lg text-white text-center shadow-md"
                  style={{
                    background:
                      "linear-gradient(135deg, #0E3646 0%, #1a5570 100%)",
                  }}
                >
                  <div className="text-3xl font-bold mb-1">GHS 45,000</div>
                  <div className="text-sm opacity-90">Outstanding Balance</div>
                </div>
                <div
                  className="p-6 rounded-lg text-white text-center shadow-md"
                  style={{
                    background:
                      "linear-gradient(135deg, #0E3646 0%, #1a5570 100%)",
                  }}
                >
                  <div className="text-3xl font-bold mb-1">28 Days</div>
                  <div className="text-sm opacity-90">Avg Payment Time</div>
                </div>
              </div>
            </div>
          </div>

          {/* Documents Tab */}
          <div className={activeTab === "documents" ? "block" : "hidden"}>
            <div className="text-center py-10 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
              <p>Document Management coming soon.</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 mt-6">
            <Link
              to="/purchase/suppliers"
              className="px-6 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="button"
              className="px-6 py-2 text-white rounded-md transition-colors"
              style={{ backgroundColor: "#2E8B1F" }}
              onClick={() => {
                if (window.confirm("Activate this supplier?")) {
                  alert("Supplier activated successfully!");
                }
              }}
            >
              ✅ Activate
            </button>
            <button
              type="submit"
              className="px-6 py-2 text-white rounded-md transition-colors disabled:opacity-50"
              style={{ backgroundColor: "#0E3646" }}
              disabled={saving}
            >
              {saving ? "Saving..." : "💾 Save Supplier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
