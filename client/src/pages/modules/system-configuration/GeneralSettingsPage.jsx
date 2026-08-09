import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../api/client.js";
import { toast } from "react-toastify";
import { useAuth } from "../../../auth/AuthContext.jsx";

export default function GeneralSettingsPage() {
  const { user } = useAuth();
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

  const [envVars, setEnvVars] = useState({
    ARKESEL_API_KEY: "",
    ARKESEL_SENDER_ID: "",
    GREEN_API_ID_INSTANCE: "",
    GREEN_API_TOKEN_INSTANCE: "",
    SMTP_HOST: "",
    SMTP_PORT: "",
    SMTP_USER: "",
    SMTP_PASS: "",
    SMTP_FROM: "",
    SMTP_SECURE: "false",
    TEMPLATE_SALES_ORDER: "",
    TEMPLATE_PURCHASE_ORDER: "",
    TEMPLATE_SERVICE_ORDER: "",
    TEMPLATE_MAINTENANCE_JOB: "",
    TEMPLATE_PAYMENT_VOUCHER: "",
  });
  const [announcements, setAnnouncements] = useState("");
  const [announcementsSaving, setAnnouncementsSaving] = useState(false);
  const [envLoading, setEnvLoading] = useState(false);
  const [envSaving, setEnvSaving] = useState(false);
  
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState("");
  const [googleMapsLoading, setGoogleMapsLoading] = useState(false);
  const [googleMapsSaving, setGoogleMapsSaving] = useState(false);

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

    (async () => {
      try {
        setEnvLoading(true);
        const res = await api.get("/admin/settings/env");
        if (!mounted) return;
        setEnvVars({
          ARKESEL_API_KEY: res.data.ARKESEL_API_KEY || "",
          ARKESEL_SENDER_ID: res.data.ARKESEL_SENDER_ID || "",
          GREEN_API_ID_INSTANCE: res.data.GREEN_API_ID_INSTANCE || "",
          GREEN_API_TOKEN_INSTANCE: res.data.GREEN_API_TOKEN_INSTANCE || "",
          SMTP_HOST: res.data.SMTP_HOST || "",
          SMTP_PORT: res.data.SMTP_PORT || "",
          SMTP_USER: res.data.SMTP_USER || "",
          SMTP_PASS: res.data.SMTP_PASS || "",
          SMTP_FROM: res.data.SMTP_FROM || "",
          SMTP_SECURE: res.data.SMTP_SECURE || "false",
          TEMPLATE_SALES_ORDER: res.data.TEMPLATE_SALES_ORDER || "",
          TEMPLATE_PURCHASE_ORDER: res.data.TEMPLATE_PURCHASE_ORDER || "",
          TEMPLATE_SERVICE_ORDER: res.data.TEMPLATE_SERVICE_ORDER || "",
          TEMPLATE_MAINTENANCE_JOB: res.data.TEMPLATE_MAINTENANCE_JOB || "",
          TEMPLATE_PAYMENT_VOUCHER: res.data.TEMPLATE_PAYMENT_VOUCHER || "",
        });
      } catch (err) {
        toast.error("Failed to load environment variables.");
      } finally {
        if (mounted) setEnvLoading(false);
      }
    })();

    (async () => {
      try {
        setGoogleMapsLoading(true);
        const res = await api.get("/admin/settings/google-maps");
        if (mounted && res?.data?.data?.api_key) {
          setGoogleMapsApiKey(res.data.data.api_key);
        }
      } catch {} finally { if (mounted) setGoogleMapsLoading(false); }
    })();

    (async () => {
      try {
        const res = await api.get("/admin/settings/announcements");
        if (mounted && res?.data?.announcements !== undefined) {
          setAnnouncements(res.data.announcements);
        }
      } catch {}
    })();

    return () => { mounted = false; };
  }, []);

  async function loadLoginBackgroundMeta() {
    try {
      const res = await api.get("/admin/settings/login-bg-info");
      if (res.data) {
        const hasBackground = !!res?.data?.hasBackground;
        const version = res?.data?.updatedAt || Date.now();
        setLoginBackgroundVersion(String(version || ""));
        setLoginBackgroundUrl(hasBackground ? `/api/admin/settings/login-background?v=${encodeURIComponent(String(version))}` : "");
      }
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

  async function saveAnnouncements() {
    try {
      setAnnouncementsSaving(true);
      await api.post("/admin/settings/announcements", { announcements });
      toast.success("Announcements saved successfully.");
    } catch (e) {
      toast.error("Failed to save announcements");
    } finally {
      setAnnouncementsSaving(false);
    }
  }

  async function saveEnvVars() {
    try {
      setEnvSaving(true);
      await api.post("/admin/settings/env", envVars);
      toast.success("Environment configurations saved successfully.");
      
      // Reload the variables to get the "********" masked values from the backend
      const res = await api.get("/admin/settings/env");
      setEnvVars(prev => ({
        ...prev,
        ARKESEL_API_KEY: res.data.ARKESEL_API_KEY || "",
        ARKESEL_SENDER_ID: res.data.ARKESEL_SENDER_ID || "",
        GREEN_API_TOKEN_INSTANCE: res.data.GREEN_API_TOKEN_INSTANCE || "",
        SMTP_PASS: res.data.SMTP_PASS || ""
      }));
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to save environment variables");
    } finally {
      setEnvSaving(false);
    }
  }

  async function saveGoogleMaps() {
    try {
      setGoogleMapsSaving(true);
      await api.post("/admin/settings/google-maps", { api_key: googleMapsApiKey });
      toast.success("Google Maps settings saved");
      const res = await api.get("/admin/settings/google-maps");
      if (res?.data?.data?.api_key) {
        setGoogleMapsApiKey(res.data.data.api_key);
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to save settings");
    } finally { setGoogleMapsSaving(false); }
  }

  if (user?.id !== 1) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <h2 className="text-xl font-bold mb-2 text-slate-700">Access Denied</h2>
        <p>You must be a system administrator (User ID: 1) to view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">General Settings</h1>
              <p className="text-sm mt-1">Configure global application variables</p>
            </div>
            <button onClick={() => window.history.back()} className="btn btn-secondary">Back</button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        
          {/* Upcoming Announcements Section */}
          <div className="card border-l-4 border-l-brand">
            <div className="card-body space-y-3">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="text-lg font-semibold text-gray-800">Upcoming Announcements</div>
                  <div className="text-sm text-gray-500">
                    Enter announcements to be displayed on the login page widget.
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-3">
                <textarea
                  className="input w-full min-h-[100px]"
                  placeholder="Enter upcoming announcements here..."
                  value={announcements}
                  onChange={(e) => setAnnouncements(e.target.value)}
                ></textarea>
                
                <div className="flex justify-end pt-3">
                  <button
                    className="btn btn-primary"
                    onClick={saveAnnouncements}
                    disabled={announcementsSaving}
                  >
                    {announcementsSaving ? "Saving..." : "Save Announcements"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SMS and WhatsApp Configuration Section */}
        <div className="card border-l-4 border-l-brand">
          <div className="card-body space-y-3">
            <div className="flex justify-between items-start gap-4">
              <div>
                <div className="text-lg font-semibold text-gray-800">SMS & WhatsApp APIs</div>
                <div className="text-sm text-slate-500">Configure credentials for Arkesel (SMS) and Meta Cloud API (WhatsApp)</div>
              </div>
            </div>
            {envLoading ? (
              <div className="text-sm text-slate-500">Loading configurations...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-700">Arkesel API Key</label>
                  <input className="input w-full" value={envVars.ARKESEL_API_KEY} onChange={e => setEnvVars(p => ({ ...p, ARKESEL_API_KEY: e.target.value }))} disabled={envSaving} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Arkesel Sender ID</label>
                  <input className="input w-full" value={envVars.ARKESEL_SENDER_ID} onChange={e => setEnvVars(p => ({ ...p, ARKESEL_SENDER_ID: e.target.value }))} disabled={envSaving} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Green API Id Instance</label>
                  <input className="input w-full" value={envVars.GREEN_API_ID_INSTANCE} onChange={e => setEnvVars(p => ({ ...p, GREEN_API_ID_INSTANCE: e.target.value }))} disabled={envSaving} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Green API Token Instance</label>
                  <input className="input w-full" value={envVars.GREEN_API_TOKEN_INSTANCE} onChange={e => setEnvVars(p => ({ ...p, GREEN_API_TOKEN_INSTANCE: e.target.value }))} disabled={envSaving} />
                </div>
              </div>
            )}
            {!envLoading && (
              <div className="mt-8 border-t border-gray-100 pt-6">
                <div className="text-lg font-semibold text-gray-800 mb-2">Email Configuration (SMTP)</div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-700">SMTP Host</label>
                    <input className="input w-full" value={envVars.SMTP_HOST} onChange={e => setEnvVars(p => ({ ...p, SMTP_HOST: e.target.value }))} disabled={envSaving} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">SMTP Port</label>
                    <input type="number" className="input w-full" value={envVars.SMTP_PORT} onChange={e => setEnvVars(p => ({ ...p, SMTP_PORT: e.target.value }))} disabled={envSaving} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">SMTP Secure (SSL/TLS)</label>
                    <select className="input w-full" value={envVars.SMTP_SECURE} onChange={e => setEnvVars(p => ({ ...p, SMTP_SECURE: e.target.value }))} disabled={envSaving}>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">SMTP User</label>
                    <input className="input w-full" value={envVars.SMTP_USER} onChange={e => setEnvVars(p => ({ ...p, SMTP_USER: e.target.value }))} disabled={envSaving} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">SMTP Password</label>
                    <input type="password" placeholder="********" className="input w-full" value={envVars.SMTP_PASS} onChange={e => setEnvVars(p => ({ ...p, SMTP_PASS: e.target.value }))} disabled={envSaving} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">From Address</label>
                    <input className="input w-full" placeholder="noreply@omnisuite.com" value={envVars.SMTP_FROM} onChange={e => setEnvVars(p => ({ ...p, SMTP_FROM: e.target.value }))} disabled={envSaving} />
                  </div>
                </div>
              </div>
            )}
            
            {!envLoading && (
              <div className="mt-8 border-t border-gray-100 pt-6">
                <div className="text-lg font-semibold text-gray-800 mb-1">Notification Trigger Templates</div>
                <div className="text-sm text-slate-500 mb-4">Available variables: {'{customer_name}'}, {'{document_type}'}, {'{document_no}'}, {'{amount}'}, {'{status}'}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-700">Sales Order Template</label>
                    <textarea className="input w-full h-24 resize-none" value={envVars.TEMPLATE_SALES_ORDER} onChange={e => setEnvVars(p => ({ ...p, TEMPLATE_SALES_ORDER: e.target.value }))} disabled={envSaving}></textarea>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Purchase Order Template</label>
                    <textarea className="input w-full h-24 resize-none" value={envVars.TEMPLATE_PURCHASE_ORDER} onChange={e => setEnvVars(p => ({ ...p, TEMPLATE_PURCHASE_ORDER: e.target.value }))} disabled={envSaving}></textarea>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Service Order Template</label>
                    <textarea className="input w-full h-24 resize-none" value={envVars.TEMPLATE_SERVICE_ORDER} onChange={e => setEnvVars(p => ({ ...p, TEMPLATE_SERVICE_ORDER: e.target.value }))} disabled={envSaving}></textarea>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Maintenance Job Template</label>
                    <textarea className="input w-full h-24 resize-none" value={envVars.TEMPLATE_MAINTENANCE_JOB} onChange={e => setEnvVars(p => ({ ...p, TEMPLATE_MAINTENANCE_JOB: e.target.value }))} disabled={envSaving}></textarea>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Payment Voucher Template</label>
                    <textarea className="input w-full h-24 resize-none" value={envVars.TEMPLATE_PAYMENT_VOUCHER} onChange={e => setEnvVars(p => ({ ...p, TEMPLATE_PAYMENT_VOUCHER: e.target.value }))} disabled={envSaving}></textarea>
                  </div>
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button type="button" className="btn-primary bg-green-600 hover:bg-green-700 border-none text-white" onClick={saveEnvVars} disabled={envSaving}>
                {envSaving ? "Saving..." : "Save Credentials"}
              </button>
            </div>
          </div>
        </div>



        <div className="card">
          <div className="card-body space-y-3">
            <div className="flex justify-between items-start gap-4">
              <div>
                <div className="text-lg font-semibold">Login Background Image</div>
                <div className="text-sm text-slate-500">Set the background image for the login and password reset forms.</div>
              </div>
              {loginBackgroundUrl && (
                <img src={loginBackgroundUrl} alt="Login Background" className="h-20 w-auto rounded border border-slate-200" />
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

        <div className="card">
          <div className="card-body space-y-3">
            <div>
              <div className="text-lg font-semibold">Google Maps</div>
              <div className="text-sm text-slate-500">Enter your Google Maps API Key to enable map features.</div>
            </div>
            {googleMapsLoading ? <div className="text-sm text-slate-500">Loading...</div> : (
              <div className="max-w-md space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-700">API Key</label>
                  <input type="text" className="input w-full" placeholder="AIzaSy..." value={googleMapsApiKey} onChange={e => setGoogleMapsApiKey(e.target.value)} disabled={googleMapsSaving} />
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-primary" disabled={googleMapsSaving} onClick={saveGoogleMaps}>
                    {googleMapsSaving ? "Saving..." : "Save Google Maps Settings"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-body space-y-3">
            <div className="text-lg font-semibold">Compliance Notification Template</div>
            <div className="text-sm text-slate-500">Message template sent when a vehicle compliance document is expiring soon or expired.</div>
            <ComplianceTemplateSection />
          </div>
        </div>

        <div className="card">
          <div className="card-body space-y-3">
            <div className="text-lg font-semibold">Servicing Notification Template</div>
            <div className="text-sm text-slate-500">Message template sent when a vehicle is due for servicing.</div>
            <ServicingTemplateSection />
          </div>
        </div>
      </div>
    </div>
  );
}

function ComplianceTemplateSection() {
  const [template, setTemplate] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await api.get("/admin/settings/compliance-template");
        setTemplate(res?.data?.template || "Your {{compliance_type}} for {{vehicle_reg}} is {{status}}. Please renew as soon as possible.");
      } catch (err) {
        toast.error("Failed to load compliance template");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function save() {
    try {
      setSaving(true);
      await api.post("/admin/settings/compliance-template", { template });
      toast.success("Compliance template saved successfully");
    } catch (err) {
      toast.error("Failed to save compliance template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="text-sm text-slate-500">Loading...</div>
      ) : (
        <>
          <div className="bg-blue-50 border border-blue-200 p-3 rounded text-sm text-blue-800">
            <strong>Available Placeholders:</strong> <code>{"{{vehicle_reg}}"}</code>, <code>{"{{compliance_type}}"}</code>, <code>{"{{status}}"}</code>, <code>{"{{expiry_date}}"}</code>
          </div>
          <textarea
            className="input w-full min-h-[100px]"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder="Template message..."
          ></textarea>
          <button
            className="btn-primary"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Template"}
          </button>
        </>
      )}
    </div>
  );
}

function ServicingTemplateSection() {
  const [template, setTemplate] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await api.get("/admin/settings/servicing-template");
        setTemplate(res?.data?.template || "Your vehicle {{vehicle_reg}} is due for {{service_type}} servicing. Please schedule an appointment.");
      } catch (err) {
        toast.error("Failed to load servicing template");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function save() {
    try {
      setSaving(true);
      await api.post("/admin/settings/servicing-template", { template });
      toast.success("Servicing template saved successfully");
    } catch (err) {
      toast.error("Failed to save servicing template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="text-sm text-slate-500">Loading...</div>
      ) : (
        <>
          <div className="bg-blue-50 border border-blue-200 p-3 rounded text-sm text-blue-800">
            <strong>Available Placeholders:</strong> <code>{"{{vehicle_reg}}"}</code>, <code>{"{{service_type}}"}</code>, <code>{"{{due_date}}"}</code>
          </div>
          <textarea
            className="input w-full min-h-[100px]"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder="Template message..."
          ></textarea>
          <button
            className="btn-primary"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Template"}
          </button>
        </>
      )}
    </div>
  );
}
