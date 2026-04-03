import nodemailer from "nodemailer";
import { query } from "../db/pool.js";
import { ensureSystemLogsTable } from "./dbUtils.js";

function bool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v !== "string") return false;
  const s = v.toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

const host = process.env.SMTP_HOST || "";
const port = Number(process.env.SMTP_PORT || 587);
const user = process.env.SMTP_USER || "";
const pass = process.env.SMTP_PASS || "";
const from = process.env.SMTP_FROM || "";
const secure = bool(process.env.SMTP_SECURE || "false");

let transporter = null;
let configured = false;
let verified = false;

if (host && from) {
  try {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
    configured = true;
  } catch {
    transporter = null;
    configured = false;
  }
}

export function isMailerConfigured() {
  return configured;
}

export async function verifyMailer() {
  if (!transporter) {
    verified = false;
    return false;
  }
  try {
    await transporter.verify();
    verified = true;
    return true;
  } catch (e) {
    verified = false;
    console.error("Mailer verify failed:", e);
    return false;
  }
}

export async function sendMail({ to, subject, text, html, cc, attachments, meta }) {
  if (!configured || !transporter) {
    console.warn(
      "[SENDMAIL] Mailer not configured. Host:",
      host,
      "From:",
      from,
    );
    const m = meta || {};
    if (!m.suppressLog) {
      try {
        await ensureSystemLogsTable();
        const moduleName = m.moduleName || "Email";
        const ref_no = m.refNo || null;
        const url_path = m.urlPath || null;
        await query(
          `INSERT INTO adm_system_logs (company_id, branch_id, user_id, module_name, action, ref_no, message, url_path)
           VALUES (:company_id, :branch_id, :user_id, :module_name, 'EMAIL_MOCK', :ref_no, :message, :url_path)`,
          {
            company_id: Number(m.companyId) || null,
            branch_id: Number(m.branchId) || null,
            user_id: Number(m.userId) || null,
            module_name: moduleName,
            ref_no,
            message:
              m.message ||
              `Mailer not configured; email not sent to ${Array.isArray(to) ? to.join(",") : to || "(unknown)"}`,
            url_path,
          },
        );
      } catch {}
    }
    return false;
  }
  try {
    const result = await transporter.sendMail({
      from,
      to,
      cc,
      subject,
      text,
      html,
      attachments,
    });
    console.log(
      `[SENDMAIL] Email sent successfully to ${to}. MessageId: ${result.messageId}`,
    );
    const m = meta || {};
    if (!m.suppressLog) {
      try {
        await ensureSystemLogsTable();
        const moduleName = m.moduleName || "Email";
        const action = m.action || "EMAIL_SENT";
        const ref_no = m.refNo || null;
        const message =
          m.message || `Email sent to ${Array.isArray(to) ? to.join(",") : to}`;
        const url_path = m.urlPath || null;
        await query(
          `INSERT INTO adm_system_logs (company_id, branch_id, user_id, module_name, action, ref_no, message, url_path)
           VALUES (:company_id, :branch_id, :user_id, :module_name, :action, :ref_no, :message, :url_path)`,
          {
            company_id: Number(m.companyId) || null,
            branch_id: Number(m.branchId) || null,
            user_id: Number(m.userId) || null,
            module_name: moduleName,
            action,
            ref_no,
            message,
            url_path,
          },
        );
      } catch {}
    }
    return true;
  } catch (err) {
    console.error(
      `[SENDMAIL] Failed to send email to ${to}:`,
      err.message,
      err,
    );
    const m = meta || {};
    if (!m.suppressLog) {
      try {
        await ensureSystemLogsTable();
        const moduleName = m.moduleName || "Email";
        const ref_no = m.refNo || null;
        const url_path = m.urlPath || null;
        await query(
          `INSERT INTO adm_system_logs (company_id, branch_id, user_id, module_name, action, ref_no, message, url_path)
           VALUES (:company_id, :branch_id, :user_id, :module_name, 'EMAIL_ERROR', :ref_no, :message, :url_path)`,
          {
            company_id: Number(m.companyId) || null,
            branch_id: Number(m.branchId) || null,
            user_id: Number(m.userId) || null,
            module_name: moduleName,
            ref_no,
            message: `Email error: ${err?.message || err}`,
            url_path,
          },
        );
      } catch {}
    }
    throw err;
  }
}
