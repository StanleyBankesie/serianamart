import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import { api } from "api/client";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

function emptyLine() {
  return { accountId: "", description: "", debit: "", credit: "" };
}

export default function VoucherFormPage({ voucherTypeCode, title }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { search } = useLocation();
  const mode = new URLSearchParams(search).get("mode");
  const readOnly = mode === "view";
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [voucherTypes, setVoucherTypes] = useState([]);
  const [fiscalYears, setFiscalYears] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [taxCodes, setTaxCodes] = useState([]);
  const [payees, setPayees] = useState([]);
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [supplierBills, setSupplierBills] = useState([]);
  const [selectedBillRefs, setSelectedBillRefs] = useState([]);
  const [selectedInvoiceRefs, setSelectedInvoiceRefs] = useState([]);
  const [voucherNoPreview, setVoucherNoPreview] = useState("");

  const [voucherDate, setVoucherDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [narration, setNarration] = useState("");
  const [fiscalYearId, setFiscalYearId] = useState("");
  const [lines, setLines] = useState([emptyLine(), emptyLine()]);
  const isRV = String(voucherTypeCode).toUpperCase() === "RV";
  const isPV = String(voucherTypeCode).toUpperCase() === "PV";
  const isCV = String(voucherTypeCode).toUpperCase() === "CV";
  const isDN = String(voucherTypeCode).toUpperCase() === "DN";
  const isCN = String(voucherTypeCode).toUpperCase() === "CN";
  const isJV = String(voucherTypeCode).toUpperCase() === "JV";
  const [rvForm, setRvForm] = useState({
    receivedFrom: "",
    receivedFromCode: "",
    payerAccountId: "",
    paymentMethod: "Cash",
    reference: "",
    chequeDate: "",
    depositAccountId: "",
    taxCodeId: "",
    items: [{ description: "", accountId: "", amount: "", referenceNo: "" }],
    notes: "",
  });
  const [pvForm, setPvForm] = useState({
    payTo: "",
    payToCode: "",
    payToAccountId: "",
    paymentMethod: "Cash",
    reference: "",
    chequeDate: "",
    paymentAccountId: "",
    taxCodeId: "",
    items: [{ description: "", accountId: "", amount: "" }],
    notes: "",
  });
  const [pvExchangeRate, setPvExchangeRate] = useState("");
  const [cvExchangeRate, setCvExchangeRate] = useState("");
  const [showPayToLov, setShowPayToLov] = useState(false);
  const [payToSearch, setPayToSearch] = useState("");
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);
  const [billModalLoading, setBillModalLoading] = useState(false);
  const [billModalError, setBillModalError] = useState("");
  const [billModalType, setBillModalType] = useState("");
  const [billModalHeader, setBillModalHeader] = useState(null);
  const [billModalDetails, setBillModalDetails] = useState([]);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState("");
  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [firstApprover, setFirstApprover] = useState(null);
  const [workflowsCache, setWorkflowsCache] = useState(null);
  const [targetApproverId, setTargetApproverId] = useState(null);
  const [submittingForward, setSubmittingForward] = useState(false);
  const [voucherStatus, setVoucherStatus] = useState("DRAFT");
  const [cvForm, setCvForm] = useState({
    fromAccountId: "",
    toAccountId: "",
    transferMethod: "Cash",
    reference: "",
    chequeDate: "",
    taxCodeId: "",
    items: [{ description: "", amount: "" }],
    notes: "",
  });
  const [rvExchangeRate, setRvExchangeRate] = useState("");
  const [currencies, setCurrencies] = useState([]);
  const [dncnExchangeRate, setDncnExchangeRate] = useState("");
  const baseCurrency = useMemo(() => {
    const arr = Array.isArray(currencies) ? currencies : [];
    return (
      arr.find(
        (c) =>
          String(c.is_base) === "1" || c.is_base === 1 || c.is_base === true,
      ) ||
      arr.find(
        (c) => String(c.code || c.currency_code || "").toUpperCase() === "GHS",
      ) ||
      arr.find((c) =>
        /ghana|cedi/i.test(String(c.name || c.currency_name || "")),
      )
    );
  }, [currencies]);
  const dncnLineCurrencyId = useMemo(() => {
    const firstLineWithAccount = lines.find((l) => String(l.accountId || ""));
    const acc = accounts.find(
      (a) => String(a.id) === String(firstLineWithAccount?.accountId || ""),
    );
    return acc?.currency_id || null;
  }, [lines, accounts]);

  async function loadSetup() {
    try {
      const [vtRes, fyRes, accRes, taxRes, custRes, supRes, curRes] =
        await Promise.all([
          api.get("/finance/voucher-types"),
          api.get("/finance/fiscal-years"),
          api.get("/finance/accounts"),
          api.get("/finance/tax-codes"),
          api.get("/sales/customers?active=true"),
          api.get("/purchase/suppliers?active=true"),
          api.get("/finance/currencies"),
        ]);
      const vt = vtRes.data?.items || [];
      const fys = fyRes.data?.items || [];
      const acc = accRes.data?.items || [];
      const taxes = (taxRes.data?.items || []).filter(
        (t) => Number(t.is_active || 0) === 1,
      );
      const customers = Array.isArray(custRes.data?.items)
        ? custRes.data.items
        : [];
      const suppliers = Array.isArray(supRes.data?.items)
        ? supRes.data.items
        : [];
      const currs = Array.isArray(curRes.data?.items) ? curRes.data.items : [];
      const combinedPayees = [
        ...customers.map((c) => ({
          type: "CUSTOMER",
          id: c.id,
          code:
            (c.customer_code && String(c.customer_code).trim()) ||
            `C${String(Number(c.id || 0)).padStart(5, "0")}`,
          name: String(c.customer_name || "").trim(),
        })),
        ...suppliers.map((s) => ({
          type: "SUPPLIER",
          id: s.id,
          code:
            (s.supplier_code && String(s.supplier_code).trim()) ||
            `SU-${String(Number(s.id || 0)).padStart(6, "0")}`,
          name: String(s.supplier_name || "").trim(),
          serviceContractor: String(s.service_contractor || "N").toUpperCase(),
        })),
      ]
        .filter((p) => p.name)
        .sort((a, b) => a.name.localeCompare(b.name));

      setVoucherTypes(vt);
      setFiscalYears(fys);
      setAccounts(acc);
      setTaxCodes(taxes);
      setPayees(combinedPayees);
      setCurrencies(currs);

      if (!fiscalYearId && fys.length) setFiscalYearId(String(fys[0].id));
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load finance setup");
    }
  }

  async function loadInvoicesForCustomer(customerId) {
    try {
      const res = await api.get("/sales/invoices", {
        params: { customer_id: customerId },
      });
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      const filtered = items
        .filter(
          (x) =>
            String(x.customer_id) === String(customerId) &&
            Number(x.balance_amount || 0) > 0,
        )
        .map((x) => ({
          id: x.id,
          invoice_no: x.invoice_no,
          balance_amount: Number(x.balance_amount || 0),
          total_amount: Number(x.total_amount || x.net_amount || 0),
          tax_code_id: x.tax_code_id || null,
        }))
        .sort((a, b) => a.invoice_no.localeCompare(b.invoice_no));
      setCustomerInvoices(filtered);
    } catch {
      setCustomerInvoices([]);
    }
  }

  async function loadOutstandingBillsForSupplier(entry) {
    try {
      const purRes = await api.get("/purchase/bills");
      const purItems = Array.isArray(purRes.data?.items)
        ? purRes.data.items
        : [];
      const purchaseFiltered = purItems
        .filter((x) => String(x.supplier_id) === String(entry.id))
        .map((x) => ({
          id: x.id,
          bill_no: x.bill_no,
          payment_status: String(x.payment_status || "UNPAID"),
          outstanding: Math.max(
            0,
            Math.round(
              (Number(x.net_amount || 0) - Number(x.amount_paid || 0)) * 100,
            ) / 100,
          ),
        }))
        .filter(
          (x) => x.payment_status !== "PAID" && Number(x.outstanding) > 0,
        );
      let combined = purchaseFiltered;
      if (String(entry.serviceContractor || "N") === "Y") {
        const srvRes = await api.get("/purchase/service-bills", {
          params: { supplierId: entry.id },
        });
        const srvItems = Array.isArray(srvRes.data?.items)
          ? srvRes.data.items
          : [];
        const serviceFiltered = srvItems
          .map((x) => ({
            id: `SB-${x.id}`,
            bill_no: x.bill_no,
            payment_status: String(x.payment || "UNPAID"),
            outstanding: Math.max(
              0,
              Math.round(
                (Number(x.total_amount || 0) - Number(x.amount_paid || 0)) *
                  100,
              ) / 100,
            ),
          }))
          .filter(
            (x) => x.payment_status !== "PAID" && Number(x.outstanding) > 0,
          );
        combined = [...purchaseFiltered, ...serviceFiltered];
      }
      combined = combined.sort((a, b) =>
        String(a.bill_no || "").localeCompare(String(b.bill_no || "")),
      );
      setSupplierBills(combined);
      const validNos = new Set(combined.map((b) => String(b.bill_no)));
      setSelectedBillRefs((prev) =>
        prev.filter((r) => validNos.has(String(r))),
      );
    } catch {
      setSupplierBills([]);
      setSelectedBillRefs([]);
    }
  }

  useEffect(() => {
    loadSetup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    async function loadNextNo() {
      if (isEdit) return;
      if (!isPV) return;
      try {
        const res = await api.get(
          "/finance/vouchers/next-no?voucherTypeCode=PV",
        );
        const raw = String(res.data?.nextNo || "");
        const m = raw.match(/^PV-?(\d+)$/i);
        const formatted = m ? `PV-${String(m[1]).padStart(6, "0")}` : raw;
        setVoucherNoPreview(formatted);
      } catch {
        setVoucherNoPreview("");
      }
    }
    loadNextNo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPV, isEdit]);
  useEffect(() => {
    async function loadNextNoRv() {
      if (isEdit) return;
      if (!isRV) return;
      try {
        const res = await api.get(
          "/finance/vouchers/next-no?voucherTypeCode=RV",
        );
        const raw = String(res.data?.nextNo || "");
        const m = raw.match(/^RV-?(\d+)$/i);
        const formatted = m ? `RV-${String(m[1]).padStart(6, "0")}` : raw;
        setVoucherNoPreview(formatted);
      } catch {
        setVoucherNoPreview("");
      }
    }
    loadNextNoRv();
  }, [isRV, isEdit]);
  useEffect(() => {
    async function loadNextNoCv() {
      if (isEdit) return;
      if (!isCV) return;
      try {
        const res = await api.get(
          "/finance/vouchers/next-no?voucherTypeCode=CV",
        );
        const raw = String(res.data?.nextNo || "");
        const m = raw.match(/^CV-?(\d+)$/i);
        const formatted = m ? `CV-${String(m[1]).padStart(6, "0")}` : raw;
        setVoucherNoPreview(formatted);
      } catch {
        setVoucherNoPreview("");
      }
    }
    loadNextNoCv();
  }, [isCV, isEdit]);
  useEffect(() => {
    async function loadNextNoDn() {
      if (isEdit) return;
      if (!isDN) return;
      try {
        const res = await api.get(
          "/finance/vouchers/next-no?voucherTypeCode=DN",
        );
        const raw = String(res.data?.nextNo || "");
        const m = raw.match(/^DN-?(\d+)$/i);
        const formatted = m ? `DN-${String(m[1]).padStart(6, "0")}` : raw;
        setVoucherNoPreview(formatted);
      } catch {
        setVoucherNoPreview("");
      }
    }
    loadNextNoDn();
  }, [isDN, isEdit]);
  useEffect(() => {
    async function loadNextNoCn() {
      if (isEdit) return;
      if (!isCN) return;
      try {
        const res = await api.get(
          "/finance/vouchers/next-no?voucherTypeCode=CN",
        );
        const raw = String(res.data?.nextNo || "");
        const m = raw.match(/^CN-?(\d+)$/i);
        const formatted = m ? `CN-${String(m[1]).padStart(6, "0")}` : raw;
        setVoucherNoPreview(formatted);
      } catch {
        setVoucherNoPreview("");
      }
    }
    loadNextNoCn();
  }, [isCN, isEdit]);

  useEffect(() => {
    async function loadNextNoJv() {
      if (isEdit) return;
      if (!isJV) return;
      try {
        const res = await api.get(
          "/finance/vouchers/next-no?voucherTypeCode=JV",
        );
        const raw = String(res.data?.nextNo || "");
        const m = raw.match(/^JV-?(\d+)$/i);
        const formatted = m ? `JV-${String(m[1]).padStart(6, "0")}` : raw;
        setVoucherNoPreview(formatted);
      } catch {
        setVoucherNoPreview("");
      }
    }
    loadNextNoJv();
  }, [isJV, isEdit]);

  useEffect(() => {
    if (!(isCN || isDN)) return;
    const fromId = dncnLineCurrencyId || null;
    const toId = baseCurrency?.id || null;
    if (!fromId || !toId) {
      setDncnExchangeRate("1");
      return;
    }
    if (String(fromId) === String(toId)) {
      setDncnExchangeRate("1");
      return;
    }
    (async () => {
      try {
        const res = await api.get("/finance/currency-rates", {
          params: {
            fromCurrencyId: Number(fromId),
            toCurrencyId: Number(toId),
            to: voucherDate || null,
          },
        });
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        const sorted = items
          .slice()
          .sort(
            (a, b) =>
              new Date(b.rate_date).getTime() - new Date(a.rate_date).getTime(),
          );
        let rate = sorted.length ? Number(sorted[0].rate || 0) : 0;
        if (!rate) {
          try {
            const resRev = await api.get("/finance/currency-rates", {
              params: {
                fromCurrencyId: Number(toId),
                toCurrencyId: Number(fromId),
                to: voucherDate || null,
              },
            });
            const itemsRev = Array.isArray(resRev.data?.items)
              ? resRev.data.items
              : [];
            const sortedRev = itemsRev
              .slice()
              .sort(
                (a, b) =>
                  new Date(b.rate_date).getTime() -
                  new Date(a.rate_date).getTime(),
              );
            const revRate = sortedRev.length
              ? Number(sortedRev[0].rate || 0)
              : 0;
            rate = revRate ? 1 / revRate : 0;
          } catch {}
        }
        setDncnExchangeRate(rate ? String(rate) : "1");
      } catch {
        setDncnExchangeRate("1");
      }
    })();
  }, [isCN, isDN, dncnLineCurrencyId, baseCurrency, voucherDate]);

  async function loadVoucher() {
    if (!isEdit) return;
    try {
      setLoading(true);
      const res = await api.get(`/finance/vouchers/${id}`);
      const data = res.data || {};
      const v = data.item || data.voucher || data;
      if (!v) return;
      const dateStr = (
        v.voucher_date ||
        v.date ||
        new Date().toISOString()
      ).split("T")[0];
      setVoucherDate(dateStr);
      setVoucherNoPreview(
        String(v.voucher_no || data.voucher?.voucher_no || ""),
      );
      setVoucherStatus(String(v.status || data.voucher?.status || "DRAFT"));
      if (v.fiscal_year_id || v.fiscalYearId || data.voucher?.fiscal_year_id) {
        setFiscalYearId(
          String(
            v.fiscal_year_id || v.fiscalYearId || data.voucher?.fiscal_year_id,
          ),
        );
      }
      setNarration(v.narration || data.voucher?.narration || "");
      const rawLines = Array.isArray(data.lines)
        ? data.lines
        : Array.isArray(v.lines)
          ? v.lines
          : v.items || [];
      const narr = String(v.narration || data.voucher?.narration || "");
      const token = (label) => {
        const m = narr.match(new RegExp(`${label}\\s*:\\s*([^|]+)`, "i"));
        return m ? String(m[1]).trim() : "";
      };
      const rawCredit = rawLines.filter((l) => Number(l.credit || 0) > 0);
      const rawDebit = rawLines.filter((l) => Number(l.debit || 0) > 0);
      const mapped =
        rawLines.map((it) => ({
          accountId: String(it.account_id || it.accountId || ""),
          description: it.description || "",
          debit: Number(it.debit || 0),
          credit: Number(it.credit || 0),
        })) || [];
      setLines(mapped.length ? mapped : [emptyLine(), emptyLine()]);
      if (isRV) {
        const debitLine = mapped.find((l) => Number(l.debit || 0) > 0);
        const creditLines = mapped.filter((l) => Number(l.credit || 0) > 0);
        const creditFirstRaw = rawCredit[0] || null;
        const rvName =
          token("Received from") || creditFirstRaw?.account_name || "";
        const rvCode = creditFirstRaw?.account_code
          ? String(creditFirstRaw.account_code)
          : "";
        const rvPayAccId = creditFirstRaw?.account_id
          ? String(creditFirstRaw.account_id)
          : "";
        const payeeEntry = rvCode
          ? payees.find((p) => String(p.code) === rvCode)
          : null;
        if (
          String(payeeEntry?.type || "").toUpperCase() === "CUSTOMER" &&
          payeeEntry?.id
        ) {
          await loadInvoicesForCustomer(payeeEntry.id);
        } else {
          setCustomerInvoices([]);
        }
        setRvForm((prev) => ({
          ...prev,
          depositAccountId: debitLine?.accountId || "",
          receivedFrom: rvName || prev.receivedFrom,
          receivedFromCode: rvCode || prev.receivedFromCode,
          payerAccountId: rvPayAccId || prev.payerAccountId,
          paymentMethod: token("Method") || prev.paymentMethod,
          reference: token("Ref") || prev.reference,
          items:
            creditLines.length > 0
              ? creditLines.map((l) => ({
                  description: l.description || "",
                  accountId: String(l.accountId || ""),
                  amount: Number(l.credit || 0),
                  referenceNo:
                    String(
                      (
                        rawCredit.find(
                          (rc) =>
                            String(rc.account_id || "") ===
                            String(l.accountId || ""),
                        ) || {}
                      ).reference_no || "",
                    ) || "",
                }))
              : prev.items,
        }));
      } else if (isPV) {
        const creditLine = mapped.find((l) => Number(l.credit || 0) > 0);
        const debitLines = mapped.filter((l) => Number(l.debit || 0) > 0);
        const debitFirstRaw = rawDebit[0] || null;
        const pvName = token("Paid to") || debitFirstRaw?.account_name || "";
        const pvCode = debitFirstRaw?.account_code
          ? String(debitFirstRaw.account_code)
          : "";
        const pvPayAccId = debitFirstRaw?.account_id
          ? String(debitFirstRaw.account_id)
          : "";
        setPvForm((prev) => ({
          ...prev,
          paymentAccountId: creditLine?.accountId || "",
          payTo: pvName || prev.payTo,
          payToCode: pvCode || prev.payToCode,
          payToAccountId: pvPayAccId || prev.payToAccountId,
          paymentMethod: token("Method") || prev.paymentMethod,
          reference: token("Ref") || prev.reference,
          items:
            debitLines.length > 0
              ? debitLines.map((l) => ({
                  description: l.description || "",
                  accountId: String(l.accountId || ""),
                  amount: Number(l.debit || 0),
                }))
              : prev.items,
        }));
      } else if (isCV) {
        const debitLine = mapped.find((l) => Number(l.debit || 0) > 0);
        const creditLine = mapped.find((l) => Number(l.credit || 0) > 0);
        setCvForm((prev) => ({
          ...prev,
          toAccountId: debitLine?.accountId || "",
          fromAccountId: creditLine?.accountId || "",
          items:
            mapped.length > 0
              ? mapped
                  .filter(
                    (l) =>
                      Number(l.debit || 0) > 0 || Number(l.credit || 0) > 0,
                  )
                  .map((l) => ({
                    description: l.description || "",
                    amount: Number(l.debit || l.credit || 0),
                  }))
              : prev.items,
        }));
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load voucher");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVoucher();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function resolveOrCreateVoucherTypeId(code) {
    try {
      const res = await api.get("/finance/voucher-types", { params: { code } });
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      if (items.length > 0) {
        return Number(items[0].id || 0);
      }
      const upper = String(code || "").toUpperCase();
      const name =
        upper === "PV"
          ? "Payment Voucher"
          : upper === "RV"
            ? "Receipt Voucher"
            : upper === "CV"
              ? "Contra Voucher"
              : upper === "CN"
                ? "Credit Note"
                : upper === "DN"
                  ? "Debit Note"
                  : "Voucher";
      const category =
        upper === "PV"
          ? "PAYMENT"
          : upper === "RV"
            ? "RECEIPT"
            : upper === "CN"
              ? "GENERAL"
              : upper === "DN"
                ? "GENERAL"
                : "GENERAL";
      await api.post("/finance/voucher-types", {
        code: upper,
        name,
        category,
        prefix: upper,
        next_number: 1,
        requires_approval: 0,
        is_active: 1,
      });
      const res2 = await api.get("/finance/voucher-types", {
        params: { code: upper },
      });
      const items2 = Array.isArray(res2.data?.items) ? res2.data.items : [];
      return Number(items2?.[0]?.id || 0);
    } catch {
      return 0;
    }
  }

  const voucherType = useMemo(() => {
    return voucherTypes.find((x) => x.code === voucherTypeCode);
  }, [voucherTypes, voucherTypeCode]);

  const generalVoucherTypeName = useMemo(() => {
    const vt = voucherTypes.find(
      (x) =>
        String(x.code).toUpperCase() === String(voucherTypeCode).toUpperCase(),
    );
    if (vt?.name) return vt.name;
    const upper = String(voucherTypeCode || "").toUpperCase();
    return upper === "CN"
      ? "Credit Note"
      : upper === "DN"
        ? "Debit Note"
        : "Voucher";
  }, [voucherTypes, voucherTypeCode]);

  const totals = useMemo(() => {
    if (isRV) {
      const subtotal = rvForm.items.reduce(
        (sum, it) => sum + Number(it.amount || 0),
        0,
      );
      return {
        debit: subtotal,
        credit: subtotal,
        subtotal,
        tax: 0,
        grand: subtotal,
      };
    }
    if (isPV) {
      const subtotal = pvForm.items.reduce(
        (sum, it) => sum + Number(it.amount || 0),
        0,
      );
      const pvRate = Number(
        taxCodes.find((t) => String(t.id) === String(pvForm.taxCodeId))
          ?.rate_percent || 0,
      );
      const tax = Math.round(subtotal * pvRate) / 100;
      return {
        debit: subtotal,
        credit: subtotal,
        subtotal,
        tax,
        grand: subtotal + tax,
      };
    }
    if (isCV) {
      const subtotal = cvForm.items.reduce(
        (sum, it) => sum + Number(it.amount || 0),
        0,
      );
      const cvRate = Number(
        taxCodes.find((t) => String(t.id) === String(cvForm.taxCodeId))
          ?.rate_percent || 0,
      );
      const tax = Math.round(subtotal * cvRate) / 100;
      return {
        debit: subtotal,
        credit: subtotal,
        subtotal,
        tax,
        grand: subtotal + tax,
      };
    }
    return lines.reduce(
      (acc, l) => {
        acc.debit += Number(l.debit || 0);
        acc.credit += Number(l.credit || 0);
        return acc;
      },
      { debit: 0, credit: 0 },
    );
  }, [lines, rvForm, pvForm, cvForm, isRV, isPV, isCV, taxCodes]);

  const balanced =
    Math.round(totals.debit * 100) === Math.round(totals.credit * 100);

  const disabledClass = readOnly
    ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700 font-semibold"
    : "";

  // moved earlier to avoid temporal-dead-zone during RV render

  const [companyInfo, setCompanyInfo] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    country: "",
    phone: "",
    email: "",
    website: "",
    taxId: "",
    registrationNo: "",
    logoUrl: "",
  });

  const [rvTaxComponentsByCode, setRvTaxComponentsByCode] = useState({});

  const payeeOptions = useMemo(() => {
    const base = accounts.filter((a) =>
      ["DEBTORS", "CREDITORS"].includes(
        String(a.group_name || "").toUpperCase(),
      ),
    );
    if (!payToSearch) return base;
    const q = String(payToSearch).toLowerCase();
    return base.filter(
      (a) =>
        String(a.name || "")
          .toLowerCase()
          .includes(q) ||
        String(a.code || "")
          .toLowerCase()
          .includes(q),
    );
  }, [accounts, payToSearch]);

  const rvTaxComponentsTotals = useMemo(() => {
    if (!isRV) return { components: [], taxTotal: 0, grand: totals.grand };
    const sub = totals.subtotal || 0;
    const comps = rvTaxComponentsByCode[String(rvForm.taxCodeId || "")] || [];
    const components = comps
      .map((c) => {
        const rate = Number(c.rate_percent || 0);
        const amount = (sub * rate) / 100;
        return {
          name: c.component_name,
          rate,
          amount,
          sort_order: c.sort_order || 0,
        };
      })
      .sort((a, b) => a.sort_order - b.sort_order);
    const taxTotal = components.reduce((s, c) => s + c.amount, 0);
    const grand = sub + taxTotal;
    return { components, taxTotal, grand };
  }, [
    isRV,
    totals.subtotal,
    totals.grand,
    rvForm.taxCodeId,
    rvTaxComponentsByCode,
  ]);

  useEffect(() => {
    async function loadRvTaxComponents() {
      const key = String(rvForm.taxCodeId || "");
      if (!isRV || !key || rvTaxComponentsByCode[key]) return;
      try {
        const resp = await api.get(`/finance/tax-codes/${key}/components`);
        const items = Array.isArray(resp.data?.items) ? resp.data.items : [];
        setRvTaxComponentsByCode((prev) => ({ ...prev, [key]: items }));
      } catch {}
    }
    loadRvTaxComponents();
  }, [isRV, rvForm.taxCodeId, rvTaxComponentsByCode]);

  useEffect(() => {
    let mounted = true;
    async function loadCompany() {
      try {
        const meResp = await api.get("/admin/me");
        const companyId = meResp.data?.scope?.companyId;
        if (!companyId) return;
        const cResp = await api.get(`/admin/companies/${companyId}`);
        const item = cResp.data?.item || {};
        const logoUrl =
          item.has_logo === 1 || item.has_logo === true
            ? `/api/admin/companies/${companyId}/logo`
            : "";
        if (!mounted) return;
        setCompanyInfo({
          name: item.name || "",
          address: item.address || "",
          city: item.city || "",
          state: item.state || "",
          country: item.country || "",
          phone: item.telephone || "",
          email: item.email || "",
          website: item.website || "",
          taxId: item.tax_id || "",
          registrationNo: item.registration_no || "",
          logoUrl,
        });
      } catch {}
    }
    loadCompany();
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
    <title>Voucher</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #fff; }
      .vh { font-size: 12px; }
      .vh table { border-collapse: collapse; width: 100%; }
      .vh th, .vh td { border: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; }
      .vh th { background: #f8fafc; text-align: left; }
      .vh .right { text-align: right; }
      .vh .center { text-align: center; }
      .vh-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 8px; }
      .vh-logo { min-width: 120px; max-width: 200px; }
      .vh-company { text-align: right; font-size: 11px; line-height: 1.35; }
      .vh-company .name { font-weight: 800; font-size: 14px; }
      .vh-titlebar { display: flex; align-items: center; gap: 10px; color: #0f172a; margin: 4px 0 10px; }
      .vh-titlebar .line { flex: 1; height: 1px; background: #0f172a; }
      .vh-titlebar .title { font-weight: 700; }
      .vh-details { width: 100%; margin-bottom: 10px; border: 1px solid #cbd5e1; }
      .vh-details td { border-color: #cbd5e1; }
      .vh-details .label { width: 32%; color: #475569; }
      .vh-details .label-wide { width: 40%; color: #475569; }
      .vh-items thead th { font-weight: 600; }
      .vh-footer a { color: inherit; text-decoration: underline; }
      @media print { button { display: none; } }
    </style>
  </head>
  <body>${bodyHtml || ""}</body>
</html>`;
  }
  function renderReceiptVoucherHtml(data) {
    const c = data.company || {};
    const r = data.receipt || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const t = data.totals || {};
    return `
    <div class="vh">
      <div class="vh-header">
        <div class="vh-logo">${c.logoHtml || ""}</div>
        <div class="vh-company">
          <div class="name">${escapeHtml(c.name || "")}</div>
          <div>${escapeHtml(c.addressLine1 || "")}</div>
          <div>${escapeHtml(c.addressLine2 || "")}</div>
          <div>Telephone: ${escapeHtml(c.phone || "")}</div>
          <div>Email: ${escapeHtml(c.email || "")}</div>
          <div>${escapeHtml(c.website || "")}</div>
          <div>TIN: ${escapeHtml(c.taxId || "")} &nbsp; Reg: ${escapeHtml(c.registrationNo || "")}</div>
        </div>
      </div>
      <div class="vh-titlebar">
        <div class="line"></div>
        <div class="title">* Receipt Voucher *</div>
        <div class="line"></div>
      </div>
      <table class="vh-details">
        <tr>
          <td style="width:50%;vertical-align:top;border-right:1px solid #cbd5e1;">
            <table style="width:100%;">
              <tr><td class="label-wide">Receipt No</td><td>:</td><td>${escapeHtml(r.receiptNo || "")}</td></tr>
              <tr><td class="label-wide">Date/Time</td><td>:</td><td>${escapeHtml(r.dateTime || "")}</td></tr>
              <tr><td class="label-wide">Method</td><td>:</td><td>${escapeHtml(r.paymentMethod || "")}</td></tr>
            </table>
          </td>
          <td style="width:50%;vertical-align:top;">
            <div style="padding:8px;">
              <div class="label">Narration</div>
              <div>${escapeHtml(r.headerText || "")}</div>
            </div>
          </td>
        </tr>
      </table>
      <table class="vh-items">
        <thead>
          <tr>
            <th>Description</th>
            <th class="right" style="width:22%;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (it) => `
            <tr>
              <td>${escapeHtml(it.name || "")}</td>
              <td class="right">${escapeHtml(it.lineTotal || it.price || "0.00")}</td>
            </tr>
          `,
            )
            .join("")}
          <tr>
            <td class="right"><strong>Subtotal</strong></td>
            <td class="right"><strong>${escapeHtml(Number(t.subtotal || 0).toFixed(2))}</strong></td>
          </tr>
          <tr>
            <td class="right">Tax</td>
            <td class="right">${escapeHtml(Number(t.tax || 0).toFixed(2))}</td>
          </tr>
          <tr>
            <td class="right"><strong>Total</strong></td>
            <td class="right"><strong>${escapeHtml(Number(t.total || t.grand || 0).toFixed(2))}</strong></td>
          </tr>
        </tbody>
      </table>
      <div class="vh-footer" style="margin-top:10px;text-align:center;">
        <div>${escapeHtml(r.footerText || "")}</div>
      </div>
    </div>
    `;
  }
  function renderPaymentVoucherHtml(data) {
    const c = data.company || {};
    const p = data.payment || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const t = data.totals || {};
    return `
    <div class="vh">
      <div class="vh-header">
        <div class="vh-logo">${c.logoHtml || ""}</div>
        <div class="vh-company">
          <div class="name">${escapeHtml(c.name || "")}</div>
          <div>${escapeHtml(c.addressLine1 || "")}</div>
          <div>${escapeHtml(c.addressLine2 || "")}</div>
          <div>Telephone: ${escapeHtml(c.phone || "")}</div>
          <div>Email: ${escapeHtml(c.email || "")}</div>
          <div>${escapeHtml(c.website || "")}</div>
          <div>TIN: ${escapeHtml(c.taxId || "")} &nbsp; Reg: ${escapeHtml(c.registrationNo || "")}</div>
        </div>
      </div>
      <div class="vh-titlebar">
        <div class="line"></div>
        <div class="title">* Payment Voucher *</div>
        <div class="line"></div>
      </div>
      <table class="vh-details">
        <tr>
          <td style="width:50%;vertical-align:top;border-right:1px solid #cbd5e1;">
            <table style="width:100%;">
              <tr><td class="label-wide">Payment No</td><td>:</td><td>${escapeHtml(p.paymentNo || "")}</td></tr>
              <tr><td class="label-wide">Date/Time</td><td>:</td><td>${escapeHtml(p.dateTime || "")}</td></tr>
              <tr><td class="label-wide">Method</td><td>:</td><td>${escapeHtml(p.paymentMethod || "")}</td></tr>
            </table>
          </td>
          <td style="width:50%;vertical-align:top;">
            <div style="padding:8px;">
              <div class="label">Narration</div>
              <div>${escapeHtml(p.headerText || "")}</div>
            </div>
          </td>
        </tr>
      </table>
      <table class="vh-items">
        <thead>
          <tr>
            <th>Description</th>
            <th class="right" style="width:22%;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (it) => `
            <tr>
              <td>${escapeHtml(it.name || "")}</td>
              <td class="right">${escapeHtml(it.lineTotal || it.price || "0.00")}</td>
            </tr>
          `,
            )
            .join("")}
          <tr>
            <td class="right"><strong>Subtotal</strong></td>
            <td class="right"><strong>${escapeHtml(Number(t.subtotal || 0).toFixed(2))}</strong></td>
          </tr>
          <tr>
            <td class="right">Tax</td>
            <td class="right">${escapeHtml(Number(t.tax || 0).toFixed(2))}</td>
          </tr>
          <tr>
            <td class="right"><strong>Total</strong></td>
            <td class="right"><strong>${escapeHtml(Number(t.total || t.grand || 0).toFixed(2))}</strong></td>
          </tr>
        </tbody>
      </table>
      <div class="vh-footer" style="margin-top:10px;text-align:center;">
        <div>${escapeHtml(p.footerText || "")}</div>
      </div>
    </div>
    `;
  }
  const buildReceiptVoucherTemplateData = () => {
    const logoUrl = String(companyInfo.logoUrl || "").trim();
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${escapeHtml(companyInfo.name || "Company")}" style="max-height:80px;object-fit:contain;" />`
      : "";
    const addressParts = [];
    if (companyInfo.address) addressParts.push(companyInfo.address);
    const cityState = [companyInfo.city, companyInfo.state]
      .filter(Boolean)
      .join(", ");
    if (cityState) addressParts.push(cityState);
    if (companyInfo.country) addressParts.push(companyInfo.country);
    const addressLine1 = String(addressParts[0] || "");
    const addressLine2 = String(addressParts.slice(1).join(" • ") || "");
    const itemsArr = (Array.isArray(rvForm.items) ? rvForm.items : []).map(
      (it) => {
        const amt = Number(it.amount || 0);
        return {
          name: String(it.description || ""),
          qty: "1.00",
          price: amt.toFixed(2),
          discount: "0.00",
          lineTotal: amt.toFixed(2),
        };
      },
    );
    const when = voucherDate ? new Date(voucherDate) : new Date();
    const method = String(rvForm.paymentMethod || "").toUpperCase();
    const methodLabel =
      method === "CASH"
        ? "Cash"
        : method === "BANK"
          ? "Bank"
          : method === "CHEQUE"
            ? "Cheque"
            : method === "TRANSFER"
              ? "Bank Transfer"
              : method === "CARD"
                ? "Card"
                : "Other";
    return {
      company: {
        name: companyInfo.name || "",
        addressLine1,
        addressLine2,
        phone: companyInfo.phone || "",
        website: companyInfo.website || "",
        taxId: companyInfo.taxId || "",
        registrationNo: companyInfo.registrationNo || "",
        logoUrl,
        logoHtml,
      },
      receipt: {
        receiptNo: String(voucherNoPreview || ""),
        dateTime: when.toLocaleString(),
        paymentMethod: methodLabel,
        headerText: "",
        footerText: "",
      },
      items: itemsArr,
      totals: {
        subtotal: Number(totals.subtotal || 0).toFixed(2),
        tax: Number(totals.tax || 0).toFixed(2),
        total: Number(totals.grand || 0).toFixed(2),
      },
    };
  };
  const buildPaymentVoucherTemplateData = () => {
    const logoUrl = String(companyInfo.logoUrl || "").trim();
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${escapeHtml(companyInfo.name || "Company")}" style="max-height:80px;object-fit:contain;" />`
      : "";
    const addressParts = [];
    if (companyInfo.address) addressParts.push(companyInfo.address);
    const cityState = [companyInfo.city, companyInfo.state]
      .filter(Boolean)
      .join(", ");
    if (cityState) addressParts.push(cityState);
    if (companyInfo.country) addressParts.push(companyInfo.country);
    const addressLine1 = String(addressParts[0] || "");
    const addressLine2 = String(addressParts.slice(1).join(" • ") || "");
    const itemsArr = (Array.isArray(pvForm.items) ? pvForm.items : []).map(
      (it) => {
        const amt = Number(it.amount || 0);
        return {
          name: String(it.description || ""),
          qty: "1.00",
          price: amt.toFixed(2),
          discount: "0.00",
          lineTotal: amt.toFixed(2),
        };
      },
    );
    const when = voucherDate ? new Date(voucherDate) : new Date();
    const method = String(pvForm.paymentMethod || "").toUpperCase();
    const methodLabel =
      method === "CASH"
        ? "Cash"
        : method === "BANK"
          ? "Bank"
          : method === "CHEQUE"
            ? "Cheque"
            : method === "TRANSFER"
              ? "Bank Transfer"
              : method === "CARD"
                ? "Card"
                : "Other";
    return {
      company: {
        name: companyInfo.name || "",
        addressLine1,
        addressLine2,
        phone: companyInfo.phone || "",
        website: companyInfo.website || "",
        taxId: companyInfo.taxId || "",
        registrationNo: companyInfo.registrationNo || "",
        logoUrl,
        logoHtml,
      },
      payment: {
        paymentNo: String(voucherNoPreview || ""),
        dateTime: when.toLocaleString(),
        paymentMethod: methodLabel,
        headerText: "",
        footerText: "",
      },
      items: itemsArr,
      totals: {
        subtotal: Number(totals.subtotal || 0).toFixed(2),
        tax: Number(totals.tax || 0).toFixed(2),
        total: Number(totals.grand || 0).toFixed(2),
      },
    };
  };
  async function waitForImages(rootEl) {
    const imgs = Array.from(rootEl?.querySelectorAll?.("img") || []);
    if (imgs.length === 0) return;
    await Promise.race([
      Promise.all(
        imgs.map(
          (img) =>
            new Promise((resolve) => {
              if (img.complete) return resolve();
              const done = () => resolve();
              img.addEventListener("load", done, { once: true });
              img.addEventListener("error", done, { once: true });
            }),
        ),
      ),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  }
  const handlePrintVoucher = async () => {
    try {
      const body = isRV
        ? renderReceiptVoucherHtml(buildReceiptVoucherTemplateData())
        : isPV
          ? renderPaymentVoucherHtml(buildPaymentVoucherTemplateData())
          : "";
      const html = wrapDoc(body);
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
      const doc =
        iframe.contentWindow?.document || iframe.contentDocument || null;
      if (!doc) {
        document.body.removeChild(iframe);
        window.print();
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
  };
  const handleDownloadVoucherPdf = async () => {
    try {
      const body = isRV
        ? renderReceiptVoucherHtml(buildReceiptVoucherTemplateData())
        : isPV
          ? renderPaymentVoucherHtml(buildPaymentVoucherTemplateData())
          : "";
      if (!body) return;
      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-10000px";
      container.style.top = "0";
      container.style.width = "794px";
      container.style.background = "white";
      container.style.padding = "32px";
      container.innerHTML = body;
      document.body.appendChild(container);
      try {
        await waitForImages(container);
        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
        });
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
          (isRV ? "ReceiptVoucher_" : isPV ? "PaymentVoucher_" : "Voucher_") +
          (voucherNoPreview || new Date().toISOString().slice(0, 10)) +
          ".pdf";
        pdf.save(fname);
      } finally {
        document.body.removeChild(container);
      }
    } catch {}
  };

  function updateLine(index, patch) {
    if (readOnly) return;
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    );
  }

  function addLine() {
    if (readOnly) return;
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index) {
    if (readOnly) return;
    setLines((prev) =>
      prev.length <= 2 ? prev : prev.filter((_, i) => i !== index),
    );
  }

  async function submit(e) {
    e.preventDefault();
    if (readOnly) return;

    const ensuredVoucherTypeId =
      Number(voucherType?.id || 0) ||
      (await resolveOrCreateVoucherTypeId(voucherTypeCode));
    const effVoucherTypeId = Number(ensuredVoucherTypeId || 0);

    let cleaned = [];
    if (isRV) {
      if (!rvForm.depositAccountId) {
        toast.error("Select deposit account");
        return;
      }
      const creditItems = rvForm.items
        .map((it) => ({
          accountId: Number(it.accountId || 0),
          description: it.description || null,
          amount: Number(it.amount || 0),
          referenceNo:
            (it.referenceNo && String(it.referenceNo).trim()) || null,
        }))
        .filter((it) => it.accountId && it.amount > 0);
      if (creditItems.length === 0) {
        toast.error("Enter at least one payment detail item");
        return;
      }
      const total = creditItems.reduce((s, it) => s + it.amount, 0);
      cleaned = [
        {
          accountId: Number(rvForm.depositAccountId),
          description: rvForm.receivedFrom || "Receipt",
          debit: Number(total),
          credit: 0,
        },
        ...creditItems.map((it) => ({
          accountId: it.accountId,
          description: it.description,
          debit: 0,
          credit: it.amount,
          referenceNo: it.referenceNo || null,
        })),
      ];
    } else if (isPV) {
      if (!pvForm.paymentAccountId) {
        toast.error("Select payment account");
        return;
      }
      const debitItems = pvForm.items
        .map((it) => ({
          accountId: Number(it.accountId || 0),
          description: it.description || null,
          amount: Number(it.amount || 0),
          referenceNo:
            (it.referenceNo && String(it.referenceNo).trim()) || null,
        }))
        .filter((it) => it.accountId && it.amount > 0);
      if (debitItems.length === 0) {
        toast.error("Enter at least one payment detail item");
        return;
      }
      const total = debitItems.reduce((s, it) => s + it.amount, 0);
      cleaned = [
        ...debitItems.map((it) => ({
          accountId: it.accountId,
          description: it.description,
          debit: it.amount,
          credit: 0,
          referenceNo: it.referenceNo || null,
        })),
        {
          accountId: Number(pvForm.paymentAccountId),
          description: pvForm.payTo || "Payment",
          debit: 0,
          credit: Number(total),
        },
      ];
    } else if (isCV) {
      if (!cvForm.fromAccountId || !cvForm.toAccountId) {
        toast.error("Select both From and To accounts");
        return;
      }
      if (String(cvForm.fromAccountId) === String(cvForm.toAccountId)) {
        toast.error("From and To accounts must be different");
        return;
      }
      const items = cvForm.items
        .map((it) => ({
          description: it.description || null,
          amount: Number(it.amount || 0),
        }))
        .filter((it) => it.amount > 0);
      if (items.length === 0) {
        toast.error("Enter at least one transfer detail item");
        return;
      }
      const total = items.reduce((s, it) => s + it.amount, 0);
      cleaned = [
        {
          accountId: Number(cvForm.toAccountId),
          description: "Account Transfer",
          debit: Number(total),
          credit: 0,
        },
        {
          accountId: Number(cvForm.fromAccountId),
          description: "Account Transfer",
          debit: 0,
          credit: Number(total),
        },
      ];
    } else {
      cleaned = lines
        .map((l) => ({
          accountId: Number(l.accountId || 0),
          description: l.description || null,
          debit: Number(l.debit || 0),
          credit: Number(l.credit || 0),
        }))
        .filter((l) => l.accountId && (l.debit || l.credit));
    }

    if (cleaned.length < 2) {
      toast.error("Enter at least two posting lines");
      return;
    }

    const debit = cleaned.reduce((s, l) => s + Number(l.debit || 0), 0);
    const credit = cleaned.reduce((s, l) => s + Number(l.credit || 0), 0);

    if (Math.round(debit * 100) !== Math.round(credit * 100)) {
      toast.error("Total debit must equal total credit");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        voucherTypeId: effVoucherTypeId,
        voucherTypeCode: voucherTypeCode,
        voucherDate,
        narration: isRV
          ? [
              rvForm.receivedFrom
                ? `Received from: ${rvForm.receivedFrom}`
                : null,
              rvForm.paymentMethod ? `Method: ${rvForm.paymentMethod}` : null,
              rvForm.reference ? `Ref: ${rvForm.reference}` : null,
              narration || null,
            ]
              .filter(Boolean)
              .join(" | ")
          : isPV
            ? [
                pvForm.payTo ? `Paid to: ${pvForm.payTo}` : null,
                pvForm.paymentMethod ? `Method: ${pvForm.paymentMethod}` : null,
                pvForm.reference ? `Ref: ${pvForm.reference}` : null,
                narration || null,
              ]
                .filter(Boolean)
                .join(" | ")
            : isCV
              ? [
                  cvForm.fromAccountId
                    ? `From: ${
                        accounts.find(
                          (a) => String(a.id) === String(cvForm.fromAccountId),
                        )?.code
                      }`
                    : null,
                  cvForm.toAccountId
                    ? `To: ${
                        accounts.find(
                          (a) => String(a.id) === String(cvForm.toAccountId),
                        )?.code
                      }`
                    : null,
                  cvForm.transferMethod
                    ? `Method: ${cvForm.transferMethod}`
                    : null,
                  cvForm.reference ? `Ref: ${cvForm.reference}` : null,
                  narration || null,
                ]
                  .filter(Boolean)
                  .join(" | ")
              : narration,
        lines: cleaned,
        ...(isPV
          ? {
              apply_to_purchase_bills: (pvForm.items || [])
                .map((it) => ({
                  ref: (it.referenceNo && String(it.referenceNo)) || "",
                  amount: Number(it.amount || 0),
                }))
                .filter((x) => x.ref && x.amount > 0)
                .map((x) => {
                  const b = supplierBills.find(
                    (sb) => String(sb.bill_no) === String(x.ref),
                  );
                  return b ? { bill_id: Number(b.id), amount: x.amount } : null;
                })
                .filter(Boolean),
              apply_to_service_bills: (pvForm.items || [])
                .map((it) => ({
                  ref: (it.referenceNo && String(it.referenceNo)) || "",
                  amount: Number(it.amount || 0),
                }))
                .filter((x) => x.ref && x.amount > 0)
                .map((x) => {
                  const b = supplierBills.find(
                    (sb) => String(sb.bill_no) === String(x.ref),
                  );
                  if (!b) return null;
                  const idStr = String(b.id || "");
                  if (!/^SB-\d+$/.test(idStr)) return null;
                  const idNum = Number(idStr.replace(/^SB-/, ""));
                  return { bill_id: idNum, amount: x.amount };
                })
                .filter(Boolean),
            }
          : {}),
      };

      if (isEdit) {
        const res = await api.put(`/finance/vouchers/${id}`, payload);
        toast.success(res.data?.message || "Updated voucher");
      } else {
        const res = await api.post("/finance/vouchers", payload);
        toast.success(`Created ${res.data?.voucherNo || "voucher"}`);
      }
      navigate(
        `/finance/${
          voucherTypeCode === "JV"
            ? "journal-voucher"
            : voucherTypeCode === "PV"
              ? "payment-voucher"
              : voucherTypeCode === "RV"
                ? "receipt-voucher"
                : voucherTypeCode === "CV"
                  ? "contra-voucher"
                  : voucherTypeCode === "SV"
                    ? "sales-voucher"
                    : voucherTypeCode === "PUV"
                      ? "purchase-voucher"
                      : voucherTypeCode === "DN"
                        ? "debit-note"
                        : voucherTypeCode === "CN"
                          ? "credit-note"
                          : "journal-voucher"
        }`,
      );
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to create voucher");
    } finally {
      setLoading(false);
    }
  }

  if (isJV || isCN || isDN) {
    return (
      <div className="space-y-4">
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg">
            <div className="flex justify-between items-center text-white">
              <div>
                <h1 className="text-2xl font-bold dark:text-brand-300">
                  {title}
                </h1>
                <p className="text-sm mt-1">
                  Create a new voucher (double-entry enforced)
                </p>
              </div>
              <div className="flex gap-2">
                <Link to=".." className="btn-success">
                  Back
                </Link>
                {voucherStatus === "APPROVED" ? (
                  <span className="px-2 py-1 rounded bg-green-500 text-white text-sm font-medium">
                    Approved
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn-success"
                    onClick={async () => {
                      if (!isEdit) return;
                      setShowForwardModal(true);
                      setWfError("");
                      if (!workflowsCache) {
                        try {
                          setWfLoading(true);
                          const res = await api.get("/workflows");
                          const items = Array.isArray(res.data?.items)
                            ? res.data.items
                            : [];
                          setWorkflowsCache(items);
                          const amount =
                            totals?.grand === "" || totals?.grand == null
                              ? null
                              : Number(totals?.grand || 0);
                          let chosen = null;
                          const byRoute = items.filter(
                            (w) =>
                              String(w.document_route || "") ===
                              "/finance/receipt-voucher",
                          );
                          const byType = items.filter((w) =>
                            [
                              "RECEIPT_VOUCHER",
                              "Receipt Voucher",
                              "RV",
                            ].includes(String(w.document_type || "")),
                          );
                          const list = [...byRoute, ...byType];
                          for (const wf of list) {
                            if (chosen) break;
                            if (Number(wf.is_active) !== 1) continue;
                            if (amount === null) {
                              chosen = wf;
                              break;
                            }
                            const minOk =
                              wf.min_amount === null ||
                              Number(amount) >= Number(wf.min_amount);
                            const maxOk =
                              wf.max_amount === null ||
                              Number(amount) <= Number(wf.max_amount);
                            if (minOk && maxOk) {
                              chosen = wf;
                              break;
                            }
                          }
                          if (!chosen) {
                            for (const wf of byType) {
                              if (chosen) break;
                              if (Number(wf.is_active) !== 1) continue;
                              if (amount === null) {
                                chosen = wf;
                                break;
                              }
                              const minOk =
                                wf.min_amount === null ||
                                Number(amount) >= Number(wf.min_amount);
                              const maxOk =
                                wf.max_amount === null ||
                                Number(amount) <= Number(wf.max_amount);
                              if (minOk && maxOk) {
                                chosen = wf;
                                break;
                              }
                            }
                          }
                          setCandidateWorkflow(chosen);
                          setFirstApprover(null);
                          setTargetApproverId(null);
                          if (chosen) {
                            const wfDetail = await api.get(
                              `/workflows/${chosen.id}`,
                            );
                            const item = wfDetail?.data?.item || {};
                            const stepOrder = Number(
                              item.current_step_order || 1,
                            );
                            const approvers = Array.isArray(
                              item?.next_step_approvers,
                            )
                              ? item.next_step_approvers
                              : [];
                            const firstUser =
                              approvers.length > 0
                                ? Number(approvers[0].id)
                                : null;
                            setFirstApprover({
                              stepOrder: stepOrder || 1,
                              stepName: String(item.step_name || "Step 1"),
                              approvalLimit:
                                approvers.length > 0
                                  ? Number(approvers[0].approval_limit || 0)
                                  : null,
                              approvers,
                            });
                            setTargetApproverId(firstUser);
                          }
                        } catch (e) {
                          setWfError(
                            e?.response?.data?.message ||
                              "Failed to load workflows",
                          );
                        } finally {
                          setWfLoading(false);
                        }
                      }
                    }}
                    disabled={loading || !isEdit}
                  >
                    Forward for Approval
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="card">
            <div className="card-body space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {!(isPV || isRV) && (
                  <div>
                    <label className="label">Voucher Type</label>
                    <input
                      className="input"
                      value={generalVoucherTypeName}
                      disabled
                    />
                  </div>
                )}
                <div>
                  <label className="label">Voucher No</label>
                  <input
                    className="input"
                    value={
                      voucherNoPreview ||
                      (isJV
                        ? "JV-000001"
                        : isCN
                          ? "CN-000001"
                          : isDN
                            ? "DN-000001"
                            : "")
                    }
                    disabled
                  />
                </div>
                <div>
                  <label className="label">Voucher Date *</label>
                  <input
                    className={`input ${disabledClass}`}
                    type="date"
                    value={voucherDate}
                    onChange={(e) => setVoucherDate(e.target.value)}
                    required
                    disabled={readOnly}
                  />
                </div>
                {!(isPV || isRV) && (
                  <div>
                    <label className="label">Fiscal Year *</label>
                    <select
                      className={`input ${disabledClass}`}
                      value={fiscalYearId}
                      onChange={(e) => setFiscalYearId(e.target.value)}
                      required
                      disabled={readOnly}
                    >
                      <option value="">Select</option>
                      {fiscalYears.map((fy) => (
                        <option key={fy.id} value={fy.id}>
                          {fy.code}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="md:col-span-3">
                  <label className="label">Narration</label>
                  <input
                    className="input"
                    value={narration}
                    onChange={(e) => setNarration(e.target.value)}
                    placeholder="Optional narration"
                    disabled={readOnly}
                  />
                </div>
              </div>

              {showPayToLov && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg w-full max-w-xl shadow-lg">
                    <div className="flex justify-between items-center px-4 py-3 border-b">
                      <div className="font-semibold text-brand">
                        Select Paid To
                      </div>
                      <button
                        type="button"
                        className="text-slate-600 hover:text-slate-800 text-xl font-bold"
                        onClick={() => setShowPayToLov(false)}
                      >
                        &times;
                      </button>
                    </div>
                    <div className="p-4">
                      <label className="label">Search</label>
                      <input
                        className="input w-full"
                        placeholder="Type name or code"
                        value={payToSearch}
                        onChange={(e) => setPayToSearch(e.target.value)}
                        autoFocus
                      />
                      <div className="mt-3 max-h-64 overflow-y-auto border rounded">
                        {payeeOptions.length === 0 ? (
                          <div className="p-3 text-center text-slate-500">
                            No matches
                          </div>
                        ) : (
                          payeeOptions
                            .sort((a, b) =>
                              String(a.name).localeCompare(String(b.name)),
                            )
                            .map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                className="w-full text-left px-3 py-2 hover:bg-slate-100 border-b last:border-b-0"
                                onClick={() => {
                                  const accountId = String(a.id);
                                  const name = String(a.name || "");
                                  const items =
                                    pvForm.items.length === 0
                                      ? [
                                          {
                                            description: "",
                                            accountId,
                                            amount: 0,
                                          },
                                        ]
                                      : pvForm.items.map((it, i) =>
                                          i === 0 ? { ...it, accountId } : it,
                                        );
                                  updatePv({
                                    payTo: name,
                                    payToAccountId: accountId,
                                    items,
                                  });
                                  setShowPayToLov(false);
                                  setPayToSearch("");
                                }}
                              >
                                <div className="font-medium">{a.name}</div>
                                <div className="text-xs text-slate-500">
                                  {a.code}
                                </div>
                              </button>
                            ))
                        )}
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setShowPayToLov(false);
                            setPayToSearch("");
                          }}
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                {isCN || isDN ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                    <div>
                      <label className="label">Exchange Rate</label>
                      <input
                        className="input"
                        value={dncnExchangeRate || ""}
                        readOnly
                      />
                    </div>
                  </div>
                ) : null}
                <div className="flex justify-between items-center mb-3">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    Posting Lines
                  </div>
                  <button
                    type="button"
                    className="btn-success"
                    onClick={addLine}
                    disabled={readOnly}
                  >
                    + Add Line
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th>Description</th>
                        {isCN || isDN ? (
                          <th className="text-right w-32">Currency</th>
                        ) : null}
                        <th className="text-right">Debit</th>
                        <th className="text-right">Credit</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l, idx) => (
                        <tr key={idx}>
                          <td>
                            <select
                              className="input"
                              value={l.accountId}
                              onChange={(e) =>
                                updateLine(idx, { accountId: e.target.value })
                              }
                              required
                              disabled={readOnly}
                            >
                              <option value="">Select account</option>
                              {accounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.code} - {a.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              className="input"
                              value={l.description}
                              onChange={(e) =>
                                updateLine(idx, { description: e.target.value })
                              }
                              placeholder="Line memo"
                              disabled={readOnly}
                            />
                          </td>
                          {isCN || isDN ? (
                            <td className="text-right">
                              {(() => {
                                const acc = accounts.find(
                                  (a) =>
                                    String(a.id) === String(l.accountId || ""),
                                );
                                return acc?.currency_code || "";
                              })()}
                            </td>
                          ) : null}
                          <td>
                            <input
                              className="input text-right"
                              type="number"
                              min="0"
                              step="1"
                              value={l.debit || ""}
                              onChange={(e) =>
                                updateLine(idx, {
                                  debit: String(e.target.value || "").replace(
                                    /^0+(?=\d)/,
                                    "",
                                  ),
                                  credit: 0,
                                })
                              }
                              onFocus={() => {
                                const v = String(l.debit ?? "");
                                if (v === "0") {
                                  updateLine(idx, { debit: "" });
                                }
                              }}
                              disabled={readOnly}
                            />
                          </td>
                          <td>
                            <input
                              className="input text-right"
                              type="number"
                              min="0"
                              step="1"
                              value={l.credit || ""}
                              onChange={(e) =>
                                updateLine(idx, {
                                  credit: String(e.target.value || "").replace(
                                    /^0+(?=\d)/,
                                    "",
                                  ),
                                  debit: 0,
                                })
                              }
                              onFocus={() => {
                                const v = String(l.credit ?? "");
                                if (v === "0") {
                                  updateLine(idx, { credit: "" });
                                }
                              }}
                              disabled={readOnly}
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="text-red-600 hover:text-red-700 text-sm font-medium"
                              onClick={() => removeLine(idx)}
                              disabled={readOnly}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex justify-end">
                  <div className="w-72 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Total Debit</span>
                      <span>{`GH₵ ${totals.debit.toFixed(2)}`}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Total Credit</span>
                      <span>{`GH₵ ${totals.credit.toFixed(2)}`}</span>
                    </div>
                    <div
                      className={`flex justify-between text-sm font-semibold ${
                        balanced
                          ? "text-green-700 dark:text-green-300"
                          : "text-red-700 dark:text-red-300"
                      }`}
                    >
                      <span>Status</span>
                      <span>{balanced ? "Balanced" : "Not Balanced"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Link to=".." className="btn-success">
                  Cancel
                </Link>
                <button
                  type="submit"
                  className="btn-success"
                  disabled={loading || !balanced || readOnly}
                >
                  {loading ? "Saving..." : "Save Voucher"}
                </button>
              </div>
            </div>
          </div>
        </form>
        {showForwardModal ? (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-[640px] max-w-[95%]">
              <div className="p-4 border-b flex justify-between items-center bg-brand text-white rounded-t-lg">
                <div className="font-semibold">
                  Forward Receipt Voucher for Approval
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowForwardModal(false);
                    setCandidateWorkflow(null);
                    setFirstApprover(null);
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
                    {voucherNoPreview || "-"}
                  </span>
                </div>
                <div className="text-sm text-slate-700">
                  Workflow:{" "}
                  <span className="font-semibold">
                    {candidateWorkflow
                      ? candidateWorkflow.workflow_name
                      : "Auto"}
                  </span>
                </div>
                <div className="text-sm text-red-600">{wfError || ""}</div>
                <div>
                  {wfLoading ? (
                    <div className="text-slate-600">Loading workflows...</div>
                  ) : firstApprover &&
                    Array.isArray(firstApprover.approvers) ? (
                    <div>
                      <label className="label">Assign To</label>
                      <select
                        className="input"
                        value={targetApproverId || ""}
                        onChange={(e) =>
                          setTargetApproverId(e.target.value || null)
                        }
                      >
                        <option value="">Select approver</option>
                        {firstApprover.approvers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.username}
                          </option>
                        ))}
                      </select>
                      <div className="text-xs text-slate-600 mt-1">
                        {firstApprover
                          ? `Step ${firstApprover.stepOrder} • ${firstApprover.stepName}${
                              firstApprover.approvalLimit != null
                                ? ` • Limit: ${Number(firstApprover.approvalLimit).toLocaleString()}`
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
                  )}
                </div>
              </div>
              <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                  onClick={() => {
                    setShowForwardModal(false);
                    setCandidateWorkflow(null);
                    setFirstApprover(null);
                    setWfError("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-700"
                  onClick={async () => {
                    if (!isEdit) return;
                    setSubmittingForward(true);
                    setWfError("");
                    try {
                      const res = await api.post(
                        `/finance/vouchers/${id}/submit`,
                        {
                          amount:
                            totals?.grand === "" || totals?.grand == null
                              ? null
                              : Number(totals?.grand || 0),
                          workflow_id: candidateWorkflow
                            ? candidateWorkflow.id
                            : null,
                          target_user_id: targetApproverId || null,
                        },
                      );
                      const newStatus = res?.data?.status || "PENDING_APPROVAL";
                      setVoucherStatus(newStatus);
                      setShowForwardModal(false);
                    } catch (e) {
                      setWfError(
                        e?.response?.data?.message ||
                          "Failed to forward for approval",
                      );
                    } finally {
                      setSubmittingForward(false);
                    }
                  }}
                  disabled={submittingForward || !isEdit}
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

  function updateRvForm(patch) {
    if (readOnly) return;
    setRvForm((prev) => ({ ...prev, ...patch }));
  }
  function updateRvItem(idx, patch) {
    if (readOnly) return;
    updateRvForm({
      items: rvForm.items.map((it, i) =>
        i === idx ? { ...it, ...patch } : it,
      ),
    });
  }
  function addRvItem() {
    if (readOnly) return;
    updateRvForm({
      items: [
        ...rvForm.items,
        { description: "", accountId: "", amount: "", referenceNo: "" },
      ],
    });
  }
  function removeRvItem(idx) {
    if (readOnly) return;
    if (rvForm.items.length <= 1) return;
    updateRvForm({
      items: rvForm.items.filter((_, i) => i !== idx),
    });
  }
  function numberToWords(amount) {
    const ones = [
      "",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
    ];
    const tens = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];
    const teens = [
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ];
    const dollars = Math.floor(amount || 0);
    const cents = Math.round(((amount || 0) - dollars) * 100);
    function convertToWords(num) {
      if (num === 0) return "";
      if (num < 10) return ones[num];
      if (num < 20) return teens[num - 10];
      if (num < 100)
        return (
          tens[Math.floor(num / 10)] +
          (num % 10 !== 0 ? " " + ones[num % 10] : "")
        );
      if (num < 1000)
        return (
          ones[Math.floor(num / 100)] +
          " Hundred" +
          (num % 100 !== 0 ? " " + convertToWords(num % 100) : "")
        );
      if (num < 1000000)
        return (
          convertToWords(Math.floor(num / 1000)) +
          " Thousand" +
          (num % 1000 !== 0 ? " " + convertToWords(num % 1000) : "")
        );
      return (
        convertToWords(Math.floor(num / 1000000)) +
        " Million" +
        (num % 1000000 !== 0 ? " " + convertToWords(num % 1000000) : "")
      );
    }
    let result = convertToWords(dollars) + " Cedi" + (dollars !== 1 ? "s" : "");
    if (cents > 0) {
      result +=
        " and " + convertToWords(cents) + " Pesewa" + (cents !== 1 ? "s" : "");
    }
    return result;
  }

  function numberToWordsBasic(amount) {
    const ones = [
      "",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
    ];
    const tens = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];
    const teens = [
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ];
    const dollars = Math.floor(amount || 0);
    const cents = Math.round(((amount || 0) - dollars) * 100);
    function convertToWords(num) {
      if (num === 0) return "Zero";
      if (num < 10) return ones[num];
      if (num < 20) return teens[num - 10];
      if (num < 100)
        return (
          tens[Math.floor(num / 10)] +
          (num % 10 !== 0 ? " " + ones[num % 10] : "")
        );
      if (num < 1000)
        return (
          ones[Math.floor(num / 100)] +
          " Hundred" +
          (num % 100 !== 0 ? " " + convertToWords(num % 100) : "")
        );
      if (num < 1000000)
        return (
          convertToWords(Math.floor(num / 1000)) +
          " Thousand" +
          (num % 1000 !== 0 ? " " + convertToWords(num % 1000) : "")
        );
      return (
        convertToWords(Math.floor(num / 1000000)) +
        " Million" +
        (num % 1000000 !== 0 ? " " + convertToWords(num % 1000000) : "")
      );
    }
    const intWords = convertToWords(dollars);
    const centsPart = String(cents).padStart(2, "0");
    return cents > 0 ? `${intWords} and ${centsPart}/100` : `${intWords}`;
  }

  // RV-derived values placed before RV render to avoid TDZ
  const rvIsBankLike = useMemo(
    () =>
      ["Cheque", "Bank Transfer", "Credit Card"].includes(
        rvForm.paymentMethod || "",
      ),
    [rvForm.paymentMethod],
  );

  const depositAccountCurrencyCode = useMemo(() => {
    const acc = accounts.find(
      (a) => String(a.id) === String(rvForm.depositAccountId || ""),
    );
    return acc?.currency_code || "";
  }, [accounts, rvForm.depositAccountId]);
  const rvPayeeCurrencyCode = useMemo(() => {
    const acc = accounts.find(
      (a) => String(a.id) === String(rvForm.payerAccountId || ""),
    );
    return acc?.currency_code || "";
  }, [accounts, rvForm.payerAccountId]);
  const rvPayeeCurrencyId = useMemo(() => {
    const acc = accounts.find(
      (a) => String(a.id) === String(rvForm.payerAccountId || ""),
    );
    return acc?.currency_id || null;
  }, [accounts, rvForm.payerAccountId]);
  const rvDepositCurrencyId = useMemo(() => {
    const acc = accounts.find(
      (a) => String(a.id) === String(rvForm.depositAccountId || ""),
    );
    return acc?.currency_id || null;
  }, [accounts, rvForm.depositAccountId]);
  const cvToCurrencyCode = useMemo(() => {
    const acc = accounts.find(
      (a) => String(a.id) === String(cvForm.toAccountId || ""),
    );
    return acc?.currency_code || "";
  }, [accounts, cvForm.toAccountId]);
  const cvFromCurrencyCode = useMemo(() => {
    const acc = accounts.find(
      (a) => String(a.id) === String(cvForm.fromAccountId || ""),
    );
    return acc?.currency_code || "";
  }, [accounts, cvForm.fromAccountId]);
  const cvFromCurrencyId = useMemo(() => {
    const acc = accounts.find(
      (a) => String(a.id) === String(cvForm.fromAccountId || ""),
    );
    return acc?.currency_id || null;
  }, [accounts, cvForm.fromAccountId]);
  const cvToCurrencyId = useMemo(() => {
    const acc = accounts.find(
      (a) => String(a.id) === String(cvForm.toAccountId || ""),
    );
    return acc?.currency_id || null;
  }, [accounts, cvForm.toAccountId]);
  const cvSelectableAccounts = useMemo(() => {
    const allowed = new Set(["BANK ACCOUNTS", "CASH AND CASH EQUIVALENTS"]);
    return (accounts || []).filter((a) =>
      allowed.has(
        String(a.group_name || "")
          .trim()
          .toUpperCase(),
      ),
    );
  }, [accounts]);
  const cvHasBankAccount = useMemo(() => {
    const fromAcc = accounts.find(
      (a) => String(a.id) === String(cvForm.fromAccountId || ""),
    );
    const toAcc = accounts.find(
      (a) => String(a.id) === String(cvForm.toAccountId || ""),
    );
    const fromGc = String(fromAcc?.group_code || "").toUpperCase();
    const fromGn = String(fromAcc?.group_name || "").toUpperCase();
    const toGc = String(toAcc?.group_code || "").toUpperCase();
    const toGn = String(toAcc?.group_name || "").toUpperCase();
    return (
      fromGc === "AST_BANK" ||
      fromGn === "BANK ACCOUNTS" ||
      toGc === "AST_BANK" ||
      toGn === "BANK ACCOUNTS"
    );
  }, [accounts, cvForm.fromAccountId, cvForm.toAccountId]);
  const rvAmountWord = useMemo(() => {
    const id = rvDepositCurrencyId;
    let cur = currencies.find((c) => String(c.id) === String(id));
    if (!cur && depositAccountCurrencyCode) {
      cur = currencies.find(
        (c) => String(c.code) === String(depositAccountCurrencyCode),
      );
    }
    return cur ? String(cur.name || "") : "";
  }, [currencies, rvDepositCurrencyId, depositAccountCurrencyCode]);
  const isChequeLike = useMemo(
    () =>
      ["Cheque", "Bank Transfer", "Credit Card"].includes(
        pvForm.paymentMethod || "",
      ),
    [pvForm.paymentMethod],
  );
  const paymentAccountCurrencyCode = useMemo(() => {
    const acc = accounts.find(
      (a) => String(a.id) === String(pvForm.paymentAccountId || ""),
    );
    return acc?.currency_code || "";
  }, [accounts, pvForm.paymentAccountId]);
  const payeeCurrencyCode = useMemo(() => {
    const acc = accounts.find(
      (a) => String(a.id) === String(pvForm.payToAccountId || ""),
    );
    return acc?.currency_code || "";
  }, [accounts, pvForm.payToAccountId]);
  const payeeCurrencyId = useMemo(() => {
    const acc = accounts.find(
      (a) => String(a.id) === String(pvForm.payToAccountId || ""),
    );
    return acc?.currency_id || null;
  }, [accounts, pvForm.payToAccountId]);
  const paymentAccountCurrencyId = useMemo(() => {
    const acc = accounts.find(
      (a) => String(a.id) === String(pvForm.paymentAccountId || ""),
    );
    return acc?.currency_id || null;
  }, [accounts, pvForm.paymentAccountId]);
  const pvAmountWord = useMemo(() => {
    const id = paymentAccountCurrencyId;
    const cur = currencies.find((c) => String(c.id) === String(id));
    return cur
      ? String(cur.name || cur.code || "")
      : String(paymentAccountCurrencyCode || "");
  }, [currencies, paymentAccountCurrencyId, paymentAccountCurrencyCode]);
  const pvVoucherTypeName = useMemo(() => {
    const vt = voucherTypes.find(
      (x) =>
        String(x.code).toUpperCase() === String(voucherTypeCode).toUpperCase(),
    );
    return vt?.name || "Payment Voucher";
  }, [voucherTypes, voucherTypeCode]);
  const rvVoucherTypeName = useMemo(() => {
    const vt = voucherTypes.find(
      (x) =>
        String(x.code).toUpperCase() === String(voucherTypeCode).toUpperCase(),
    );
    return vt?.name || "Receive Voucher";
  }, [voucherTypes, voucherTypeCode]);
  useEffect(() => {
    if (!isCV) return;
    const fromId = cvFromCurrencyId || null;
    const toId = cvToCurrencyId || null;
    const fromCode = cvFromCurrencyCode || "";
    const toCode = cvToCurrencyCode || "";
    if (!fromId || !toId) {
      setCvExchangeRate("");
      return;
    }
    if (fromCode && toCode && fromCode === toCode) {
      setCvExchangeRate("1");
      return;
    }
    (async () => {
      try {
        const res = await api.get("/finance/currency-rates", {
          params: {
            fromCurrencyId: Number(fromId),
            toCurrencyId: Number(toId),
            to: voucherDate || null,
          },
        });
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        const sorted = items
          .slice()
          .sort(
            (a, b) =>
              new Date(b.rate_date).getTime() - new Date(a.rate_date).getTime(),
          );
        const rate = sorted.length ? Number(sorted[0].rate || 0) : 0;
        setCvExchangeRate(rate ? String(rate) : "");
      } catch {
        setCvExchangeRate("");
      }
    })();
  }, [
    isCV,
    cvFromCurrencyId,
    cvToCurrencyId,
    cvFromCurrencyCode,
    cvToCurrencyCode,
    voucherDate,
  ]);

  if (isRV) {
    return (
      <div className="space-y-4">
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg">
            <div className="flex justify-between items-center text-white">
              <div>
                <h1 className="text-2xl font-bold dark:text-brand-300">
                  {title}
                </h1>
                <p className="text-sm mt-1">Record incoming payments</p>
              </div>
              <div className="flex gap-2">
                <Link to=".." className="btn-success">
                  Back
                </Link>
                {voucherStatus === "APPROVED" ? (
                  <span className="px-2 py-1 rounded bg-green-500 text-white text-sm font-medium">
                    Approved
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn-success"
                    onClick={async () => {
                      if (!isEdit) return;
                      setShowForwardModal(true);
                      setWfError("");
                      if (!workflowsCache) {
                        try {
                          setWfLoading(true);
                          const res = await api.get("/workflows");
                          const items = Array.isArray(res.data?.items)
                            ? res.data.items
                            : [];
                          setWorkflowsCache(items);
                          const amount =
                            totals?.grand === "" || totals?.grand == null
                              ? null
                              : Number(totals?.grand || 0);
                          let chosen = null;
                          const byRoute = items.filter(
                            (w) =>
                              String(w.document_route || "") ===
                              "/finance/contra-voucher",
                          );
                          const byType = items.filter((w) =>
                            ["CONTRA_VOUCHER", "Contra Voucher", "CV"].includes(
                              String(w.document_type || ""),
                            ),
                          );
                          const list = [...byRoute, ...byType];
                          for (const wf of list) {
                            if (chosen) break;
                            if (Number(wf.is_active) !== 1) continue;
                            if (amount === null) {
                              chosen = wf;
                              break;
                            }
                            const minOk =
                              wf.min_amount === null ||
                              Number(amount) >= Number(wf.min_amount);
                            const maxOk =
                              wf.max_amount === null ||
                              Number(amount) <= Number(wf.max_amount);
                            if (minOk && maxOk) {
                              chosen = wf;
                              break;
                            }
                          }
                          if (!chosen) {
                            for (const wf of byType) {
                              if (chosen) break;
                              if (Number(wf.is_active) !== 1) continue;
                              if (amount === null) {
                                chosen = wf;
                                break;
                              }
                              const minOk =
                                wf.min_amount === null ||
                                Number(amount) >= Number(wf.min_amount);
                              const maxOk =
                                wf.max_amount === null ||
                                Number(amount) <= Number(wf.max_amount);
                              if (minOk && maxOk) {
                                chosen = wf;
                                break;
                              }
                            }
                          }
                          setCandidateWorkflow(chosen);
                          setFirstApprover(null);
                          setTargetApproverId(null);
                          if (chosen) {
                            const wfDetail = await api.get(
                              `/workflows/${chosen.id}`,
                            );
                            const item = wfDetail?.data?.item || {};
                            const stepOrder = Number(
                              item.current_step_order || 1,
                            );
                            const approvers = Array.isArray(
                              item?.next_step_approvers,
                            )
                              ? item.next_step_approvers
                              : [];
                            const firstUser =
                              approvers.length > 0
                                ? Number(approvers[0].id)
                                : null;
                            setFirstApprover({
                              stepOrder: stepOrder || 1,
                              stepName: String(item.step_name || "Step 1"),
                              approvalLimit:
                                approvers.length > 0
                                  ? Number(approvers[0].approval_limit || 0)
                                  : null,
                              approvers,
                            });
                            setTargetApproverId(firstUser);
                          }
                        } catch (e) {
                          setWfError(
                            e?.response?.data?.message ||
                              "Failed to load workflows",
                          );
                        } finally {
                          setWfLoading(false);
                        }
                      }
                    }}
                    disabled={loading || !isEdit}
                  >
                    Forward for Approval
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="card">
            <div className="card-body space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {!(isPV || isRV) && (
                  <div>
                    <label className="label">Voucher Type</label>
                    <input
                      className="input"
                      value={rvVoucherTypeName}
                      disabled
                    />
                  </div>
                )}
                <div>
                  <label className="label">Voucher No</label>
                  <input
                    className="input"
                    value={voucherNoPreview || "RV-000001"}
                    disabled
                  />
                </div>
                <div>
                  <label className="label">Voucher Date *</label>
                  <input
                    className={`input ${disabledClass}`}
                    type="date"
                    value={voucherDate}
                    onChange={(e) => setVoucherDate(e.target.value)}
                    required
                    disabled={readOnly}
                  />
                </div>
                {!(isPV || isRV) && (
                  <div>
                    <label className="label">Fiscal Year *</label>
                    <select
                      className={`input ${disabledClass}`}
                      value={fiscalYearId}
                      onChange={(e) => setFiscalYearId(e.target.value)}
                      required
                      disabled={readOnly}
                    >
                      <option value="">Select</option>
                      {fiscalYears.map((fy) => (
                        <option key={fy.id} value={fy.id}>
                          {fy.code}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Received From</label>
                  <select
                    className={`input ${disabledClass}`}
                    value={rvForm.receivedFromCode || ""}
                    onChange={(e) => {
                      const code = e.target.value;
                      const entry = payees.find(
                        (p) => String(p.code) === String(code),
                      );
                      const name = entry?.name || "";
                      const matchByCode = accounts.find(
                        (a) => String(a.code) === String(code),
                      );
                      const isCustomer =
                        String(entry?.type || "").toUpperCase() === "CUSTOMER";
                      const isSupplier =
                        String(entry?.type || "").toUpperCase() === "SUPPLIER";
                      const matchByName = accounts.find((a) => {
                        const gn = String(a.group_name || "").toUpperCase();
                        const targetGroup = isCustomer
                          ? "DEBTORS"
                          : isSupplier
                            ? "CREDITORS"
                            : "";
                        if (targetGroup && gn !== targetGroup) return false;
                        const an = String(a.name || "")
                          .trim()
                          .toLowerCase();
                        const en = String(name || "")
                          .trim()
                          .toLowerCase();
                        return an === en || an.includes(en) || en.includes(an);
                      });
                      const chosenAcc = matchByCode || matchByName || null;
                      const accountId = chosenAcc?.id
                        ? String(chosenAcc.id)
                        : "";
                      if (isCustomer && entry?.id) {
                        loadInvoicesForCustomer(entry.id);
                      } else {
                        setCustomerInvoices([]);
                      }
                      updateRvForm({
                        receivedFrom: name,
                        receivedFromCode: code,
                        payerAccountId: accountId,
                        items:
                          rvForm.items.length === 0
                            ? [
                                {
                                  description: "",
                                  accountId,
                                  amount: "",
                                  referenceNo: "",
                                },
                              ]
                            : rvForm.items.map((it, i) =>
                                i === 0 ? { ...it, accountId } : it,
                              ),
                      });
                    }}
                    disabled={readOnly}
                  >
                    <option value="">Select customer or supplier</option>
                    {payees.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Payment Method</label>
                  <select
                    className={`input ${disabledClass}`}
                    value={rvForm.paymentMethod}
                    onChange={(e) =>
                      updateRvForm({ paymentMethod: e.target.value })
                    }
                    disabled={readOnly}
                  >
                    <option>Cash</option>
                    <option>Cheque</option>
                    <option>Bank Transfer</option>
                    <option>Credit Card</option>
                    <option>Mobile Money</option>
                  </select>
                </div>
                {rvIsBankLike ? (
                  <div className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Reference / Cheque No</label>
                        <input
                          className={`input ${disabledClass}`}
                          value={rvForm.reference}
                          onChange={(e) =>
                            updateRvForm({ reference: e.target.value })
                          }
                          placeholder="Reference Number or Cheque Number"
                          disabled={readOnly}
                        />
                      </div>
                      <div>
                        <label className="label">Cheque Date</label>
                        <input
                          className={`input ${disabledClass}`}
                          type="date"
                          value={rvForm.chequeDate || ""}
                          onChange={(e) =>
                            updateRvForm({ chequeDate: e.target.value })
                          }
                          disabled={readOnly}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center">
                    <label className="label">Deposit Account *</label>
                    <span className="text-xs text-slate-500">
                      {depositAccountCurrencyCode || ""}
                    </span>
                  </div>
                  <select
                    className={`input ${disabledClass}`}
                    value={rvForm.depositAccountId}
                    onChange={(e) =>
                      updateRvForm({ depositAccountId: e.target.value })
                    }
                    required
                    disabled={readOnly}
                  >
                    <option value="">Select account</option>
                    {accounts
                      .filter((a) => {
                        const gc = String(a.group_code || "").toUpperCase();
                        const gn = String(a.group_name || "").toUpperCase();
                        return rvIsBankLike
                          ? gc === "AST_BANK" || gn === "BANK ACCOUNTS"
                          : gc === "AST_CASH" ||
                              gn === "CASH AND CASH EQUIVALENTS";
                      })
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Currency</label>
                      <input
                        className="input bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700 font-semibold"
                        value={depositAccountCurrencyCode || ""}
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="label">Exchange Rate</label>
                      <input
                        className="input bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700 font-semibold"
                        value={rvExchangeRate || ""}
                        readOnly
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                {isCN || isDN ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                    <div>
                      <label className="label">Exchange Rate</label>
                      <input
                        className="input"
                        value={dncnExchangeRate || ""}
                        readOnly
                      />
                    </div>
                  </div>
                ) : null}
                <div className="flex justify-between items-center mb-3">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    Payment Details
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="w-10">#</th>
                        <th>Description</th>
                        <th className="w-64">Account</th>
                        <th className="w-64">Bill</th>
                        <th className="text-right w-32">Currency</th>
                        <th className="text-right w-40">Amount</th>
                        <th className="w-24" />
                      </tr>
                    </thead>
                    <tbody>
                      {rvForm.items.length === 0 ? (
                        <tr>
                          <td className="text-center p-2" colSpan={7}>
                            No items
                          </td>
                        </tr>
                      ) : (
                        rvForm.items.map((it, idx) => (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td>
                              <input
                                className={`input ${disabledClass}`}
                                value={it.description}
                                onChange={(e) =>
                                  updateRvItem(idx, {
                                    description: e.target.value,
                                  })
                                }
                                placeholder="Description"
                                disabled={readOnly}
                              />
                            </td>
                            <td>
                              <select
                                className={`input bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700 font-semibold ${disabledClass}`}
                                value={it.accountId}
                                onChange={(e) => {
                                  const accountId = e.target.value;
                                  updateRvItem(idx, { accountId });
                                  if (idx === 0) {
                                    const acc = accounts.find(
                                      (a) => String(a.id) === String(accountId),
                                    );
                                    const code = acc?.code
                                      ? String(acc.code)
                                      : "";
                                    const entry = payees.find(
                                      (p) => String(p.code) === String(code),
                                    );
                                    const name = entry?.name || "";
                                    updateRvForm({
                                      receivedFrom: name,
                                      receivedFromCode: code,
                                      payerAccountId: String(accountId || ""),
                                    });
                                  }
                                }}
                                required
                                disabled={readOnly}
                              >
                                <option value="">Select account</option>
                                {accounts.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              {customerInvoices.length > 0 ? (
                                idx === 0 ? (
                                  <select
                                    multiple
                                    className={`input ${disabledClass}`}
                                    value={selectedInvoiceRefs}
                                    onChange={(e) => {
                                      const opts = Array.from(
                                        e.target.selectedOptions,
                                      ).map((o) => o.value);
                                      setSelectedInvoiceRefs(opts);
                                      const chosenList =
                                        customerInvoices.filter((inv) =>
                                          opts.includes(String(inv.invoice_no)),
                                        );
                                      const items =
                                        chosenList.length > 0
                                          ? chosenList.map((inv) => ({
                                              description: "",
                                              accountId:
                                                rvForm.payerAccountId || "",
                                              amount: Number(
                                                inv.balance_amount || 0,
                                              ),
                                              referenceNo: String(
                                                inv.invoice_no,
                                              ),
                                            }))
                                          : [
                                              {
                                                description: "",
                                                accountId:
                                                  rvForm.payerAccountId || "",
                                                amount: 0,
                                                referenceNo: "",
                                              },
                                            ];
                                      const firstTaxCodeId =
                                        chosenList.length > 0
                                          ? chosenList[0].tax_code_id || null
                                          : null;
                                      updateRvForm({
                                        items,
                                        ...(firstTaxCodeId
                                          ? {
                                              taxCodeId: String(firstTaxCodeId),
                                            }
                                          : {}),
                                      });
                                    }}
                                    size={Math.min(
                                      6,
                                      Math.max(3, customerInvoices.length),
                                    )}
                                    disabled={readOnly}
                                  >
                                    {customerInvoices.map((inv) => (
                                      <option
                                        key={inv.id}
                                        value={inv.invoice_no}
                                      >
                                        {inv.invoice_no} — Outstanding{" "}
                                        {Number(
                                          inv.balance_amount || 0,
                                        ).toLocaleString(undefined, {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <div className="text-slate-500 dark:text-slate-400 text-sm">
                                    Select invoices using first row
                                  </div>
                                )
                              ) : (
                                <div className="text-slate-500 dark:text-slate-400 text-sm">
                                  No outstanding invoices for selected customer
                                </div>
                              )}
                            </td>
                            <td className="text-right">
                              {rvPayeeCurrencyCode || ""}
                            </td>
                            <td>
                              <input
                                className={`input text-right ${disabledClass}`}
                                type="number"
                                min="0"
                                step="1"
                                value={it.amount || ""}
                                onChange={(e) =>
                                  updateRvItem(idx, {
                                    amount: Number(e.target.value || 0),
                                  })
                                }
                                onFocus={() => {
                                  if (Number(it.amount || 0) === 0) {
                                    updateRvItem(idx, { amount: "" });
                                  }
                                }}
                                disabled={readOnly}
                              />
                            </td>
                            <td>
                              <div />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-semibold">
                        {Number(totals.subtotal || 0).toLocaleString(
                          undefined,
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          },
                        )}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 justify-between">
                        <div className="flex items-center gap-2">
                          <span>Tax Code</span>
                          <select
                            className={`input w-36 ${disabledClass}`}
                            value={rvForm.taxCodeId}
                            onChange={(e) =>
                              updateRvForm({ taxCodeId: e.target.value })
                            }
                            disabled={readOnly}
                          >
                            <option value="">Select</option>
                            {taxCodes.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <span className="font-semibold">
                          {Number(
                            rvTaxComponentsTotals.taxTotal || 0,
                          ).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      {rvTaxComponentsTotals.components.map((c) => (
                        <div
                          key={c.name}
                          className="flex justify-between text-sm text-slate-700"
                        >
                          <span>
                            {c.name} [{c.rate}%]
                          </span>
                          <span>
                            {Number(c.amount || 0).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold">TOTAL AMOUNT</span>
                      <span className="font-bold">
                        {Number(
                          rvTaxComponentsTotals.grand || totals.grand || 0,
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="label">Amount in Words</label>
                      <textarea
                        className="input h-20"
                        value={`${numberToWordsBasic(
                          Number(
                            rvTaxComponentsTotals.grand || totals.grand || 0,
                          ),
                        )} ${rvAmountWord}`.trim()}
                        readOnly
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Notes / Remarks</label>
                <textarea
                  className="input h-24"
                  value={rvForm.notes}
                  onChange={(e) => updateRvForm({ notes: e.target.value })}
                  placeholder="Additional notes or comments"
                />
              </div>

              <div className="flex flex-col md:flex-row gap-2">
                <button
                  type="button"
                  className="btn-success"
                  onClick={handlePrintVoucher}
                >
                  Print Voucher
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleDownloadVoucherPdf}
                >
                  Download PDF
                </button>
                <Link to=".." className="btn-success">
                  Cancel
                </Link>
                <button
                  type="submit"
                  className="btn-success"
                  disabled={
                    loading ||
                    readOnly ||
                    !balanced ||
                    !rvForm.depositAccountId ||
                    Number(totals.grand || 0) <= 0
                  }
                >
                  {loading ? "Saving..." : "Save Voucher"}
                </button>
              </div>
            </div>
          </div>
        </form>
        {showForwardModal ? (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-[640px] max-w-[95%]">
              <div className="p-4 border-b flex justify-between items-center bg-brand text-white rounded-t-lg">
                <div className="font-semibold">
                  Forward Contra Voucher for Approval
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowForwardModal(false);
                    setCandidateWorkflow(null);
                    setFirstApprover(null);
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
                    {voucherNoPreview || "-"}
                  </span>
                </div>
                <div className="text-sm text-slate-700">
                  Workflow:{" "}
                  <span className="font-semibold">
                    {candidateWorkflow
                      ? candidateWorkflow.workflow_name
                      : "Auto"}
                  </span>
                </div>
                <div className="text-sm text-red-600">{wfError || ""}</div>
                <div>
                  {wfLoading ? (
                    <div className="text-slate-600">Loading workflows...</div>
                  ) : firstApprover &&
                    Array.isArray(firstApprover.approvers) ? (
                    <div>
                      <label className="label">Assign To</label>
                      <select
                        className="input"
                        value={targetApproverId || ""}
                        onChange={(e) =>
                          setTargetApproverId(e.target.value || null)
                        }
                      >
                        <option value="">Select approver</option>
                        {firstApprover.approvers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.username}
                          </option>
                        ))}
                      </select>
                      <div className="text-xs text-slate-600 mt-1">
                        {firstApprover
                          ? `Step ${firstApprover.stepOrder} • ${firstApprover.stepName}${
                              firstApprover.approvalLimit != null
                                ? ` • Limit: ${Number(firstApprover.approvalLimit).toLocaleString()}`
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
                  )}
                </div>
              </div>
              <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                  onClick={() => {
                    setShowForwardModal(false);
                    setCandidateWorkflow(null);
                    setFirstApprover(null);
                    setWfError("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-700"
                  onClick={async () => {
                    if (!isEdit) return;
                    setSubmittingForward(true);
                    setWfError("");
                    try {
                      const res = await api.post(
                        `/finance/vouchers/${id}/submit`,
                        {
                          amount:
                            totals?.grand === "" || totals?.grand == null
                              ? null
                              : Number(totals?.grand || 0),
                          workflow_id: candidateWorkflow
                            ? candidateWorkflow.id
                            : null,
                          target_user_id: targetApproverId || null,
                        },
                      );
                      const newStatus = res?.data?.status || "PENDING_APPROVAL";
                      setVoucherStatus(newStatus);
                      setShowForwardModal(false);
                    } catch (e) {
                      setWfError(
                        e?.response?.data?.message ||
                          "Failed to forward for approval",
                      );
                    } finally {
                      setSubmittingForward(false);
                    }
                  }}
                  disabled={submittingForward || !isEdit}
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
  // PV UI
  function updatePv(patch) {
    if (readOnly) return;
    setPvForm((prev) => ({ ...prev, ...patch }));
  }
  function updatePvItem(idx, patch) {
    if (readOnly) return;
    const nextItems = pvForm.items.map((it, i) =>
      i === idx ? { ...it, ...patch } : it,
    );
    const changed = nextItems[idx];
    if (
      Object.prototype.hasOwnProperty.call(patch, "amount") &&
      (!changed.referenceNo || String(changed.referenceNo).trim() === "")
    ) {
      const used = new Set(
        nextItems
          .map((x) => String(x.referenceNo || ""))
          .filter((r) => r && r.length > 0),
      );
      const candidate =
        selectedBillRefs.find((r) => !used.has(String(r))) ||
        selectedBillRefs[0] ||
        null;
      if (candidate) {
        nextItems[idx] = { ...changed, referenceNo: String(candidate) };
      }
    }
    updatePv({ items: nextItems });
  }
  function addPvItem() {
    if (readOnly) return;
    updatePv({
      items: [...pvForm.items, { description: "", accountId: "", amount: "" }],
    });
  }
  function removePvItem(idx) {
    if (readOnly) return;
    if (pvForm.items.length <= 1) return;
    updatePv({
      items: pvForm.items.filter((_, i) => i !== idx),
    });
  }
  const [knockOffTotal, setKnockOffTotal] = useState(0);
  function setPvAmountForRef(referenceNo, amount) {
    if (readOnly) return;
    const idx = pvForm.items.findIndex(
      (it) => String(it.referenceNo || "") === String(referenceNo || ""),
    );
    if (idx >= 0) {
      updatePvItem(idx, { amount: Number(amount || 0) });
    } else {
      updatePv({
        items: [
          ...pvForm.items,
          {
            description: `Bill ${referenceNo} payment`,
            accountId: pvForm.payToAccountId || "",
            amount: Number(amount || 0),
            referenceNo: String(referenceNo || ""),
          },
        ],
      });
    }
  }
  function allocatePvBillsFifo(total) {
    if (readOnly) return;
    const refs = [...selectedBillRefs];
    const chosen = supplierBills.filter((b) =>
      refs.includes(String(b.bill_no)),
    );
    let remaining = Number(total || 0);
    const nextItemsMap = new Map(
      pvForm.items.map((it) => [String(it.referenceNo || ""), { ...it }]),
    );
    for (let i = 0; i < chosen.length; i++) {
      const b = chosen[i];
      const outstanding = Number(b?.outstanding || 0);
      const alloc = Math.max(0, Math.min(outstanding, remaining));
      remaining = Math.max(0, remaining - alloc);
      nextItemsMap.set(String(b.bill_no), {
        description: `Bill ${b.bill_no} payment`,
        accountId: pvForm.payToAccountId || "",
        amount: alloc,
        referenceNo: String(b.bill_no),
      });
    }
    updatePv({ items: Array.from(nextItemsMap.values()) });
  }
  async function openBillModal(entry) {
    if (!entry) return;
    setShowBillModal(true);
    setBillModalLoading(true);
    setBillModalError("");
    setBillModalHeader(null);
    setBillModalDetails([]);
    try {
      const idStr = String(entry.id || "");
      if (idStr.startsWith("SB-")) {
        const idNum = Number(idStr.replace(/^SB-/, ""));
        setBillModalType("SERVICE");
        const res = await api.get(`/purchase/service-bills/${idNum}`);
        setBillModalHeader(res.data?.item || null);
        setBillModalDetails(res.data?.details || []);
      } else {
        const idNum = Number(entry.id);
        setBillModalType("PURCHASE");
        const res = await api.get(`/purchase/bills/${idNum}`);
        setBillModalHeader(res.data?.item || null);
        setBillModalDetails(res.data?.details || []);
      }
    } catch (e) {
      setBillModalError(
        e?.response?.data?.message || "Failed to load bill details",
      );
    } finally {
      setBillModalLoading(false);
    }
  }
  useEffect(() => {
    if (!isPV) return;
    const acc = accounts.find(
      (a) => String(a.id) === String(pvForm.paymentAccountId || ""),
    );
    if (!acc) return;
    const gc = String(acc.group_code || "").toUpperCase();
    const gn = String(acc.group_name || "").toUpperCase();
    const wantsBank = isChequeLike;
    const ok = wantsBank
      ? gc === "AST_BANK" || gn === "BANK ACCOUNTS"
      : gc === "AST_CASH" || gn === "CASH AND CASH EQUIVALENTS";
    if (!ok) updatePv({ paymentAccountId: "" });
  }, [isPV, isChequeLike, accounts, pvForm.paymentAccountId]);
  useEffect(() => {
    if (!isRV) return;
    const acc = accounts.find(
      (a) => String(a.id) === String(rvForm.depositAccountId || ""),
    );
    if (!acc) return;
    const gc = String(acc.group_code || "").toUpperCase();
    const gn = String(acc.group_name || "").toUpperCase();
    const wantsBank = rvIsBankLike;
    const ok = wantsBank
      ? gc === "AST_BANK" || gn === "BANK ACCOUNTS"
      : gc === "AST_CASH" || gn === "CASH AND CASH EQUIVALENTS";
    if (!ok) updateRvForm({ depositAccountId: "" });
  }, [isRV, rvIsBankLike, accounts, rvForm.depositAccountId]);
  useEffect(() => {
    if (!isPV) return;
    const fromId = payeeCurrencyId || null;
    const toId = paymentAccountCurrencyId || null;
    const fromCode = payeeCurrencyCode || "";
    const toCode = paymentAccountCurrencyCode || "";
    if (!fromId || !toId) {
      setPvExchangeRate("");
      return;
    }
    if (fromCode && toCode && fromCode === toCode) {
      setPvExchangeRate("1");
      return;
    }
    (async () => {
      try {
        const res = await api.get("/finance/currency-rates", {
          params: {
            fromCurrencyId: Number(fromId),
            toCurrencyId: Number(toId),
            to: voucherDate || null,
          },
        });
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        const sorted = items
          .slice()
          .sort(
            (a, b) =>
              new Date(b.rate_date).getTime() - new Date(a.rate_date).getTime(),
          );
        const rate = sorted.length ? Number(sorted[0].rate || 0) : 0;
        setPvExchangeRate(rate ? String(rate) : "");
      } catch {
        setPvExchangeRate("");
      }
    })();
  }, [
    isPV,
    payeeCurrencyId,
    paymentAccountCurrencyId,
    payeeCurrencyCode,
    paymentAccountCurrencyCode,
    voucherDate,
  ]);
  useEffect(() => {
    if (!isRV) return;
    const fromId = rvPayeeCurrencyId || null;
    const toId = rvDepositCurrencyId || null;
    const fromCode = rvPayeeCurrencyCode || "";
    const toCode = depositAccountCurrencyCode || "";
    if (!fromId || !toId) {
      setRvExchangeRate("1");
      return;
    }
    if (fromCode && toCode && fromCode === toCode) {
      setRvExchangeRate("1");
      return;
    }
    (async () => {
      try {
        const res = await api.get("/finance/currency-rates", {
          params: {
            fromCurrencyId: Number(fromId),
            toCurrencyId: Number(toId),
            to: voucherDate || null,
          },
        });
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        const sorted = items
          .slice()
          .sort(
            (a, b) =>
              new Date(b.rate_date).getTime() - new Date(a.rate_date).getTime(),
          );
        let rate = sorted.length ? Number(sorted[0].rate || 0) : 0;
        if (!rate) {
          try {
            const resRev = await api.get("/finance/currency-rates", {
              params: {
                fromCurrencyId: Number(toId),
                toCurrencyId: Number(fromId),
                to: voucherDate || null,
              },
            });
            const itemsRev = Array.isArray(resRev.data?.items)
              ? resRev.data.items
              : [];
            const sortedRev = itemsRev
              .slice()
              .sort(
                (a, b) =>
                  new Date(b.rate_date).getTime() -
                  new Date(a.rate_date).getTime(),
              );
            const revRate = sortedRev.length
              ? Number(sortedRev[0].rate || 0)
              : 0;
            rate = revRate ? 1 / revRate : 0;
          } catch {}
        }
        setRvExchangeRate(rate ? String(rate) : "1");
      } catch {
        setRvExchangeRate("1");
      }
    })();
  }, [
    isRV,
    rvPayeeCurrencyId,
    rvDepositCurrencyId,
    rvPayeeCurrencyCode,
    depositAccountCurrencyCode,
    voucherDate,
  ]);
  if (isPV) {
    return (
      <div className="space-y-4">
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg">
            <div className="flex justify-between items-center text-white">
              <div>
                <h1 className="text-2xl font-bold dark:text-brand-300">
                  {title}
                </h1>
                <p className="text-sm mt-1">Record outgoing payments</p>
              </div>
              <div className="flex gap-2">
                <Link to=".." className="btn-success">
                  Back
                </Link>
                {voucherStatus === "APPROVED" ? (
                  <span className="px-2 py-1 rounded bg-green-500 text-white text-sm font-medium">
                    Approved
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn-success"
                    onClick={async () => {
                      if (!isEdit) return;
                      setShowForwardModal(true);
                      setWfError("");
                      if (!workflowsCache) {
                        try {
                          setWfLoading(true);
                          const res = await api.get("/workflows");
                          const items = Array.isArray(res.data?.items)
                            ? res.data.items
                            : [];
                          setWorkflowsCache(items);
                          const amount =
                            totals?.grand === "" || totals?.grand == null
                              ? null
                              : Number(totals?.grand || 0);
                          let chosen = null;
                          const byRoute = items.filter(
                            (w) =>
                              String(w.document_route || "") ===
                              "/finance/payment-voucher",
                          );
                          const byType = items.filter((w) =>
                            [
                              "PAYMENT_VOUCHER",
                              "Payment Voucher",
                              "PV",
                            ].includes(String(w.document_type || "")),
                          );
                          const list = [...byRoute, ...byType];
                          for (const wf of list) {
                            if (chosen) break;
                            if (Number(wf.is_active) !== 1) continue;
                            if (amount === null) {
                              chosen = wf;
                              break;
                            }
                            const minOk =
                              wf.min_amount === null ||
                              Number(amount) >= Number(wf.min_amount);
                            const maxOk =
                              wf.max_amount === null ||
                              Number(amount) <= Number(wf.max_amount);
                            if (minOk && maxOk) {
                              chosen = wf;
                              break;
                            }
                          }
                          if (!chosen) {
                            for (const wf of byType) {
                              if (chosen) break;
                              if (Number(wf.is_active) !== 1) continue;
                              if (amount === null) {
                                chosen = wf;
                                break;
                              }
                              const minOk =
                                wf.min_amount === null ||
                                Number(amount) >= Number(wf.min_amount);
                              const maxOk =
                                wf.max_amount === null ||
                                Number(amount) <= Number(wf.max_amount);
                              if (minOk && maxOk) {
                                chosen = wf;
                                break;
                              }
                            }
                          }
                          setCandidateWorkflow(chosen);
                          setFirstApprover(null);
                          setTargetApproverId(null);
                          if (chosen) {
                            const wfDetail = await api.get(
                              `/workflows/${chosen.id}`,
                            );
                            const item = wfDetail?.data?.item || {};
                            const stepOrder = Number(
                              item.current_step_order || 1,
                            );
                            const approvers = Array.isArray(
                              item?.next_step_approvers,
                            )
                              ? item.next_step_approvers
                              : [];
                            const first = await api.get(
                              `/workflows/${chosen.id}`,
                            );
                            const stepsBase = Array.isArray(
                              first?.data?.item ? [first.data.item] : [],
                            )
                              ? []
                              : [];
                            const firstStep = stepOrder || 1;
                            const firstUser =
                              approvers.length > 0
                                ? Number(approvers[0].id)
                                : null;
                            setFirstApprover({
                              stepOrder: firstStep,
                              stepName: String(item.step_name || "Step 1"),
                              approvalLimit:
                                approvers.length > 0
                                  ? Number(approvers[0].approval_limit || 0)
                                  : null,
                              approvers,
                            });
                            setTargetApproverId(firstUser);
                          }
                        } catch (e) {
                          setWfError(
                            e?.response?.data?.message ||
                              "Failed to load workflows",
                          );
                        } finally {
                          setWfLoading(false);
                        }
                      }
                    }}
                    disabled={loading || !isEdit}
                  >
                    Forward for Approval
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="card">
            <div className="card-body space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {!(isPV || isRV) && (
                  <div>
                    <label className="label">Voucher Type</label>
                    <input
                      className="input"
                      value={pvVoucherTypeName}
                      disabled
                    />
                  </div>
                )}
                <div>
                  <label className="label">Voucher No</label>
                  <input
                    className="input"
                    value={voucherNoPreview || "PV-000000"}
                    disabled
                  />
                </div>
                <div>
                  <label className="label">Voucher Date *</label>
                  <input
                    className="input"
                    type="date"
                    value={voucherDate}
                    onChange={(e) => setVoucherDate(e.target.value)}
                    required
                    disabled={readOnly}
                  />
                </div>
                {!(isPV || isRV) && (
                  <div>
                    <label className="label">Fiscal Year *</label>
                    <select
                      className="input"
                      value={fiscalYearId}
                      onChange={(e) => setFiscalYearId(e.target.value)}
                      required
                      disabled={readOnly}
                    >
                      <option value="">Select</option>
                      {fiscalYears.map((fy) => (
                        <option key={fy.id} value={fy.id}>
                          {fy.code}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Paid To</label>
                  <select
                    className={`input ${disabledClass}`}
                    value={pvForm.payToCode || ""}
                    onChange={(e) => {
                      const code = e.target.value;
                      const entry = payees.find(
                        (p) => String(p.code) === String(code),
                      );
                      const name = entry?.name || "";
                      const matchAcc = accounts.find(
                        (a) => String(a.code) === String(code),
                      );
                      const accountId = matchAcc?.id ? String(matchAcc.id) : "";
                      const items =
                        pvForm.items.length === 0
                          ? [{ description: "", accountId, amount: 0 }]
                          : pvForm.items.map((it, i) =>
                              i === 0 ? { ...it, accountId } : it,
                            );
                      updatePv({
                        payTo: name,
                        payToCode: code,
                        payToAccountId: accountId,
                        items,
                      });
                      if (
                        String(entry?.type || "").toUpperCase() ===
                          "SUPPLIER" &&
                        entry?.id
                      ) {
                        loadOutstandingBillsForSupplier(entry);
                      } else {
                        setSupplierBills([]);
                        setSelectedBillRefs([]);
                      }
                    }}
                    disabled={readOnly}
                  >
                    <option value="">Select customer or supplier</option>
                    {payees.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Payment Method</label>
                  <select
                    className={`input ${disabledClass}`}
                    value={pvForm.paymentMethod}
                    onChange={(e) =>
                      updatePv({ paymentMethod: e.target.value })
                    }
                  >
                    <option>Cash</option>
                    <option>Cheque</option>
                    <option>Bank Transfer</option>
                    <option>Credit Card</option>
                    <option>Mobile Money</option>
                  </select>
                </div>

                {isChequeLike ? (
                  <div className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Reference / Cheque No</label>
                        <input
                          className={`input ${disabledClass}`}
                          value={pvForm.reference}
                          onChange={(e) =>
                            updatePv({ reference: e.target.value })
                          }
                          placeholder="Reference Number or Cheque Number"
                          disabled={readOnly}
                        />
                      </div>
                      <div>
                        <label className="label">Cheque Date</label>
                        <input
                          className={`input ${disabledClass}`}
                          type="date"
                          value={pvForm.chequeDate || ""}
                          onChange={(e) =>
                            updatePv({ chequeDate: e.target.value })
                          }
                          disabled={readOnly}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="label">Payment Account *</label>
                    <select
                      className={`input ${disabledClass}`}
                      value={pvForm.paymentAccountId}
                      onChange={(e) =>
                        updatePv({ paymentAccountId: e.target.value })
                      }
                      required
                    >
                      <option value="">Select account</option>
                      {accounts
                        .filter((a) => {
                          const gc = String(a.group_code || "").toUpperCase();
                          const gn = String(a.group_name || "").toUpperCase();
                          return isChequeLike
                            ? gc === "AST_BANK" || gn === "BANK ACCOUNTS"
                            : gc === "AST_CASH" ||
                                gn === "CASH AND CASH EQUIVALENTS";
                        })
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} - {a.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Outstanding Bills</label>
                    {supplierBills.length > 0 ? (
                      <select
                        multiple
                        className={`input ${disabledClass}`}
                        value={selectedBillRefs}
                        onChange={(e) => {
                          const opts = Array.from(e.target.selectedOptions).map(
                            (o) => o.value,
                          );
                          setSelectedBillRefs(opts);
                          const chosenList = supplierBills.filter((b) =>
                            opts.includes(String(b.bill_no)),
                          );
                          const defaultTotal = chosenList.reduce(
                            (sum, b) => sum + Number(b.outstanding || 0),
                            0,
                          );
                          setKnockOffTotal(defaultTotal);
                          const items = chosenList.map((b) => ({
                            description: `Bill ${b.bill_no} payment`,
                            accountId: pvForm.payToAccountId || "",
                            amount: Number(b.outstanding || 0),
                            referenceNo: String(b.bill_no),
                          }));
                          updatePv({
                            items:
                              items.length > 0
                                ? items
                                : [
                                    {
                                      description: "",
                                      accountId: pvForm.payToAccountId || "",
                                      amount: 0,
                                      referenceNo: "",
                                    },
                                  ],
                          });
                          allocatePvBillsFifo(defaultTotal);
                        }}
                        onDoubleClick={(e) => {
                          if (readOnly) return;
                          const i = e.target.selectedIndex;
                          if (i == null || i < 0) return;
                          const val = e.target.options?.[i]?.value;
                          const entry = supplierBills.find(
                            (b) => String(b.bill_no) === String(val),
                          );
                          if (entry) openBillModal(entry);
                        }}
                        size={Math.min(10, Math.max(3, supplierBills.length))}
                        disabled={readOnly}
                      >
                        {supplierBills.map((b) => (
                          <option key={b.id} value={b.bill_no}>
                            {b.bill_no} — {b.payment_status} — Outstanding{" "}
                            {Number(b.outstanding || 0).toLocaleString(
                              undefined,
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              },
                            )}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="input bg-gray-100 text-gray-500">
                        No bills for selected supplier
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="label">Currency</label>
                    <input
                      className="input bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700 font-semibold"
                      value={paymentAccountCurrencyCode || ""}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="label">Exchange Rate</label>
                    <input
                      className="input bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700 font-semibold"
                      value={pvExchangeRate || ""}
                      readOnly
                    />
                  </div>
                </div>
                <div />
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <div className="flex justify-between items-center mb-3">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    Payment Details
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="w-10">#</th>
                        <th>Description</th>
                        <th className="w-64">Account</th>
                        <th className="text-right w-32">Currency</th>
                        <th className="text-right w-40">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pvForm.items.length === 0 ? (
                        <tr>
                          <td className="text-center p-2" colSpan={5}>
                            No items
                          </td>
                        </tr>
                      ) : (
                        pvForm.items.map((it, idx) => (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td>
                              <input
                                className={`input ${disabledClass}`}
                                value={it.description}
                                onChange={(e) =>
                                  updatePvItem(idx, {
                                    description: e.target.value,
                                  })
                                }
                                placeholder="Description"
                              />
                            </td>
                            <td>
                              <select
                                className={`input bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700 font-semibold ${disabledClass}`}
                                value={it.accountId}
                                onChange={(e) =>
                                  updatePvItem(idx, {
                                    accountId: e.target.value,
                                  })
                                }
                                required
                                disabled={readOnly}
                              >
                                <option value="">Select account</option>
                                {accounts.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="text-right">
                              {payeeCurrencyCode || ""}
                            </td>
                            <td>
                              <input
                                className={`input text-right ${disabledClass}`}
                                type="number"
                                min="0"
                                step="1"
                                value={it.amount || ""}
                                onChange={(e) =>
                                  updatePvItem(idx, {
                                    amount: Number(e.target.value || 0),
                                  })
                                }
                                onFocus={() => {
                                  if (Number(it.amount || 0) === 0) {
                                    updatePvItem(idx, { amount: "" });
                                  }
                                }}
                                disabled={readOnly}
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-semibold">
                        {Number(totals.subtotal || 0).toLocaleString(
                          undefined,
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          },
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span>
                          Tax (
                          {Number(
                            taxCodes.find(
                              (t) => String(t.id) === String(pvForm.taxCodeId),
                            )?.rate_percent || 0,
                          )}
                          %)
                        </span>
                        <select
                          className="input w-36"
                          value={pvForm.taxCodeId}
                          onChange={(e) =>
                            updatePv({ taxCodeId: e.target.value })
                          }
                        >
                          <option value="">Select</option>
                          {taxCodes.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <span className="font-semibold">
                        {Number(totals.tax || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold">TOTAL AMOUNT</span>
                      <span className="font-bold">
                        {Number(totals.grand || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="label">Amount in Words</label>
                      <textarea
                        className="input h-20"
                        value={`${numberToWordsBasic(Number(totals.grand || 0))} ${pvAmountWord}`.trim()}
                        readOnly
                      />
                    </div>
                  </div>
                </div>
              </div>
              {selectedBillRefs.length > 0 && (
                <div className="mt-4">
                  <div className="font-semibold mb-2">
                    Knock Off Payment Against Bills
                  </div>
                  <div className="mb-2 flex items-center gap-2">
                    <label className="label mb-0">Total to Allocate</label>
                    <input
                      type="number"
                      className={`input w-40 text-right ${disabledClass}`}
                      min="0"
                      step="0.01"
                      value={Number(knockOffTotal || 0)}
                      onChange={(e) => {
                        const v = Number(e.target.value || 0);
                        setKnockOffTotal(v);
                        allocatePvBillsFifo(v);
                      }}
                      disabled={readOnly}
                    />
                    <button
                      type="button"
                      className="btn-success"
                      onClick={() => {
                        let applied = selectedBillRefs.reduce((sum, ref) => {
                          const it = pvForm.items.find(
                            (x) => String(x.referenceNo || "") === String(ref),
                          );
                          return sum + Number(it?.amount || 0);
                        }, 0);
                        if (applied <= 0) {
                          allocatePvBillsFifo(knockOffTotal);
                          applied = selectedBillRefs.reduce((sum, ref) => {
                            const it = pvForm.items.find(
                              (x) =>
                                String(x.referenceNo || "") === String(ref),
                            );
                            return sum + Number(it?.amount || 0);
                          }, 0);
                        }
                        toast.success(
                          `Knock-off confirmed. Allocated GH₵ ${applied.toFixed(
                            2,
                          )} (FIFO applied)`,
                        );
                      }}
                      disabled={readOnly}
                    >
                      Confirm Knock-off
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th className="w-32">Bill No</th>
                          <th className="text-right w-40">Outstanding</th>
                          <th className="text-right w-40">Knock-off Amount</th>
                          <th className="text-right w-40">
                            Balance After Knock-off
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedBillRefs.map((ref) => {
                          const b = supplierBills.find(
                            (sb) => String(sb.bill_no) === String(ref),
                          );
                          const outstanding = Number(b?.outstanding || 0);
                          const it = pvForm.items.find(
                            (x) => String(x.referenceNo || "") === String(ref),
                          ) || {
                            referenceNo: ref,
                            amount: 0,
                          };
                          const balance = Math.max(
                            0,
                            outstanding - Number(it.amount || 0),
                          );
                          return (
                            <tr key={`knock-${ref}`}>
                              <td>{String(ref)}</td>
                              <td className="text-right">
                                {outstanding.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td>
                                <input
                                  className={`input text-right ${disabledClass}`}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={Number(it.amount || 0)}
                                  onChange={(e) =>
                                    setPvAmountForRef(
                                      ref,
                                      Number(e.target.value || 0),
                                    )
                                  }
                                  disabled={readOnly}
                                />
                              </td>
                              <td className="text-right">
                                {balance.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div>
                <label className="label">Notes / Remarks</label>
                <textarea
                  className={`input h-24 ${disabledClass}`}
                  value={pvForm.notes}
                  onChange={(e) => updatePv({ notes: e.target.value })}
                  placeholder="Additional notes or comments"
                />
              </div>

              <div className="flex flex-col md:flex-row gap-2">
                <button
                  type="button"
                  className="btn-success"
                  onClick={handlePrintVoucher}
                >
                  Print Voucher
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleDownloadVoucherPdf}
                >
                  Download PDF
                </button>
                <Link to=".." className="btn-success">
                  Cancel
                </Link>
                <button
                  type="submit"
                  className="btn-success"
                  disabled={
                    loading ||
                    readOnly ||
                    !balanced ||
                    !pvForm.paymentAccountId ||
                    Number(totals.grand || 0) <= 0
                  }
                >
                  {loading ? "Saving..." : "Save Voucher"}
                </button>
              </div>
            </div>
          </div>
        </form>
        {showBillModal ? (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-[800px] max-w-[95%]">
              <div className="p-4 border-b flex justify-between items-center bg-brand text-white rounded-t-lg">
                <div className="font-semibold">
                  {billModalType === "SERVICE"
                    ? "Service Bill"
                    : "Purchase Bill"}{" "}
                  Details
                </div>
                <button
                  type="button"
                  className="text-white text-xl font-bold"
                  onClick={() => setShowBillModal(false)}
                >
                  &times;
                </button>
              </div>
              <div className="p-4">
                {billModalLoading ? (
                  <div className="text-center py-6">Loading...</div>
                ) : billModalError ? (
                  <div className="text-center text-red-600 py-6">
                    {billModalError}
                  </div>
                ) : !billModalHeader ? (
                  <div className="text-center text-slate-500 py-6">No data</div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <div>
                        <div className="label">Bill No</div>
                        <div className="input">{billModalHeader.bill_no}</div>
                      </div>
                      <div>
                        <div className="label">Date</div>
                        <div className="input">
                          {billModalHeader.bill_date || ""}
                        </div>
                      </div>
                      <div>
                        <div className="label">Status</div>
                        <div className="input">
                          {billModalHeader.status || ""}
                        </div>
                      </div>
                      <div>
                        <div className="label">Amount</div>
                        <div className="input">
                          {Number(
                            billModalHeader.total_amount ||
                              billModalHeader.net_amount ||
                              0,
                          ).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Description</th>
                            <th className="text-right w-32">Qty</th>
                            <th className="text-right w-32">Price</th>
                            <th className="text-right w-40">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {billModalDetails.length === 0 ? (
                            <tr>
                              <td
                                className="text-center text-slate-500"
                                colSpan={4}
                              >
                                No details
                              </td>
                            </tr>
                          ) : (
                            billModalDetails.map((d) => (
                              <tr key={d.id}>
                                <td>
                                  {d.item_name || d.description || ""}{" "}
                                  <span className="text-xs text-slate-500">
                                    {d.item_code || d.category || ""}
                                  </span>
                                </td>
                                <td className="text-right">
                                  {Number(
                                    d.qty || d.quantity || 0,
                                  ).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                                <td className="text-right">
                                  {Number(
                                    d.unit_price || d.rate || 0,
                                  ).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                                <td className="text-right">
                                  {Number(
                                    d.line_total || d.amount || 0,
                                  ).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
              <div className="p-3 border-t flex justify-end">
                <button
                  type="button"
                  className="btn-success"
                  onClick={() => setShowBillModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {showForwardModal ? (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-[640px] max-w-[95%]">
              <div className="p-4 border-b flex justify-between items-center bg-brand text-white rounded-t-lg">
                <div className="font-semibold">
                  Forward Payment Voucher for Approval
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowForwardModal(false);
                    setCandidateWorkflow(null);
                    setFirstApprover(null);
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
                    {voucherNoPreview || "-"}
                  </span>
                </div>
                <div className="text-sm text-slate-700">
                  Workflow:{" "}
                  <span className="font-semibold">
                    {candidateWorkflow
                      ? candidateWorkflow.workflow_name
                      : "Auto"}
                  </span>
                </div>
                <div className="text-sm text-red-600">{wfError || ""}</div>
                <div>
                  {wfLoading ? (
                    <div className="text-slate-600">Loading workflows...</div>
                  ) : firstApprover &&
                    Array.isArray(firstApprover.approvers) ? (
                    <div>
                      <label className="label">Assign To</label>
                      <select
                        className="input"
                        value={targetApproverId || ""}
                        onChange={(e) =>
                          setTargetApproverId(e.target.value || null)
                        }
                      >
                        <option value="">Select approver</option>
                        {firstApprover.approvers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.username}
                          </option>
                        ))}
                      </select>
                      <div className="text-xs text-slate-600 mt-1">
                        {firstApprover
                          ? `Step ${firstApprover.stepOrder} • ${firstApprover.stepName}${
                              firstApprover.approvalLimit != null
                                ? ` • Limit: ${Number(firstApprover.approvalLimit).toLocaleString()}`
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
                  )}
                </div>
              </div>
              <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                  onClick={() => {
                    setShowForwardModal(false);
                    setCandidateWorkflow(null);
                    setFirstApprover(null);
                    setWfError("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-700"
                  onClick={async () => {
                    if (!isEdit) return;
                    setSubmittingForward(true);
                    setWfError("");
                    try {
                      const res = await api.post(
                        `/finance/vouchers/${id}/submit`,
                        {
                          amount:
                            totals?.grand === "" || totals?.grand == null
                              ? null
                              : Number(totals?.grand || 0),
                          workflow_id: candidateWorkflow
                            ? candidateWorkflow.id
                            : null,
                          target_user_id: targetApproverId || null,
                        },
                      );
                      const newStatus = res?.data?.status || "PENDING_APPROVAL";
                      setVoucherStatus(newStatus);
                      setShowForwardModal(false);
                    } catch (e) {
                      setWfError(
                        e?.response?.data?.message ||
                          "Failed to forward for approval",
                      );
                    } finally {
                      setSubmittingForward(false);
                    }
                  }}
                  disabled={submittingForward || !isEdit}
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
  function updateCv(patch) {
    if (readOnly) return;
    setCvForm((prev) => ({ ...prev, ...patch }));
  }
  function updateCvItem(idx, patch) {
    if (readOnly) return;
    updateCv({
      items: cvForm.items.map((it, i) =>
        i === idx ? { ...it, ...patch } : it,
      ),
    });
  }
  function addCvItem() {
    if (readOnly) return;
    updateCv({
      items: [...cvForm.items, { description: "", amount: "" }],
    });
  }
  function removeCvItem(idx) {
    if (readOnly) return;
    if (cvForm.items.length <= 1) return;
    updateCv({
      items: cvForm.items.filter((_, i) => i !== idx),
    });
  }
  if (isCV) {
    return (
      <div className="space-y-4">
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg">
            <div className="flex justify-between items-center text-white">
              <div>
                <h1 className="text-2xl font-bold dark:text-brand-300">
                  {title}
                </h1>
                <p className="text-sm mt-1">Transfer funds between accounts</p>
              </div>
              <div className="flex gap-2">
                <Link to=".." className="btn-success">
                  Back
                </Link>
                <button
                  type="button"
                  className="btn-success"
                  onClick={async () => {
                    if (!isEdit) return;
                    setShowForwardModal(true);
                    setWfError("");
                    if (!workflowsCache) {
                      try {
                        setWfLoading(true);
                        const res = await api.get("/workflows");
                        const items = Array.isArray(res.data?.items)
                          ? res.data.items
                          : [];
                        setWorkflowsCache(items);
                        const amount =
                          totals?.grand === "" || totals?.grand == null
                            ? null
                            : Number(totals?.grand || 0);
                        let chosen = null;
                        const byRoute = items.filter(
                          (w) =>
                            String(w.document_route || "") ===
                            "/finance/contra-voucher",
                        );
                        const byType = items.filter((w) =>
                          ["CONTRA_VOUCHER", "Contra Voucher", "CV"].includes(
                            String(w.document_type || ""),
                          ),
                        );
                        const list = [...byRoute, ...byType];
                        for (const wf of list) {
                          if (chosen) break;
                          if (Number(wf.is_active) !== 1) continue;
                          if (amount === null) {
                            chosen = wf;
                            break;
                          }
                          const minOk =
                            wf.min_amount === null ||
                            Number(amount) >= Number(wf.min_amount);
                          const maxOk =
                            wf.max_amount === null ||
                            Number(amount) <= Number(wf.max_amount);
                          if (minOk && maxOk) {
                            chosen = wf;
                            break;
                          }
                        }
                        if (!chosen) {
                          for (const wf of byType) {
                            if (chosen) break;
                            if (Number(wf.is_active) !== 1) continue;
                            if (amount === null) {
                              chosen = wf;
                              break;
                            }
                            const minOk =
                              wf.min_amount === null ||
                              Number(amount) >= Number(wf.min_amount);
                            const maxOk =
                              wf.max_amount === null ||
                              Number(amount) <= Number(wf.max_amount);
                            if (minOk && maxOk) {
                              chosen = wf;
                              break;
                            }
                          }
                        }
                        setCandidateWorkflow(chosen);
                        setFirstApprover(null);
                        setTargetApproverId(null);
                        if (chosen) {
                          const wfDetail = await api.get(
                            `/workflows/${chosen.id}`,
                          );
                          const item = wfDetail?.data?.item || {};
                          const stepOrder = Number(
                            item.current_step_order || 1,
                          );
                          const approvers = Array.isArray(
                            item?.next_step_approvers,
                          )
                            ? item.next_step_approvers
                            : [];
                          const firstUser =
                            approvers.length > 0
                              ? Number(approvers[0].id)
                              : null;
                          setFirstApprover({
                            stepOrder: stepOrder || 1,
                            stepName: String(item.step_name || "Step 1"),
                            approvalLimit:
                              approvers.length > 0
                                ? Number(approvers[0].approval_limit || 0)
                                : null,
                            approvers,
                          });
                          setTargetApproverId(firstUser);
                        }
                      } catch (e) {
                        setWfError(
                          e?.response?.data?.message ||
                            "Failed to load workflows",
                        );
                      } finally {
                        setWfLoading(false);
                      }
                    }
                  }}
                  disabled={loading || !isEdit}
                >
                  Forward for Approval
                </button>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="card">
            <div className="card-body space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="label">Voucher Type</label>
                  <input className="input" value="Contra Voucher" disabled />
                </div>
                <div>
                  <label className="label">Voucher No</label>
                  <input
                    className="input"
                    value={voucherNoPreview || "CV-000001"}
                    disabled
                  />
                </div>
                <div>
                  <label className="label">Voucher Date *</label>
                  <input
                    className="input"
                    type="date"
                    value={voucherDate}
                    onChange={(e) => setVoucherDate(e.target.value)}
                    required
                    disabled={readOnly}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">From Account *</label>
                  <select
                    className="input"
                    value={cvForm.fromAccountId}
                    onChange={(e) =>
                      updateCv({ fromAccountId: e.target.value })
                    }
                    required
                    disabled={readOnly}
                  >
                    <option value="">Select account</option>
                    {cvSelectableAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2">
                    <label className="label">Currency</label>
                    <input
                      className="input bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700 font-semibold"
                      value={cvFromCurrencyCode || ""}
                      readOnly
                    />
                  </div>
                </div>
                <div>
                  <label className="label">To Account *</label>
                  <select
                    className="input"
                    value={cvForm.toAccountId}
                    onChange={(e) => updateCv({ toAccountId: e.target.value })}
                    required
                    disabled={readOnly}
                  >
                    <option value="">Select account</option>
                    {cvSelectableAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2">
                    <label className="label">Currency</label>
                    <input
                      className="input bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700 font-semibold"
                      value={cvToCurrencyCode || ""}
                      readOnly
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Transfer Method</label>
                  <select
                    className="input"
                    value={cvForm.transferMethod}
                    onChange={(e) =>
                      updateCv({ transferMethod: e.target.value })
                    }
                    disabled={readOnly}
                  >
                    <option>Cash</option>
                    <option>Cheque</option>
                    <option>Bank Transfer</option>
                  </select>
                </div>
                {cvHasBankAccount ? (
                  <div className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Reference / Cheque No</label>
                        <input
                          className="input"
                          value={cvForm.reference}
                          onChange={(e) =>
                            updateCv({ reference: e.target.value })
                          }
                          placeholder="Reference Number or Cheque Number"
                          disabled={readOnly}
                        />
                      </div>
                      <div>
                        <label className="label">Cheque Date</label>
                        <input
                          className="input"
                          type="date"
                          value={cvForm.chequeDate || ""}
                          onChange={(e) =>
                            updateCv({ chequeDate: e.target.value })
                          }
                          disabled={readOnly}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="label">Reference / Instrument No</label>
                    <input
                      className="input"
                      value={cvForm.reference}
                      onChange={(e) => updateCv({ reference: e.target.value })}
                      placeholder="Reference Number"
                      disabled={readOnly}
                    />
                  </div>
                )}
                <div>
                  <label className="label">Exchange Rate</label>
                  <input
                    className="input bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700 font-semibold"
                    value={cvExchangeRate || ""}
                    readOnly
                  />
                </div>
                <div>
                  <label className="label">Tax Code</label>
                  <select
                    className="input"
                    value={cvForm.taxCodeId}
                    onChange={(e) => updateCv({ taxCodeId: e.target.value })}
                    disabled={readOnly}
                  >
                    <option value="">None</option>
                    {taxCodes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <div className="flex justify-between items-center mb-3">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    Transfer Details
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="w-10">#</th>
                        <th className="w-64">Description</th>
                        <th className="text-right w-40">Amount to Transfer</th>
                        <th className="w-24 hidden" />
                      </tr>
                    </thead>
                    <tbody>
                      {cvForm.items.length === 0 ? (
                        <tr>
                          <td className="text-center p-2" colSpan={4}>
                            No items
                          </td>
                        </tr>
                      ) : (
                        cvForm.items.map((it, idx) => (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td>
                              <input
                                className="input"
                                value={it.description}
                                onChange={(e) =>
                                  updateCvItem(idx, {
                                    description: e.target.value,
                                  })
                                }
                                placeholder="Description"
                                disabled={readOnly}
                              />
                            </td>
                            <td>
                              <input
                                className="input text-right"
                                type="number"
                                min="0"
                                step="1"
                                value={it.amount}
                                onChange={(e) =>
                                  updateCvItem(idx, {
                                    amount: Number(e.target.value || 0),
                                  })
                                }
                                onFocus={() => {
                                  if (Number(it.amount || 0) === 0) {
                                    updateCvItem(idx, { amount: "" });
                                  }
                                }}
                                disabled={readOnly}
                              />
                            </td>
                            <td className="hidden" />
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-semibold">
                        {Number(totals.subtotal || 0).toLocaleString(
                          undefined,
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          },
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <div className="flex items-center gap-2">
                        <span>
                          Tax (
                          {Number(
                            taxCodes.find(
                              (t) => String(t.id) === String(cvForm.taxCodeId),
                            )?.rate_percent || 0,
                          )}
                          %)
                        </span>
                      </div>
                      <span className="font-semibold">
                        {Number(totals.tax || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold">TOTAL AMOUNT</span>
                      <span className="font-bold">
                        {Number(totals.grand || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="label">Amount in Words</label>
                      <textarea
                        className="input h-20"
                        value={numberToWords(Number(totals.grand || 0))}
                        readOnly
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Notes / Remarks</label>
                <textarea
                  className="input h-24"
                  value={cvForm.notes}
                  onChange={(e) => updateCv({ notes: e.target.value })}
                  placeholder="Additional notes or comments"
                />
              </div>

              <div className="flex flex-col md:flex-row gap-2">
                <button
                  type="button"
                  className="btn-success"
                  onClick={handlePrintVoucher}
                >
                  Print Voucher
                </button>
                <Link to=".." className="btn-success">
                  Cancel
                </Link>
                <button
                  type="submit"
                  className="btn-success"
                  disabled={
                    loading ||
                    readOnly ||
                    !balanced ||
                    !cvForm.fromAccountId ||
                    !cvForm.toAccountId ||
                    Number(totals.grand || 0) <= 0
                  }
                >
                  {loading ? "Saving..." : "Save Voucher"}
                </button>
              </div>
            </div>
          </div>
        </form>
        {showForwardModal ? (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-[640px] max-w-[95%]">
              <div className="p-4 border-b flex justify-between items-center bg-brand text-white rounded-t-lg">
                <div className="font-semibold">
                  Forward Contra Voucher for Approval
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowForwardModal(false);
                    setCandidateWorkflow(null);
                    setFirstApprover(null);
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
                    {voucherNoPreview || "-"}
                  </span>
                </div>
                <div className="text-sm text-slate-700">
                  Workflow:{" "}
                  <span className="font-semibold">
                    {candidateWorkflow
                      ? candidateWorkflow.workflow_name
                      : "Auto"}
                  </span>
                </div>
                <div className="text-sm text-red-600">{wfError || ""}</div>
                <div>
                  {wfLoading ? (
                    <div className="text-slate-600">Loading workflows...</div>
                  ) : firstApprover &&
                    Array.isArray(firstApprover.approvers) ? (
                    <div>
                      <label className="label">Assign To</label>
                      <select
                        className="input"
                        value={targetApproverId || ""}
                        onChange={(e) =>
                          setTargetApproverId(e.target.value || null)
                        }
                      >
                        <option value="">Select approver</option>
                        {firstApprover.approvers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.username}
                          </option>
                        ))}
                      </select>
                      <div className="text-xs text-slate-600 mt-1">
                        {firstApprover
                          ? `Step ${firstApprover.stepOrder} • ${firstApprover.stepName}${
                              firstApprover.approvalLimit != null
                                ? ` • Limit: ${Number(firstApprover.approvalLimit).toLocaleString()}`
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
                  )}
                </div>
              </div>
              <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                  onClick={() => {
                    setShowForwardModal(false);
                    setCandidateWorkflow(null);
                    setFirstApprover(null);
                    setWfError("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-700"
                  onClick={async () => {
                    if (!isEdit) return;
                    setSubmittingForward(true);
                    setWfError("");
                    try {
                      const res = await api.post(
                        `/finance/vouchers/${id}/submit`,
                        {
                          amount:
                            totals?.grand === "" || totals?.grand == null
                              ? null
                              : Number(totals?.grand || 0),
                          workflow_id: candidateWorkflow
                            ? candidateWorkflow.id
                            : null,
                          target_user_id: targetApproverId || null,
                        },
                      );
                      const newStatus = res?.data?.status || "PENDING_APPROVAL";
                      setVoucherStatus(newStatus);
                      setShowForwardModal(false);
                    } catch (e) {
                      setWfError(
                        e?.response?.data?.message ||
                          "Failed to forward for approval",
                      );
                    } finally {
                      setSubmittingForward(false);
                    }
                  }}
                  disabled={submittingForward || !isEdit}
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
}
