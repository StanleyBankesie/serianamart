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

console.log(
  "[MAILER_INIT] Configuration loaded: host=" +
    host +
    ", port=" +
    port +
    ", secure=" +
    secure +
    ", from=" +
    from,
);

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
    console.log("[MAILER_INIT] ✓ Nodemailer transporter created successfully");
  } catch (err) {
    transporter = null;
    configured = false;
    console.error(
      "[MAILER_INIT] ✗ Failed to create transporter:",
      err?.message,
    );
  }
} else {
  console.warn(
    "[MAILER_INIT] ⚠ Mailer not configured. Missing: " +
      (!host ? "SMTP_HOST " : "") +
      (!from ? "SMTP_FROM" : ""),
  );
}

export function isMailerConfigured() {
  return configured;
}

export async function verifyMailer() {
  if (!transporter) {
    verified = false;
    console.warn("[MAILER_VERIFY] No transporter available");
    return false;
  }
  try {
    await transporter.verify();
    verified = true;
    console.log("[MAILER_VERIFY] ✓ SMTP connection verified");
    return true;
  } catch (e) {
    verified = false;
    console.error("[MAILER_VERIFY] ✗ SMTP verification failed:", e?.message);
    return false;
  }
}

export async function sendMail({ to, subject, text, html, cc }) {
  if (!configured || !transporter) {
    console.warn(
      "[SENDMAIL] ✗ Mailer not configured. Cannot send to " +
        to +
        ". isConfigured=" +
        configured +
        ", hasTransporter=" +
        !!transporter,
    );
    return false;
  }

  try {
    console.log("[SENDMAIL] Attempting to send email to: " + to);
    const result = await transporter.sendMail({
      from,
      to,
      cc,
      subject,
      text,
      html,
    });
    console.log(
      "[SENDMAIL] ✓ Email sent successfully to " +
        to +
        ". MessageId: " +
        result.messageId,
    );
    return true;
  } catch (err) {
    console.error(
      "[SENDMAIL] ✗ Failed to send email to " + to + ": " + err?.message,
    );
    console.error("[SENDMAIL] Full error:", err);
    throw err;
  }
}
