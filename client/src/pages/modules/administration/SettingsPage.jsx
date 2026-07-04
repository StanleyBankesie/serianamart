/**
 * @fileoverview SettingsPage component.
 * Provides functionality for SettingsPage.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";

const TABS = [
  { key: "general", label: "General" },
  { key: "notifications", label: "Notifications" },
  { key: "templates", label: "Templates" },
  { key: "departments", label: "Departments" },
  { key: "backups", label: "Backups" },
];

function BackupsSection() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    s3: { bucket: "", region: "", endpoint: "", access_key: "", secret_key: "", has_secret: false },
    gdrive: { client_email: "", folder_id: "", private_key: "", has_private_key: false },
    b2: { bucket: "", endpoint: "", access_key: "", secret_key: "", has_secret: false },
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await api.get("/admin/settings/backups");
        const d = res?.data?.data;
        if (d && mounted) {
          setSettings({
            s3: { ...d.s3, secret_key: "" },
            gdrive: { ...d.gdrive, private_key: "" },
            b2: { ...d.b2, secret_key: "" },
          });
        }
      } catch (err) {
        toast.error("Failed to load backup settings");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.post("/admin/settings/backups", settings);
      toast.success("Backup settings saved successfully");
      setSettings(prev => ({
        s3: { ...prev.s3, secret_key: "", has_secret: true },
        gdrive: { ...prev.gdrive, private_key: "", has_private_key: true },
        b2: { ...prev.b2, secret_key: "", has_secret: true },
      }));
    } catch (err) {
      toast.error(err.message || "Failed to save backup settings");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (provider, field, value) => {
    setSettings(prev => ({
      ...prev,
      [provider]: { ...prev[provider], [field]: value }
    }));
  };

  if (loading) return <div className="text-slate-500 text-sm">Loading backup settings...</div>;

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <h3 className="text-lg font-medium text-slate-800 mb-4">AWS S3 Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bucket Name</label>
            <input type="text" className="w-full px-3 py-2 border rounded-md" value={settings.s3.bucket} onChange={e => handleChange('s3', 'bucket', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Region</label>
            <input type="text" className="w-full px-3 py-2 border rounded-md" value={settings.s3.region} onChange={e => handleChange('s3', 'region', e.target.value)} placeholder="e.g. us-east-1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Endpoint (Optional)</label>
            <input type="text" className="w-full px-3 py-2 border rounded-md" value={settings.s3.endpoint} onChange={e => handleChange('s3', 'endpoint', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Access Key ID</label>
            <input type="text" className="w-full px-3 py-2 border rounded-md" value={settings.s3.access_key} onChange={e => handleChange('s3', 'access_key', e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Secret Access Key {settings.s3.has_secret && <span className="text-green-600 text-xs">(Saved)</span>}</label>
            <input type="password" className="w-full px-3 py-2 border rounded-md" value={settings.s3.secret_key} onChange={e => handleChange('s3', 'secret_key', e.target.value)} placeholder={settings.s3.has_secret ? "Leave blank to keep existing" : ""} />
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <h3 className="text-lg font-medium text-slate-800 mb-4">Google Drive Configuration</h3>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Client Email</label>
            <input type="email" className="w-full px-3 py-2 border rounded-md" value={settings.gdrive.client_email} onChange={e => handleChange('gdrive', 'client_email', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Folder ID</label>
            <input type="text" className="w-full px-3 py-2 border rounded-md" value={settings.gdrive.folder_id} onChange={e => handleChange('gdrive', 'folder_id', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Private Key {settings.gdrive.has_private_key && <span className="text-green-600 text-xs">(Saved)</span>}</label>
            <textarea className="w-full px-3 py-2 border rounded-md" rows="3" value={settings.gdrive.private_key} onChange={e => handleChange('gdrive', 'private_key', e.target.value)} placeholder={settings.gdrive.has_private_key ? "Leave blank to keep existing" : ""}></textarea>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <h3 className="text-lg font-medium text-slate-800 mb-4">Backblaze B2 Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bucket Name</label>
            <input type="text" className="w-full px-3 py-2 border rounded-md" value={settings.b2.bucket} onChange={e => handleChange('b2', 'bucket', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Endpoint</label>
            <input type="text" className="w-full px-3 py-2 border rounded-md" value={settings.b2.endpoint} onChange={e => handleChange('b2', 'endpoint', e.target.value)} placeholder="e.g. https://s3.us-west-004.backblazeb2.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Application Key ID</label>
            <input type="text" className="w-full px-3 py-2 border rounded-md" value={settings.b2.access_key} onChange={e => handleChange('b2', 'access_key', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Application Key {settings.b2.has_secret && <span className="text-green-600 text-xs">(Saved)</span>}</label>
            <input type="password" className="w-full px-3 py-2 border rounded-md" value={settings.b2.secret_key} onChange={e => handleChange('b2', 'secret_key', e.target.value)} placeholder={settings.b2.has_secret ? "Leave blank to keep existing" : ""} />
          </div>
        </div>
      </div>

      <div>
        <button type="submit" disabled={saving} className="px-4 py-2 bg-brand text-white rounded-md font-medium hover:bg-brand-dark transition-colors disabled:opacity-50">
          {saving ? "Saving..." : "Save Backup Settings"}
        </button>
      </div>
    </form>
  );
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [pushEnabled, setPushEnabled] = useState(() => {
    try {
      const raw = localStorage.getItem("push_enabled");
      if (raw === null) return true;
      return String(raw) === "1";
    } catch { return true; }
  });
  const [permissionStatus, setPermissionStatus] = useState(() => {
    try {
      if (typeof window !== "undefined" && "Notification" in window) {
        return String(window.Notification.permission || "default");
      }
    } catch {}
    return "default";
  });
  const [cloud, setCloud] = useState({ cloud_name: "", api_key: "", api_secret: "", folder: "", has_secret: false });
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [emailTestTo, setEmailTestTo] = useState("");
  const [emailTesting, setEmailTesting] = useState(false);
  const [loginBackgroundUrl, setLoginBackgroundUrl] = useState("");
  const [loginBackgroundVersion, setLoginBackgroundVersion] = useState("");
  const [loginBackgroundSaving, setLoginBackgroundSaving] = useState(false);
  const [inactivityTimeout, setInactivityTimeout] = useState(() => {
    try {
      if (typeof localStorage !== "undefined") {
        const val = localStorage.getItem("omnisuite.inactivityTimeout");
        if (val !== null) return val;
      }
    } catch {}
    return "60";
  });

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && "Notification" in window) {
        setPermissionStatus(String(window.Notification.permission || "default"));
      }
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("push_enabled", pushEnabled ? "1" : "0"); } catch {}
  }, [pushEnabled]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setCloudLoading(true);
        const res = await api.get("/admin/settings/cloudinary");
        const d = res?.data?.data || {};
        if (!mounted) return;
        setCloud(p => ({ ...p, cloud_name: d.cloud_name || "", api_key: d.api_key || "", folder: d.folder || "", has_secret: !!d.has_secret }));
      } catch {} finally { if (mounted) setCloudLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  async function saveCloudinary() {
    try {
      setCloudSaving(true);
      await api.post("/admin/settings/cloudinary", {
        cloud_name: cloud.cloud_name, api_key: cloud.api_key,
        api_secret: cloud.api_secret || undefined, folder: cloud.folder || undefined,
      });
      toast.success("Cloudinary settings saved");
      setCloud(p => ({ ...p, has_secret: true, api_secret: "" }));
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to save settings");
    } finally { setCloudSaving(false); }
  }

  async function sendTestEmail() {
    try {
      setEmailTesting(true);
      const res = await api.post("/admin/email/test", { to: emailTestTo || undefined });
      const configured = !!res?.data?.configured;
      const sent = !!res?.data?.sent;
      if (!configured) toast.error("Mailer not configured");
      else if (sent) toast.success("Test email sent");
      else toast.error("Mailer configured but send failed");
    } catch { toast.error("Failed to send test email"); }
    finally { setEmailTesting(false); }
  }

  async function loadLoginBackgroundMeta() {
    try {
      const res = await api.get("/admin/settings/login-background/meta");
      const hasBackground = !!res?.data?.hasBackground;
      const version = res?.data?.updatedAt || Date.now();
      setLoginBackgroundVersion(String(version || ""));
      setLoginBackgroundUrl(hasBackground ? `/api/admin/settings/login-background?v=${encodeURIComponent(String(version))}` : "");
    } catch {
      setLoginBackgroundUrl("");
      setLoginBackgroundVersion("");
    }
  }

  useEffect(() => { loadLoginBackgroundMeta(); }, []);

  async function uploadLoginBackground(file) {
    if (!file) return;
    try {
      setLoginBackgroundSaving(true);
      let uploadFile = file;
      if (file.size > 300 * 1024) {
        const compressed = await new Promise((resolve) => {
          const img = new Image();
          const url = URL.createObjectURL(file);
          img.onload = () => {
            URL.revokeObjectURL(url);
            let w = img.naturalWidth, h = img.naturalHeight;
            const maxDim = 1920;
            if (w > maxDim || h > maxDim) {
              if (w > h) { h = (h / w) * maxDim; w = maxDim; }
              else { w = (w / h) * maxDim; h = maxDim; }
            }
            const c = document.createElement("canvas");
            c.width = w; c.height = h;
            const ctx = c.getContext("2d");
            ctx.drawImage(img, 0, 0, w, h);
            c.toBlob(blob => resolve(blob), "image/jpeg", 0.8);
          };
          img.src = url;
        });
        uploadFile = new File([compressed], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
      }
      const fd = new FormData();
      fd.append("background", uploadFile);
      await api.post("/admin/settings/login-background", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Login background updated");
      await loadLoginBackgroundMeta();
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to update login background");
    } finally { setLoginBackgroundSaving(false); }
  }

  async function clearLoginBackground() {
    try {
      setLoginBackgroundSaving(true);
      await api.delete("/admin/settings/login-background");
      setLoginBackgroundUrl("");
      setLoginBackgroundVersion("");
      toast.success("Login background reset");
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to reset login background");
    } finally { setLoginBackgroundSaving(false); }
  }

  async function requestPushPermission() {
    try {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      const res = await window.Notification.requestPermission();
      setPermissionStatus(String(res || "default"));
      toast[res === "granted" ? "success" : "info"](res === "granted" ? "Notifications enabled" : "Notifications permission denied or dismissed");
    } catch {}
  }

  async function subscribePushNow() {
    try {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
      if (window.Notification.permission !== "granted") { toast.info("Grant notification permission first"); return; }
      const reg = await navigator.serviceWorker.ready;
      const res = await api.get("/push/public-key");
      const publicKey = String(res.data?.publicKey || "");
      if (!publicKey) { toast.error("Missing VAPID public key"); return; }
      function urlBase64ToUint8Array(base64String) {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
        return outputArray;
      }
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      const existing = await reg.pushManager.getSubscription();
      if (existing && existing.endpoint) {
        await api.post("/push/subscribe", { subscription: existing.toJSON() });
        toast.success("Push subscription saved"); return;
      }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      await api.post("/push/subscribe", { subscription: sub.toJSON() });
      toast.success("Subscribed to push notifications");
    } catch { toast.error("Failed to subscribe"); }
  }

  async function unsubscribePushNow() {
    try {
      if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing && existing.endpoint) {
        try { await api.delete("/push/unsubscribe", { data: { subscription: existing.toJSON() } }); } catch {}
        try { await existing.unsubscribe(); } catch {}
        toast.success("Unsubscribed");
      } else toast.info("No active subscription");
    } catch { toast.error("Failed to unsubscribe"); }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">Administration Settings</h1>
              <p className="text-sm mt-1">Notifications, branding, and document setup</p>
            </div>
            <Link to="/administration" className="btn btn-secondary">Return to Menu</Link>
          </div>
        </div>
      </div>

      <div className="flex border-b mb-4 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium capitalize whitespace-nowrap ${activeTab === tab.key ? "border-b-2 border-brand text-brand" : "text-slate-500 hover:text-slate-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "general" && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-body space-y-3">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="text-lg font-semibold">Login Background</div>
                  <div className="text-sm text-slate-500">Change the image shown behind the login form.</div>
                </div>
                {loginBackgroundUrl ? (
                  <div className="w-40 h-24 rounded border border-slate-200 bg-cover bg-center" style={{ backgroundImage: `url(${loginBackgroundUrl})` }} />
                ) : (
                  <div className="w-40 h-24 rounded border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-500">Default image</div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="btn-primary cursor-pointer">
                  {loginBackgroundSaving ? "Saving..." : "Upload Background"}
                  <input type="file" accept="image/*" className="hidden" disabled={loginBackgroundSaving} onChange={e => { const file = e.target.files?.[0] || null; e.target.value = ""; uploadLoginBackground(file); }} />
                </label>
                <button type="button" className="btn-outline" disabled={loginBackgroundSaving || !loginBackgroundUrl} onClick={clearLoginBackground}>Reset to Default</button>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body space-y-3">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="text-lg font-semibold">Security & Inactivity</div>
                  <div className="text-sm text-slate-500">Set how many minutes until an inactive user is automatically logged out. Set to 0 to disable.</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <input type="number" min="0" className="input w-32" value={inactivityTimeout}
                  onChange={e => { const val = e.target.value; setInactivityTimeout(val); try { if (typeof localStorage !== "undefined") localStorage.setItem("omnisuite.inactivityTimeout", val); } catch {} }} />
                <span className="text-sm text-slate-600">minutes</span>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body space-y-3">
              <div className="text-lg font-semibold">Email</div>
              <div className="text-sm text-slate-500">Send a test email to verify SMTP settings.</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700">Recipient</label>
                  <input className="input w-full" value={emailTestTo} onChange={e => setEmailTestTo(e.target.value)} placeholder="user@example.com (optional)" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-primary" onClick={sendTestEmail} disabled={emailTesting}>{emailTesting ? "Sending..." : "Send Test Email"}</button>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body space-y-3">
              <div className="text-lg font-semibold">Cloudinary Storage</div>
              <div className="text-sm text-slate-500">Store attachments in Cloudinary; links are saved to document records.</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700">Cloud Name</label>
                  <input className="input w-full" value={cloud.cloud_name} onChange={e => setCloud(p => ({ ...p, cloud_name: e.target.value }))} disabled={cloudLoading || cloudSaving} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">API Key</label>
                  <input className="input w-full" value={cloud.api_key} onChange={e => setCloud(p => ({ ...p, api_key: e.target.value }))} disabled={cloudLoading || cloudSaving} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">API Secret</label>
                  <input type="password" placeholder={cloud.has_secret && !cloud.api_secret ? "•••••••• (unchanged)" : ""} className="input w-full" value={cloud.api_secret} onChange={e => setCloud(p => ({ ...p, api_secret: e.target.value }))} disabled={cloudLoading || cloudSaving} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Folder (optional)</label>
                  <input className="input w-full" value={cloud.folder} onChange={e => setCloud(p => ({ ...p, folder: e.target.value }))} disabled={cloudLoading || cloudSaving} />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-primary" onClick={saveCloudinary} disabled={cloudSaving}>{cloudSaving ? "Saving..." : "Save Cloudinary Settings"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "notifications" && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-body space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-lg font-semibold">Push Notifications</div>
                  <div className="text-sm text-slate-500">Permission: {permissionStatus}</div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-sm">Enabled</span>
                  <input type="checkbox" className="toggle" checked={pushEnabled} onChange={e => setPushEnabled(e.target.checked)} />
                </label>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={requestPushPermission}>Request Permission</button>
                <button type="button" className="btn-primary" onClick={subscribePushNow} disabled={!pushEnabled}>Subscribe Now</button>
                <button type="button" className="btn-outline" onClick={unsubscribePushNow}>Unsubscribe</button>
              </div>
              <div className="text-xs text-slate-500">When enabled, the app registers for push after login and delivers background alerts.</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body space-y-3">
              <div className="text-lg font-semibold">Low Stock Notifications</div>
              <div className="text-sm text-slate-500">Configure how users receive low stock alerts</div>
              <LowStockNotificationSection />
            </div>
          </div>
        </div>
      )}

      {activeTab === "templates" && (
        <div className="card">
          <div className="card-body space-y-3">
            <div className="text-lg font-semibold">Document Templates</div>
            <div className="text-sm text-slate-500">Manage print and PDF templates for Sales Order, Invoice, and more.</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Link to="/administration/settings/templates?type=general-template" className="btn-outline">Report Header</Link>
              <Link to="/administration/settings/templates?type=sales-order" className="btn-outline">Sales Order</Link>
              <Link to="/administration/settings/templates?type=invoice" className="btn-outline">Invoice</Link>
              <Link to="/administration/settings/templates?type=delivery-note" className="btn-outline">Delivery Note</Link>
              <Link to="/administration/settings/templates?type=payment-voucher" className="btn-outline">Payment Voucher</Link>
              <Link to="/administration/settings/templates?type=salary-slip" className="btn-outline">Salary Slip</Link>
              <Link to="/administration/settings/templates?type=receipt-voucher" className="btn-outline">Receipt Voucher</Link>
              <Link to="/administration/settings/templates?type=quotation" className="btn-outline">Quotation</Link>
              <Link to="/administration/settings/templates?type=purchase-order" className="btn-outline">Purchase Order</Link>
              <Link to="/administration/settings/templates?type=grn" className="btn-outline">GRN</Link>
              <Link to="/administration/settings/templates?type=purchase-bill" className="btn-outline">Purchase Bill</Link>
              <Link to="/administration/settings/templates?type=direct-purchase" className="btn-outline">Direct Purchase</Link>
            </div>
          </div>
        </div>
      )}

      {activeTab === "departments" && <DepartmentsSection />}
      {activeTab === "backups" && <BackupsSection />}
    </div>
  );
}

function LowStockNotificationSection() {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get("/admin/users");
        const items = res?.data?.data?.items || res?.data?.items || [];
        setUsers(items);
      } catch {}
    }
    load();
  }, []);

  useEffect(() => {
    if (!selectedUserId) return;
    async function loadPref() {
      try {
        setLoading(true);
        const res = await api.get(`/access/notification-prefs?key=low-stock&user_id=${selectedUserId}`);
        const item = res?.data?.item || null;
        setPushEnabled(Boolean(item?.push_enabled));
        setEmailEnabled(Boolean(item?.email_enabled));
      } catch { setPushEnabled(false); setEmailEnabled(false); }
      finally { setLoading(false); }
    }
    loadPref();
  }, [selectedUserId]);

  async function save() {
    if (!selectedUserId) return;
    try {
      setSaving(true);
      await api.put(`/access/notification-prefs/low-stock`, { user_id: Number(selectedUserId), push_enabled: pushEnabled ? 1 : 0, email_enabled: emailEnabled ? 1 : 0 });
    } catch {}
    setSaving(false);
  }

  return (
    <div className="space-y-3">
      <div className="max-w-md">
        <label className="text-xs font-medium text-slate-700">User</label>
        <select className="input w-full" value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
          <option value="">Choose a user...</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.username || u.full_name || `User #${u.id}`}</option>)}
        </select>
      </div>
      {selectedUserId && (
        <div className="space-y-3">
          {loading ? <div className="text-sm text-slate-500">Loading preferences...</div> : (
            <>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="checkbox" checked={pushEnabled} onChange={e => setPushEnabled(e.target.checked)} />
                  <span className="text-sm">Push notification + app notification</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="checkbox" checked={emailEnabled} onChange={e => setEmailEnabled(e.target.checked)} />
                  <span className="text-sm">Email notification</span>
                </label>
              </div>
              <button className="btn-primary" disabled={saving} onClick={save}>{saving ? "Saving..." : "Save Preference"}</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DepartmentsSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", is_active: 1 });
  const [editingId, setEditingId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/departments");
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch { toast.error("Failed to load departments"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const resetForm = () => { setForm({ name: "", code: "", is_active: 1 }); setEditingId(null); };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.code.trim()) { toast.error("Name and Code are required"); return; }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/admin/departments/${editingId}`, form);
        toast.success("Department updated");
      } else {
        await api.post("/admin/departments", form);
        toast.success("Department created");
      }
      resetForm();
      loadData();
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to save"); }
    finally { setSaving(false); }
  };

  const handleEdit = (item) => {
    setForm({ name: item.name, code: item.code, is_active: item.is_active });
    setEditingId(item.id);
  };

  const handleCancel = () => resetForm();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <div className="card p-4">
          <h3 className="font-medium mb-4">{editingId ? "Edit Department" : "Add Department"}</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Name</label>
              <input className="input w-full" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm mb-1">Code</label>
              <input className="input w-full" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} />
            </div>
            <div>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="checkbox" checked={form.is_active === 1 || form.is_active === true} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked ? 1 : 0 }))} />
                <span className="text-sm">Active</span>
              </label>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" disabled={saving} onClick={handleSubmit}>
                {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
              {editingId && (
                <button className="btn-outline" onClick={handleCancel}>Cancel</button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="lg:col-span-2">
        <div className="card">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-bold text-slate-500 uppercase">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
                ) : items.length > 0 ? items.map(item => (
                  <tr key={item.id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{item.code}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${item.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"}`}>
                        {item.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleEdit(item)} className="text-brand hover:text-brand-700 text-sm font-medium">Edit</button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No departments found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}


