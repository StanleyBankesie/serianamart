import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";

function SummaryBox({ html }) {
  return (
    <div className="card">
      <div className="card-body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

export default function ServiceOrderForm() {
  const [activeTab, setActiveTab] = useState("internal");
  const [showModal, setShowModal] = useState(false);
  const [orderNo, setOrderNo] = useState("");

  const [intCustType, setIntCustType] = useState("");
  const [intExisting, setIntExisting] = useState({ custId: "", accEmail: "" });
  const [intPerson, setIntPerson] = useState({
    fname: "",
    lname: "",
    email: "",
    phone: "",
  });
  const [intService, setIntService] = useState({
    servCat: "",
    items: [],
  });
  const [intSchedule, setIntSchedule] = useState({
    addr: "",
    date: "",
    time: "",
  });
  const [intPayment, setIntPayment] = useState("");

  const [extDept, setExtDept] = useState({ dept: "", cost: "" });
  const [extRequestor, setExtRequestor] = useState({
    name: "",
    title: "",
    email: "",
    phone: "",
  });
  const [extContractor, setExtContractor] = useState({
    name: "",
    id: "",
    email: "",
    phone: "",
  });
  const [extReqs, setExtReqs] = useState({
    cat: "",
    scope: "",
  });
  const [extTimeline, setExtTimeline] = useState({
    loc: "",
    start: "",
    end: "",
  });
  const [extBudget, setExtBudget] = useState({
    estCost: "",
    currency: "USD",
  });

  function generateOrderNo() {
    return `ORD-${Date.now().toString().slice(-8)}`;
  }

  function addServiceItem() {
    setIntService((p) => ({
      ...p,
      items: [
        ...p.items,
        { id: crypto.randomUUID(), desc: "", qty: 1, price: 0, sub: 0 },
      ],
    }));
  }

  function updateItem(id, key, value) {
    setIntService((p) => {
      const items = p.items.map((it) => {
        if (it.id === id) {
          const next = { ...it, [key]: value };
          const qty = parseFloat(next.qty || 0);
          const price = parseFloat(next.price || 0);
          next.sub = qty * price;
          return next;
        }
        return it;
      });
      return { ...p, items };
    });
  }

  function removeItem(id) {
    setIntService((p) => ({
      ...p,
      items: p.items.filter((it) => it.id !== id),
    }));
  }

  const intSummaryHtml = useMemo(() => {
    let total = 0;
    let html = '<div class="sum-item"><strong>Services</strong></div>';
    for (const it of intService.items) {
      const desc = String(it.desc || "Service");
      const qty = parseFloat(it.qty || 0);
      const price = parseFloat(it.price || 0);
      const sub = qty * price;
      if (sub > 0) {
        html += `<div class="sum-item"><span>${desc} (x${qty})</span><span>$${sub.toFixed(
          2,
        )}</span></div>`;
      }
      total += sub;
    }
    if (intCustType === "existing") {
      const disc = total * 0.1;
      html += `<div class="sum-item"><span>Discount (10%)</span><span style="color:#27ae60">-$${disc.toFixed(
        2,
      )}</span></div>`;
      total -= disc;
    }
    if (total > 0) {
      html += `<div class="sum-total"><span>Total</span><span>$${total.toFixed(
        2,
      )}</span></div>`;
    } else {
      html =
        '<p style="text-align:center;color:#7f8c8d;padding:20px">Add services to see summary</p>';
    }
    return html;
  }, [intService.items, intCustType]);

  function resetInternal() {
    setIntCustType("");
    setIntExisting({ custId: "", accEmail: "" });
    setIntPerson({ fname: "", lname: "", email: "", phone: "" });
    setIntService({ servCat: "", items: [] });
    setIntSchedule({ addr: "", date: "", time: "" });
    setIntPayment("");
  }

  function resetExternal() {
    setExtDept({ dept: "", cost: "" });
    setExtRequestor({ name: "", title: "", email: "", phone: "" });
    setExtContractor({ name: "", id: "", email: "", phone: "" });
    setExtReqs({ cat: "", scope: "" });
    setExtTimeline({ loc: "", start: "", end: "" });
    setExtBudget({ estCost: "", currency: "USD" });
  }

  function submitInternal(e) {
    e.preventDefault();
    const num = generateOrderNo();
    setOrderNo(num);
    setShowModal(true);
  }

  function submitExternal(e) {
    e.preventDefault();
    const num = generateOrderNo();
    setOrderNo(num);
    setShowModal(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/service-management"
            className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to Service Management
          </Link>
          <h1 className="text-2xl font-bold mt-2">Service Order Management</h1>
          <p className="text-sm mt-1">
            Comprehensive order system for internal services and external
            contractors
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h2 className="text-xl font-semibold dark:text-brand-300">
                Service Orders
              </h2>
              <p className="text-sm mt-1">
                Internal services and external contractor orders
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className={
                  activeTab === "internal" ? "btn-primary" : "btn-secondary"
                }
                onClick={() => setActiveTab("internal")}
              >
                Internal Order
              </button>
              <button
                type="button"
                className={
                  activeTab === "external" ? "btn-primary" : "btn-secondary"
                }
                onClick={() => setActiveTab("external")}
              >
                External Order
              </button>
            </div>
          </div>
        </div>

        <div className="card-body">
          {activeTab === "internal" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <form onSubmit={submitInternal}>
                  <div className="section-header">
                    <h3>👤 Customer Information</h3>
                    <p>Select customer type and provide details</p>
                  </div>

                  <div className="group">
                    <label>
                      Customer Type <span className="req">*</span>
                    </label>
                    <div style={{ display: "flex", gap: 15, marginBottom: 12 }}>
                      <div
                        className={`btn-group ${intCustType === "existing" ? "active" : ""}`}
                        onClick={() => setIntCustType("existing")}
                      >
                        <h4>Existing Customer</h4>
                        <p>10% loyalty discount</p>
                      </div>
                      <div
                        className={`btn-group ${intCustType === "general" ? "active" : ""}`}
                        onClick={() => setIntCustType("general")}
                      >
                        <h4>General Public</h4>
                        <p>Standard pricing</p>
                      </div>
                    </div>
                  </div>

                  {intCustType === "existing" && (
                    <div className="form-grid">
                      <div className="group">
                        <label>
                          Customer ID <span className="req">*</span>
                        </label>
                        <input
                          className="input"
                          value={intExisting.custId}
                          onChange={(e) =>
                            setIntExisting((p) => ({
                              ...p,
                              custId: e.target.value,
                            }))
                          }
                          placeholder="CUST-12345"
                        />
                      </div>
                      <div className="group">
                        <label>
                          Account Email <span className="req">*</span>
                        </label>
                        <input
                          className="input"
                          type="email"
                          value={intExisting.accEmail}
                          onChange={(e) =>
                            setIntExisting((p) => ({
                              ...p,
                              accEmail: e.target.value,
                            }))
                          }
                          placeholder="account@example.com"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="group">
                      <label>
                        First Name <span className="req">*</span>
                      </label>
                      <input
                        className="input"
                        value={intPerson.fname}
                        onChange={(e) =>
                          setIntPerson((p) => ({ ...p, fname: e.target.value }))
                        }
                        placeholder="John"
                      />
                    </div>
                    <div className="group">
                      <label>
                        Last Name <span className="req">*</span>
                      </label>
                      <input
                        className="input"
                        value={intPerson.lname}
                        onChange={(e) =>
                          setIntPerson((p) => ({ ...p, lname: e.target.value }))
                        }
                        placeholder="Doe"
                      />
                    </div>
                    <div className="group">
                      <label>
                        Email <span className="req">*</span>
                      </label>
                      <input
                        className="input"
                        type="email"
                        value={intPerson.email}
                        onChange={(e) =>
                          setIntPerson((p) => ({ ...p, email: e.target.value }))
                        }
                        placeholder="customer@example.com"
                      />
                    </div>
                    <div className="group">
                      <label>
                        Phone <span className="req">*</span>
                      </label>
                      <input
                        className="input"
                        value={intPerson.phone}
                        onChange={(e) =>
                          setIntPerson((p) => ({ ...p, phone: e.target.value }))
                        }
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                  </div>

                  <div className="section-header">
                    <h3>🛠️ Service Selection</h3>
                    <p>Choose service category and add items</p>
                  </div>

                  <div className="group">
                    <label>
                      Service Category <span className="req">*</span>
                    </label>
                    <select
                      className="input"
                      value={intService.servCat}
                      onChange={(e) =>
                        setIntService((p) => ({
                          ...p,
                          servCat: e.target.value,
                        }))
                      }
                    >
                      <option value="">-- Select Category --</option>
                      <option value="consulting">Consulting & Advisory</option>
                      <option value="installation">Installation & Setup</option>
                      <option value="maintenance">Maintenance & Support</option>
                      <option value="repair">Repair & Troubleshooting</option>
                      <option value="training">Training & Education</option>
                      <option value="custom">Custom/Specialized</option>
                    </select>
                  </div>

                  <div className="card">
                    <div className="card-body">
                      <h4 style={{ color: "var(--primary)", marginBottom: 10 }}>
                        📋 Service Items
                      </h4>
                      <div>
                        {intService.items.map((it) => (
                          <div
                            key={it.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "2fr 1fr 100px 120px 40px",
                              gap: 12,
                              marginBottom: 10,
                              padding: 10,
                              background: "var(--white)",
                              border: "2px solid var(--border)",
                              borderRadius: 6,
                            }}
                          >
                            <input
                              className="input"
                              value={it.desc}
                              onChange={(e) =>
                                updateItem(it.id, "desc", e.target.value)
                              }
                              placeholder="Service description"
                            />
                            <input
                              className="input"
                              type="number"
                              min="1"
                              value={it.qty}
                              onChange={(e) =>
                                updateItem(it.id, "qty", e.target.value)
                              }
                            />
                            <input
                              className="input"
                              type="number"
                              step="0.01"
                              min="0"
                              value={it.price}
                              onChange={(e) =>
                                updateItem(it.id, "price", e.target.value)
                              }
                              placeholder="0.00"
                            />
                            <input
                              className="input"
                              readOnly
                              value={(
                                parseFloat(it.qty || 0) *
                                parseFloat(it.price || 0)
                              ).toFixed(2)}
                            />
                            <button
                              type="button"
                              className="btn-danger"
                              onClick={() => removeItem(it.id)}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="btn-primary mt-2"
                        onClick={addServiceItem}
                      >
                        + Add Service Item
                      </button>
                    </div>
                  </div>

                  <div className="section-header">
                    <h3>📍 Location & Schedule</h3>
                    <p>Where and when should service be performed?</p>
                  </div>

                  <div className="group">
                    <label>
                      Service Address <span className="req">*</span>
                    </label>
                    <textarea
                      className="input"
                      value={intSchedule.addr}
                      onChange={(e) =>
                        setIntSchedule((p) => ({ ...p, addr: e.target.value }))
                      }
                      placeholder="Complete address"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="group">
                      <label>
                        Service Date <span className="req">*</span>
                      </label>
                      <input
                        className="input"
                        type="date"
                        value={intSchedule.date}
                        onChange={(e) =>
                          setIntSchedule((p) => ({
                            ...p,
                            date: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="group">
                      <label>
                        Time Slot <span className="req">*</span>
                      </label>
                      <select
                        className="input"
                        value={intSchedule.time}
                        onChange={(e) =>
                          setIntSchedule((p) => ({
                            ...p,
                            time: e.target.value,
                          }))
                        }
                      >
                        <option value="">-- Select Time --</option>
                        <option value="08-10">8:00 AM - 10:00 AM</option>
                        <option value="10-12">10:00 AM - 12:00 PM</option>
                        <option value="12-14">12:00 PM - 2:00 PM</option>
                        <option value="14-16">2:00 PM - 4:00 PM</option>
                        <option value="16-18">4:00 PM - 6:00 PM</option>
                      </select>
                    </div>
                  </div>

                  <div className="section-header">
                    <h3>💳 Payment</h3>
                    <p>Select payment method</p>
                  </div>
                  <div className="group">
                    <label>
                      Payment Method <span className="req">*</span>
                    </label>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {["card", "bank", "cash", "invoice"].map((m) => (
                        <label
                          key={m}
                          className="inline-flex items-center gap-2 text-sm"
                        >
                          <input
                            type="radio"
                            name="pay"
                            value={m}
                            checked={intPayment === m}
                            onChange={() => setIntPayment(m)}
                          />
                          {m[0].toUpperCase() + m.slice(1)}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={resetInternal}
                    >
                      Clear
                    </button>
                    <button type="submit" className="btn-primary">
                      Submit Order
                    </button>
                  </div>
                </form>
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-2">Order Summary</h2>
                <SummaryBox html={intSummaryHtml} />
              </div>
            </div>
          )}

          {activeTab === "external" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <form onSubmit={submitExternal}>
                  <div className="section-header">
                    <h3>🏛️ Requesting Department</h3>
                    <p>Which department needs this service?</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="group">
                      <label>
                        Department <span className="req">*</span>
                      </label>
                      <select
                        className="input"
                        value={extDept.dept}
                        onChange={(e) =>
                          setExtDept((p) => ({ ...p, dept: e.target.value }))
                        }
                      >
                        <option value="">-- Select Department --</option>
                        <option value="operations">Operations</option>
                        <option value="it">IT</option>
                        <option value="facilities">Facilities</option>
                        <option value="hr">HR</option>
                        <option value="finance">Finance</option>
                      </select>
                    </div>
                    <div className="group">
                      <label>
                        Cost Center <span className="req">*</span>
                      </label>
                      <input
                        className="input"
                        value={extDept.cost}
                        onChange={(e) =>
                          setExtDept((p) => ({ ...p, cost: e.target.value }))
                        }
                        placeholder="CC-12345"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="group">
                      <label>
                        Requestor Name <span className="req">*</span>
                      </label>
                      <input
                        className="input"
                        value={extRequestor.name}
                        onChange={(e) =>
                          setExtRequestor((p) => ({
                            ...p,
                            name: e.target.value,
                          }))
                        }
                        placeholder="Full name"
                      />
                    </div>
                    <div className="group">
                      <label>
                        Job Title <span className="req">*</span>
                      </label>
                      <input
                        className="input"
                        value={extRequestor.title}
                        onChange={(e) =>
                          setExtRequestor((p) => ({
                            ...p,
                            title: e.target.value,
                          }))
                        }
                        placeholder="Position"
                      />
                    </div>
                    <div className="group">
                      <label>
                        Email <span className="req">*</span>
                      </label>
                      <input
                        className="input"
                        type="email"
                        value={extRequestor.email}
                        onChange={(e) =>
                          setExtRequestor((p) => ({
                            ...p,
                            email: e.target.value,
                          }))
                        }
                        placeholder="requestor@company.com"
                      />
                    </div>
                    <div className="group">
                      <label>
                        Phone <span className="req">*</span>
                      </label>
                      <input
                        className="input"
                        value={extRequestor.phone}
                        onChange={(e) =>
                          setExtRequestor((p) => ({
                            ...p,
                            phone: e.target.value,
                          }))
                        }
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                  </div>

                  <div className="section-header">
                    <h3>🤝 Contractor Information</h3>
                    <p>Select or add contractor details</p>
                  </div>
                  <div className="form-grid">
                    <div className="group">
                      <label>
                        Contractor Name <span className="req">*</span>
                      </label>
                      <input
                        className="input"
                        value={extContractor.name}
                        onChange={(e) =>
                          setExtContractor((p) => ({
                            ...p,
                            name: e.target.value,
                          }))
                        }
                        placeholder="Company name"
                      />
                    </div>
                    <div className="group">
                      <label>
                        Contractor ID{" "}
                        <span className="text-slate-500">(Optional)</span>
                      </label>
                      <input
                        className="input"
                        value={extContractor.id}
                        onChange={(e) =>
                          setExtContractor((p) => ({
                            ...p,
                            id: e.target.value,
                          }))
                        }
                        placeholder="CONT-12345"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="group">
                      <label>
                        Contractor Email <span className="req">*</span>
                      </label>
                      <input
                        className="input"
                        type="email"
                        value={extContractor.email}
                        onChange={(e) =>
                          setExtContractor((p) => ({
                            ...p,
                            email: e.target.value,
                          }))
                        }
                        placeholder="contractor@company.com"
                      />
                    </div>
                    <div className="group">
                      <label>
                        Contractor Phone <span className="req">*</span>
                      </label>
                      <input
                        className="input"
                        value={extContractor.phone}
                        onChange={(e) =>
                          setExtContractor((p) => ({
                            ...p,
                            phone: e.target.value,
                          }))
                        }
                        placeholder="+1 (555) 987-6543"
                      />
                    </div>
                  </div>

                  <div className="section-header">
                    <h3>🛠️ Service Requirements</h3>
                    <p>Describe services needed from contractor</p>
                  </div>
                  <div className="group">
                    <label>
                      Service Category <span className="req">*</span>
                    </label>
                    <select
                      className="input"
                      value={extReqs.cat}
                      onChange={(e) =>
                        setExtReqs((p) => ({ ...p, cat: e.target.value }))
                      }
                    >
                      <option value="">-- Select Category --</option>
                      <option value="construction">
                        Construction & Renovation
                      </option>
                      <option value="electrical">Electrical Services</option>
                      <option value="plumbing">Plumbing Services</option>
                      <option value="hvac">HVAC Services</option>
                      <option value="it">IT & Technology</option>
                      <option value="cleaning">Cleaning & Janitorial</option>
                    </select>
                  </div>
                  <div className="group">
                    <label>
                      Scope of Work <span className="req">*</span>
                    </label>
                    <textarea
                      className="input"
                      value={extReqs.scope}
                      onChange={(e) =>
                        setExtReqs((p) => ({ ...p, scope: e.target.value }))
                      }
                      placeholder="Detailed description of work to be performed"
                    />
                  </div>

                  <div className="section-header">
                    <h3>📍 Location & Timeline</h3>
                    <p>Where and when should work be performed?</p>
                  </div>
                  <div className="group">
                    <label>
                      Work Location <span className="req">*</span>
                    </label>
                    <textarea
                      className="input"
                      value={extTimeline.loc}
                      onChange={(e) =>
                        setExtTimeline((p) => ({ ...p, loc: e.target.value }))
                      }
                      placeholder="Facility address"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="group">
                      <label>
                        Start Date <span className="req">*</span>
                      </label>
                      <input
                        className="input"
                        type="date"
                        value={extTimeline.start}
                        onChange={(e) =>
                          setExtTimeline((p) => ({
                            ...p,
                            start: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="group">
                      <label>
                        End Date <span className="req">*</span>
                      </label>
                      <input
                        className="input"
                        type="date"
                        value={extTimeline.end}
                        onChange={(e) =>
                          setExtTimeline((p) => ({ ...p, end: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <div className="section-header">
                    <h3>💰 Budget Information</h3>
                    <p>Estimated costs and payment terms</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="group">
                      <label>
                        Estimated Cost <span className="req">*</span>
                      </label>
                      <input
                        className="input"
                        type="number"
                        step="0.01"
                        min="0"
                        value={extBudget.estCost}
                        onChange={(e) =>
                          setExtBudget((p) => ({
                            ...p,
                            estCost: e.target.value,
                          }))
                        }
                        placeholder="0.00"
                      />
                    </div>
                    <div className="group">
                      <label>
                        Currency <span className="req">*</span>
                      </label>
                      <select
                        className="input"
                        value={extBudget.currency}
                        onChange={(e) =>
                          setExtBudget((p) => ({
                            ...p,
                            currency: e.target.value,
                          }))
                        }
                      >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={resetExternal}
                    >
                      Clear
                    </button>
                    <button type="submit" className="btn-primary">
                      Submit Order
                    </button>
                  </div>
                </form>
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-2">Order Summary</h2>
                <SummaryBox
                  html={
                    '<p style="text-align:center;color:#7f8c8d;padding:20px">Fill in details to see summary</p>'
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="card w-full max-w-md">
            <div className="card-header bg-brand text-white rounded-t-lg">
              <div className="font-semibold">Order Submitted</div>
            </div>
            <div className="card-body space-y-3 text-center">
              <div className="text-4xl mb-2">✓</div>
              <div className="text-sm">
                Your order has been received and is being processed.
              </div>
              <div className="order-num">Order #: {orderNo}</div>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
