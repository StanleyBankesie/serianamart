import { query } from "../../db/pool.js";
import { sendPushToUser } from "../../routes/push.routes.js";
import { sendMail } from "../../utils/mailer.js";
import { getIO } from "../../utils/socket.js";
import { ensureWorkflowTables } from "../../utils/dbUtils.js";

export async function notifyWorkflowForward({
  companyId,
  userId,
  workflowInstanceId,
  documentId,
  documentType,
  title = "Document Forwarded",
  message = "",
  action = "APPROVE",
  link = `/administration/workflows/approvals/${workflowInstanceId}`,
  senderName = "System",
}) {
  try {
    await ensureWorkflowTables();
    await query(
      `INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
       VALUES (:companyId, :userId, :title, :message, :link, 0)`,
      { companyId, userId, title, message, link },
    );
  } catch {}
  try {
    const io = getIO();
    io.to(`user_${userId}`).emit("notifications:new", {
      title: title || "Notification",
      message: message || "",
      link,
      type: "workflow",
      documentId,
      workflowInstanceId,
    });
  } catch {}

  try {
    const payload = {
      title: title || "Document Forwarded",
      message: message || `A ${documentType} has been forwarded to you.`,
      type: "workflow-forward",
      documentType,
      documentRef: String(documentId),
      actionType: action,
      senderName,
      link,
      tag: `wf-${workflowInstanceId || documentId}`,
    };
    await sendPushToUser(userId, payload);
  } catch {}

  try {
    // Map via username -> email (scoped by company)
    const unameRows = await query(
      `SELECT username FROM adm_users WHERE id = :userId AND is_active = 1 LIMIT 1`,
      { userId },
    );
    const uname = unameRows?.[0]?.username || null;
    let to = null;
    if (uname) {
      const emailRows = await query(
        `SELECT email FROM adm_users WHERE username = :uname AND company_id = :companyId AND is_active = 1 LIMIT 1`,
        { uname, companyId },
      );
      to = emailRows?.[0]?.email || null;
    }
    if (!to) return;
    const subject = title || "Document Forwarded";
    const text = [
      "Hello,",
      "",
      message || `A ${documentType} has been forwarded to you.`,
      "",
      `Document Type: ${documentType}`,
      `Reference No: ${documentId}`,
      `Sent By: ${senderName}`,
      `Action Required: ${action}`,
      "",
      `Open: ${process.env.APP_URL ? process.env.APP_URL + link : link}`,
    ].join("\n");
    const html = [
      `<p>Hello,</p>`,
      `<p>${message || "A document has been forwarded to you."}</p>`,
      `<div style="background:#f5f5f5;padding:12px;border-radius:6px">`,
      `<p><strong>Document Type:</strong> ${documentType}</p>`,
      `<p><strong>Reference No:</strong> ${documentId}</p>`,
      `<p><strong>Sent By:</strong> ${senderName}</p>`,
      `<p><strong>Action Required:</strong> ${action}</p>`,
      `</div>`,
      `<p><a href="${link}" style="background:#0e3646;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Open Document</a></p>`,
    ].join("");
    await sendMail({
      to,
      subject,
      text,
      html,
      meta: {
        moduleName: "WorkflowNotify",
        action: "EMAIL_SENT",
        userId,
        companyId,
        refNo: String(documentId),
        urlPath: link,
        message: `Workflow forward email sent to ${to}`,
      },
    });
  } catch {}
}
