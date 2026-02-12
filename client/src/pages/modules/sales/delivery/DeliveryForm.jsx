import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../../../api/client";
import { useAuth } from "../../../../auth/AuthContext.jsx";
import { ArrowLeft, Save, Search, Truck, CheckCircle } from "lucide-react";

export default function DeliveryForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { scope } = useAuth();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [taxes, setTaxes] = useState([]);

  const [formData, setFormData] = useState({
    delivery_no: "",
    delivery_date: new Date().toISOString().split("T")[0],
    customer_id: "",
    sales_order_id: "",
    invoice_id: "",
    status: "DRAFT",
    remarks: "",
    items: [],
  });

  // Search states
  const [searchOrderNo, setSearchOrderNo] = useState("");

  // Data Lists
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [itemsCatalog, setItemsCatalog] = useState([]);

  useEffect(() => {
    loadCustomers();
    loadInvoices();
    loadItems();
    fetchTaxCodes();
    if (isEdit) {
      loadDelivery(id);
    } else {
      (async () => {
        try {
          const nextNo = await getNextDeliveryNo();
          setFormData((prev) => ({ ...prev, delivery_no: nextNo }));
        } catch {
          setFormData((prev) => ({ ...prev, delivery_no: "DN-000001" }));
        }
      })();
    }
  }, [id]);

  async function loadCustomers() {
    try {
      const res = await api.get("/sales/customers");
      setCustomers(res.data.items || []);
    } catch (err) {
      console.error("Failed to load customers", err);
    }
  }

  async function loadInvoices() {
    try {
      const [invRes, delRes] = await Promise.all([
        api.get("/sales/invoices"),
        api.get("/sales/deliveries"),
      ]);
      const invs = Array.isArray(invRes.data?.items) ? invRes.data.items : [];
      const dels = Array.isArray(delRes.data?.items) ? delRes.data.items : [];
      const usedInvoiceIds = new Set(
        dels
          .map((d) => d?.invoice_id)
          .filter((v) => v !== undefined && v !== null)
          .map((v) => String(v)),
      );
      const usedOrderIds = new Set(
        dels
          .map((d) => d?.sales_order_id)
          .filter((v) => v !== undefined && v !== null)
          .map((v) => String(v)),
      );
      let filtered = invs;
      if (usedInvoiceIds.size > 0) {
        filtered = filtered.filter((i) => !usedInvoiceIds.has(String(i.id)));
      } else {
        filtered = filtered.filter(
          (i) => !usedOrderIds.has(String(i.sales_order_id)),
        );
      }
      setInvoices(filtered);
    } catch (err) {
      console.error("Failed to load invoices", err);
    }
  }

  async function loadItems() {
    try {
      const res = await api.get("/inventory/items");
      setItemsCatalog(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (err) {
      console.error("Failed to load items", err);
    }
  }

  async function getNextDeliveryNo() {
    try {
      const res = await api.get("/sales/deliveries/next-no");
      const nextNo = res.data?.nextNo || "";
      return nextNo || "DN-000001";
    } catch (err) {
      console.error("Failed to fetch deliveries for next no", err);
      return "DN-000001";
    }
  }

  const fetchTaxCodes = async () => {
    try {
      const response = await api.get("/finance/tax-codes");
      const fetchedTaxes = Array.isArray(response.data?.items)
        ? response.data.items
        : [];
      const mappedTaxes = fetchedTaxes.map((t) => ({
        value: t.id,
        label: t.name,
        rate: Number(t.rate_percent),
      }));
      setTaxes(mappedTaxes);
    } catch (error) {
      console.error("Error fetching tax codes:", error);
    }
  };

  async function loadDelivery(deliveryId) {
    try {
      setLoading(true);
      const res = await api.get(`/sales/deliveries/${deliveryId}`);
      const header = res.data?.item || {};
      const details = Array.isArray(res.data?.details) ? res.data.details : [];
      setFormData((prev) => ({
        ...prev,
        delivery_no: header.delivery_no || prev.delivery_no,
        delivery_date:
          (header.delivery_date
            ? String(header.delivery_date).slice(0, 10)
            : prev.delivery_date) || prev.delivery_date,
        customer_id: header.customer_id || "",
        sales_order_id: header.sales_order_id || "",
        invoice_id: header.invoice_id || "",
        status: header.status || prev.status,
        remarks: header.remarks || "",
        items: details.map((d) => ({
          item_id: d.item_id,
          item_name: d.item_name || "",
          quantity: Number(d.quantity || 0),
          ordered_qty: Number(d.quantity || 0),
          tax_type: d.tax_id || "",
          uom: d.uom || "PCS",
          unit_price: Number(d.unit_price || 0),
        })),
      }));
      setLoading(false);
    } catch (err) {
      setError("Failed to load delivery");
      setLoading(false);
    }
  }

  async function handleInvoiceSelect(invoiceId) {
    if (!invoiceId) return;

    try {
      setLoading(true);
      // Find the selected invoice from the list
      const match = invoices.find((i) => String(i.id) === String(invoiceId));

      if (match) {
        // Check if it's linked to a sales order
        if (!match.sales_order_id) {
          console.warn("This invoice is not linked to a sales order.");
        }

        let orderData = null;
        let orderDetails = [];

        if (match.sales_order_id) {
          // Fetch linked sales order
          const orderRes = await api.get(
            `/sales/orders/${match.sales_order_id}`,
          );
          orderData = orderRes.data.item;
          orderDetails = orderRes.data.details;
        }

        const itemsToLoad = orderDetails.length > 0 ? orderDetails : [];

        setFormData((prev) => ({
          ...prev,
          customer_id: match.customer_id,
          sales_order_id: match.sales_order_id || "",
          invoice_id: match.id || "",
          items: itemsToLoad.map((d) => ({
            item_id: d.item_id,
            item_name:
              d.item_name ||
              itemsCatalog.find((p) => String(p.id) === String(d.item_id))
                ?.item_name ||
              "",
            quantity: d.quantity,
            ordered_qty: d.quantity,
            tax_type: d.tax_id || (taxes.length > 0 ? taxes[0].value : ""),
            uom: d.uom || "PCS",
            unit_price: Number(d.unit_price || 0),
          })),
        }));

        if (orderData) {
          setSearchOrderNo(orderData.order_no);
        } else {
          setSearchOrderNo("");
        }

        setSuccess(`Loaded from Invoice ${match.invoice_no}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error loading invoice details");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.customer_id) {
      alert("Please select a customer");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...formData,
        company_id: scope?.companyId,
        branch_id: scope?.branchId,
        invoice_id: formData.invoice_id || undefined,
        items: formData.items.map((item) => {
          const tax = taxes.find((t) => t.value == item.tax_type);
          return {
            item_id: item.item_id,
            quantity: Number(item.quantity),
            tax_id: item.tax_type,
            tax_rate: tax ? tax.rate : 0,
            tax_amount: 0,
          };
        }),
      };
      if (isEdit) {
        await api.put(`/sales/deliveries/${id}`, payload);
      } else {
        await api.post("/sales/deliveries", payload);
      }
      setSuccess("Delivery saved successfully");
      setTimeout(() => navigate("/sales/delivery"), 1500);
    } catch (err) {
      setError("Failed to save delivery");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function updateStatus(newStatus) {
    if (isEdit && id) {
      (async () => {
        try {
          await api.put(`/sales/deliveries/${id}/status`, {
            status: newStatus,
          });
          setFormData((prev) => ({ ...prev, status: newStatus }));
          setSuccess(`Status updated to ${newStatus}`);
        } catch (err) {
          setError("Failed to update status");
          console.error(err);
        }
      })();
    } else {
      setFormData((prev) => ({ ...prev, status: newStatus }));
    }
  }

  if (loading && !formData.customer_id)
    return <div className="p-8">Loading...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold">
            {isEdit ? "Edit Delivery" : "New Delivery"}
          </h1>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => updateStatus("DELIVERED")}
            disabled={
              !isEdit ||
              saving ||
              String(formData.status || "").toUpperCase() === "DELIVERED"
            }
            className="btn-success flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Auto Delivery
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Delivery
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded mb-6">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 text-green-600 p-4 rounded mb-6">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded shadow-sm border">
            <h2 className="text-lg font-semibold mb-4">Delivery Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery No
                </label>
                <input
                  type="text"
                  value={formData.delivery_no}
                  onChange={(e) =>
                    setFormData({ ...formData, delivery_no: e.target.value })
                  }
                  className="w-full border rounded p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={formData.delivery_date}
                  onChange={(e) =>
                    setFormData({ ...formData, delivery_date: e.target.value })
                  }
                  className="w-full border rounded p-2"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer
                </label>
                <select
                  id="customer"
                  value={formData.customer_id}
                  onChange={(e) =>
                    setFormData({ ...formData, customer_id: e.target.value })
                  }
                  className="w-full border rounded p-2"
                >
                  <option value="">Select Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.customer_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded shadow-sm border">
            <h2 className="text-lg font-semibold mb-4">Load Items</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Invoice Selection */}
              <div className="p-4 bg-gray-50 rounded border col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Invoice
                </label>
                <select
                  className="w-full border rounded p-2"
                  onChange={(e) => handleInvoiceSelect(e.target.value)}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select an Invoice...
                  </option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_no} -{" "}
                      {new Date(inv.invoice_date).toLocaleDateString()} (
                      {inv.total_amount})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Selecting an invoice will populate customer and order details.
                </p>
              </div>

              {/* Sales Order Display (Read Only or Manual Override) */}
              <div className="p-4 bg-gray-50 rounded border col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sales Order Number
                </label>
                <input
                  type="text"
                  placeholder="Sales Order No"
                  value={searchOrderNo}
                  readOnly
                  className="w-full border rounded p-2 bg-gray-100 text-gray-500 cursor-not-allowed"
                />
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="p-3">Item</th>
                    <th className="p-3 w-28">Ordered</th>
                    <th className="p-3 w-28">To Deliver</th>
                    <th className="p-3 w-20">UOM</th>
                    <th className="p-3 w-28">Unit Price</th>
                    <th className="p-3 w-40">Tax</th>
                    <th className="p-3 w-12">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {formData.items.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-gray-500">
                        No items loaded. Search for an order or invoice.
                      </td>
                    </tr>
                  ) : (
                    formData.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-3">
                          {item.item_name ||
                            itemsCatalog.find(
                              (p) => String(p.id) === String(item.item_id),
                            )?.item_name ||
                            ""}
                        </td>
                        <td className="p-3">{item.ordered_qty}</td>
                        <td className="p-3">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => {
                              const newItems = [...formData.items];
                              newItems[idx].quantity =
                                parseFloat(e.target.value) || 0;
                              setFormData({ ...formData, items: newItems });
                            }}
                            className="w-full border rounded p-1"
                          />
                        </td>
                        <td className="p-3">{item.uom || "PCS"}</td>
                        <td className="p-3">
                          {Number(item.unit_price || 0).toFixed(2)}
                        </td>
                        <td className="p-3">
                          <select
                            value={item.tax_type || ""}
                            onChange={(e) => {
                              const newItems = [...formData.items];
                              newItems[idx].tax_type = e.target.value;
                              setFormData({ ...formData, items: newItems });
                            }}
                            className="w-full border rounded p-1"
                          >
                            <option value="">None</option>
                            {taxes.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => {
                              const newItems = formData.items.filter(
                                (_, i) => i !== idx,
                              );
                              setFormData({ ...formData, items: newItems });
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            &times;
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded shadow-sm border">
            <h2 className="text-lg font-semibold mb-4">Shipping Info</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remarks
                </label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) =>
                    setFormData({ ...formData, remarks: e.target.value })
                  }
                  rows="4"
                  className="w-full border rounded p-2"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
