import React, { useMemo, useState, useEffect } from "react";
import { api } from "../../../../api/client";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

function toYmd(date) {
  try {
    const d = date instanceof Date ? date : new Date(date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return "";
  }
}
function SummaryBox({ html }) {
  return (
    <div className="card">
      <div className="card-body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

export default function ServiceOrderForm() {
  const navigate = useNavigate();
  const params = useParams();
  const editId = params.id ? String(params.id) : "";
  const [activeTab, setActiveTab] = useState("internal");
  const [orderNo, setOrderNo] = useState("");
  const today = new Date().toISOString().split("T")[0];
  const [serviceRequests, setServiceRequests] = useState([]);
  const [serviceItems, setServiceItems] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState("");
  const [showModal, setShowModal] = useState(false);

  const [intCustType, setIntCustType] = useState("");
  const [intExisting, setIntExisting] = useState({ custId: "", accEmail: "" });
  const [intPerson, setIntPerson] = useState({
    customer: "",
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
  const [contractors, setContractors] = useState([]);
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
  const [departments, setDepartments] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [serviceCategories, setServiceCategories] = useState([]);
  const [workLocations, setWorkLocations] = useState([]);

  function generateOrderNo() {
    return `ORD-${Date.now().toString().slice(-8)}`;
  }

  useEffect(() => {
    let mounted = true;
    async function fetchServiceRequests() {
      try {
        const resp = await api.get("/purchase/service-requests");
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        if (mounted) setServiceRequests(rows);
      } catch {
        if (mounted) setServiceRequests([]);
      }
    }
    async function fetchServiceItems() {
      try {
        const resp = await api.get("/inventory/items");
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        const filtered = rows.filter((i) => {
          const t = String(i.item_type || "").toUpperCase();
          const tn = String(i.item_type_name || "").toLowerCase();
          const si = String(i.service_item || "").toUpperCase();
          return (
            t === "SERVICE" ||
            tn.includes("service") ||
            si === "Y" ||
            Number(i.service_item) === 1
          );
        });
        if (mounted) setServiceItems(filtered);
      } catch {
        if (mounted) setServiceItems([]);
      }
    }
    fetchServiceRequests();
    fetchServiceItems();
    async function fetchContractors() {
      try {
        const resp = await api.get("/purchase/suppliers", {
          params: { contractor: "Y" },
        });
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        setContractors(rows);
      } catch {
        setContractors([]);
      }
    }
    fetchContractors();
    async function fetchDepartments() {
      try {
        const resp = await api.get("/admin/departments");
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        if (mounted) setDepartments(rows);
      } catch {
        if (mounted) setDepartments([]);
      }
    }
    async function fetchCostCenters() {
      try {
        const resp = await api.get("/finance/cost-centers");
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        if (mounted) setCostCenters(rows);
      } catch {
        if (mounted) setCostCenters([]);
      }
    }
    async function fetchServiceCategories() {
      try {
        const resp = await api.get("/purchase/service-setup/categories");
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        if (mounted) setServiceCategories(rows);
      } catch {
        if (mounted) setServiceCategories([]);
      }
    }
    async function fetchWorkLocations() {
      try {
        const resp = await api.get("/purchase/service-setup/work-locations");
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        if (mounted) setWorkLocations(rows);
      } catch {
        if (mounted) setWorkLocations([]);
      }
    }
    async function fetchCurrencies() {
      try {
        const resp = await api.get("/finance/currencies");
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        if (mounted) setCurrencies(rows);
      } catch {
        if (mounted) setCurrencies([]);
      }
    }
    fetchDepartments();
    fetchCostCenters();
    fetchServiceCategories();
    fetchWorkLocations();
    fetchCurrencies();
    async function fetchSupervisors() {
      try {
        const resp = await api.get("/purchase/service-setup/supervisors");
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        if (mounted) setSupervisors(rows);
      } catch {
        if (mounted) setSupervisors([]);
      }
    }
    fetchSupervisors();
    async function fetchForEdit() {
      if (!editId) return;
      try {
        const resp = await api.get(`/purchase/service-orders/${editId}`);
        const item = resp?.data?.item || {};
        const lines = Array.isArray(resp?.data?.lines) ? resp.data.lines : [];
        const type = String(item.order_type || "INTERNAL").toUpperCase();
        setActiveTab(type === "EXTERNAL" ? "external" : "internal");
        setOrderNo(item.order_no || "");
        if (type === "INTERNAL") {
          setIntPerson({
            customer: item.customer_name || "",
            email: item.customer_email || "",
            phone: item.customer_phone || "",
          });
          setIntService({
            servCat: item.service_category || "",
            items: lines.map((ln) => ({
              id: crypto.randomUUID(),
              item_id: ln.item_id || "",
              desc: ln.description || "",
              qty: Number(ln.qty || 0),
              price: Number(ln.unit_price || 0),
              sub: Number(ln.line_total || 0),
            })),
          });
          setIntSchedule({
            addr: item.schedule_address || item.work_location || "",
            date: toYmd(item.schedule_date || item.order_date || ""),
            time: item.schedule_time || "",
          });
        } else {
          setExtDept({
            dept: item.department || "",
            cost: item.cost_center || "",
          });
          setExtRequestor({
            name: item.requestor_name || "",
            title: item.requestor_title || "",
            email: item.requestor_email || "",
            phone: item.requestor_phone || "",
          });
          setExtContractor({
            name: item.contractor_name || "",
            id: item.contractor_code || "",
            email: item.contractor_email || "",
            phone: item.contractor_phone || "",
          });
          setExtReqs({
            cat: item.ext_category || "",
            scope: item.scope_of_work || "",
          });
          setExtTimeline({
            loc: item.work_location || "",
            start: toYmd(item.start_date || ""),
            end: toYmd(item.end_date || ""),
          });
          setExtBudget({
            estCost: item.estimated_cost || "",
            currency: item.currency_code || "USD",
          });
        }
        if (item.assigned_supervisor_user_id) {
          setSelectedSupervisorId(String(item.assigned_supervisor_user_id));
        }
      } catch {
        // ignore edit load errors
      }
    }
    fetchForEdit();
    if (!editId) {
      // ensure at least one blank item row for new orders
      setIntService((p) =>
        Array.isArray(p.items) && p.items.length
          ? p
          : {
              ...p,
              items: [
                {
                  id: crypto.randomUUID(),
                  item_id: "",
                  desc: "",
                  qty: 1,
                  price: 0,
                  sub: 0,
                },
              ],
            },
      );
    }
    return () => {
      mounted = false;
    };
  }, []);

  async function loadServiceRequest(id) {
    const sid = Number(id);
    if (!Number.isFinite(sid) || sid <= 0) return;
    try {
      const resp = await api.get(`/purchase/service-requests/${sid}`);
      const it = resp.data?.item || {};
      const customer = String(it.requester_full_name || "").trim();
      setIntPerson({
        customer,
        email: it.requester_email || "",
        phone: it.requester_phone || "",
      });
      const catRaw = String(it.service_type || "").toLowerCase();
      const catMap = {
        consultation: "consulting",
        consulting: "consulting",
        installation: "installation",
        maintenance: "maintenance",
        repair: "repair",
        general: "custom",
      };
      setIntService((p) => ({
        ...p,
        servCat: catMap[catRaw] || p.servCat || "",
      }));
      setIntSchedule({
        addr: it.requester_address || "",
        date: it.preferred_date || "",
        time: it.preferred_time || "",
      });
    } catch {
      // ignore
    }
  }

  function addServiceItem() {
    setIntService((p) => ({
      ...p,
      items: [
        ...p.items,
        {
          id: crypto.randomUUID(),
          item_id: "",
          desc: "",
          qty: 1,
          price: 0,
          sub: 0,
        },
      ],
    }));
  }

  function updateItem(id, key, value) {
    setIntService((p) => {
      const items = p.items.map((it) => {
        if (it.id === id) {
          const next = { ...it, [key]: value };
          if (key === "item_id") {
            const selected =
              serviceItems.find((s) => String(s.id) === String(value)) || null;
            if (selected) {
              next.desc = selected.item_name || next.desc;
              const sp = Number(selected.selling_price || 0);
              if (Number.isFinite(sp)) next.price = sp;
            }
          }
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
    const baseSymbol =
      currencies.find((c) => Number(c.is_base) === 1)?.symbol ||
      currencies.find((c) => String(c.code).toUpperCase() === "GHS")?.symbol ||
      "₵" ||
      "₵";
    let html = '<div class="sum-item"><strong>Services</strong></div>';
    for (const it of intService.items) {
      const desc = String(it.desc || "Service");
      const qty = parseFloat(it.qty || 0);
      const price = parseFloat(it.price || 0);
      const sub = qty * price;
      if (sub > 0) {
        html += `<div class="sum-item"><span>${desc} (x${qty})</span><span>${baseSymbol}${sub.toFixed(
          2,
        )}</span></div>`;
      }
      total += sub;
    }
    if (intCustType === "existing") {
      const disc = total * 0.1;
      html += `<div class="sum-item"><span>Discount (10%)</span><span style="color:#27ae60">-${baseSymbol}${disc.toFixed(
        2,
      )}</span></div>`;
      total -= disc;
    }
    if (total > 0) {
      html += `<div class="sum-total"><span>Total</span><span>${baseSymbol}${total.toFixed(
        2,
      )}</span></div>`;
    } else {
      html =
        '<p style="text-align:center;color:#7f8c8d;padding:20px">Add services to see summary</p>';
    }
    return html;
  }, [intService.items, intCustType, currencies]);

  function resetInternal() {
    setIntCustType("");
    setIntExisting({ custId: "", accEmail: "" });
    setIntPerson({ customer: "", email: "", phone: "" });
    setIntService({ servCat: "", items: [] });
    setIntSchedule({ addr: "", date: "", time: "" });
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
    const lines = (intService.items || []).map((it) => {
      const qty = parseFloat(it.qty || 0);
      const price = parseFloat(it.price || 0);
      return {
        item_id: it.item_id || null,
        item_name:
          serviceItems.find((s) => String(s.id) === String(it.item_id))
            ?.item_name || null,
        description: it.desc || null,
        qty,
        unit_price: price,
        line_total: qty * price,
      };
    });
    const total = lines.reduce((sum, l) => sum + Number(l.line_total || 0), 0);
    const payload = {
      order_type: "INTERNAL",
      customer_name: intPerson.customer || null,
      customer_email: intPerson.email || null,
      customer_phone: intPerson.phone || null,
      service_category: intService.servCat || null,
      schedule_address: intSchedule.addr || null,
      schedule_date: intSchedule.date || null,
      schedule_time: intSchedule.time || null,
      lines,
      total_amount: total,
      assigned_supervisor_user_id: selectedSupervisorId
        ? Number(selectedSupervisorId)
        : null,
      assigned_supervisor_username:
        supervisors.find(
          (s) => String(s.user_id) === String(selectedSupervisorId),
        )?.username || null,
    };
    const req =
      editId && editId !== ""
        ? api.put(`/purchase/service-orders/${editId}`, payload)
        : api.post("/purchase/service-orders", payload);
    req
      .then((resp) => {
        const num =
          resp?.data?.order_no ||
          orderNo ||
          (editId ? `ORD-${editId}` : generateOrderNo());
        setOrderNo(num);
        toast.success(
          num
            ? `Service order ${num} saved successfully`
            : "Service order saved successfully",
        );
        navigate("/service-management/service-orders");
      })
      .catch(() => {
        alert("Failed to submit service order");
      });
  }

  function submitExternal(e) {
    e.preventDefault();
    const payload = {
      order_type: "EXTERNAL",
      department: extDept.dept || null,
      cost_center: extDept.cost || null,
      requestor_name: extRequestor.name || null,
      requestor_title: extRequestor.title || null,
      requestor_email: extRequestor.email || null,
      requestor_phone: extRequestor.phone || null,
      contractor_name: extContractor.name || null,
      contractor_code: extContractor.id || null,
      contractor_email: extContractor.email || null,
      contractor_phone: extContractor.phone || null,
      ext_category: extReqs.cat || null,
      scope_of_work: extReqs.scope || null,
      work_location: extTimeline.loc || null,
      start_date: extTimeline.start || null,
      end_date: extTimeline.end || null,
      estimated_cost: extBudget.estCost || null,
      currency_code: extBudget.currency || null,
      total_amount: Number(extBudget.estCost || 0),
      assigned_supervisor_user_id: selectedSupervisorId
        ? Number(selectedSupervisorId)
        : null,
      assigned_supervisor_username:
        supervisors.find(
          (s) => String(s.user_id) === String(selectedSupervisorId),
        )?.username || null,
    };
    const req =
      editId && editId !== ""
        ? api.put(`/purchase/service-orders/${editId}`, payload)
        : api.post("/purchase/service-orders", payload);
    req
      .then((resp) => {
        const num =
          resp?.data?.order_no ||
          orderNo ||
          (editId ? `ORD-${editId}` : generateOrderNo());
        setOrderNo(num);
        toast.success(
          num
            ? `Service order ${num} saved successfully`
            : "Service order saved successfully",
        );
        navigate("/service-management/service-orders");
      })
      .catch(() => {
        alert("Failed to submit service order");
      });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/service-management/service-orders"
            className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to Service Order List
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
                Internal
              </button>
              <button
                type="button"
                className={
                  activeTab === "external" ? "btn-primary" : "btn-secondary"
                }
                onClick={() => setActiveTab("external")}
              >
                External
              </button>
            </div>
          </div>
        </div>

        <div className="card-body">
          {activeTab === "internal" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <form onSubmit={submitInternal}>
                  <div className="group">
                    <label>
                      Link Service Request <span className="req">*</span>
                    </label>
                    <select
                      className="input"
                      onChange={(e) => loadServiceRequest(e.target.value)}
                    >
                      <option value="">-- Select Service Request --</option>
                      {serviceRequests.map((sr) => (
                        <option key={sr.id} value={sr.id}>
                          {sr.request_no} • {sr.requester_full_name} •{" "}
                          {sr.service_type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                    <div className="group md:col-span-2">
                      <label>
                        Customer <span className="req">*</span>
                      </label>
                      <input
                        className="input"
                        value={intPerson.customer}
                        onChange={(e) =>
                          setIntPerson((p) => ({
                            ...p,
                            customer: e.target.value,
                          }))
                        }
                        placeholder="Company / Customer name"
                        required
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
                        required
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
                        required
                      />
                    </div>
                  </div>

                  <div className="group mt-4">
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
                      required
                    >
                      <option value="">-- Select Category --</option>
                      {serviceCategories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="card">
                    <div className="card-body">
                      <h4 style={{ color: "var(--primary)", marginBottom: 10 }}>
                        📋 Service Items
                      </h4>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "2fr 1fr 100px 120px 40px",
                          gap: 12,
                          marginBottom: 8,
                          padding: "4px 10px",
                          background: "var(--white)",
                          border: "2px solid var(--border)",
                          borderRadius: 6,
                          fontWeight: 600,
                        }}
                      >
                        <div>Item</div>
                        <div>Qty</div>
                        <div>Rate</div>
                        <div>Amount</div>
                        <div />
                      </div>
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
                            <select
                              className="input"
                              value={it.item_id || ""}
                              onChange={(e) =>
                                updateItem(it.id, "item_id", e.target.value)
                              }
                            >
                              <option value="">
                                -- Select Service Item --
                              </option>
                              {serviceItems.map((si) => (
                                <option key={si.id} value={si.id}>
                                  {si.item_name}
                                </option>
                              ))}
                            </select>
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

                  <div className="group">
                    <label>
                      Work Location <span className="req">*</span>
                    </label>
                    <select
                      className="input"
                      value={intSchedule.addr}
                      onChange={(e) =>
                        setIntSchedule((p) => ({ ...p, addr: e.target.value }))
                      }
                      required
                    >
                      <option value="">-- Select Work Location --</option>
                      {workLocations.map((wl) => (
                        <option key={wl.id} value={wl.name}>
                          {wl.name}
                        </option>
                      ))}
                    </select>
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
                        min={today}
                        required
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
                        required
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

                  <div className="group">
                    <label>Assigned Supervisor</label>
                    <select
                      className="input"
                      value={selectedSupervisorId}
                      onChange={(e) => setSelectedSupervisorId(e.target.value)}
                    >
                      <option value="">-- Select Supervisor --</option>
                      {supervisors.map((s) => (
                        <option key={s.id} value={s.user_id}>
                          {s.username}
                        </option>
                      ))}
                    </select>
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
                        required
                      >
                        <option value="">-- Select Department --</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.name}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="group">
                      <label>
                        Cost Center <span className="req">*</span>
                      </label>
                      <select
                        className="input"
                        value={extDept.cost}
                        onChange={(e) =>
                          setExtDept((p) => ({ ...p, cost: e.target.value }))
                        }
                        required
                      >
                        <option value="">-- Select Cost Center --</option>
                        {costCenters.map((cc) => (
                          <option key={cc.id} value={cc.code}>
                            {cc.code} • {cc.name}
                          </option>
                        ))}
                      </select>
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
                        required
                      />
                    </div>
                    <div className="group">
                      <label>Job Title</label>
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
                        required
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
                        required
                      />
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="group">
                      <label>
                        Contractor Name <span className="req">*</span>
                      </label>
                      <select
                        className="input"
                        value={extContractor.name}
                        onChange={(e) => {
                          const name = e.target.value;
                          setExtContractor((p) => ({ ...p, name }));
                          const sup = contractors.find(
                            (c) => String(c.supplier_name) === String(name),
                          );
                          if (sup) {
                            setExtContractor({
                              name: sup.supplier_name || "",
                              id: sup.supplier_code || "",
                              email: sup.email || "",
                              phone: sup.phone || "",
                            });
                            const cur = currencies.find(
                              (x) => Number(x.id) === Number(sup.currency_id),
                            );
                            if (cur?.code) {
                              setExtBudget((p) => ({
                                ...p,
                                currency: cur.code,
                              }));
                            }
                          }
                        }}
                        required
                      >
                        <option value="">-- Select Contractor --</option>
                        {contractors.map((c) => (
                          <option key={c.id} value={c.supplier_name}>
                            {c.supplier_name}
                          </option>
                        ))}
                      </select>
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
                        readOnly
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
                        required
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
                        required
                      />
                    </div>
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
                      required
                    >
                      <option value="">-- Select Category --</option>
                      {serviceCategories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
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
                      required
                    />
                  </div>

                  <div className="group">
                    <label>
                      Work Location <span className="req">*</span>
                    </label>
                    <select
                      className="input"
                      value={extTimeline.loc}
                      onChange={(e) =>
                        setExtTimeline((p) => ({ ...p, loc: e.target.value }))
                      }
                      required
                    >
                      <option value="">-- Select Work Location --</option>
                      {workLocations.map((wl) => (
                        <option key={wl.id} value={wl.name}>
                          {wl.name}
                        </option>
                      ))}
                    </select>
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
                        min={today}
                        required
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
                        min={today}
                        required
                      />
                    </div>
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
                        required
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
                        required
                      >
                        <option value="">-- Select Currency --</option>
                        {currencies.map((c) => (
                          <option key={c.id} value={c.code}>
                            {c.code}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="group">
                    <label>Assigned Supervisor</label>
                    <select
                      className="input"
                      value={selectedSupervisorId}
                      onChange={(e) => setSelectedSupervisorId(e.target.value)}
                    >
                      <option value="">-- Select Supervisor --</option>
                      {supervisors.map((s) => (
                        <option key={s.id} value={s.user_id}>
                          {s.username}
                        </option>
                      ))}
                    </select>
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
