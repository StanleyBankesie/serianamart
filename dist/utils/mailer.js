import nodemailer from "nodemailer";

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

export async function sendMail({ to, subject, text, html }) {
  if (!configured || !transporter) {
    return false;
  }
  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
  return true;
}
