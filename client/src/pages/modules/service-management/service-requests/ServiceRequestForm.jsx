import React, { useMemo, useState, useEffect } from "react";
import { api } from "../../../../api/client";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

function SectionHeader({ number, title }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-semibold">
        {number}
      </div>
      <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </div>
    </div>
  );
}

export default function ServiceRequestForm() {
  const navigate = useNavigate();
  const location = useLocation();
  function normalizeDateString(v) {
    if (!v) return "";
    const s =
      typeof v === "string"
        ? v
        : (() => {
            try {
              return new Date(v).toISOString();
            } catch {
              return String(v);
            }
          })();
    return s.slice(0, 10);
  }
  const [form, setForm] = useState({
    customerType: "",
    customerId: "",
    accountEmail: "",
    email: "",
    phone: "",
    company: "",
    address: "",
    city: "",
    state: "",
    country: "",
    serviceType: "",
    department: "",
    requestTitle: "",
    description: "",
    urgency: "normal",
    preferredDate: "",
    preferredTime: "",
    contactMethod: "email",
    recurring: "no",
    additionalNotes: "",
    terms: false,
  });
  const [customers, setCustomers] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [serverRef, setServerRef] = useState({ id: null, request_no: "" });
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState([]);
  const requiredKeys = useMemo(() => {
    const base = [
      "customerType",
      "serviceType",
      "requestTitle",
      "description",
      "urgency",
      "terms",
    ];
    if (form.customerType === "existing") {
      base.push("customerId");
    } else {
      base.push("company", "email", "phone");
    }
    return base;
  }, [form.customerType]);
  const progress = useMemo(() => {
    let filled = 0;
    for (const k of requiredKeys) {
      const v = form[k];
      if (k === "terms") {
        if (v === true) filled++;
      } else if (typeof v === "string" && v.trim() !== "") {
        filled++;
      }
    }
    return Math.round((filled / requiredKeys.length) * 100);
  }, [form, requiredKeys]);

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    let mounted = true;
    async function fetchCustomers() {
      try {
        const resp = await api.get("/sales/customers");
        const items = Array.isArray(resp.data?.items) ? resp.data.items : [];
        if (mounted) setCustomers(items);
      } catch {
        if (mounted) setCustomers([]);
      }
    }
    async function fetchProspects(q = "") {
      try {
        const resp = await api.get("/sales/prospects", {
          params: { q: q || null },
        });
        const items = Array.isArray(resp.data?.items) ? resp.data.items : [];
        if (mounted) setProspects(items);
      } catch {
        if (mounted) setProspects([]);
      }
    }
    if (form.customerType === "existing") {
      fetchCustomers();
    }
    fetchProspects("");
    return () => {
      mounted = false;
    };
  }, [form.customerType]);

  useEffect(() => {
    let mounted = true;
    async function fetchDepartments() {
      try {
        const resp = await api.get("/admin/departments");
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        if (mounted) setDepartments(rows);
      } catch {
        if (mounted) setDepartments([]);
      }
    }
    fetchDepartments();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    let cancelled = false;
    async function loadExisting() {
      try {
        if (!id) return;
        const resp = await api.get(`/purchase/service-requests/${id}`);
        const item = resp.data?.item;
        if (!item || cancelled) return;
        setForm((prev) => ({
          ...prev,
          customerType: "general",
          customerId: "",
          accountEmail: item.requester_email || "",
          email: item.requester_email || "",
          phone: item.requester_phone || "",
          company: item.requester_full_name || "",
          address: item.requester_address || "",
          city: "",
          state: "",
          country: "",
          serviceType: item.service_type || "",
          department: item.department || "",
          requestTitle: item.request_title || "",
          description: item.description || "",
          urgency: item.priority === "high" ? "emergency" : item.priority === "medium" ? "urgent" : "normal",
          preferredDate: normalizeDateString(item.preferred_date) || "",
          preferredTime: item.preferred_time || "",
          contactMethod: item.contact_method || "email",
          recurring: item.recurring || "no",
          additionalNotes: item.additional_notes || "",
          terms: Boolean(item.agreed_terms),
        }));
      } catch {}
    }
    loadExisting();
    return () => {
      cancelled = true;
    };
  }, [location.search]);

  function handleCustomerSelect(id) {
    const sid = String(id || "");
    update("customerId", sid);
    const cust =
      customers.find((c) => String(c.id) === sid) ||
      customers.find((c) => String(c.customer_code || "") === sid) ||
      null;
    const emailVal = cust.email || form.email || "";
    const phoneVal = cust.phone || cust.mobile || form.phone || "";
    setForm((prev) => ({
      ...prev,
      company: cust.customer_name || prev.company || "",
      email: emailVal,
      phone: phoneVal,
      accountEmail: cust.email || prev.accountEmail || "",
      address: cust.address || prev.address || "",
      city: cust.city || prev.city || "",
      state: cust.state || prev.state || "",
      country: cust.country || prev.country || "",
    }));
  }
  function handleFileInput(e) {
    const incoming = Array.from(e.target.files || []);
    addFiles(incoming);
    e.target.value = "";
  }

  function addFiles(incoming) {
    const next = [...files];
    for (const f of incoming) {
      if (f.size > 10 * 1024 * 1024) {
        alert(`File ${f.name} is too large. Max size is 10MB.`);
        continue;
      }
      next.push(f);
    }
    setFiles(next);
  }

  function removeFile(name) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  function generateRequestId() {
    const prefix = "SR";
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    return `${prefix}-${timestamp}-${random}`;
  }

  function resetForm() {
    setForm({
      email: "",
      phone: "",
      company: "",
      address: "",
      city: "",
      state: "",
      country: "",
      serviceType: "",
      department: "",
      requestTitle: "",
      description: "",
      urgency: "normal",
      preferredDate: "",
      preferredTime: "",
      contactMethod: "email",
      recurring: "no",
      additionalNotes: "",
      terms: false,
    });
    setFiles([]);
  }

  function onSubmit(e) {
    e.preventDefault();
    const incomplete = requiredKeys.filter((k) => {
      const v = form[k];
      return k === "terms" ? !v : !String(v || "").trim();
    });
    if (incomplete.length) {
      alert("Please complete all required fields.");
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    const fullName = String(form.company || "").trim();
    const addrParts = [
      String(form.address || "").trim(),
      String(form.city || "").trim(),
      String(form.state || "").trim(),
      String(form.country || "").trim(),
    ].filter(Boolean);
    const combinedAddress = addrParts.join(", ");
    const priorityMap = { normal: "low", urgent: "medium", emergency: "high" };
    const priority = priorityMap[String(form.urgency || "normal")] || "low";
    const payload = {
      customer_type: form.customerType,
      customer_id: form.customerId || null,
      account_email: form.accountEmail || null,
      full_name: fullName,
      email: form.email,
      phone: form.phone,
      company: form.company || null,
      address: combinedAddress || null,
      service_type: String(form.serviceType || "").trim(),
      department: form.department || null,
      request_title: form.requestTitle,
      description: form.description,
      priority,
      preferred_date: (() => {
        const s = normalizeDateString(form.preferredDate);
        return s ? s : null;
      })(),
      preferred_time: form.preferredTime || null,
      contact_method: form.contactMethod || "email",
      recurring: form.recurring || "no",
      additional_notes: form.additionalNotes || null,
      agreed_terms: form.terms ? 1 : 0,
      attachments: files.map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
      })),
      prospect: {
        prospect_customer: form.company || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        country: form.country || null,
        telephone: form.phone || null,
        email: form.email || null,
      },
    };
    const params = new URLSearchParams(location.search);
    const editId = params.get("id");
    const req = editId
      ? api.put(`/purchase/service-requests/${editId}`, payload)
      : api.post("/purchase/service-requests", payload);
    req
      .then((res) => {
        const requestNo = res?.data?.request_no || "";
        toast.success(
          requestNo
            ? `Service request ${requestNo} submitted successfully`
            : "Service request submitted successfully",
        );
        navigate("/service-management/service-requests");
      })
      .catch((err) => {
        toast.error(
          err?.response?.data?.message ||
            "Failed to submit request. Please try again.",
        );
      })
      .finally(() => {
        setSubmitting(false);
      });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/service-management/service-requests"
            className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to Request List
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            Service Request
          </h1>
          <p className="text-sm mt-1">
            Submit your service request and we will get back to you shortly
          </p>
        </div>
        <div className="w-64">
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs mt-1 text-right">{progress}%</div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="card">
          <div className="card-body space-y-4">
            <SectionHeader number="0" title="Customer Type" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                className={
                  "rounded-lg border px-4 py-3 text-left " +
                  (form.customerType === "existing"
                    ? "bg-brand text-white border-brand"
                    : "border-slate-300 bg-white")
                }
                onClick={() => update("customerType", "existing")}
              >
                <div className="text-sm font-semibold">Existing Customer</div>
                <div className="text-xs">You have an account with us</div>
              </button>
              <button
                type="button"
                className={
                  "rounded-lg border px-4 py-3 text-left " +
                  (form.customerType === "general"
                    ? "bg-brand text-white border-brand"
                    : "border-slate-300 bg-white")
                }
                onClick={() => update("customerType", "general")}
              >
                <div className="text-sm font-semibold">New Customer</div>
                <div className="text-xs">First time requesting service</div>
              </button>
            </div>
            {String(form.customerType || "") === "" && (
              <div className="text-xs text-red-600">
                Please select a customer type
              </div>
            )}
            {form.customerType === "existing" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="label">
                    Customer ID <span className="text-red-600">*</span>
                  </label>
                  <select
                    className="input"
                    value={form.customerId}
                    onChange={(e) => handleCustomerSelect(e.target.value)}
                  >
                    <option value="">Select Customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.customer_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Account Email</label>
                  <input
                    className="input"
                    type="email"
                    value={form.accountEmail}
                    readOnly
                    placeholder="your.email@example.com"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-body space-y-4">
            <SectionHeader number="2" title="Company & Address" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {form.customerType === "general" && (
                <div>
                  <label className="label">Company</label>
                  <div className="relative">
                    <input
                      className="input"
                      list="prospectsList"
                      value={form.company}
                      onChange={async (e) => {
                        const v = e.target.value;
                        update("company", v);
                        try {
                          const resp = await api.get("/sales/prospects", {
                            params: { q: v || null },
                          });
                          const items = Array.isArray(resp.data?.items)
                            ? resp.data.items
                            : [];
                          setProspects(items);
                        } catch {}
                      }}
                      placeholder="Requester / Company"
                    />
                    <datalist id="prospectsList">
                      {prospects.map((p) => (
                        <option key={`${p.company_id}-${p.id}`} value={p.prospect_customer} />
                      ))}
                    </datalist>
                  </div>
                </div>
              )}
              <div>
                <label className="label">Address</label>
                <input
                  className="input"
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  placeholder="123 Main Street"
                />
              </div>
              <div>
                <label className="label">City</label>
                <input
                  className="input"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  placeholder="Accra"
                />
              </div>
              <div>
                <label className="label">State</label>
                <input
                  className="input"
                  value={form.state}
                  onChange={(e) => update("state", e.target.value)}
                  placeholder="Greater Accra"
                />
              </div>
              <div>
                <label className="label">Country</label>
                <input
                  className="input"
                  value={form.country}
                  onChange={(e) => update("country", e.target.value)}
                  placeholder="Ghana"
                />
              </div>
              <div>
                <label className="label">
                  Email <span className="text-red-600">*</span>
                </label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="customer@example.com"
                />
              </div>
              <div>
                <label className="label">Telephone</label>
                <input
                  className="input"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="+233 ..."
                />
              </div>
            </div>
            <SectionHeader number="3" title="Service Details" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Service Type</label>
                <select
                  className="input"
                  value={form.serviceType}
                  onChange={(e) => update("serviceType", e.target.value)}
                >
                  <option value="">Select service</option>
                  <option value="general">General Services</option>
                  <option value="installation">Installation</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="repair">Repair</option>
                  <option value="consultation">Consultation</option>
                </select>
              </div>
              <div>
                <label className="label">Department</label>
                <select
                  className="input"
                  value={form.department}
                  onChange={(e) => update("department", e.target.value)}
                >
                  <option value="">Select department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="label">
                  Request Title <span className="text-red-600">*</span>
                </label>
                <input
                  className="input"
                  value={form.requestTitle}
                  onChange={(e) => update("requestTitle", e.target.value)}
                  placeholder="Brief title of the request"
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">
                  Description <span className="text-red-600">*</span>
                </label>
                <textarea
                  className="input"
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  rows={4}
                  placeholder="Detailed description of the issue or service needed"
                />
              </div>
              <div>
                <label className="label">Urgency</label>
                <select
                  className="input"
                  value={form.urgency}
                  onChange={(e) => update("urgency", e.target.value)}
                >
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
              <div>
                <label className="label">Preferred Date</label>
                <input
                  className="input"
                  type="date"
                  value={form.preferredDate}
                  onChange={(e) => update("preferredDate", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Preferred Time</label>
                <input
                  className="input"
                  type="time"
                  value={form.preferredTime}
                  onChange={(e) => update("preferredTime", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Preferred Contact Method</label>
                <select
                  className="input"
                  value={form.contactMethod}
                  onChange={(e) => update("contactMethod", e.target.value)}
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                </select>
              </div>
              <div>
                <label className="label">Recurring Service</label>
                <select
                  className="input"
                  value={form.recurring}
                  onChange={(e) => update("recurring", e.target.value)}
                >
                  <option value="no">No</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="label">Additional Notes</label>
                <textarea
                  className="input"
                  value={form.additionalNotes}
                  onChange={(e) => update("additionalNotes", e.target.value)}
                  rows={3}
                  placeholder="Any additional information"
                />
              </div>
              <div className="md:col-span-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.terms}
                    onChange={(e) => update("terms", e.target.checked)}
                  />
                  I agree to the terms and conditions
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg">
            <div className="flex justify-between items-center">
              <div className="font-semibold">Attachments (optional)</div>
              <div className="text-xs text-slate-200">
                Ref: {serverRef.request_no || generateRequestId()}
              </div>
            </div>
          </div>
          <div className="card-body space-y-3">
            <div
              className={
                "border-2 border-dashed rounded-lg p-6 text-center transition " +
                (dragActive
                  ? "border-brand-400 bg-brand-50"
                  : "border-slate-300")
              }
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragActive(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                const incoming = Array.from(e.dataTransfer.files || []);
                addFiles(incoming);
              }}
            >
              <div className="text-sm">
                Drag & drop files here or click to upload
              </div>
              <div className="mt-3">
                <input type="file" multiple onChange={handleFileInput} />
              </div>
            </div>
            {files.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Selected Files</div>
                <div className="space-y-2">
                  {files.map((f) => (
                    <div
                      key={f.name}
                      className="flex items-center justify-between p-2 rounded border border-slate-200"
                    >
                      <div>
                        <div className="text-sm font-medium">{f.name}</div>
                        <div className="text-xs text-slate-500">
                          {(f.size / 1024).toFixed(1)} KB •{" "}
                          {f.type || "unknown"}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => removeFile(f.name)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => resetForm()}
          >
            Reset
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            Submit Request
          </button>
        </div>
      </form>

      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="card w-full max-w-md">
            <div className="card-header bg-brand text-white rounded-t-lg">
              <div className="font-semibold">Request Submitted</div>
            </div>
            <div className="card-body space-y-3">
              <div className="text-sm">
                Thank you. Your service request has been submitted successfully.
              </div>
              <div className="text-sm">
                Reference No: {serverRef.request_no || "(pending)"}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                >
                  New Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
