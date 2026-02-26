import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import { api } from "../../../api/client.js";
import { Download } from "lucide-react";

export default function StockUploadPage() {
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [itRes, whRes] = await Promise.all([
          api.get("/inventory/items"),
          api.get("/inventory/warehouses"),
        ]);
        if (!mounted) return;
        setItems(Array.isArray(itRes.data?.items) ? itRes.data.items : []);
        setWarehouses(Array.isArray(whRes.data?.items) ? whRes.data.items : []);
      } catch (e) {
        toast.error(e?.response?.data?.message || "Failed to load data");
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const downloadTemplate = () => {
    try {
      const header = ["ITEM_CODE", "ITEM_NAME", "NEW_QTY"];
      const data = items.map((it) => ({
        ITEM_CODE: String(it.item_code || ""),
        ITEM_NAME: String(it.item_name || ""),
        NEW_QTY: "",
      }));
      const ws = XLSX.utils.json_to_sheet(data, { header });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "StockUpload");
      XLSX.writeFile(wb, "stock_upload_template.xlsx");
    } catch (e) {
      toast.error("Failed to generate template");
    }
  };

  const handleChooseFile = () => {
    fileRef.current?.click();
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const normalized = rows
        .map((r) => ({
          item_code: String(r.ITEM_CODE || r.item_code || "").trim(),
          qty: Number(r.NEW_QTY ?? r.qty ?? r.QTY ?? 0),
        }))
        .filter((r) => r.item_code && Number.isFinite(r.qty));
      if (!normalized.length) {
        toast.error("No valid rows found in the Excel file");
        return;
      }
      const resp = await api.post("/inventory/stock-balances/bulk-upload", {
        rows: normalized,
        warehouseId: warehouseId || null,
      });
      const updated = Number(resp?.data?.updated || 0);
      const failed = Number(resp?.data?.failed || 0);
      toast.success(
        `Upload complete: ${updated} updated${failed ? `, ${failed} failed` : ""}`,
      );
    } catch (e) {
      toast.error(e?.response?.data?.message || "Upload failed");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/inventory"
            className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to Inventory
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            Stock Upload
          </h1>
          <p className="text-sm mt-1">
            Download template, fill quantities, and upload to update stock balances
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-body space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Warehouse</label>
              <select
                className="input"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                <option value="">None / Branch-level</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.warehouse_name || w.warehouse_code}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button type="button" className="btn" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Download Template (Excel)
              </button>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                className="btn-success"
                onClick={handleChooseFile}
                disabled={loading}
              >
                Upload Filled Excel
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFile}
              />
            </div>
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-300">
            Template columns: ITEM_CODE, ITEM_NAME, NEW_QTY. Only ITEM_CODE and
            NEW_QTY are required.
          </div>
        </div>
      </div>
    </div>
  );
}
