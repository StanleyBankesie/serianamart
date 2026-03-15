import nodemailer from "nodemailer";

let transporter = null;
let configured = false;

function bool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v !== "string") return false;
  const s = v.toLowerCase().trim();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

export function initWorkflowMailer() {
  const host = process.env.SMTP_HOST || "";
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const secure = bool(process.env.SMTP_SECURE || "false");
  if (!host) {
    configured = false;
    transporter = null;
    return false;
  }
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
  configured = true;
  return true;
}

export function isWorkflowMailerConfigured() {
  return configured;
}

export async function sendWorkflowEmail({ to, subject, text, html, cc }) {
  if (!configured || !transporter) {
    return false;
  }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "";
  const info = await transporter.sendMail({ from, to, cc, subject, text, html });
  return !!info?.messageId;
}

