import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../../../api/client";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function SalesOrderList() {
  const navigate = useNavigate();
  const { canPerformAction } = usePermission();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState("");
  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [firstApprover, setFirstApprover] = useState(null);
  const [workflowsCache, setWorkflowsCache] = useState(null);
  const [targetApproverId, setTargetApproverId] = useState(null);
  const [submittingForward, setSubmittingForward] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [companyInfo, setCompanyInfo] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
    phone: "",
    email: "",
    website: "",
    taxId: "",
    registrationNo: "",
    logoUrl: "",
  });
  const [preparedBy, setPreparedBy] = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadCompanyAndUser() {
      try {
        const meResp = await api.get("/admin/me");
        const companyId = meResp.data?.scope?.companyId;
        const u = meResp.data?.user || {};
        const uname = String(u.username || "").trim();
        const fname = String(u.full_name || "").trim();
        const name = String(u.name || "").trim();
        const email = String(u.email || "").trim();
        const pb =
          uname ||
          fname ||
          name ||
          email ||
          "";
        if (mounted) setPreparedBy(pb);
        if (!companyId) return;
        const cResp = await api.get(`/admin/companies/${companyId}`);
        const item = cResp.data?.item || {};
        const logoUrl =
          item.has_logo === 1 || item.has_logo === true
            ? `/api/admin/companies/${companyId}/logo`
            : "";
        if (!mounted) return;
        setCompanyInfo({
          name: String(item.name || ""),
          address: String(item.address || ""),
          city: String(item.city || ""),
          state: String(item.state || ""),
          country: String(item.country || ""),
          postalCode: String(item.postal_code || ""),
          phone: String(item.telephone || ""),
          email: String(item.email || ""),
          website: String(item.website || ""),
          taxId: String(item.tax_id || ""),
          registrationNo: String(item.registration_no || ""),
          logoUrl: String(logoUrl || ""),
        });
      } catch {}
    }
    loadCompanyAndUser();
    return () => {
      mounted = false;
    };
  }, []);

  function escapeHtml(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function wrapDoc(bodyHtml) {
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sales Order</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 16px; color: #0f172a; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; }
      th { background: #f8fafc; text-align: left; }
    </style>
  </head>
  <body>${bodyHtml || ""}</body>
</html>`;
  }
  async function waitForImages(container) {
    const imgs = Array.from(container?.querySelectorAll?.("img") || []);
    if (!imgs.length) return;
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) return resolve();
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
          }),
      ),
    );
  }
  const buildSalesOrderTemplateDataFromApi = (header, details) => {
    const logoUrl = String(companyInfo.logoUrl || "").trim();
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${escapeHtml(companyInfo.name || "Company")}" style="max-height:80px;object-fit:contain;" />`
      : "";
    const items = (Array.isArray(details) ? details : []).map((d, idx) => {
      const qty = Number(d.qty ?? d.quantity ?? 0);
      const unit = Number(d.unit_price ?? 0);
      const disc = Number(d.discount_percent ?? 0);
      const tax = Number(d.tax_amount ?? 0);
      const total = Number(d.total_amount ?? qty * unit - (qty * unit * disc) / 100 + tax);
      return {
        sr: String(idx + 1),
        code: String(d.item_code || ""),
        name: String(d.item_name || ""),
        quantity: qty.toFixed(2),
        uom: String(d.uom || d.uom_code || ""),
        price: unit.toFixed(2),
        discount: disc.toFixed(2),
        tax: tax.toFixed(2),
        amount: total.toFixed(2),
      };
    });
    const sub = items.reduce((s, it) => s + Number(it.price) * Number(it.quantity), 0);
    const discTotal = items.reduce(
      (s, it) => s + (Number(it.price) * Number(it.quantity) * Number(it.discount)) / 100,
      0,
    );
    const taxTotal = items.reduce((s, it) => s + Number(it.tax || 0), 0);
    const net = sub - discTotal;
    const totalBase = header.net_amount ?? header.total_amount ?? (net + taxTotal);
    const total = Number(totalBase ?? 0);
    return {
      company: {
        name: companyInfo.name || "",
        address: companyInfo.address || "",
        city: companyInfo.city || "",
        state: companyInfo.state || "",
        country: companyInfo.country || "",
        postalCode: companyInfo.postalCode || "",
        phone: companyInfo.phone || "",
        email: companyInfo.email || "",
        website: companyInfo.website || "",
        taxId: companyInfo.taxId || "",
        registrationNo: companyInfo.registrationNo || "",
        logoUrl,
        logoHtml,
      },
      sales_order: {
        number: String(header.order_no || ""),
        date: header.order_date ? String(header.order_date).slice(0, 10) : "",
        payment_type: String(header.payment_type || ""),
        price_type: String(header.price_type || ""),
      },
      customer: {
        name: String(header.customer_name || ""),
        address: String(header.address || ""),
        city: String(header.city || ""),
        state: String(header.state || ""),
        country: String(header.country || ""),
        phone: String(header.phone || ""),
        email: String(header.email || ""),
      },
      items,
      totals: {
        sub_total: sub.toFixed(2),
        discount: discTotal.toFixed(2),
        tax_amount: taxTotal.toFixed(2),
        total: Number(total || 0).toFixed(2),
      },
      prepared_by: preparedBy || "",
    };
  };
  function renderSalesOrderHtml(data) {
    const c = data.company || {};
    const s = data.sales_order || {};
    const u = data.customer || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const t = data.totals || {};
    return `
      <style>
        .doc { color: #0f172a; font-size: 12px; }
        .doc-header { display: flex; justify-content: space-between; align-items: center; }
        .doc-title { font-weight: 800; font-size: 18px; color: #296d8f; }
        .company-block { display: flex; gap: 12px; align-items: center; }
        .company-logo { max-height: 80px; object-fit: contain; }
        .company-info div { line-height: 1.4; }
        .meta { text-align: right; font-size: 12px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        table { border-collapse: collapse; width: 100%; font-size: 12px; }
        th, td { border: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; }
        th { background: #f8fafc; text-align: left; }
        .totals { display: flex; justify-content: flex-end; margin-top: 12px; }
        .totals table { width: 360px; }
      </style>
      <div class="doc">
        <div class="doc-header">
          <div class="company-block">
            ${c.logoUrl ? `<img src="${c.logoUrl}" alt="${escapeHtml(c.name || "Company")}" class="company-logo" />` : ""}
            <div class="company-info">
              <div>${escapeHtml(c.name || "")}</div>
              <div>${escapeHtml(c.address || "")}</div>
              <div>${escapeHtml(c.city || "")}${c.city ? "," : ""} ${escapeHtml(c.state || "")} ${escapeHtml(c.country || "")}</div>
              <div>${escapeHtml(c.phone || "")} ${escapeHtml(c.email || "")}</div>
              <div>${escapeHtml(c.website || "")}</div>
              <div>${c.taxId ? `Tax ID: ${escapeHtml(c.taxId)}` : ""}</div>
              <div>${c.registrationNo ? `Reg No: ${escapeHtml(c.registrationNo)}` : ""}</div>
            </div>
          </div>
          <div class="meta">
            <div class="doc-title">Sales Order</div>
            <div>Order No: ${escapeHtml(s.number || "")}</div>
            <div>Order Date: ${escapeHtml(s.date || "")}</div>
          </div>
        </div>
        <div class="grid-2" style="margin-top: 6px;">
          <div>
            <div style="font-weight:700;margin-bottom:4px;">Customer</div>
            <div>${escapeHtml(u.name || "")}</div>
            <div>${escapeHtml(u.address || "")}</div>
            <div>${escapeHtml(u.city || "")}${u.city ? "," : ""} ${escapeHtml(u.state || "")} ${escapeHtml(u.country || "")}</div>
            <div>${escapeHtml(u.phone || "")} ${escapeHtml(u.email || "")}</div>
          </div>
          <div>
            <div style="font-weight:700;margin-bottom:4px;">Payment</div>
            <div>Payment Type: ${escapeHtml(s.payment_type || "")}</div>
            <div>Price Type: ${escapeHtml(s.price_type || "")}</div>
          </div>
        </div>
        <table style="margin-top: 8px;">
          <thead>
            <tr>
              <th>#</th>
              <th>Code</th>
              <th>Description</th>
              <th style="text-align:right;">Qty</th>
              <th>UOM</th>
              <th style="text-align:right;">Unit Price</th>
              <th style="text-align:right;">Disc%</th>
              <th style="text-align:right;">Tax</th>
              <th style="text-align:right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (it) => `
                <tr>
                  <td>${escapeHtml(it.sr || "")}</td>
                  <td>${escapeHtml(it.code || "")}</td>
                  <td>${escapeHtml(it.name || "")}</td>
                  <td style="text-align:right;">${escapeHtml(it.quantity || "")}</td>
                  <td>${escapeHtml(it.uom || "")}</td>
                  <td style="text-align:right;">${escapeHtml(it.price || "")}</td>
                  <td style="text-align:right;">${escapeHtml(it.discount || "")}</td>
                  <td style="text-align:right;">${escapeHtml(it.tax || "")}</td>
                  <td style="text-align:right;">${escapeHtml(it.amount || "")}</td>
                </tr>
              `,
              )
              .join("")}
          </tbody>
        </table>
        <div class="totals">
          <table>
            <tbody>
              <tr><td>Sub Total</td><td style="text-align:right;">${escapeHtml(t.sub_total || "")}</td></tr>
              <tr><td>Discount</td><td style="text-align:right;">${escapeHtml(t.discount || "")}</td></tr>
              <tr><td>Tax</td><td style="text-align:right;">${escapeHtml(t.tax_amount || "")}</td></tr>
              <tr><td><strong>Total</strong></td><td style="text-align:right;"><strong>${escapeHtml(t.total || "")}</strong></td></tr>
            </tbody>
          </table>
        </div>
        <div style="margin-top:10px;font-size:12px;">
          <div>Prepared By: ${escapeHtml(String(data.prepared_by || ""))}</div>
        </div>
      </div>
    `;
  }
  async function printSalesOrder(id) {
    try {
      const resp = await api.get(`/sales/orders/${id}`);
      const header = resp.data?.item || {};
      const details = Array.isArray(resp.data?.details) ? resp.data.details : [];
      const data = buildSalesOrderTemplateDataFromApi(header, details);
      const html = wrapDoc(renderSalesOrderHtml(data));
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document || iframe.contentDocument || null;
      if (!doc) {
        document.body.removeChild(iframe);
        return;
      }
      doc.open();
      doc.write(html);
      doc.close();
      const win = iframe.contentWindow || window;
      const doPrint = () => {
        win.focus();
        try {
          win.print();
        } catch {}
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 100);
      };
      setTimeout(doPrint, 200);
    } catch {}
  }
  async function downloadSalesOrderPdf(id) {
    try {
      const resp = await api.get(`/sales/orders/${id}`);
      const header = resp.data?.item || {};
      const details = Array.isArray(resp.data?.details) ? resp.data.details : [];
      const data = buildSalesOrderTemplateDataFromApi(header, details);
      const html = renderSalesOrderHtml(data);
      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-10000px";
      container.style.top = "0";
      container.style.width = "794px";
      container.style.background = "white";
      container.style.padding = "32px";
      container.innerHTML = html;
      document.body.appendChild(container);
      try {
        await waitForImages(container);
        const canvas = await html2canvas(container, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let rendered = 0;
        while (rendered < imgHeight) {
          pdf.addImage(imgData, "PNG", 0, -rendered, imgWidth, imgHeight);
          rendered += pageHeight;
          if (rendered < imgHeight) pdf.addPage();
        }
        const fname =
          "SalesOrder_" +
          (String(header.order_no || "").replaceAll(" ", "_") ||
            new Date().toISOString().slice(0, 10)) +
          ".pdf";
        pdf.save(fname);
      } finally {
        document.body.removeChild(container);
      }
    } catch {}
  }

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/sales/orders");
      setOrders(Array.isArray(response.data?.items) ? response.data.items : []);
    } catch (error) {
      setError(error?.response?.data?.message || "Error fetching orders");
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      DRAFT: "badge badge-warning",
      CONFIRMED: "badge badge-info",
      PROCESSING: "badge badge-primary",
      SHIPPED: "badge badge-secondary",
      DELIVERED: "badge badge-success",
      CANCELLED: "badge badge-error",
    };
    return <span className={statusClasses[status] || "badge"}>{status}</span>;
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      String(order.order_no || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      String(order.customer_name || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const openForwardModal = async (order) => {
    setSelectedOrder(order);
    setShowForwardModal(true);
    setWfError("");
    if (!workflowsCache) {
      try {
        setWfLoading(true);
        const res = await api.get("/workflows");
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setWorkflowsCache(items);
        await computeCandidateFromList(items);
      } catch (e) {
        setWfError(e?.response?.data?.message || "Failed to load workflows");
      } finally {
        setWfLoading(false);
      }
    } else {
      await computeCandidate();
    }
  };

  const computeCandidateFromList = async (items) => {
    if (!items || !items.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWfError("");
      return;
    }
    const route = "/sales/sales-orders";
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const chosen =
      items.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      items.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "SALES_ORDER",
      ) ||
      null;
    setCandidateWorkflow(chosen || null);
    setFirstApprover(null);
    if (!chosen) return;
    try {
      setWfLoading(true);
      const res = await api.get(`/workflows/${chosen.id}`);
      const item = res.data?.item;
      const steps = Array.isArray(item?.steps) ? item.steps : [];
      setWorkflowSteps(steps);
      const first = steps[0] || null;
      setFirstApprover(
        first
          ? {
              userId: first.approver_user_id,
              name: first.approver_name,
              stepName: first.step_name,
              stepOrder: first.step_order,
              approvalLimit: first.approval_limit,
            }
          : null,
      );
      if (first) {
        const defaultTarget =
          (Array.isArray(first.approvers) && first.approvers.length
            ? first.approvers[0].id
            : first.approver_user_id) || null;
        setTargetApproverId(defaultTarget);
      } else {
        setTargetApproverId(null);
      }
    } catch (e) {
      setWfError(
        e?.response?.data?.message || "Failed to load workflow details",
      );
    } finally {
      setWfLoading(false);
    }
  };

  const computeCandidate = async () => {
    if (!workflowsCache || !workflowsCache.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWfError("");
      return;
    }
    const route = "/sales/sales-orders";
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const chosen =
      workflowsCache.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      workflowsCache.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "SALES_ORDER",
      ) ||
      null;
    setCandidateWorkflow(chosen || null);
    setFirstApprover(null);
    if (!chosen) return;
    try {
      setWfLoading(true);
      const res = await api.get(`/workflows/${chosen.id}`);
      const item = res.data?.item;
      const steps = Array.isArray(item?.steps) ? item.steps : [];
      setWorkflowSteps(steps);
      const first = steps[0] || null;
      setFirstApprover(
        first
          ? {
              userId: first.approver_user_id,
              name: first.approver_name,
              stepName: first.step_name,
              stepOrder: first.step_order,
              approvalLimit: first.approval_limit,
            }
          : null,
      );
      if (first) {
        const defaultTarget =
          (Array.isArray(first.approvers) && first.approvers.length
            ? first.approvers[0].id
            : first.approver_user_id) || null;
        setTargetApproverId(defaultTarget);
      } else {
        setTargetApproverId(null);
      }
    } catch (e) {
      setWfError(
        e?.response?.data?.message || "Failed to load workflow details",
      );
    } finally {
      setWfLoading(false);
    }
  };

  async function forwardDocument() {
    if (!selectedOrder) return;
    setSubmittingForward(true);
    setWfError("");
    try {
      const amount =
        selectedOrder.total_amount === undefined ||
        selectedOrder.total_amount === null
          ? null
          : Number(selectedOrder.total_amount || 0);
      const res = await api.post(`/sales/orders/${selectedOrder.id}/submit`, {
        amount,
        workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
        target_user_id: targetApproverId || null,
      });
      const newStatus = res?.data?.status || "PENDING_APPROVAL";
      setOrders((prev) =>
        prev.map((x) =>
          x.id === selectedOrder.id ? { ...x, status: newStatus } : x,
        ),
      );
      setShowForwardModal(false);
      setSelectedOrder(null);
    } catch (e) {
      setWfError(
        e?.response?.data?.message || "Failed to forward for approval",
      );
    } finally {
      setSubmittingForward(false);
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading orders...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Sales Orders
              </h1>
              <p className="text-sm mt-1">
                Manage customer orders and track fulfillment
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/sales" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link to="/sales/sales-orders/new" className="btn-success">
                + New Sales Order
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by order number or customer..."
                className="input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full md:w-48">
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="DRAFT">Draft</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="PROCESSING">Processing</option>
                <option value="SHIPPED">Shipped</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
              <p className="mt-2">Loading sales orders...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-600 dark:text-slate-400">
                No sales orders found.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Order No</th>
                    <th>Order Date</th>
                    <th>Customer</th>
                    <th>Priority</th>
                    <th>Amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="font-medium">{order.order_no}</td>
                      <td>{new Date(order.order_date).toLocaleDateString()}</td>
                      <td>{order.customer_name}</td>
                      <td>{order.priority || "-"}</td>
                      <td className="font-semibold">
                        {order.total_amount.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          {canPerformAction("sales:sales-orders", "view") && (
                            <button
                              onClick={() =>
                                navigate(
                                  `/sales/sales-orders/${order.id}?mode=view`,
                                )
                              }
                              className="text-brand hover:text-brand-600 font-medium text-sm"
                            >
                              View
                            </button>
                          )}
                          {String(order.status || "").toUpperCase() !==
                            "CONFIRMED" &&
                            canPerformAction("sales:sales-orders", "edit") && (
                              <button
                                onClick={() =>
                                  navigate(
                                    `/sales/sales-orders/${order.id}?mode=edit`,
                                  )
                                }
                                className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                              >
                                Edit
                              </button>
                            )}
                          {order.status === "APPROVED" ? (
                            <span className="ml-3 text-sm font-medium px-2 py-1 rounded bg-green-500 text-white">
                              Approved
                            </span>
                          ) : order.status === "DRAFT" ? (
                            <button
                              type="button"
                              className="ml-3 text-sm font-medium px-2 py-1 rounded bg-brand text-white hover:bg-brand-700 transition-colors"
                              onClick={() => openForwardModal(order)}
                              disabled={submittingForward}
                            >
                              Forward for Approval
                            </button>
                          ) : null}
                          <button
                            onClick={() => printSalesOrder(order.id)}
                            className="inline-flex items-center px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 text-white text-xs font-semibold"
                          >
                            Print
                          </button>
                          <button
                            onClick={() => downloadSalesOrderPdf(order.id)}
                            className="inline-flex items-center px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold"
                          >
                            PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {showForwardModal ? (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-erp w/full max-w-md overflow-hidden">
            <div className="p-4 bg-brand text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">Forward for Approval</h2>
              <button
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedOrder(null);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setTargetApproverId(null);
                  setWorkflowSteps([]);
                  setWfError("");
                }}
                className="text-white hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-slate-700">
                Document No:{" "}
                <span className="font-semibold">
                  {selectedOrder?.order_no || "-"}
                </span>
              </div>
              <div className="text-sm text-slate-700">
                Workflow:{" "}
                <span className="font-semibold">
                  {candidateWorkflow
                    ? `${candidateWorkflow.workflow_name} (${candidateWorkflow.workflow_code})`
                    : "None (inactive)"}
                </span>
              </div>
              <div>
                {wfLoading ? (
                  <div className="text-sm">Loading workflow...</div>
                ) : null}
              </div>
              <div>
                {wfError ? (
                  <div className="text-sm text-red-600">{wfError}</div>
                ) : null}
              </div>
              <div className="text-sm">
                <div className="font-medium">Target Approver</div>
                {(() => {
                  const hasSteps =
                    Array.isArray(workflowSteps) && workflowSteps.length > 0;
                  const first = hasSteps ? workflowSteps[0] : null;
                  const opts = first
                    ? Array.isArray(first.approvers) && first.approvers.length
                      ? first.approvers.map((u) => ({
                          id: u.id,
                          name: u.username,
                        }))
                      : first.approver_user_id
                        ? [
                            {
                              id: first.approver_user_id,
                              name:
                                first.approver_name ||
                                String(first.approver_user_id),
                            },
                          ]
                        : []
                    : [];
                  return opts.length > 0 ? (
                    <div className="mt-1">
                      <select
                        className="input w-full"
                        value={targetApproverId || ""}
                        onChange={(e) =>
                          setTargetApproverId(
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      >
                        <option value="">Select target approver</option>
                        {opts.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                      <div className="text-xs text-slate-600 mt-1">
                        {firstApprover
                          ? `Step ${firstApprover.stepOrder} • ${firstApprover.stepName}${
                              firstApprover.approvalLimit != null
                                ? ` • Limit: ${Number(
                                    firstApprover.approvalLimit,
                                  ).toLocaleString()}`
                                : ""
                            }`
                          : ""}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-600">
                      {candidateWorkflow
                        ? "No approver found in workflow definition"
                        : "No active workflow; default behavior will apply"}
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
              <button
                type="button"
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedOrder(null);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setTargetApproverId(null);
                  setWorkflowSteps([]);
                  setWfError("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-700"
                onClick={forwardDocument}
                disabled={
                  submittingForward ||
                  !selectedOrder ||
                  (Array.isArray(workflowSteps) &&
                    workflowSteps.length > 0 &&
                    candidateWorkflow &&
                    !targetApproverId)
                }
              >
                {submittingForward ? "Forwarding..." : "Forward"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
