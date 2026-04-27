import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "api/client";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";
import { toast } from "react-toastify";

export default function ShippingAdviceList() {
  const [searchTerm, setSearchTerm] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const { canPerformAction, ensurePagePerms, hasExceptional } = usePermission();
  const [exceptionalAllowed, setExceptionalAllowed] = useState(false);
  const [cancelDenied, setCancelDenied] = useState(false);

  useEffect(() => {
    try {
      const path =
        (typeof window !== "undefined" &&
          window.location &&
          window.location.pathname) ||
        "/purchase/shipping-advice";
      ensurePagePerms && ensurePagePerms(path);
    } catch {}
  }, [ensurePagePerms]);

  useEffect(() => {
    let cancelled = false;
    async function checkExceptional() {
      try {
        const me = await api.get("/admin/me");
        const uid = Number(me?.data?.user?.id || me?.data?.user?.sub || 0);
        if (!uid || cancelled) return;
        const resp = await api.get(
          `/admin/users/${uid}/exceptional-permissions`,
        );
        const items = Array.isArray(resp?.data?.data?.items)
          ? resp.data.data.items
          : Array.isArray(resp?.data?.items)
            ? resp.data.items
            : [];
        let allowed = items.some((p) => {
          const effect = String(p.effect || "").toUpperCase();
          const active = Number(p.is_active || p.isActive) === 1;
          const code = String(
            p.permission_code || p.permissionCode || "",
          ).toUpperCase();
          const codeOk = code === "PURCHASE.SHIPPING_ADVICE.CANCEL";
          return effect === "ALLOW" && active && codeOk;
        });
        const denied = items.some((p) => {
          const effect = String(p.effect || "").toUpperCase();
          const active = Number(p.is_active || p.isActive) === 1;
          const code = String(
            p.permission_code || p.permissionCode || "",
          ).toUpperCase();
          return (
            effect === "DENY" &&
            active &&
            code === "PURCHASE.SHIPPING_ADVICE.CANCEL"
          );
        });
        if (!allowed) {
          allowed = items.some((p) => {
            const effect = String(p.effect || "").toUpperCase();
            const active = Number(p.is_active || p.isActive) === 1;
            return effect === "ALLOW" && active;
          });
        }
        if (!cancelled) setExceptionalAllowed(allowed);
        if (!cancelled) setCancelDenied(denied);
      } catch {
        if (!cancelled) setExceptionalAllowed(false);
        if (!cancelled) setCancelDenied(false);
      }
    }
    checkExceptional();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get("/purchase/shipping-advices")
      .then((res) => {
        if (!mounted) return;
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Failed to load shipping advice",
        );
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const getStatusBadge = (status) => {
    const badges = {
      DRAFT: "badge-info",
      IN_TRANSIT: "badge-warning",
      ARRIVED: "badge-success",
      CLEARED: "badge-success",
      CANCELLED: "badge-error",
    };
    return badges[status] || "badge-info";
  };

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return items.slice();
    return filterAndSort(items, {
      query: searchTerm,
      getKeys: (r) => [r.advice_no, r.po_no, r.bill_of_lading],
    });
  }, [items, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Shipping Advice
          </h1>
          <p className="text-sm mt-1">Track shipments and vessel information</p>
        </div>
        <div className="flex gap-2">
          <Link to="/purchase" className="btn btn-secondary">
            Return to Menu
          </Link>
          <Link to="/purchase/shipping-advice/new" className="btn-success">
            + New Shipping Advice
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by advice no / PO / vessel..."
                className="input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card-body overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Advice No</th>
                <th>Date</th>
                <th>PO</th>
                <th>Supplier</th>
                <th>ETD</th>
                <th>ETA</th>
                <th>Status</th>
                <th>Actions</th>
                            <th>Created By</th>
              <th>Created Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="8"
                    className="text-center py-8 text-slate-500 dark:text-slate-400"
                  >
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-red-600">
                    {error}
                  </td>
                </tr>
              ) : null}

              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan="8"
                    className="text-center py-8 text-slate-500 dark:text-slate-400"
                  >
                    No records
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.advice_no}</td>
                    <td>
                      {r.advice_date
                        ? new Date(r.advice_date).toLocaleDateString()
                        : ""}
                    </td>
                    <td>{r.po_no}</td>
                    <td>{r.supplier_name}</td>
                    <td>
                      {r.etd_date
                        ? new Date(r.etd_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>
                      {r.eta_date
                        ? new Date(r.eta_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <Link
                        to={`/purchase/shipping-advice/${r.id}?mode=view`}
                        className="text-brand hover:text-brand-600 dark:text-brand-300 dark:hover:text-brand-200 text-sm font-medium"
                      >
                        View
                      </Link>
                      <Link
                        to={`/purchase/shipping-advice/${r.id}?mode=edit`}
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium ml-2"
                      >
                        Edit
                      </Link>
                      {hasExceptional("PURCHASE.SHIPPING_ADVICE.CANCEL") &&
                      !r.has_clearing ? (
                        <button
                          type="button"
                          className="inline-flex items-center px-3 py-1.5 rounded bg-[#A30000] hover:bg-[#7B0000] text-white text-xs font-semibold ml-2"
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Cancel this Shipping Advice (${r.advice_no})?`,
                              )
                            )
                              return;
                            try {
                              await api.delete(
                                `/purchase/shipping-advices/${r.id}`,
                              );
                              toast.success("Shipping advice cancelled");
                              setItems((prev) =>
                                prev.filter((x) => x.id !== r.id),
                              );
                            } catch (e) {
                              toast.error(
                                e?.response?.data?.message ||
                                  "Unable to cancel shipping advice",
                              );
                            }
                          }}
                        >
                          Cancel
                        </button>
                      ) : null}
                    </td>
                    <td>{r.created_by_name || "-"}</td>
                    <td>{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
