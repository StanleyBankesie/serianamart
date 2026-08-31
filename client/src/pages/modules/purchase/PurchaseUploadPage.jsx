/**
 * @fileoverview PurchaseUploadPage component.
 * Allows downloading Excel templates, filling in purchase bills, and bulk uploading into pur_bills and optionally fin_vouchers.
 */

import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import {
  Download,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  RefreshCw,
  Layers,
  HelpCircle
} from "lucide-react";
import { api } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { usePermission } from "@/auth/PermissionContext";

const TEMPLATE_HEADERS = [
  "BRANCH_ID",
  "WAREHOUSE_NAME",
  "SUPPLIER_NAME",
  "BILL_DATE",
  "DUE_DATE",
  "SUPPLIER_INVOICE_NO",
  "SUPPLIER_INVOICE_DATE",
  "PAYMENT_TERMS",
  "CURRENCY",
  "EXCHANGE_RATE",
  "ITEM_NAME",
  "QTY",
  "UNIT_PRICE",
  "DISCOUNT_PERCENT",
  "TAX_AMOUNT",
  "DESCRIPTION"
];

export default function PurchaseUploadPage() {
  const { scope, user } = useAuth();
  const { canAccessFeatureKey, isSuper } = usePermission();
  const fileRef = useRef(null);

  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [items, setItems] = useState([]);
  const [updateFinanceVouchers, setUpdateFinanceVouchers] = useState(true);
  const [parsedBills, setParsedBills] = useState([]);
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const hasAccess = isSuper || canAccessFeatureKey("purchase", "purchase-upload");

  useEffect(() => {
    if (!hasAccess) return;
    Promise.all([
      api.get("/admin/branches").catch(() => ({ data: [] })),
      api.get("/inventory/warehouses").catch(() => ({ data: [] })),
      api.get("/finance/currencies").catch(() => ({ data: [] })),
      api.get("/inventory/items").catch(() => ({ data: [] })),
    ]).then(([brRes, whRes, curRes, itemRes]) => {
      const bItems = brRes.data?.items || brRes.data || [];
      const wItems = whRes.data?.items || whRes.data || [];
      const cItems = curRes.data?.items || curRes.data || [];
      const itItems = itemRes.data?.items || itemRes.data || [];
      setBranches(bItems);
      setWarehouses(wItems);
      setCurrencies(cItems);
      setItems(itItems);
      if (scope?.branchId) {
        setSelectedBranch(String(scope.branchId));
      } else if (bItems.length === 1) {
        setSelectedBranch(String(bItems[0].id));
      }
    });
  }, [hasAccess, scope?.branchId]);

  if (!hasAccess) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl mt-12 space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Access Restricted</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          You do not have permission to access the Purchase Upload page. This exclusive permission can only be granted by a System Administrator under Admin Permissions in System Configuration.
        </p>
        <Link to="/purchase" className="btn btn-secondary text-xs px-4 py-2 inline-flex items-center gap-1.5">
          <ArrowLeft size={14} /> Return to Purchase
        </Link>
      </div>
    );
  }

  const downloadTemplate = async () => {
    try {
      const bId = selectedBranch || (branches[0] ? String(branches[0].id) : "1");
      const branchWhs = warehouses
        .filter((w) => !selectedBranch || String(w.branch_id) === String(selectedBranch))
        .map((w) => w.warehouse_name || w.name)
        .filter(Boolean);

      const defaultWh = branchWhs[0] || "Main Warehouse";
      const today = new Date().toISOString().slice(0, 10);

      const paymentTermsList = ["Immediate", "15 Days", "30 Days", "45 Days", "60 Days", "90 Days"];
      const currencyList = currencies.length > 0
        ? Array.from(new Set(currencies.map((c) => c.code || c.currency_code).filter(Boolean)))
        : ["GHS", "USD", "EUR", "GBP", "NGN", "KES", "RMB", "CAD"];

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("PurchaseBills");

      // Populate lookup sheet for autocomplete
      const lookupSheet = workbook.addWorksheet("LookupData");
      lookupSheet.getCell("A1").value = "ITEM_NAME";

      const itemNames = items.length > 0
        ? items.map((it) => it.item_name || it.name).filter(Boolean)
        : ["Office Paper A4", "Ballpoint Pens Box", "Wireless Router"];

      itemNames.forEach((name, idx) => {
        lookupSheet.getCell(`A${idx + 2}`).value = name;
      });

      lookupSheet.state = "hidden";

      // Column definitions
      worksheet.columns = [
        { header: "BRANCH_ID", key: "BRANCH_ID", width: 12 },
        { header: "WAREHOUSE_NAME", key: "WAREHOUSE_NAME", width: 22 },
        { header: "SUPPLIER_NAME", key: "SUPPLIER_NAME", width: 26 },
        { header: "BILL_DATE", key: "BILL_DATE", width: 14 },
        { header: "DUE_DATE", key: "DUE_DATE", width: 14 },
        { header: "SUPPLIER_INVOICE_NO", key: "SUPPLIER_INVOICE_NO", width: 22 },
        { header: "SUPPLIER_INVOICE_DATE", key: "SUPPLIER_INVOICE_DATE", width: 22 },
        { header: "PAYMENT_TERMS", key: "PAYMENT_TERMS", width: 18 },
        { header: "CURRENCY", key: "CURRENCY", width: 15 },
        { header: "EXCHANGE_RATE", key: "EXCHANGE_RATE", width: 15 },
        { header: "ITEM_NAME", key: "ITEM_NAME", width: 28 },
        { header: "QTY", key: "QTY", width: 12 },
        { header: "UNIT_PRICE", key: "UNIT_PRICE", width: 14 },
        { header: "DISCOUNT_PERCENT", key: "DISCOUNT_PERCENT", width: 18 },
        { header: "TAX_AMOUNT", key: "TAX_AMOUNT", width: 14 },
        { header: "DESCRIPTION", key: "DESCRIPTION", width: 26 }
      ];

      // Style header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FF1E293B" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE2E8F0" },
      };

      // Add sample rows
      worksheet.addRow({
        BRANCH_ID: bId,
        WAREHOUSE_NAME: defaultWh,
        SUPPLIER_NAME: "ABC Supplies Ltd",
        BILL_DATE: today,
        DUE_DATE: today,
        SUPPLIER_INVOICE_NO: "INV-9981",
        SUPPLIER_INVOICE_DATE: today,
        PAYMENT_TERMS: "30 Days",
        CURRENCY: "GHS",
        EXCHANGE_RATE: 1,
        ITEM_NAME: "Office Paper A4",
        QTY: 10,
        UNIT_PRICE: 45.0,
        DISCOUNT_PERCENT: 0,
        TAX_AMOUNT: 4.5,
        DESCRIPTION: "Office Supplies Q1"
      });

      worksheet.addRow({
        BRANCH_ID: bId,
        WAREHOUSE_NAME: defaultWh,
        SUPPLIER_NAME: "ABC Supplies Ltd",
        BILL_DATE: today,
        DUE_DATE: today,
        SUPPLIER_INVOICE_NO: "INV-9981",
        SUPPLIER_INVOICE_DATE: today,
        PAYMENT_TERMS: "30 Days",
        CURRENCY: "GHS",
        EXCHANGE_RATE: 1,
        ITEM_NAME: "Ballpoint Pens Box",
        QTY: 5,
        UNIT_PRICE: 20.0,
        DISCOUNT_PERCENT: 5,
        TAX_AMOUNT: 1.9,
        DESCRIPTION: "Office Supplies Q1"
      });

      worksheet.addRow({
        BRANCH_ID: bId,
        WAREHOUSE_NAME: defaultWh,
        SUPPLIER_NAME: "Global Tech Ltd",
        BILL_DATE: today,
        DUE_DATE: today,
        SUPPLIER_INVOICE_NO: "INV-4412",
        SUPPLIER_INVOICE_DATE: today,
        PAYMENT_TERMS: "Immediate",
        CURRENCY: "USD",
        EXCHANGE_RATE: 15.5,
        ITEM_NAME: "Wireless Router",
        QTY: 2,
        UNIT_PRICE: 120.0,
        DISCOUNT_PERCENT: 0,
        TAX_AMOUNT: 0,
        DESCRIPTION: "IT Equipment"
      });

      // Data validations
      const whFormula = branchWhs.length > 0
        ? `"${branchWhs.join(",")}"`
        : `"${defaultWh}"`;
      const termsFormula = `"${paymentTermsList.join(",")}"`;
      const curFormula = `"${currencyList.join(",")}"`;
      const itemFormula = `LookupData!$A$2:$A$${itemNames.length + 1}`;

      for (let r = 2; r <= 1000; r++) {
        // Col B: WAREHOUSE_NAME
        worksheet.getCell(`B${r}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [whFormula],
          showErrorMessage: true,
          errorTitle: "Invalid Warehouse",
          error: "Please select a warehouse from the dropdown list.",
        };
        // Col H: PAYMENT_TERMS
        worksheet.getCell(`H${r}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [termsFormula],
          showErrorMessage: true,
          errorTitle: "Invalid Payment Terms",
          error: "Please select payment terms from the dropdown list.",
        };
        // Col I: CURRENCY
        worksheet.getCell(`I${r}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [curFormula],
          showErrorMessage: true,
          errorTitle: "Invalid Currency",
          error: "Please select a currency from the dropdown list.",
        };
        // Col K: ITEM_NAME (Type-ahead autocomplete dropdown)
        worksheet.getCell(`K${r}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [itemFormula],
          showErrorMessage: true,
          errorTitle: "Invalid Item Name",
          error: "Please select a valid item name from the autocomplete list.",
        };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Purchase_Bills_Upload_Template.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Template downloaded successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate template");
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (!rows.length) {
          toast.error("No rows found in the uploaded file");
          return;
        }

        const grouped = groupBills(rows);
        if (!grouped.length) {
          toast.error("No valid purchase bills parsed from file");
          return;
        }

        setParsedBills(grouped);
        setPreview(true);
        toast.info(`Parsed ${grouped.length} purchase bill(s) with ${rows.length} total line items`);
      } catch (err) {
        toast.error("Failed to parse file: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const groupBills = (rawRows) => {
    const formatDate = (d) => {
      if (!d) return "";
      if (d instanceof Date) {
        const tzOffset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
      }
      return String(d).trim();
    };

    const billMap = new Map();

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const supp = String(row.SUPPLIER_NAME || row.supplier_name || "").trim();
      const billDate = formatDate(row.BILL_DATE || row.bill_date) || new Date().toISOString().slice(0, 10);
      const suppInvNo = String(row.SUPPLIER_INVOICE_NO || row.supplier_invoice_no || row.supplier_invoice_number || "").trim();
      const wh = String(row.WAREHOUSE_NAME || row.warehouse_name || "").trim();

      if (!supp) continue;

      const groupKey = suppInvNo
        ? `SUPP_${supp}_INV_${suppInvNo}`
        : `SUPP_${supp}_DATE_${billDate}_WH_${wh}_${i}`;

      if (!billMap.has(groupKey)) {
        billMap.set(groupKey, {
          branch_id: row.BRANCH_ID || row.branch_id || selectedBranch || 1,
          warehouse_name: wh,
          supplier_name: supp,
          bill_no: "",
          bill_date: billDate,
          due_date: formatDate(row.DUE_DATE || row.due_date),
          supplier_invoice_number: suppInvNo,
          supplier_invoice_date: formatDate(row.SUPPLIER_INVOICE_DATE || row.supplier_invoice_date),
          payment_terms: String(row.PAYMENT_TERMS || row.payment_terms || "30 Days").trim(),
          currency_code: String(row.CURRENCY || row.currency || row.CURRENCY_CODE || row.currency_code || "GHS").trim(),
          exchange_rate: Number(row.EXCHANGE_RATE || row.exchange_rate || 1) || 1,
          lines: [],
        });
      }

      const currentBill = billMap.get(groupKey);
      const qty = Number(row.QTY ?? row.qty ?? 1);
      const unitPrice = Number(row.UNIT_PRICE ?? row.unit_price ?? 0);
      const discPct = Number(row.DISCOUNT_PERCENT ?? row.discount_percent ?? 0);
      const taxAmt = Number(row.TAX_AMOUNT ?? row.tax_amount ?? 0);
      const gross = qty * unitPrice;
      const net = gross - (gross * discPct) / 100;
      const total = net + taxAmt;

      currentBill.lines.push({
        item_name: String(row.ITEM_NAME || row.item_name || row.ITEM_CODE || row.item_code || "").trim(),
        qty,
        unit_price: unitPrice,
        discount_percent: discPct,
        tax_amount: taxAmt,
        line_total: total,
        description: String(row.DESCRIPTION || row.description || "").trim(),
      });
    }

    return Array.from(billMap.values());
  };

  const handleUpload = async () => {
    if (!parsedBills.length) {
      toast.error("No purchase bills to upload");
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const resp = await api.post("/purchase/bulk-upload", {
        bills: parsedBills,
        updateFinanceVouchers,
        branchId: selectedBranch ? Number(selectedBranch) : null,
      });

      setUploadResult(resp.data);
      toast.success(
        `Successfully uploaded ${resp.data.createdCount || parsedBills.length} purchase bill(s)!`
      );
      setPreview(false);
      setParsedBills([]);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to upload purchase bills");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      {/* Header */}
      <div className="card shadow-md">
        <div className="card-header bg-brand text-white rounded-t-lg p-5">
          <Link
            to="/purchase"
            className="inline-flex items-center gap-1.5 text-xs text-white/80 hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Purchase
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Purchase Upload</h1>
          <p className="text-sm text-white/80 mt-1">
            Download template, fill in supplier bills, and bulk upload into Purchase & Finance modules
          </p>
        </div>

        <div className="card-body p-6 space-y-6">
          {/* Settings & Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-800/40 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300">
                Target Branch
              </label>
              <select
                className="input text-sm mt-1"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
              >
                <option value="">Select Branch</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.branch_name || b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col justify-center">
              <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-2">
                Finance Integration
              </label>
              <label className="flex items-center gap-3 cursor-pointer bg-white dark:bg-slate-900 px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-brand transition-colors">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-brand focus:ring-brand w-4 h-4"
                  checked={updateFinanceVouchers}
                  onChange={(e) => setUpdateFinanceVouchers(e.target.checked)}
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Update Finance Vouchers (fin_vouchers)
                  </span>
                  <p className="text-slate-500 text-[11px]">
                    Auto-posts Purchase Voucher entries into General Ledger
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Quick Action Steps Banner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="inline-block bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mb-1">
                  Step 1
                </span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Download Purchase Bills Template
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Get pre-formatted spreadsheet with required bill and item columns
                </p>
              </div>
              <button
                type="button"
                onClick={downloadTemplate}
                className="btn btn-success text-xs px-4 py-2 font-semibold inline-flex items-center gap-2 whitespace-nowrap shadow-sm"
              >
                <Download size={15} /> Download Template
              </button>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/60 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="inline-block bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mb-1">
                  Step 2
                </span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Upload Completed Excel Sheet
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Select your filled Excel file (.xlsx, .xls, or .csv) to preview & import
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="btn btn-primary text-xs px-4 py-2 font-semibold inline-flex items-center gap-2 whitespace-nowrap shadow-sm"
              >
                <Upload size={15} /> Select File
              </button>
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            className="hidden"
            onChange={handleFile}
          />

          {/* Upload Result Modal/Banner */}
          {uploadResult && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300 font-semibold text-base">
                <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
                Upload Successful! {uploadResult.createdCount} Purchase Bill(s) Created.
              </div>
              {uploadResult.createdBills && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900">
                  <table className="table table-compact w-full text-xs">
                    <thead>
                      <tr>
                        <th>Bill No</th>
                        <th>Supplier</th>
                        <th>Net Amount</th>
                        <th>Finance Voucher No</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadResult.createdBills.map((cb, idx) => (
                        <tr key={idx}>
                          <td className="font-semibold text-brand">{cb.billNo}</td>
                          <td>{cb.supplierName}</td>
                          <td>{Number(cb.netAmount).toFixed(2)}</td>
                          <td>
                            {cb.voucherNo ? (
                              <span className="badge badge-success text-[10px]">{cb.voucherNo}</span>
                            ) : (
                              <span className="text-slate-400">N/A</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Preview Section */}
          {preview && parsedBills.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <FileSpreadsheet size={18} className="text-brand" />
                    Preview Data ({parsedBills.length} Bill{parsedBills.length !== 1 ? "s" : ""})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Review parsed details below before confirming upload.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setPreview(false);
                      setParsedBills([]);
                    }}
                    className="btn btn-secondary text-xs px-3 py-1.5"
                    disabled={uploading}
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="btn btn-success text-xs px-5 py-1.5 inline-flex items-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" /> Uploading...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} /> Confirm & Upload Bills
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {parsedBills.map((b, idx) => {
                  const totalNet = b.lines.reduce((s, l) => s + (l.line_total || 0), 0);

                  return (
                    <div
                      key={idx}
                      className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm space-y-3"
                    >
                      <div className="flex flex-wrap justify-between items-center text-xs gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="badge badge-brand text-[11px] font-bold">
                            Bill #{idx + 1}: {b.bill_no || "Auto-Generate"}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            Supplier: {b.supplier_name}
                          </span>
                          {b.warehouse_name && (
                            <span className="badge badge-outline text-[10px] text-slate-500">
                              Wh: {b.warehouse_name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400">
                          <span>Date: {b.bill_date}</span>
                          <span>Currency: {b.currency_code} ({b.exchange_rate})</span>
                          <span>Inv Ref: {b.supplier_invoice_number || "-"}</span>
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                            Total: {totalNet.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <table className="table table-compact w-full text-xs">
                        <thead>
                          <tr>
                            <th>Item Name</th>
                            <th className="text-right">Qty</th>
                            <th className="text-right">Unit Price</th>
                            <th className="text-right">Disc %</th>
                            <th className="text-right">Tax</th>
                            <th className="text-right">Line Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {b.lines.map((l, lIdx) => (
                            <tr key={lIdx}>
                              <td>
                                <span className="font-medium">{l.item_name || "Custom Item"}</span>
                                {l.description && (
                                  <span className="text-[10px] text-slate-400 block">{l.description}</span>
                                )}
                              </td>
                              <td className="text-right">{l.qty}</td>
                              <td className="text-right">{Number(l.unit_price).toFixed(2)}</td>
                              <td className="text-right">{l.discount_percent}%</td>
                              <td className="text-right">{Number(l.tax_amount).toFixed(2)}</td>
                              <td className="text-right font-semibold text-slate-900 dark:text-slate-100">
                                {Number(l.line_total).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
