import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import { api } from "../../../../api/client";
import "./PriceSetup.css";

export default function PriceSetup() {
  const [activeTab, setActiveTab] = useState("standard");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [priceTypes, setPriceTypes] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState(""); // 'standard', 'customer'
  const [selectedItem, setSelectedItem] = useState(null);
  const fileInputRef = React.useRef(null);

  // Filter states
  const [filters, setFilters] = useState({
    product: "",
    customer: "",
    category: "",
  });

  // Form states
  const [formData, setFormData] = useState({});

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadTabData();
  }, [activeTab, filters]);

  const loadInitialData = async () => {
    try {
      console.log("Loading initial data...");
      const [productsRes, customersRes, priceTypesRes, currenciesRes] =
        await Promise.all([
          api.get("/inventory/items"),
          api.get("/sales/customers"),
          api.get("/sales/price-types"),
          api.get("/finance/currencies"),
        ]);

      console.log("Products loaded:", productsRes.data);
      console.log("Customers loaded:", customersRes.data);
      console.log("Price Types loaded:", priceTypesRes.data);
      console.log("Currencies loaded:", currenciesRes.data);

      setProducts(productsRes.data.items || []);
      setCustomers(customersRes.data.items || []);
      setPriceTypes(priceTypesRes.data.items || []);
      setCurrencies(currenciesRes.data.items || []);
    } catch (err) {
      console.error("Error loading initial data:", err);
    }
  };

  const loadTabData = async () => {
    setLoading(true);
    try {
      let endpoint = "";
      let params = {};

      switch (activeTab) {
        case "standard":
          endpoint = "/sales/prices/standard";
          break;
        case "customer":
          endpoint = "/sales/prices/customer";
          if (filters.customer) params.customer_id = filters.customer;
          break;
        default:
          return;
      }

      console.log(`Fetching tab data from ${endpoint}`, params);
      const res = await api.get(endpoint, { params });
      console.log("Tab data response:", res.data);

      // Handle both array and object wrapper formats just in case
      const items = Array.isArray(res.data) ? res.data : res.data.items || [];
      setData(items);
    } catch (err) {
      console.error("Error loading tab data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    let headers = [];
    let filename = "";
    let rows = [];

    if (activeTab === "standard") {
      headers = [
        "Item Code",
        "Cost Price",
        "Selling Price",
        "Margin %",
        "Effective Date (YYYY-MM-DD)",
        "Price Type",
        "UOM",
        "Currency Name",
      ];
      filename = "standard_prices_template.xlsx";
      rows = data.map((item) => {
        const product = products.find((p) => p.id === item.product_id);
        const priceType = priceTypes.find((pt) => pt.id === item.price_type_id);
        const currency = currencies.find((c) => c.id === item.currency_id);
        return [
          product ? product.item_code : "",
          item.cost_price,
          item.selling_price,
          item.margin_percent,
          item.effective_date ? item.effective_date.split("T")[0] : "",
          priceType ? priceType.name : "",
          item.uom,
          currency ? currency.name : "",
        ];
      });
    } else {
      headers = [
        "Customer Name",
        "Item Code",
        "Standard Price",
        "Customer Price",
        "Discount %",
        "Min Quantity",
        "Effective From (YYYY-MM-DD)",
        "Effective To (YYYY-MM-DD)",
        "Price Type",
        "UOM",
        "Currency Name",
      ];
      filename = "customer_prices_template.xlsx";
      rows = data.map((item) => {
        const product = products.find((p) => p.id === item.product_id);
        const customer = customers.find((c) => c.id === item.customer_id);
        const priceType = priceTypes.find((pt) => pt.id === item.price_type_id);
        const currency = currencies.find((c) => c.id === item.currency_id);
        return [
          customer ? customer.customer_name : "",
          product ? product.item_code : "",
          item.standard_price,
          item.customer_price,
          item.discount_percent,
          item.min_quantity,
          item.effective_from ? item.effective_from.split("T")[0] : "",
          item.effective_to ? item.effective_to.split("T")[0] : "",
          priceType ? priceType.name : "",
          item.uom,
          currency ? currency.name : "",
        ];
      });
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Prices");
    XLSX.writeFile(wb, filename);
  };

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const items = XLSX.utils.sheet_to_json(sheet);

        if (items.length === 0) {
          alert("File is empty or invalid format");
          return;
        }

        const endpoint =
          activeTab === "standard"
            ? "/sales/prices/bulk/standard"
            : "/sales/prices/bulk/customer";
        await api.post(endpoint, { items });
        alert("Uploaded successfully");
        loadTabData();
      } catch (err) {
        console.error("Upload failed", err);
        alert("Upload failed: " + (err.response?.data?.message || err.message));
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleOpenModal = (type, item = null) => {
    setModalType(type);
    setSelectedItem(item);
    setFormData(item || {});
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedItem(null);
    setFormData({});
  };

  const handleSave = async () => {
    try {
      let endpoint = "";
      const payload = { ...formData };

      // Sanitize numeric fields
      const numericFields = [
        "product_id",
        "customer_id",
        "cost_price",
        "selling_price",
        "margin_percent",
        "standard_price",
        "customer_price",
        "discount_percent",
        "min_quantity",
        "max_quantity",
        "unit_price",
        "price_type_id",
        "currency_id",
      ];

      numericFields.forEach((field) => {
        if (
          payload[field] !== undefined &&
          payload[field] !== null &&
          payload[field] !== ""
        ) {
          payload[field] = Number(payload[field]);
        } else if (
          [
            "cost_price",
            "selling_price",
            "customer_price",
            "unit_price",
          ].includes(field)
        ) {
          // Default required numeric fields to 0 if empty
          if (payload[field] === "" || payload[field] === undefined)
            payload[field] = 0;
        } else {
          // Default optional numeric fields to null if empty
          if (payload[field] === "") payload[field] = null;
        }
      });

      // Sanitize date fields
      const dateFields = ["effective_date", "effective_from", "effective_to"];
      dateFields.forEach((field) => {
        if (payload[field] === "") payload[field] = null;
      });

      switch (modalType) {
        case "standard":
          endpoint = "/sales/prices/standard";
          break;
        case "customer":
          endpoint = "/sales/prices/customer";
          break;
        default:
          return;
      }

      await api.post(endpoint, payload);
      handleCloseModal();
      loadTabData();
    } catch (err) {
      console.error("Error saving data:", err);
      alert(
        "Failed to save data: " + (err.response?.data?.message || err.message)
      );
    }
  };

  const renderStandardPrices = () => (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Cost Price</th>
            <th>Selling Price</th>
            <th>Margin %</th>
            <th>Effective Date</th>
            <th>Price Type</th>
            <th>UOM</th>
            <th>Currency</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => {
            const product = products.find((p) => p.id === item.product_id);
            const priceType = priceTypes.find(
              (pt) => pt.id === item.price_type_id
            );
            const currency = currencies.find((c) => c.id === item.currency_id);
            return (
              <tr key={index}>
                <td>
                  {product
                    ? `${product.item_name} (${product.item_code})`
                    : item.product_id}
                </td>
                <td>{Number(item.cost_price).toFixed(2)}</td>
                <td>{Number(item.selling_price).toFixed(2)}</td>
                <td>{Number(item.margin_percent).toFixed(2)}%</td>
                <td>{new Date(item.effective_date).toLocaleDateString()}</td>
                <td>{priceType ? priceType.name : "-"}</td>
                <td>{item.uom || "-"}</td>
                <td>
                  {currency
                    ? `${currency.code} - ${currency.name}`
                    : item.currency_id || "-"}
                </td>
                <td>
                  <button
                    className="btn btn-sm btn-info"
                    onClick={() => handleOpenModal("standard", item)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderCustomerPrices = () => (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Product</th>
            <th>Standard Price</th>
            <th>Customer Price</th>
            <th>Discount %</th>
            <th>Min Qty</th>
            <th>Effective</th>
            <th>Price Type</th>
            <th>UOM</th>
            <th>Currency</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => {
            const customer = customers.find((c) => c.id === item.customer_id);
            const product = products.find((p) => p.id === item.product_id);
            const priceType = priceTypes.find(
              (pt) => pt.id === item.price_type_id
            );
            const currency = currencies.find((c) => c.id === item.currency_id);
            return (
              <tr key={index}>
                <td>{customer ? customer.customer_name : item.customer_id}</td>
                <td>{product ? product.item_name : item.product_id}</td>
                <td>{Number(item.standard_price).toFixed(2)}</td>
                <td>{Number(item.customer_price).toFixed(2)}</td>
                <td>{Number(item.discount_percent).toFixed(2)}%</td>
                <td>{item.min_quantity}</td>
                <td>
                  {item.effective_from
                    ? new Date(item.effective_from).toLocaleDateString()
                    : "-"}
                </td>
                <td>{priceType ? priceType.name : "-"}</td>
                <td>{item.uom || "-"}</td>
                <td>
                  {currency
                    ? `${currency.code} - ${currency.name}`
                    : item.currency_id || "-"}
                </td>
                <td>
                  <button
                    className="btn btn-sm btn-info"
                    onClick={() => handleOpenModal("customer", item)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const handleProductChange = (productId) => {
    const product = products.find((p) => p.id == productId);
    if (product) {
      setFormData((prev) => ({
        ...prev,
        product_id: productId,
        uom: product.uom,
        cost_price: product.cost_price,
        currency_id: product.currency_id,
        price_type_id: product.price_type_id,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        product_id: productId,
      }));
    }
  };

  const renderModalContent = () => {
    if (modalType === "standard") {
      return (
        <div className="form-grid">
          <div className="form-group">
            <label className="required">Product</label>
            <select
              value={formData.product_id || ""}
              onChange={(e) => handleProductChange(e.target.value)}
            >
              <option value="">Select Product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.item_name} ({p.item_code})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Price Type</label>
            <select
              value={formData.price_type_id || ""}
              onChange={(e) =>
                setFormData({ ...formData, price_type_id: e.target.value })
              }
            >
              <option value="">Select Price Type</option>
              {priceTypes.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {pt.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>UOM</label>
            <input
              type="text"
              value={formData.uom || ""}
              onChange={(e) =>
                setFormData({ ...formData, uom: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label>Currency</label>
            <select
              value={formData.currency_id || ""}
              onChange={(e) =>
                setFormData({ ...formData, currency_id: e.target.value })
              }
            >
              <option value="">Select Currency</option>
              {currencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="required">Cost Price</label>
            <input
              type="number"
              value={formData.cost_price || ""}
              onChange={(e) => {
                const cp = Number(e.target.value || 0);
                const mp = Number(formData.margin_percent || 0);
                const sp = Number((cp + (cp * mp) / 100).toFixed(2));
                setFormData({
                  ...formData,
                  cost_price: e.target.value,
                  selling_price: sp,
                });
              }}
            />
          </div>
          <div className="form-group">
            <label className="required">Selling Price</label>
            <input
              type="number"
              value={formData.selling_price || ""}
              onChange={(e) => {
                const sp = Number(e.target.value || 0);
                const cp = Number(formData.cost_price || 0);
                const mp = cp > 0 ? Number(((sp - cp) / cp) * 100) : 0;
                setFormData({
                  ...formData,
                  selling_price: e.target.value,
                  margin_percent: Number(mp.toFixed(2)),
                });
              }}
            />
          </div>
          <div className="form-group">
            <label>Margin %</label>
            <input
              type="number"
              value={formData.margin_percent || ""}
              onChange={(e) => {
                const mp = Number(e.target.value || 0);
                const cp = Number(formData.cost_price || 0);
                const sp = Number((cp + (cp * mp) / 100).toFixed(2));
                setFormData({
                  ...formData,
                  margin_percent: e.target.value,
                  selling_price: sp,
                });
              }}
            />
          </div>
          <div className="form-group">
            <label className="required">Effective Date</label>
            <input
              type="date"
              value={
                formData.effective_date
                  ? formData.effective_date.split("T")[0]
                  : ""
              }
              onChange={(e) =>
                setFormData({ ...formData, effective_date: e.target.value })
              }
            />
          </div>
        </div>
      );
    } else if (modalType === "customer") {
      return (
        <div className="form-grid">
          <div className="form-group">
            <label className="required">Customer</label>
            <select
              value={formData.customer_id || ""}
              onChange={(e) =>
                setFormData({ ...formData, customer_id: e.target.value })
              }
            >
              <option value="">Select Customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customer_name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="required">Product</label>
            <select
              value={formData.product_id || ""}
              onChange={(e) => handleProductChange(e.target.value)}
            >
              <option value="">Select Product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.item_name} ({p.item_code})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Price Type</label>
            <select
              value={formData.price_type_id || ""}
              onChange={(e) =>
                setFormData({ ...formData, price_type_id: e.target.value })
              }
            >
              <option value="">Select Price Type</option>
              {priceTypes.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {pt.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>UOM</label>
            <input
              type="text"
              value={formData.uom || ""}
              onChange={(e) =>
                setFormData({ ...formData, uom: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label>Currency</label>
            <select
              value={formData.currency_id || ""}
              onChange={(e) =>
                setFormData({ ...formData, currency_id: e.target.value })
              }
            >
              <option value="">Select Currency</option>
              {currencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Standard Price</label>
            <input
              type="number"
              value={formData.standard_price || ""}
              onChange={(e) =>
                setFormData({ ...formData, standard_price: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label className="required">Customer Price</label>
            <input
              type="number"
              value={formData.customer_price || ""}
              onChange={(e) =>
                setFormData({ ...formData, customer_price: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label>Discount %</label>
            <input
              type="number"
              value={formData.discount_percent || ""}
              onChange={(e) =>
                setFormData({ ...formData, discount_percent: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label>Min Quantity</label>
            <input
              type="number"
              value={formData.min_quantity || ""}
              onChange={(e) =>
                setFormData({ ...formData, min_quantity: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label>Effective From</label>
            <input
              type="date"
              value={
                formData.effective_from
                  ? formData.effective_from.split("T")[0]
                  : ""
              }
              onChange={(e) =>
                setFormData({ ...formData, effective_from: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label>Effective To</label>
            <input
              type="date"
              value={
                formData.effective_to ? formData.effective_to.split("T")[0] : ""
              }
              onChange={(e) =>
                setFormData({ ...formData, effective_to: e.target.value })
              }
            />
          </div>
        </div>
      );
    }
  };

  return (
    <div className="price-setup-container">
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept=".csv"
        onChange={handleFileChange}
      />
      <div className="price-setup-header">
        <h1>
          <span>💰</span>
          Price Setup
        </h1>
        <div className="header-actions">
          <Link to="/sales" className="btn btn-secondary">
            ← Return to Menu
          </Link>
          <button
            className="btn btn-secondary"
            onClick={handleDownloadTemplate}
          >
            📥 Download Template
          </button>
          <button className="btn btn-secondary" onClick={handleUploadClick}>
            📤 Upload Prices
          </button>
          <button className="btn btn-secondary" onClick={loadTabData}>
            🔄 Refresh
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleOpenModal(activeTab)}
          >
            ➕ New Price
          </button>
        </div>
      </div>

      <div className="content">
        <div className="tabs">
          <button
            className={`tab ${activeTab === "standard" ? "active" : ""}`}
            onClick={() => setActiveTab("standard")}
          >
            💵 Standard Prices
          </button>
          <button
            className={`tab ${activeTab === "customer" ? "active" : ""}`}
            onClick={() => setActiveTab("customer")}
          >
            👥 Customer Specific Prices
          </button>
        </div>

        {activeTab === "standard" && (
          <div className="tab-content active">
            <div className="filter-section">
              <div className="filter-grid">
                <div className="form-group">
                  <label>Search Product</label>
                  <input type="text" placeholder="Search by code or name" />
                </div>
                <div className="form-group">
                  <button className="btn btn-primary">🔍 Search</button>
                </div>
              </div>
            </div>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : data.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No standard prices found. Click "New Price" to add one.
              </div>
            ) : (
              renderStandardPrices()
            )}
          </div>
        )}

        {activeTab === "customer" && (
          <div className="tab-content active">
            <div className="filter-section">
              <div className="filter-grid">
                <div className="form-group">
                  <label>Select Customer</label>
                  <select
                    value={filters.customer}
                    onChange={(e) =>
                      setFilters({ ...filters, customer: e.target.value })
                    }
                  >
                    <option value="">All Customers</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.customer_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : data.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No customer prices found. Click "New Price" to add one.
              </div>
            ) : (
              renderCustomerPrices()
            )}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="price-modal-overlay">
          <div className="price-modal-content">
            <div className="modal-header">
              <h2>
                {modalType === "standard" && "💰 Standard Price Setup"}
                {modalType === "customer" && "👥 Customer Price Setup"}
              </h2>
              <button className="close-btn" onClick={handleCloseModal}>
                &times;
              </button>
            </div>
            <div className="modal-body">{renderModalContent()}</div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleCloseModal}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
