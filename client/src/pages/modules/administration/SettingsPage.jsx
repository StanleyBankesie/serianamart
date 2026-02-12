import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";

export default function SettingsPage() {
  const [pushEnabled, setPushEnabled] = useState(() => {
    try {
      const raw = localStorage.getItem("push_enabled");
      if (raw === null) return true;
      return String(raw) === "1";
    } catch {
      return true;
    }
  });
  const [permissionStatus, setPermissionStatus] = useState(() => {
    try {
      if (typeof window !== "undefined" && "Notification" in window) {
        return String(window.Notification.permission || "default");
      }
    } catch {}
    return "default";
  });
  const [companyInfo, setCompanyInfo] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    phone: "",
    email: "",
    website: "",
    taxId: "",
    registrationNo: "",
    logoUrl: "",
    logoVersion: 0,
  });
  const [companyLogoDataUrl, setCompanyLogoDataUrl] = useState("");
  const [companyLogoObjectUrl, setCompanyLogoObjectUrl] = useState("");
  const logoObjectUrlRef = useRef(null);

  function setLogoObjectUrl(nextUrl) {
    try {
      const prev = logoObjectUrlRef.current;
      if (prev && prev !== nextUrl) URL.revokeObjectURL(prev);
    } catch {}
    logoObjectUrlRef.current = nextUrl || null;
    setCompanyLogoObjectUrl(String(nextUrl || ""));
  }

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && "Notification" in window) {
        setPermissionStatus(
          String(window.Notification.permission || "default"),
        );
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("push_enabled", pushEnabled ? "1" : "0");
    } catch {}
  }, [pushEnabled]);
  async function requestPushPermission() {
    try {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      const res = await window.Notification.requestPermission();
      setPermissionStatus(String(res || "default"));
      toast[res === "granted" ? "success" : "info"](
        res === "granted"
          ? "Notifications enabled"
          : "Notifications permission denied or dismissed",
      );
    } catch {}
  }
  async function subscribePushNow() {
    try {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator)) return;
      if (!("PushManager" in window)) return;
      if (!("Notification" in window)) return;
      if (window.Notification.permission !== "granted") {
        toast.info("Grant notification permission first");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const res = await api.get("/push/public-key");
      const publicKey = String(res.data?.publicKey || "");
      if (!publicKey) {
        toast.error("Missing VAPID public key");
        return;
      }
      function urlBase64ToUint8Array(base64String) {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding)
          .replace(/-/g, "+")
          .replace(/_/g, "/");
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      }
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      const existing = await reg.pushManager.getSubscription();
      if (existing && existing.endpoint) {
        await api.post("/push/subscribe", { subscription: existing.toJSON() });
        toast.success("Push subscription saved");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      await api.post("/push/subscribe", { subscription: sub.toJSON() });
      toast.success("Subscribed to push notifications");
    } catch {
      toast.error("Failed to subscribe");
    }
  }
  async function unsubscribePushNow() {
    try {
      if (typeof window === "undefined" || !("serviceWorker" in navigator))
        return;
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing && existing.endpoint) {
        try {
          await api.delete("/push/unsubscribe", {
            data: { subscription: existing.toJSON() },
          });
        } catch {}
        try {
          await existing.unsubscribe();
        } catch {}
        toast.success("Unsubscribed");
      } else {
        toast.info("No active subscription");
      }
    } catch {
      toast.error("Failed to unsubscribe");
    }
  }
  useEffect(() => {
    let mounted = true;
    async function loadCompany() {
      try {
        const meResp = await api.get("/admin/me");
        const companyId = meResp.data?.scope?.companyId;
        if (!companyId) return;
        const cResp = await api.get(`/admin/companies/${companyId}`);
        const item = cResp.data?.item || {};
        let logoUrl =
          item.has_logo === 1 || item.has_logo === true
            ? `/api/admin/companies/${companyId}/logo`
            : "";
        if (!mounted) return;
        setCompanyInfo({
          name: item.name || "",
          address: item.address || "",
          city: item.city || "",
          state: item.state || "",
          postalCode: item.postal_code || "",
          country: item.country || "",
          phone: item.telephone || "",
          email: item.email || "",
          website: item.website || "",
          taxId: item.tax_id || "",
          registrationNo: item.registration_no || "",
          logoUrl,
          logoVersion: Date.now(),
        });
      } catch {}
    }
    loadCompany();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    function onCompanyUpdated(e) {
      const d = e?.detail || {};
      setCompanyInfo((prev) => ({
        ...prev,
        ...d,
        logoVersion: d.logoVersion || Date.now(),
      }));
      try {
        if (d.logoDataUrl) {
          setCompanyLogoDataUrl(String(d.logoDataUrl));
        }
        if (d.logoObjectUrl) {
          setLogoObjectUrl(String(d.logoObjectUrl));
        }
      } catch {}
    }
    window.addEventListener("company_info_updated", onCompanyUpdated);
    return () =>
      window.removeEventListener("company_info_updated", onCompanyUpdated);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadLogoDataUrl() {
      try {
        const baseUrl = String(companyInfo.logoUrl || "").trim();
        if (!baseUrl) {
          setCompanyLogoDataUrl("");
          setLogoObjectUrl("");
          return;
        }
        const v = companyInfo.logoVersion || Date.now();
        const url = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}v=${encodeURIComponent(
          String(v),
        )}`;
        const resp = await fetch(url, { credentials: "include" });
        if (!resp.ok) {
          setCompanyLogoDataUrl("");
          setLogoObjectUrl("");
          return;
        }
        const blob = await resp.blob();
        if (!active) return;
        const objUrl = URL.createObjectURL(blob);
        setLogoObjectUrl(objUrl);
        setCompanyLogoDataUrl("");
      } catch {
        setCompanyLogoDataUrl("");
        setLogoObjectUrl("");
      }
    }
    loadLogoDataUrl();
    return () => {
      active = false;
    };
  }, [companyInfo.logoUrl, companyInfo.logoVersion]);

  useEffect(() => {
    return () => {
      try {
        const prev = logoObjectUrlRef.current;
        if (prev) URL.revokeObjectURL(prev);
      } catch {}
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-body space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-lg font-semibold">Push Notifications</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Permission: {permissionStatus}
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm">Enabled</span>
              <input
                type="checkbox"
                className="toggle"
                checked={pushEnabled}
                onChange={(e) => setPushEnabled(e.target.checked)}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={requestPushPermission}
            >
              Request Permission
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={subscribePushNow}
              disabled={!pushEnabled}
            >
              Subscribe Now
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={unsubscribePushNow}
            >
              Unsubscribe
            </button>
          </div>
          <div className="text-xs text-slate-500">
            When enabled, the app registers for push after login and delivers
            background alerts.
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Administration Settings
              </h1>
              <p className="text-sm mt-1">Notifications and document setup</p>
            </div>
            <div className="flex gap-2">
              <Link to="/administration" className="btn btn-secondary">
                Return to Menu
              </Link>
            </div>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-body space-y-3">
          <div className="text-lg font-semibold">Document Templates</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Manage print and PDF templates for Sales Order, Invoice, and more.
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Link
              to="/administration/settings/templates?type=sales-order"
              className="btn-outline"
            >
              Sales Order
            </Link>
            <Link
              to="/administration/settings/templates?type=invoice"
              className="btn-outline"
            >
              Invoice
            </Link>
            <Link
              to="/administration/settings/templates?type=delivery-note"
              className="btn-outline"
            >
              Delivery Note
            </Link>
            <Link
              to="/administration/settings/templates?type=payment-voucher"
              className="btn-outline"
            >
              Payment Voucher
            </Link>
            <Link
              to="/administration/settings/templates?type=salary-slip"
              className="btn-outline"
            >
              Salary Slip
            </Link>
            <Link
              to="/administration/settings/templates?type=receipt-voucher"
              className="btn-outline"
            >
              Receipt Voucher
            </Link>
            <Link
              to="/administration/settings/templates?type=quotation"
              className="btn-outline"
            >
              Quotation
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompanyBrandingEditor({ setLogoObjectUrl, setCompanyInfo }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    phone: "",
    email: "",
    website: "",
    logoUrl: "",
    logoVersion: 0,
  });
  const [companyId, setCompanyId] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const me = await api.get("/admin/me");
        const cid = me.data?.scope?.companyId || null;
        if (!cid) return;
        setCompanyId(cid);
        const cResp = await api.get(`/admin/companies/${cid}`);
        const item = cResp.data?.item || {};
        const logoUrl =
          item.has_logo === 1 || item.has_logo === true
            ? `/api/admin/companies/${cid}/logo`
            : "";
        if (!mounted) return;
        setInfo({
          name: item.name || "",
          address: item.address || "",
          city: item.city || "",
          state: item.state || "",
          postalCode: item.postal_code || "",
          country: item.country || "",
          phone: item.telephone || "",
          email: item.email || "",
          website: item.website || "",
          logoUrl,
        });
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function uploadLogo(file) {
    if (!file || !companyId) return;
    try {
      setSaving(true);
      setError("");

      const objUrl = URL.createObjectURL(file);
      setLogoObjectUrl(objUrl);
      setInfo((p) => ({ ...p, logoUrl: objUrl, logoVersion: Date.now() }));

      // Upload to server
      const fd = new FormData();
      fd.append("logo", file);
      const resp = await api.post(`/admin/companies/${companyId}/logo`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Fetch the logo back from server with cache-busting
      const timestamp = new Date().getTime();
      const logoResp = await api.get(
        `/admin/companies/${companyId}/logo?t=${timestamp}`,
        {
          responseType: "blob",
        },
      );

      if (logoResp.data && logoResp.data.size > 0) {
        const serverUrl = URL.createObjectURL(logoResp.data);
        setLogoObjectUrl(serverUrl);

        const version = Date.now();
        const serverLogoUrl = `/api/admin/companies/${companyId}/logo?v=${encodeURIComponent(String(version))}`;
        setInfo((p) => ({
          ...p,
          logoUrl: serverLogoUrl,
          logoVersion: version,
        }));

        // Update parent component
        if (setCompanyInfo) {
          setCompanyInfo((p) => ({
            ...p,
            logoUrl: serverLogoUrl,
            logoVersion: version,
          }));
        }

        toast.success("Logo uploaded successfully");
      } else {
        throw new Error("Logo upload failed: empty response");
      }
    } catch (e) {
      console.error("Logo upload error:", e);
      setError(e?.response?.data?.message || e?.message || "Failed to upload");
      toast.error("Failed to upload logo");
    } finally {
      setSaving(false);
    }
  }

  async function saveInfo() {
    try {
      setSaving(true);
      setError("");
      if (companyId) {
        await api.put(`/admin/companies/${companyId}`, {
          name: info.name || null,
          address: info.address || null,
          city: info.city || null,
          state: info.state || null,
          postal_code: info.postalCode || null,
          country: info.country || null,
          telephone: info.phone || null,
          email: info.email || null,
          website: info.website || null,
        });
        toast.success("Company information saved");
      } else {
        toast.success("Company information updated");
      }

      // Update parent component
      if (setCompanyInfo) {
        setCompanyInfo((p) => ({
          ...p,
          name: info.name,
          address: info.address,
          city: info.city,
          state: info.state,
          postalCode: info.postalCode,
          country: info.country,
          phone: info.phone,
          email: info.email,
          website: info.website,
          logoUrl: info.logoUrl,
          logoVersion: info.logoVersion || Date.now(),
        }));
      }

      try {
        window.dispatchEvent(
          new CustomEvent("company_info_updated", {
            detail: {
              name: info.name,
              address: info.address,
              city: info.city,
              state: info.state,
              postalCode: info.postalCode,
              country: info.country,
              phone: info.phone,
              email: info.email,
              website: info.website,
              logoUrl: info.logoUrl,
              logoVersion: info.logoVersion || Date.now(),
            },
          }),
        );
      } catch {}
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Failed to save");
      toast.error("Failed to save company information");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-700">Name</label>
          <input
            className="input"
            value={info.name}
            onChange={(e) => setInfo((p) => ({ ...p, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700">Phone</label>
          <input
            className="input"
            value={info.phone}
            onChange={(e) => setInfo((p) => ({ ...p, phone: e.target.value }))}
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium text-slate-700">Address</label>
          <input
            className="input"
            value={info.address}
            onChange={(e) =>
              setInfo((p) => ({ ...p, address: e.target.value }))
            }
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700">City</label>
          <input
            className="input"
            value={info.city}
            onChange={(e) => setInfo((p) => ({ ...p, city: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700">State</label>
          <input
            className="input"
            value={info.state}
            onChange={(e) => setInfo((p) => ({ ...p, state: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700">Country</label>
          <input
            className="input"
            value={info.country}
            onChange={(e) =>
              setInfo((p) => ({ ...p, country: e.target.value }))
            }
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700">
            Postal Code
          </label>
          <input
            className="input"
            value={info.postalCode}
            onChange={(e) =>
              setInfo((p) => ({ ...p, postalCode: e.target.value }))
            }
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700">Email</label>
          <input
            className="input"
            value={info.email}
            onChange={(e) => setInfo((p) => ({ ...p, email: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700">Website</label>
          <input
            className="input"
            value={info.website}
            onChange={(e) =>
              setInfo((p) => ({ ...p, website: e.target.value }))
            }
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium text-slate-700">Logo</label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => uploadLogo(e.target.files?.[0])}
                disabled={saving}
              />
            </div>
            {info.logoUrl ? (
              <div className="flex-shrink-0 border rounded p-1">
                <img
                  src={`${info.logoUrl}${
                    info.logoUrl.includes("?") ? "&" : "?"
                  }v=${encodeURIComponent(String(info.logoVersion || 0))}`}
                  alt="Logo"
                  className="h-12 w-12 object-contain"
                  key={String(info.logoVersion || 0)}
                  onError={(e) => {
                    console.error("Logo image failed to load:", e);
                    e.target.src = "";
                  }}
                />
              </div>
            ) : (
              <div className="flex-shrink-0 border rounded p-1 bg-gray-100 h-12 w-12 flex items-center justify-center text-xs text-gray-500">
                No logo
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-primary"
          onClick={saveInfo}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Company Info"}
        </button>
      </div>
    </div>
  );
}
