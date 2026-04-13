import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function UserOverrides() {
  const navigate = useNavigate();
  const STANDARD_EXCEPTIONS = [
    { code: "SALES.DISCOUNT.ALLOW", label: "Permission to give discount" },
    { code: "WORKFLOW.APPROVAL.REVERSE", label: "Reversal of approval" },
    { code: "SALES.ORDER.CANCEL", label: "Sales Order Cancellations" },
    { code: "SALES.QUOTATION.CANCEL", label: "Sales Quotation Cancellation" },
    { code: "PURCHASE.ORDER.CANCEL", label: "Purchase Order Cancellations" },
    { code: "SALES.INVOICE.CANCEL", label: "Invoice Cancellations" },
    { code: "PURCHASE.GRN.REVERSE", label: "GRN Reversal" },
    { code: "PURCHASE.BILL.CANCEL", label: "Purchase Bill Cancellation" },
    {
      code: "PURCHASE.SHIPPING_ADVICE.CANCEL",
      label: "Cancel Shipping Advice",
    },
    {
      code: "PURCHASE.CLEARING_AT_PORT.CANCEL",
      label: "Cancel Clearing at Port",
    },
    {
      code: "INVENTORY.MATERIAL_REQUISITION.CANCEL",
      label: "Material Requisition Cancellations",
    },
    {
      code: "PURCHASE.GENERAL_REQUISITION.CANCEL",
      label: "General Requisition Cancellations",
    },
  ];
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [role, setRole] = useState(null);
  const [roleModules, setRoleModules] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({});
  const [overrides, setOverrides] = useState({});
  const [exPerms, setExPerms] = useState({});
  const [exSaving, setExSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await api.get("/admin/users");
        const items = res?.data?.data?.items || res?.data?.items || [];
        setUsers(items);
      } catch {}
    }
    loadUsers();
  }, []);

  async function loadContext(userId) {
    setSelectedUser(userId);
    setLoading(true);
    setError("");
    try {
      const userRes = await api.get(`/admin/users/${userId}`);
      const u = userRes?.data?.data?.item || userRes?.data?.item || null;
      setRole(u && u.role ? u.role : null);

      const roleId = Number(u?.role_id || u?.role?.id || 0);
      if (roleId) {
        try {
          const modsRes = await api
            .get(`/access/roles/${roleId}/modules`)
            .catch(() => ({ data: { modules: [] } }));
          const permsRes = await api
            .get(`/access/roles/${roleId}/permissions`)
            .catch(() => ({ data: { permissions: [] } }));
          const mods = modsRes?.data?.modules || [];
          setRoleModules(mods);
          const permList = permsRes?.data?.permissions || [];
          const byModule = {};
          for (const p of permList) {
            byModule[p.module_key] = {
              can_view: !!p.can_view,
              can_create: !!p.can_create,
              can_edit: !!p.can_edit,
              can_delete: !!p.can_delete,
            };
          }
          setRolePermissions(byModule);
        } catch {}
      } else {
        setRoleModules([]);
        setRolePermissions({});
      }
      try {
        const oRes = await api
          .get(`/access/users/${userId}/overrides`)
          .catch(() => ({ data: { overrides: [] } }));
        const oList = oRes?.data?.overrides || [];
        const byModuleOverride = {};
        for (const o of oList) {
          byModuleOverride[o.module_key] = {
            can_view: o.can_view,
            can_create: o.can_create,
            can_edit: o.can_edit,
            can_delete: o.can_delete,
          };
        }
        setOverrides(byModuleOverride);
      } catch {}
      // Load exceptional permissions for user
      try {
        const exRes = await api.get(
          `/admin/users/${userId}/exceptional-permissions`,
        );
        const items = Array.isArray(exRes?.data?.data?.items)
          ? exRes.data.data.items
          : Array.isArray(exRes?.data?.items)
            ? exRes.data.items
            : [];
        const map = {};
        for (const { permission_code, effect, is_active } of items) {
          const code = String(permission_code || "").toUpperCase();
          const active = Number(is_active) === 1;
          const allow = String(effect || "ALLOW").toUpperCase() === "ALLOW";
          map[code] = active && allow;
        }
        const init = {};
        for (const def of STANDARD_EXCEPTIONS) {
          init[def.code] = !!map[def.code];
        }
        setExPerms(init);
      } catch {}
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Failed to load user context. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function display(val) {
    if (val == null) return "—";
    return val ? "Yes" : "No";
  }

  function toggleOverride(mk, key) {
    setOverrides((prev) => {
      const next = { ...prev };
      const row = next[mk] || {
        can_view: null,
        can_create: null,
        can_edit: null,
        can_delete: null,
      };
      const current = row[key];
      row[key] = current == null ? true : current ? false : null;
      next[mk] = row;
      return next;
    });
  }

  async function saveOverrides() {
    try {
      const payload = roleModules.map((mk) => ({
        module_key: mk,
        can_view: overrides[mk]?.can_view ?? null,
        can_create: overrides[mk]?.can_create ?? null,
        can_edit: overrides[mk]?.can_edit ?? null,
        can_delete: overrides[mk]?.can_delete ?? null,
      }));
      await api.put(`/access/users/${selectedUser}/overrides`, {
        overrides: payload,
      });
      alert("Saved");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save");
    }
  }

  function toggleExceptional(code) {
    const k = String(code || "");
    if (!k) return;
    setExPerms((prev) => ({ ...prev, [k]: !prev[k] }));
  }

  async function saveExceptional() {
    if (!selectedUser) return;
    try {
      setExSaving(true);
      const permissions = STANDARD_EXCEPTIONS.map((e) => ({
        permission_code: e.code,
        effect: exPerms[e.code] ? "ALLOW" : "DENY",
        is_active: 1,
        exception_type: "STANDARD",
      }));
      await api.put(`/admin/users/${selectedUser}/exceptional-permissions`, {
        permissions,
      });
      toast.success("Exceptional permissions saved");
      navigate("/administration/exceptional-permissions", {
        state: {
          afterSave: {
            entity: "exceptional-permissions",
            id: Number(selectedUser) || null,
            ts: Date.now(),
          },
        },
        replace: true,
      });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Failed to save exceptional permissions",
      );
    } finally {
      setExSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Overrides</h1>
          <p className="text-sm text-slate-600">
            Set exceptional overrides per user
          </p>
        </div>
        <a href="/administration" className="btn btn-secondary">
          Back to Menu
        </a>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="card">
        <div className="card-body space-y-4">
          <div>
            <label className="label">Select User</label>
            <select
              className="input"
              value={selectedUser || ""}
              onChange={(e) => loadContext(Number(e.target.value))}
            >
              <option value="">Choose user</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} ({u.email})
                </option>
              ))}
            </select>
          </div>
          {selectedUser ? (
            <div className="space-y-3 border rounded p-3">
              <div className="text-sm font-semibold">
                ERP Standard Exceptional Permissions
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {STANDARD_EXCEPTIONS.map((e) => (
                  <label
                    key={e.code}
                    className="flex items-center gap-2 p-2 border rounded hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={!!exPerms[e.code]}
                      onChange={() => toggleExceptional(e.code)}
                      disabled={exSaving}
                    />
                    <span>{e.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  className="btn btn-success"
                  onClick={saveExceptional}
                  disabled={exSaving}
                >
                  {exSaving ? "Saving..." : "Save Exceptional Permissions"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
