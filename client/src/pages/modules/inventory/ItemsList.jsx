import React, { useEffect, useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { usePermission } from "../../../auth/PermissionContext.jsx";
import { toast } from "react-toastify";
import { api } from "../../../api/client";

export default function ItemsList() {
  const { canPerformAction } = usePermission();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [itemType, setItemType] = useState("");
  const [status, setStatus] = useState("");
  const [hasBarcode, setHasBarcode] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [sort, setSort] = useState({ key: "item_code", asc: true });
  const fileInputRef = useRef(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHeaders, setPreviewHeaders] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [uploading, setUploading] = useState(false);
  const normalizeBarcode = (v) => {
    if (v == null) return "";
    const s = String(v).trim();
    if (!s) return "";
    const m = /^([+-]?)(\d+(?:\.\d+)?)[eE]([+-]?\d+)$/.exec(s);
    if (!m) return s;
    const sign = m[1] || "";
    let num = m[2];
    const exp = parseInt(m[3], 10);
    if (!Number.isFinite(exp)) return s;
    if (num.includes(".")) {
      const parts = num.split(".");
      const intPart = parts[0];
      const fracPart = parts[1];
      if (exp >= 0) {
        const move = Math.min(exp, fracPart.length);
        const merged = intPart + fracPart.slice(0, move);
        const rem = fracPart.slice(move);
        const zeros =
          exp > fracPart.length ? "0".repeat(exp - fracPart.length) : "";
        num = merged + rem + zeros;
      } else {
        const k = -exp;
        const pad = "0".repeat(k - intPart.length);
        const left =
          intPart.length > k ? intPart.slice(0, intPart.length - k) : "";
        const right =
          (intPart.length > k
            ? intPart.slice(intPart.length - k)
            : pad + intPart) + fracPart;
        num = left + (left ? "" : "") + right;
      }
    } else {
      if (exp >= 0) {
        num = num + "0".repeat(exp);
      } else {
        const k = -exp;
        const pad = "0".repeat(k);
        num = "0." + pad + num;
      }
    }
    num = num.replace(/^0+(?=\d)/, "");
    return (sign === "-" ? "-" : "") + num;
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    api
      .get("/inventory/items")
      .then((res) => {
        if (!mounted) return;
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load items");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((it) => Boolean(it.is_active)).length;
    const inactive = total - active;
    const lowStock = items.filter(
      (it) =>
        Number(it.stock_level || 0) <= Number(it.reorder_level || -1) &&
        it.reorder_level != null,
    ).length;
    return { total, active, inactive, lowStock };
  }, [items]);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return items
      .filter((it) => {
        if (itemType && String(it.item_type || "") !== itemType) return false;
        if (status && (status === "Y" ? !it.is_active : it.is_active))
          return false;
        if (hasBarcode === "Y" && !it.barcode) return false;
        if (hasBarcode === "N" && it.barcode) return false;
        return (
          String(it.item_code || "")
            .toLowerCase()
            .includes(q) ||
          String(it.item_name || "")
            .toLowerCase()
            .includes(q) ||
          String(it.barcode || "")
            .toLowerCase()
            .includes(q)
        );
      })
      .sort((a, b) => {
        const av = a[sort.key];
        const bv = b[sort.key];
        if (av == null && bv == null) return 0;
        if (av == null) return sort.asc ? -1 : 1;
        if (bv == null) return sort.asc ? 1 : -1;
        if (typeof av === "number" && typeof bv === "number") {
          return sort.asc ? av - bv : bv - av;
        }
        const as = String(av).toLowerCase();
        const bs = String(bv).toLowerCase();
        if (as < bs) return sort.asc ? -1 : 1;
        if (as > bs) return sort.asc ? 1 : -1;
        return 0;
      });
  }, [items, searchTerm, itemType, status, hasBarcode, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const onSort = (key) => {
    setSort((prev) =>
      prev.key === key ? { key, asc: !prev.asc } : { key, asc: true },
    );
  };

  const handleBulkUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const processImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const lines = text.split("\n");
      const headers = lines[0].split(",").map((h) => h.trim());

      // Basic validation of headers
      const requiredHeaders = ["ITEM_NAME*", "ITEM_TYPE*", "BASE_UOM*"];
      const missing = requiredHeaders.filter((h) => !headers.includes(h));
      if (missing.length > 0) {
        toast.error(
          `Invalid CSV format: Missing required header(s): ${missing.join(", ")}`,
        );
        return;
      }

      // Build lookup maps for category/group/currency/tax/account codes -> IDs
      let categoryCodeToId = new Map();
      let categoryIdToName = new Map();
      let groupCodeToId = new Map();
      let groupIdToName = new Map();
      let currencyCodeToId = new Map();
      let taxCodeToId = new Map();
      let accountCodeToId = new Map();
      let itemTypeSet = new Set();
      let itemTypeCodeToCode = new Map();
      let itemTypeNameToCode = new Map();
      try {
        const [catRes, grpRes, curRes, taxRes, accRes, typeRes] =
          await Promise.all([
            api.get("/inventory/item-categories"),
            api.get("/inventory/item-groups"),
            api.get("/finance/currencies"),
            api.get("/finance/tax-codes"),
            api.get("/finance/accounts"),
            api.get("/inventory/item-types"),
          ]);
        const cats = Array.isArray(catRes?.data?.items)
          ? catRes.data.items
          : [];
        const grps = Array.isArray(grpRes?.data?.items)
          ? grpRes.data.items
          : [];
        const curs = Array.isArray(curRes?.data?.items)
          ? curRes.data.items
          : [];
        const taxes = Array.isArray(taxRes?.data?.items)
          ? taxRes.data.items
          : [];
        const accounts = Array.isArray(accRes?.data?.items)
          ? accRes.data.items
          : [];
        const types = Array.isArray(typeRes?.data?.items)
          ? typeRes.data.items
          : [];
        cats.forEach((c) => {
          const id = Number(c.id);
          const code = String(c.category_code || "").toUpperCase();
          const name = String(c.category_name || "").toUpperCase();
          if (id > 0) {
            if (code) categoryCodeToId.set(code, id);
            if (name) categoryCodeToId.set(name, id);
            categoryIdToName.set(id, String(c.category_name || ""));
          }
        });
        grps.forEach((g) => {
          const id = Number(g.id);
          const code = String(g.group_code || "").toUpperCase();
          const name = String(g.group_name || "").toUpperCase();
          if (id > 0) {
            if (code) groupCodeToId.set(code, id);
            if (name) groupCodeToId.set(name, id);
            groupIdToName.set(id, String(g.group_name || ""));
          }
        });
        curs.forEach((c) => {
          const id = Number(c.id);
          const code = String(c.code || "").toUpperCase();
          const name = String(c.name || "").toUpperCase();
          if (id > 0) {
            if (code) currencyCodeToId.set(code, id);
            if (name) currencyCodeToId.set(name, id);
          }
        });
        taxes.forEach((t) => {
          const id = Number(t.id);
          const code = String(t.code || "").toUpperCase();
          const name = String(t.name || "").toUpperCase();
          if (id > 0) {
            if (code) taxCodeToId.set(code, id);
            if (name) taxCodeToId.set(name, id);
          }
        });
        accounts.forEach((a) => {
          const id = Number(a.id);
          const code = String(a.code || "").toUpperCase();
          const name = String(a.name || "").toUpperCase();
          if (id > 0) {
            if (code) accountCodeToId.set(code, id);
            if (name) accountCodeToId.set(name, id);
          }
        });
        types.forEach((t) => {
          const code = String(
            t.type_code || t.code || t.key || "",
          ).toUpperCase();
          const name = String(t.type_name || t.name || "").toUpperCase();
          if (code) {
            itemTypeSet.add(code);
            itemTypeCodeToCode.set(code, code);
          }
          if (name) {
            itemTypeSet.add(name);
            if (code) itemTypeNameToCode.set(name, code);
          }
        });
      } catch (_) {
        // proceed without maps; numeric IDs in CSV will still work via fallback below
      }

      const rows = [];
      const existingNames = new Set(
        (Array.isArray(items) ? items : [])
          .map((it) => String(it.item_name || "").toUpperCase())
          .filter(Boolean),
      );
      const seenNames = new Set();
      // Build preview rows with validation
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = line.split(",").map((v) => v.trim());
        if (values.length < headers.length) continue;
        const rowData = {};
        headers.forEach((h, idx) => {
          const key = h.replace("*", "");
          rowData[key] = values[idx];
        });
        let nextItemCode = rowData.ITEM_CODE || "";
        const itemTypeRaw = String(rowData.ITEM_TYPE || "").toUpperCase();
        const itemTypeResolved =
          itemTypeCodeToCode.get(itemTypeRaw) ||
          itemTypeNameToCode.get(itemTypeRaw) ||
          (itemTypeSet.has(itemTypeRaw) ? itemTypeRaw : null);
        const itemTypeValid =
          itemTypeSet.size === 0 ? true : !!itemTypeResolved;
        const barcodeExpanded = normalizeBarcode(rowData.BARCODE || "");
        const categoryResolved =
          (rowData.ITEM_CATEGORY &&
            categoryCodeToId.get(
              String(rowData.ITEM_CATEGORY).toUpperCase(),
            )) ||
          (rowData.ITEM_CATEGORY_CODE &&
            categoryCodeToId.get(
              String(rowData.ITEM_CATEGORY_CODE).toUpperCase(),
            )) ||
          rowData.ITEM_CATEGORY_ID ||
          null;
        const groupResolved =
          (rowData.ITEM_GROUP &&
            groupCodeToId.get(String(rowData.ITEM_GROUP).toUpperCase())) ||
          (rowData.ITEM_GROUP_CODE &&
            groupCodeToId.get(String(rowData.ITEM_GROUP_CODE).toUpperCase())) ||
          rowData.ITEM_GROUP_ID ||
          null;
        let categoryLabel = "";
        if (rowData.ITEM_CATEGORY_ID) {
          const cid = Number(rowData.ITEM_CATEGORY_ID);
          categoryLabel =
            categoryIdToName.get(cid) ||
            rowData.ITEM_CATEGORY ||
            rowData.ITEM_CATEGORY_CODE ||
            String(rowData.ITEM_CATEGORY_ID);
        } else {
          categoryLabel =
            rowData.ITEM_CATEGORY ||
            rowData.ITEM_CATEGORY_CODE ||
            (categoryResolved
              ? categoryIdToName.get(Number(categoryResolved)) || ""
              : "");
        }
        let groupLabel = "";
        if (rowData.ITEM_GROUP_ID) {
          const gid = Number(rowData.ITEM_GROUP_ID);
          groupLabel =
            groupIdToName.get(gid) ||
            rowData.ITEM_GROUP ||
            rowData.ITEM_GROUP_CODE ||
            String(rowData.ITEM_GROUP_ID);
        } else {
          groupLabel =
            rowData.ITEM_GROUP ||
            rowData.ITEM_GROUP_CODE ||
            (groupResolved
              ? groupIdToName.get(Number(groupResolved)) || ""
              : "");
        }
        const categoryName = categoryResolved
          ? categoryIdToName.get(Number(categoryResolved)) || ""
          : "";
        const groupName = groupResolved
          ? groupIdToName.get(Number(groupResolved)) || ""
          : "";
        const errorsRow = [];
        if (!rowData.ITEM_NAME) errorsRow.push("Missing ITEM_NAME");
        const nameUpper = String(rowData.ITEM_NAME || "").toUpperCase();
        if (nameUpper) {
          if (existingNames.has(nameUpper))
            errorsRow.push("Duplicate ITEM_NAME");
          if (seenNames.has(nameUpper)) errorsRow.push("Duplicate in CSV");
          seenNames.add(nameUpper);
        }
        if (!itemTypeRaw) errorsRow.push("Missing ITEM_TYPE");
        if (!itemTypeValid) errorsRow.push("Unknown ITEM_TYPE");
        if (!rowData.BASE_UOM) errorsRow.push("Missing BASE_UOM");
        if (rowData.ITEM_CATEGORY && !categoryResolved)
          errorsRow.push("Unknown ITEM_CATEGORY");
        if (rowData.ITEM_GROUP && !groupResolved)
          errorsRow.push("Unknown ITEM_GROUP");
        rows.push({
          index: i + 1,
          raw: rowData,
          preview: {
            item_code: nextItemCode,
            item_name: rowData.ITEM_NAME,
            item_type: itemTypeResolved || itemTypeRaw,
            category_id: categoryResolved,
            item_group_id: groupResolved,
            category_label: String(categoryLabel),
            group_label: String(groupLabel),
            category_name: categoryName,
            group_name: groupName,
            uom: rowData.BASE_UOM,
            barcode: barcodeExpanded,
          },
          valid: errorsRow.length === 0,
          errors: errorsRow,
        });
      }
      setPreviewHeaders([
        "Row",
        "Item Code",
        "Name",
        "Type",
        "Uploaded Category",
        "Category Name",
        "Uploaded Group",
        "Group Name",
        "UOM",
        "Barcode",
        "Status",
      ]);
      setPreviewRows(rows);
      setPreviewOpen(true);
      e.target.value = null;
    };

    reader.readAsText(file);
  };

  const confirmUpload = async () => {
    try {
      setUploading(true);
      let success = 0;
      let failed = 0;
      const errs = [];
      for (const r of previewRows) {
        if (!r.valid) {
          failed++;
          continue;
        }
        const rowData = r.raw;
        let nextItemCode = rowData.ITEM_CODE;
        if (!nextItemCode) {
          try {
            const res = await api.get("/inventory/items/next-code");
            if (res?.data?.nextCode) nextItemCode = res.data.nextCode;
          } catch {}
        }
        const payload = {
          item_code: nextItemCode,
          item_name: rowData.ITEM_NAME,
          item_type: r.preview.item_type || rowData.ITEM_TYPE,
          category_id: r.preview.category_id || null,
          item_group_id: r.preview.item_group_id || null,
          group_id: r.preview.item_group_id || null,
          uom: rowData.BASE_UOM,
          barcode: r.preview.barcode || null,
          cost_price: Number(rowData.STANDARD_COST) || 0,
          selling_price: Number(rowData.SELLING_PRICE) || 0,
          currency_id: null,
          description: rowData.DESCRIPTION,
          is_stockable: rowData.IS_STOCKABLE === "Y",
          is_sellable: rowData.IS_SELLABLE === "Y",
          is_purchasable: rowData.IS_PURCHASABLE === "Y",
          min_stock_level: Number(rowData.MIN_STOCK_LEVEL) || 0,
          max_stock_level: Number(rowData.MAX_STOCK_LEVEL) || 0,
          reorder_level: Number(rowData.REORDER_LEVEL) || 0,
          safety_stock: Number(rowData.SAFETY_STOCK) || 0,
        };
        try {
          await api.post("/inventory/items", payload);
          success++;
        } catch (err) {
          failed++;
          errs.push(
            `Row ${r.index} (${payload.item_code || payload.item_name}): ${
              err.response?.data?.message || err.message
            }`,
          );
        }
      }
      if (success > 0) {
        toast.success(`Uploaded ${success} items`);
        const res = await api.get("/inventory/items");
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      }
      if (failed > 0) {
        toast.error(`Skipped ${failed} invalid rows`);
        if (errs.length) {
          alert(
            "Some rows failed:\n" +
              errs.slice(0, 10).join("\n") +
              (errs.length > 10 ? "\n..." : ""),
          );
        }
      }
    } finally {
      setUploading(false);
      setPreviewOpen(false);
      setPreviewRows([]);
      setPreviewHeaders([]);
    }
  };

  const downloadTemplateCSV = async () => {
    let taxCodes = [];
    let accountCodes = [];
    try {
      const [taxRes, accRes] = await Promise.all([
        api.get("/finance/tax-codes"),
        api.get("/finance/accounts"),
      ]);
      taxCodes = (Array.isArray(taxRes?.data?.items) ? taxRes.data.items : [])
        .map((t) => String(t.code || "").trim())
        .filter(Boolean);
      accountCodes = (
        Array.isArray(accRes?.data?.items) ? accRes.data.items : []
      )
        .map((a) => String(a.code || "").trim())
        .filter(Boolean);
    } catch {
      // ignore; will fall back to placeholders below
    }
    const pick = (arr, idx = 0, fallback = "") =>
      String(arr?.[idx] || fallback);
    const findByName = (arr, part) =>
      String(arr?.find((c) => String(c).toUpperCase().includes(part)) || "");
    const sampleVatPurchase = pick(taxCodes, 0, "VAT");
    const sampleVatSales = pick(taxCodes, 1, sampleVatPurchase);
    let samplePurchaseAcc =
      findByName(accountCodes, "PURCHASE") || pick(accountCodes, 0, "PURCHASE");
    let sampleSalesAcc =
      findByName(accountCodes, "SALES") ||
      pick(accountCodes, 1, pick(accountCodes, 0, "SALES"));
    const headers = [
      "ITEM_NAME*",
      "ITEM_TYPE*",
      "ITEM_CATEGORY",
      "ITEM_GROUP",
      "BASE_UOM*",
      "BARCODE",
      "STANDARD_COST",
      "SELLING_PRICE",
      "CURRENCY_CODE",
      "VAT_PURCHASE_CODE",
      "VAT_SALES_CODE",
      "PURCHASE_ACCOUNT_CODE",
      "SALES_ACCOUNT_CODE",
      "DESCRIPTION",
      "IS_STOCKABLE",
      "IS_SELLABLE",
      "IS_PURCHASABLE",
      "MIN_STOCK_LEVEL",
      "MAX_STOCK_LEVEL",
      "REORDER_LEVEL",
      "SAFETY_STOCK",
    ];
    const sample = [
      [
        "Raw Material 1",
        "RAW_MATERIAL",
        "",
        "",
        "PCS",
        "",
        "100.00",
        "120.00",
        "GHS",
        sampleVatPurchase,
        sampleVatSales,
        samplePurchaseAcc,
        sampleSalesAcc,
        "Sample raw material",
        "Y",
        "Y",
        "Y",
        "10",
        "100",
        "20",
        "5",
      ],
      [
        "Finished Good 1",
        "FINISHED_GOOD",
        "",
        "",
        "PCS",
        "5060072082361",
        "150.00",
        "180.00",
        "GHS",
        sampleVatPurchase,
        sampleVatSales,
        samplePurchaseAcc,
        sampleSalesAcc,
        "Sample finished product",
        "Y",
        "Y",
        "Y",
        "5",
        "50",
        "10",
        "3",
      ],
    ];
    const rows = [headers.join(","), ...sample.map((r) => r.join(","))].join(
      "\n",
    );
    const blob = new Blob([rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "items_bulk_upload_template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const exportItemsCSV = () => {
    const headers = [
      "item_code",
      "item_name",
      "item_type",
      "category_name",
      "uom",
      "barcode",
      "stock_level",
      "cost_price",
      "selling_price",
      "is_active",
    ];
    const csv = [
      headers.join(","),
      ...filtered.map((it) =>
        [
          it.item_code ?? "",
          it.item_name ?? "",
          it.item_type ?? "",
          it.category_name ?? "",
          it.uom ?? "",
          it.barcode ?? "",
          it.stock_level ?? "",
          it.cost_price ?? "",
          it.selling_price ?? "",
          it.is_active ? "Y" : "N",
        ]
          .map((v) => {
            const s = String(v);
            return s.includes(",") || s.includes('"') || s.includes("\n")
              ? `"${s.replace(/"/g, '""')}"`
              : s;
          })
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "items_export.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemType, status, hasBarcode, pageSize]);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Items Master
              </h1>
              <p className="text-sm mt-1 text-slate-500 dark:text-slate-400">
                Configure items, UOM, pricing and barcodes
              </p>
            </div>
            <div className="flex gap-2 flex-wrap w-full md:w-auto justify-start md:justify-end">
              <Link to="/inventory" className="btn-secondary">
                Return to Menu
              </Link>
              <input
                type="file"
                ref={fileInputRef}
                onChange={processImport}
                className="hidden"
                accept=".csv"
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={handleBulkUpload}
              >
                Bulk Upload
              </button>
              <button
                type="button"
                className="btn-outline"
                onClick={downloadTemplateCSV}
              >
                Download Template
              </button>
              <button
                type="button"
                className="btn-outline"
                onClick={exportItemsCSV}
              >
                Export Items
              </button>
              <Link to="/inventory/items/new" className="btn-primary">
                + New Item
              </Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          {error ? (
            <div className="text-sm text-red-600 mb-4">{error}</div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
            <div className="col-span-2">
              <input
                type="text"
                placeholder="Search by code, name, barcode..."
                className="input w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <select
                className="input w-full"
                value={itemType}
                onChange={(e) => setItemType(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="RAW_MATERIAL">Raw Material</option>
                <option value="FINISHED_GOOD">Finished Good</option>
                <option value="SEMI_FINISHED">Semi-Finished</option>
                <option value="CONSUMABLE">Consumable</option>
                <option value="SERVICE">Service</option>
              </select>
            </div>
            <div>
              <select
                className="input w-full"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All Status</option>
                <option value="Y">Active</option>
                <option value="N">Inactive</option>
              </select>
            </div>
            <div>
              <select
                className="input w-full"
                value={hasBarcode}
                onChange={(e) => setHasBarcode(e.target.value)}
              >
                <option value="">All</option>
                <option value="Y">With Barcode</option>
                <option value="N">Without Barcode</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <div className="p-3 bg-white rounded border">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-slate-500">Total Items</div>
            </div>
            <div className="p-3 bg-white rounded border">
              <div className="text-2xl font-bold">{stats.active}</div>
              <div className="text-sm text-slate-500">Active Items</div>
            </div>
            <div className="p-3 bg-white rounded border">
              <div className="text-2xl font-bold">{stats.lowStock}</div>
              <div className="text-sm text-slate-500">Low Stock</div>
            </div>
            <div className="p-3 bg-white rounded border">
              <div className="text-2xl font-bold">{stats.inactive}</div>
              <div className="text-sm text-slate-500">Inactive Items</div>
            </div>
          </div>

          <div className="flex justify-between items-center mb-2">
            <div className="text-sm text-slate-600">
              Showing {Math.min(pageItems.length, filtered.length)} of{" "}
              {filtered.length} items
            </div>
            <div>
              <select
                className="input"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th onClick={() => onSort("item_code")}>Item Code</th>
                  <th onClick={() => onSort("item_name")}>Item Name</th>
                  <th onClick={() => onSort("item_type")}>Type</th>
                  <th onClick={() => onSort("category_name")}>Category</th>
                  <th onClick={() => onSort("uom")}>UOM</th>
                  <th>Barcode</th>
                  <th onClick={() => onSort("stock_level")}>Stock Level</th>
                  <th
                    className="text-right"
                    onClick={() => onSort("cost_price")}
                  >
                    Std Cost
                  </th>
                  <th
                    className="text-right"
                    onClick={() => onSort("selling_price")}
                  >
                    Sell Price
                  </th>
                  <th onClick={() => onSort("is_active")}>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="11"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : null}
                {!loading && !pageItems.length ? (
                  <tr>
                    <td
                      colSpan="11"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      No items found
                    </td>
                  </tr>
                ) : null}
                {pageItems.map((it) => (
                  <tr key={it.id}>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {it.item_code}
                    </td>
                    <td>{it.item_name}</td>
                    <td>{it.item_type_name || it.item_type || "-"}</td>
                    <td>{it.category_name || "-"}</td>
                    <td>{it.uom}</td>
                    <td>{it.barcode || "-"}</td>
                    <td>{it.stock_level ?? "-"}</td>
                    <td className="text-right">
                      {Number(it.cost_price || 0).toFixed(2)}
                    </td>
                    <td className="text-right">
                      {Number(it.selling_price || 0).toFixed(2)}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          it.is_active ? "badge-success" : "badge-error"
                        }`}
                      >
                        {it.is_active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td>
                      {canPerformAction("inventory:items", "view") && (
                        <Link
                          to={`/inventory/items/${it.id}?mode=view`}
                          className="text-brand hover:text-brand-700 text-sm font-medium"
                        >
                          View
                        </Link>
                      )}
                      {canPerformAction("inventory:items", "edit") && (
                        <Link
                          to={`/inventory/items/${it.id}?mode=edit`}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium ml-2"
                        >
                          Edit
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center py-3 border-t gap-4">
            <div className="text-sm text-slate-600 order-2 md:order-1">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2 items-center order-1 md:order-2">
              <button
                className="btn-success"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
              >
                ««
              </button>
              <button
                className="btn-success"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                «
              </button>
              <span className="text-sm">
                {(currentPage - 1) * pageSize + 1}-
                {Math.min(currentPage * pageSize, filtered.length)} of{" "}
                {filtered.length}
              </span>
              <button
                className="btn-success"
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
              >
                »
              </button>
              <button
                className="btn-success"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
              >
                »»
              </button>
            </div>
          </div>
        </div>
      </div>
      {previewOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div className="w-[96vw] max-w-[1100px] max-h-[85vh] bg-white rounded-xl shadow-erp-lg overflow-hidden border border-slate-200">
            <div className="px-4 py-3 bg-brand text-white flex items-center justify-between">
              <div>
                <div className="text-lg font-bold">Bulk Upload Preview</div>
                <div className="text-xs opacity-90">
                  Review parsed rows. Only valid rows will be uploaded.
                </div>
              </div>
              <button
                type="button"
                className="text-white hover:text-slate-100 text-xl"
                onClick={() => {
                  setPreviewOpen(false);
                  setPreviewRows([]);
                  setPreviewHeaders([]);
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="overflow-auto" style={{ maxHeight: "55vh" }}>
                <div className="min-w-[960px]">
                  <table className="table w-full">
                    <thead>
                      <tr>
                        {previewHeaders.map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((r) => (
                        <tr
                          key={r.index}
                          className={r.valid ? "" : "bg-red-50"}
                        >
                          <td>{r.index}</td>
                          <td>{r.preview.item_code || "-"}</td>
                          <td>{r.preview.item_name || "-"}</td>
                          <td>{r.preview.item_type || "-"}</td>
                          <td>{r.preview.category_label || "-"}</td>
                          <td>{r.preview.category_name || "-"}</td>
                          <td>{r.preview.group_label || "-"}</td>
                          <td>{r.preview.group_name || "-"}</td>
                          <td>{r.preview.uom || "-"}</td>
                          <td>{r.preview.barcode || "-"}</td>
                          <td>
                            {r.valid ? (
                              <span className="text-green-700 font-medium">
                                OK
                              </span>
                            ) : (
                              <span className="text-red-700 text-sm">
                                {r.errors.join("; ")}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setPreviewOpen(false);
                    setPreviewRows([]);
                    setPreviewHeaders([]);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-success"
                  onClick={confirmUpload}
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Upload Valid Rows"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
