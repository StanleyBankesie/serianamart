import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "api/client";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";
import { toast } from "react-toastify";

export default function PortClearancesList() {
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
        "/purchase/port-clearances";
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
          const codeOk = code === "PURCHASE.CLEARING_AT_PORT.CANCEL";
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
            code === "PURCHASE.CLEARING_AT_PORT.CANCEL"
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
      .get("/purchase/port-clearances")
      .then((res) => {
        if (!mounted) return;
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Failed to load port clearances",
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
      PENDING: "badge-warning",
      CLEARED: "badge-success",
      CANCELLED: "badge-error",
    };
    return badges[status] || "badge-info";
  };

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return items.slice();
    return filterAndSort(items, {
      query: searchTerm,
      getKeys: (r) => [r.clearance_no, r.advice_no],
    });
  }, [items, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Clearing at Port
          </h1>
          <p className="text-sm mt-1">Manage customs and port clearances</p>
        </div>
        <div className="flex gap-2">
          <Link to="/purchase" className="btn btn-secondary">
            Return to Menu
          </Link>
          <Link to="/purchase/port-clearances/new" className="btn-success">
            + New Clearance
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by clearance no / shipping advice..."
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
                <th>Clearance No</th>
                <th>Date</th>
                <th>PO</th>
                <th>Supplier</th>
                <th>Clearing Agent</th>
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
                    colSpan="7"
                    className="text-center py-8 text-slate-500 dark:text-slate-400"
                  >
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-red-600">
                    {error}
                  </td>
                </tr>
              ) : null}

              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="text-center py-8 text-slate-500 dark:text-slate-400"
                  >
                    No records
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.clearance_no}</td>
                    <td>
                      {r.clearance_date
                        ? new Date(r.clearance_date).toLocaleDateString()
                        : ""}
                    </td>
                    <td>{r.po_no || ""}</td>
                    <td>{r.supplier_name || ""}</td>
                    <td>{r.clearing_agent || ""}</td>
                    <td>
                      <span className={`badge ${getStatusBadge(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <Link
                        to={`/purchase/port-clearances/${r.id}?mode=view`}
                        className="text-brand hover:text-brand-600 dark:text-brand-300 dark:hover:text-brand-200 text-sm font-medium"
                      >
                        View
                      </Link>
                      <Link
                        to={`/purchase/port-clearances/${r.id}?mode=edit`}
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium ml-2"
                      >
                        Edit
                      </Link>
                      {hasExceptional("PURCHASE.CLEARING_AT_PORT.CANCEL") &&
                      !r.has_grn ? (
                        <button
                          type="button"
                          className="inline-flex items-center px-3 py-1.5 rounded bg-[#A30000] hover:bg-[#7B0000] text-white text-xs font-semibold ml-2"
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Cancel this Port Clearance (${r.clearance_no})?`,
                              )
                            )
                              return;
                            try {
                              await api.delete(
                                `/purchase/port-clearances/${r.id}`,
                              );
                              toast.success("Port clearance cancelled");
                              setItems((prev) =>
                                prev.filter((x) => x.id !== r.id),
                              );
                            } catch (e) {
                              toast.error(
                                e?.response?.data?.message ||
                                  "Unable to cancel port clearance",
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
