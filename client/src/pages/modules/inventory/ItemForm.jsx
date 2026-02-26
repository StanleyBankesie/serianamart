import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";
import { useUoms } from "@/hooks/useUoms";
import { useItemCategories } from "@/hooks/useItemCategories";
import { useItemTypes } from "@/hooks/useItemTypes";

export default function ItemForm() {
  const { uoms, loading: uomsLoading } = useUoms();
  const { categories, loading: categoriesLoading } = useItemCategories();
  const { itemTypes, loading: itemTypesLoading } = useItemTypes();
  console.log("ItemForm mounting");
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [itemGroups, setItemGroups] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [currencies, setCurrencies] = useState([]);

  const [formData, setFormData] = useState({
    item_code: "",
    item_name: "",
    uom: "PCS",
    barcode: "",
    cost_price: 0,
    selling_price: 0,
    currency_id: "",
    image_url: "",
    is_active: true,
    item_type: "",
    category_id: "",
    item_group_id: "",
    description: "",
    min_stock_level: 0,
    max_stock_level: 0,
    reorder_level: 0,
    safety_stock: 0,
    vat_on_purchase_id: "",
    vat_on_sales_id: "",
    purchase_account_id: "",
    sales_account_id: "",
    service_item: false,
    is_stockable: true,
    is_sellable: true,
    is_purchasable: true,
  });

  useEffect(() => {
    Promise.all([
      api.get("/inventory/item-groups"),
      api.get("/finance/accounts").catch(() => ({ data: { items: [] } })),
      api.get("/finance/tax-codes").catch(() => ({ data: { items: [] } })),
      api.get("/finance/currencies").catch(() => ({ data: { items: [] } })),
    ])
      .then(([groupsRes, accountsRes, taxesRes, currenciesRes]) => {
        setItemGroups(
          Array.isArray(groupsRes.data?.items) ? groupsRes.data.items : []
        );
        setAccounts(
          Array.isArray(accountsRes.data?.items) ? accountsRes.data.items : []
        );
        setTaxes(
          Array.isArray(taxesRes.data?.items) ? taxesRes.data.items : []
        );
        setCurrencies(
          Array.isArray(currenciesRes.data?.items)
            ? currenciesRes.data.items
            : []
        );
      })
      .catch(() => {});

    if (isNew) {
      // Fetch next item code
      api
        .get("/inventory/items/next-code")
        .then((res) => {
          if (res.data?.nextCode) {
            setFormData((prev) => ({ ...prev, item_code: res.data.nextCode }));
          }
        })
        .catch(() => {});
      return;
    }

    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get(`/inventory/items/${id}`)
      .then((res) => {
        if (!mounted) return;
        const it = res.data?.item;
        if (!it) return;
        setFormData({
          item_code: it.item_code || "",
          item_name: it.item_name || "",
          uom: it.uom || "PCS",
          barcode: it.barcode || "",
          cost_price: Number(it.cost_price || 0),
          selling_price: Number(it.selling_price || 0),
          currency_id: it.currency_id || "",
          image_url: it.image_url || "",
          is_active: Boolean(it.is_active),
          item_type: it.item_type || "",
          category_id: it.category_id || "",
          item_group_id: it.item_group_id || "",
          description: it.description || "",
          min_stock_level: Number(it.min_stock_level || 0),
          max_stock_level: Number(it.max_stock_level || 0),
          reorder_level: Number(it.reorder_level || 0),
          safety_stock: Number(it.safety_stock || 0),
          vat_on_purchase_id: it.vat_on_purchase_id || "",
          vat_on_sales_id: it.vat_on_sales_id || "",
          purchase_account_id: it.purchase_account_id || "",
          sales_account_id: it.sales_account_id || "",
          service_item: String(it.service_item || "").toUpperCase() === "Y",
          is_stockable:
            String(it.is_stockable ?? "Y").toUpperCase() === "Y",
          is_sellable: String(it.is_sellable ?? "Y").toUpperCase() === "Y",
          is_purchasable:
            String(it.is_purchasable ?? "Y").toUpperCase() === "Y",
        });
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load item");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id, isNew]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append("file", file);

    setUploading(true);
    try {
      const res = await api.post("/upload", uploadData);
      setFormData((prev) => ({ ...prev, image_url: res.data.url }));
      toast.success("Image uploaded successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        item_code: formData.item_code,
        item_name: formData.item_name,
        uom: formData.uom,
        barcode: formData.barcode || null,
        cost_price: Number(formData.cost_price) || 0,
        selling_price: Number(formData.selling_price) || 0,
        currency_id: formData.currency_id || null,
        is_active: Boolean(formData.is_active),
        item_type: formData.item_type || null,
        category_id: formData.category_id || null,
        item_group_id: formData.item_group_id || null,
        description: formData.description || null,
        min_stock_level: Number(formData.min_stock_level) || 0,
        max_stock_level: Number(formData.max_stock_level) || 0,
        reorder_level: Number(formData.reorder_level) || 0,
        safety_stock: Number(formData.safety_stock) || 0,
        vat_on_purchase_id: formData.vat_on_purchase_id || null,
        vat_on_sales_id: formData.vat_on_sales_id || null,
        purchase_account_id: formData.purchase_account_id || null,
        sales_account_id: formData.sales_account_id || null,
        service_item: formData.service_item ? "Y" : "N",
        is_stockable: formData.is_stockable ? "Y" : "N",
        is_sellable: formData.is_sellable ? "Y" : "N",
        is_purchasable: formData.is_purchasable ? "Y" : "N",
      };

      if (isNew) {
        await api.post("/inventory/items", payload);
      } else {
        await api.put(`/inventory/items/${id}`, payload);
      }

      navigate("/inventory/items");
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to save item");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex flex-col md:flex-row justify-between items-center text-white gap-4">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                {isNew ? "New Item" : "Edit Item"}
              </h1>
              <p className="text-sm mt-1">
                Define item attributes, pricing and stock rules
              </p>
            </div>
            <Link
              to="/inventory/items"
              className="btn-success w-full md:w-auto text-center"
            >
              Back to List
            </Link>
          </div>
        </div>

        <div className="card-body">
          <form onSubmit={handleSubmit} className="space-y-6">
            {loading ? <div className="text-sm">Loading...</div> : null}
            {error ? <div className="text-sm text-red-600">{error}</div> : null}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="label">
                      Item Code * (System Generated)
                    </label>
                    <input
                      type="text"
                      className="input bg-gray-100 cursor-not-allowed"
                      value={formData.item_code}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="label">Item Name *</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.item_name}
                      onChange={(e) =>
                        setFormData({ ...formData, item_name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Barcode</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.barcode}
                      onChange={(e) =>
                        setFormData({ ...formData, barcode: e.target.value })
                      }
                      placeholder="Scan or enter barcode"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
                {formData.image_url ? (
                  <div className="relative w-full h-40 mb-2">
                    <img
                      src={formData.image_url}
                      alt="Item"
                      className="w-full h-full object-contain"
                    />
                    <button
                      type="button"
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                      onClick={() =>
                        setFormData({ ...formData, image_url: "" })
                      }
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="text-gray-400 mb-2 flex flex-col items-center">
                    <svg
                      className="w-12 h-12 mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span>No Image</span>
                  </div>
                )}
                <label
                  className={`btn-secondary cursor-pointer ${
                    uploading ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {uploading ? "Uploading..." : "Upload Image"}
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleImageUpload}
                    accept="image/*"
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Item Type *</label>
                <select
                  className="input"
                  value={formData.item_type}
                  onChange={(e) =>
                    setFormData({ ...formData, item_type: e.target.value })
                  }
                  required
                >
                  <option value="">-- Select Type --</option>
                  {itemTypesLoading ? (
                    <option>Loading...</option>
                  ) : (
                    (Array.isArray(itemTypes) ? itemTypes : []).map((t) =>
                      t ? (
                        <option key={t.id} value={t.type_code}>
                          {t.type_name}
                        </option>
                      ) : null
                    )
                  )}
                </select>
              </div>
              <div>
                <label className="label">Category</label>
                <select
                  className="input"
                  value={formData.category_id}
                  onChange={(e) =>
                    setFormData({ ...formData, category_id: e.target.value })
                  }
                >
                  <option value="">-- Select Category --</option>
                  {categoriesLoading ? (
                    <option>Loading...</option>
                  ) : (
                    categories.map((c) =>
                      c ? (
                        <option key={c.id} value={c.id}>
                          {c.category_name}
                        </option>
                      ) : null
                    )
                  )}
                </select>
              </div>
              <div>
                <label className="label">Base UOM</label>
                <select
                  className="input"
                  value={formData.uom}
                  onChange={(e) =>
                    setFormData({ ...formData, uom: e.target.value })
                  }
                >
                  <option value="">-- Select UOM --</option>
                  {uomsLoading ? (
                    <option>Loading...</option>
                  ) : (
                    uoms.map((u) => (
                      <option key={u.id} value={u.uom_code}>
                        {u.uom_code}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Item Group</label>
                <select
                  className="input"
                  value={formData.item_group_id}
                  onChange={(e) =>
                    setFormData({ ...formData, item_group_id: e.target.value })
                  }
                >
                  <option value="">-- Select Group --</option>
                  {itemGroups.map((g) =>
                    g ? (
                      <option key={g.id} value={g.id}>
                        {g.group_name}
                      </option>
                    ) : null
                  )}
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={formData.is_active ? "ACTIVE" : "INACTIVE"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      is_active: e.target.value === "ACTIVE",
                    })
                  }
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Cost Price</label>
                <input
                  type="number"
                  className="input"
                  value={formData.cost_price}
                  onChange={(e) =>
                    setFormData({ ...formData, cost_price: e.target.value })
                  }
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="label">Selling Price</label>
                <input
                  type="number"
                  className="input"
                  value={formData.selling_price}
                  onChange={(e) =>
                    setFormData({ ...formData, selling_price: e.target.value })
                  }
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="label">Currency</label>
                <select
                  className="input"
                  value={formData.currency_id}
                  onChange={(e) =>
                    setFormData({ ...formData, currency_id: e.target.value })
                  }
                >
                  <option value="">-- Select Currency --</option>
                  {currencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
              <h3 className="col-span-full font-semibold text-gray-700">
                Financial Details
              </h3>

              <div>
                <label className="label">TAX on Purchase</label>
                <select
                  className="input"
                  value={formData.vat_on_purchase_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      vat_on_purchase_id: e.target.value,
                    })
                  }
                >
                  <option value="">-- Select Tax Code --</option>
                  {taxes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code} ({Number(t.rate_percent)}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">TAX on Sales</label>
                <select
                  className="input"
                  value={formData.vat_on_sales_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      vat_on_sales_id: e.target.value,
                    })
                  }
                >
                  <option value="">-- Select Tax Code --</option>
                  {taxes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code} ({Number(t.rate_percent)}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Purchase Account</label>
                <select
                  className="input"
                  value={formData.purchase_account_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      purchase_account_id: e.target.value,
                    })
                  }
                >
                  <option value="">-- Select Account --</option>
                  {accounts
                    .filter(
                      (a) =>
                        !a.nature ||
                        ["EXPENSE", "COST_OF_SALES"].includes(a.nature)
                    )
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                  {/* Fallback to show all if not found in filter or just append others */}
                  <option disabled>──────────</option>
                  {accounts.map((a) => (
                    <option key={`all-${a.id}`} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Sales Account</label>
                <select
                  className="input"
                  value={formData.sales_account_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      sales_account_id: e.target.value,
                    })
                  }
                >
                  <option value="">-- Select Account --</option>
                  {accounts
                    .filter(
                      (a) =>
                        !a.group_name ||
                        a.group_name.toUpperCase().includes("INCOME") ||
                        a.group_name.toUpperCase().includes("REVENUE") ||
                        a.group_name.toUpperCase().includes("SALES")
                    )
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                  <option disabled>──────────</option>
                  {accounts.map((a) => (
                    <option key={`all-${a.id}`} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Description</label>
              <textarea
                className="input"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="label">Min Stock Level</label>
                <input
                  type="number"
                  className="input"
                  value={formData.min_stock_level}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      min_stock_level: e.target.value,
                    })
                  }
                  min="0"
                />
              </div>
              <div>
                <label className="label">Max Stock Level</label>
                <input
                  type="number"
                  className="input"
                  value={formData.max_stock_level}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_stock_level: e.target.value,
                    })
                  }
                  min="0"
                />
              </div>
              <div>
                <label className="label">Reorder Level</label>
                <input
                  type="number"
                  className="input"
                  value={formData.reorder_level}
                  onChange={(e) =>
                    setFormData({ ...formData, reorder_level: e.target.value })
                  }
                  min="0"
                />
              </div>
              <div>
                <label className="label">Safety Stock</label>
                <input
                  type="number"
                  className="input"
                  value={formData.safety_stock}
                  onChange={(e) =>
                    setFormData({ ...formData, safety_stock: e.target.value })
                  }
                  min="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2 p-2 border rounded">
                <input
                  type="checkbox"
                  checked={formData.service_item}
                  onChange={(e) =>
                    setFormData({ ...formData, service_item: e.target.checked })
                  }
                />
                <span>Service Item</span>
              </div>
              <div className="flex items-center gap-2 p-2 border rounded">
                <input
                  type="checkbox"
                  checked={formData.is_stockable}
                  onChange={(e) =>
                    setFormData({ ...formData, is_stockable: e.target.checked })
                  }
                />
                <span>Is Stockable</span>
              </div>
              <div className="flex items-center gap-2 p-2 border rounded">
                <input
                  type="checkbox"
                  checked={formData.is_sellable}
                  onChange={(e) =>
                    setFormData({ ...formData, is_sellable: e.target.checked })
                  }
                />
                <span>Is Sellable</span>
              </div>
              <div className="flex items-center gap-2 p-2 border rounded">
                <input
                  type="checkbox"
                  checked={formData.is_purchasable}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      is_purchasable: e.target.checked,
                    })
                  }
                />
                <span>Is Purchasable</span>
              </div>
            </div>

            <div className="flex flex-col-reverse md:flex-row justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Link
                to="/inventory/items"
                className="btn-secondary w-full md:w-auto text-center"
              >
                Cancel
              </Link>
              <button
                type="submit"
                className="btn-primary w-full md:w-auto"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Item"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
