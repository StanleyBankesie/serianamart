import React, { useMemo, useState } from "react";
import { api } from "../../../../api/client";
import { Link } from "react-router-dom";

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
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    company: "",
    address: "",
    serviceType: "",
    department: "",
    requestTitle: "",
    description: "",
    priority: "",
    preferredDate: "",
    preferredTime: "",
    contactMethod: "email",
    recurring: "no",
    additionalNotes: "",
    terms: false,
  });
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [serverRef, setServerRef] = useState({ id: null, request_no: "" });
  const [submitting, setSubmitting] = useState(false);
  const requiredKeys = useMemo(
    () => [
      "fullName",
      "email",
      "phone",
      "serviceType",
      "requestTitle",
      "description",
      "priority",
      "terms",
    ],
    []
  );
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
      fullName: "",
      email: "",
      phone: "",
      company: "",
      address: "",
      serviceType: "",
      department: "",
      requestTitle: "",
      description: "",
      priority: "",
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
    const payload = {
      full_name: form.fullName,
      email: form.email,
      phone: form.phone,
      company: form.company || null,
      address: form.address || null,
      service_type: form.serviceType,
      department: form.department || null,
      request_title: form.requestTitle,
      description: form.description,
      priority: form.priority || "low",
      preferred_date: form.preferredDate || null,
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
    };
    api
      .post("/purchase/service-requests", payload)
      .then((res) => {
        const id = res?.data?.id || null;
        const requestNo = res?.data?.request_no || "";
        setServerRef({ id, request_no: requestNo });
        setShowModal(true);
      })
      .catch((err) => {
        alert(
          err?.response?.data?.message ||
            "Failed to submit request. Please try again."
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
            to="/purchase"
            className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to Purchase
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
            <SectionHeader number="1" title="Personal Information" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">
                  Full Name <span className="text-red-600">*</span>
                </label>
                <input
                  className="input"
                  value={form.fullName}
                  onChange={(e) => update("fullName", e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="label">
                  Email Address <span className="text-red-600">*</span>
                </label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="john.doe@example.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">
                  Phone Number <span className="text-red-600">*</span>
                </label>
                <input
                  className="input"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="+233 555 123 456"
                />
              </div>
              <div>
                <label className="label">Company/Organization</label>
                <input
                  className="input"
                  value={form.company}
                  onChange={(e) => update("company", e.target.value)}
                  placeholder="ABC Corporation"
                />
              </div>
            </div>
            <div>
              <label className="label">Address</label>
              <input
                className="input"
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                placeholder="Street Address, City, State, ZIP"
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body space-y-4">
            <SectionHeader number="2" title="Service Details" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">
                  Service Type <span className="text-red-600">*</span>
                </label>
                <select
                  className="input"
                  value={form.serviceType}
                  onChange={(e) => update("serviceType", e.target.value)}
                >
                  <option value="">Select Service Type</option>
                  <option value="maintenance">Maintenance & Repair</option>
                  <option value="installation">Installation</option>
                  <option value="consultation">Consultation</option>
                  <option value="technical">Technical Support</option>
                  <option value="upgrade">Upgrade/Enhancement</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="label">Department</label>
                <select
                  className="input"
                  value={form.department}
                  onChange={(e) => update("department", e.target.value)}
                >
                  <option value="">Select Department</option>
                  <option value="it">IT Department</option>
                  <option value="facilities">Facilities Management</option>
                  <option value="hr">Human Resources</option>
                  <option value="finance">Finance</option>
                  <option value="operations">Operations</option>
                  <option value="customer">Customer Service</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">
                Request Title <span className="text-red-600">*</span>
              </label>
              <input
                className="input"
                value={form.requestTitle}
                onChange={(e) => update("requestTitle", e.target.value)}
                placeholder="Brief title of your request"
              />
            </div>
            <div>
              <label className="label">
                Detailed Description <span className="text-red-600">*</span>
              </label>
              <textarea
                className="input min-h-28"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Provide a detailed description of your service request..."
              />
            </div>
            <div>
              <label className="label">
                Priority Level <span className="text-red-600">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {[
                  { key: "low", label: "Low", hint: "Can wait a few days" },
                  {
                    key: "medium",
                    label: "Medium",
                    hint: "Within 24-48 hours",
                  },
                  { key: "high", label: "High", hint: "Urgent - ASAP" },
                ].map((opt) => (
                  <label
                    key={opt.key}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                      form.priority === opt.key
                        ? "border-brand-500 bg-brand-50"
                        : "border-slate-200"
                    }`}
                    onClick={() => update("priority", opt.key)}
                  >
                    <input
                      type="radio"
                      className="checkbox checkbox-sm"
                      checked={form.priority === opt.key}
                      onChange={() => update("priority", opt.key)}
                    />
                    <div>
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-xs text-slate-600">{opt.hint}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body space-y-4">
            <SectionHeader number="3" title="Schedule & Preferences" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                <select
                  className="input"
                  value={form.preferredTime}
                  onChange={(e) => update("preferredTime", e.target.value)}
                >
                  <option value="">Select Time</option>
                  <option value="morning">Morning (8AM - 12PM)</option>
                  <option value="afternoon">Afternoon (12PM - 5PM)</option>
                  <option value="evening">Evening (5PM - 8PM)</option>
                  <option value="anytime">Anytime</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Preferred Contact Method</label>
              <div className="flex flex-wrap gap-4">
                {["email", "phone", "sms"].map((m) => (
                  <label key={m} className="flex items-center gap-2">
                    <input
                      type="radio"
                      className="checkbox checkbox-sm"
                      checked={form.contactMethod === m}
                      onChange={() => update("contactMethod", m)}
                    />
                    <span className="capitalize">{m}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body space-y-4">
            <SectionHeader number="4" title="Additional Information" />
            <div>
              <label className="label">Experienced this issue before?</label>
              <div className="flex gap-4">
                {[
                  { key: "yes", label: "Yes" },
                  { key: "no", label: "No" },
                ].map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2">
                    <input
                      type="radio"
                      className="checkbox checkbox-sm"
                      checked={form.recurring === opt.key}
                      onChange={() => update("recurring", opt.key)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Additional Notes/Comments</label>
              <textarea
                className="input min-h-24"
                value={form.additionalNotes}
                onChange={(e) => update("additionalNotes", e.target.value)}
                placeholder="Any other information that might be helpful..."
              />
            </div>
            <div>
              <label className="label">Attach Files</label>
              <div
                className={`rounded-lg border p-6 text-center ${
                  dragActive
                    ? "border-brand-500 bg-brand-50"
                    : "border-slate-200"
                }`}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
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
                  addFiles(Array.from(e.dataTransfer.files || []));
                }}
                onClick={() =>
                  document.getElementById("sr-file-input")?.click()
                }
              >
                <div className="text-3xl mb-2">📎</div>
                <div className="text-sm">
                  Click to upload or drag and drop files here
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  Max file size: 10MB | Supported: PDF, DOC, JPG, PNG
                </div>
                <input
                  id="sr-file-input"
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleFileInput}
                />
              </div>
              {files.length > 0 && (
                <div className="mt-3 space-y-2">
                  {files.map((f) => (
                    <div
                      key={f.name}
                      className="flex items-center justify-between p-2 rounded border border-slate-200"
                    >
                      <div className="text-sm">
                        📄 {f.name} ({(f.size / 1024).toFixed(2)} KB)
                      </div>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => removeFile(f.name)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm">
              <div className="text-blue-900">
                Note: By submitting this service request, you agree to our terms
                of service and privacy policy. We will contact you within 24–48
                hours to confirm your request and provide further details.
              </div>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="checkbox"
                checked={form.terms}
                onChange={(e) => update("terms", e.target.checked)}
              />
              <span className="text-sm">
                I agree to the terms and conditions
              </span>
              <span className="text-red-600">*</span>
            </label>
            <div className="flex flex-col md:flex-row gap-2">
              <button
                type="button"
                className="btn-secondary w-full md:w-auto"
                onClick={resetForm}
              >
                Clear Form
              </button>
              <button type="submit" className="btn-primary w-full md:w-auto">
                Submit Request
              </button>
            </div>
          </div>
        </div>
      </form>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="text-4xl text-green-600">✓</div>
            <div className="text-xl font-semibold mt-2">
              Request Submitted Successfully!
            </div>
            <div className="text-sm mt-1">
              Your service request has been received and is being processed.
            </div>
            <div className="mt-3 text-sm">
              Reference:{" "}
              <span className="font-mono font-semibold">
                {serverRef.request_no || generateRequestId()}
              </span>
            </div>
            {serverRef.id && (
              <div className="text-xs text-slate-600 mt-1">
                Internal ID: {String(serverRef.id)}
              </div>
            )}
            <div className="text-xs text-slate-600 mt-1">
              We will contact you shortly via your preferred method. Please save
              your request ID for reference.
            </div>
            <div className="mt-4">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
