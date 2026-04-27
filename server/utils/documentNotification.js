import { query } from "../db/pool.js";
import { isMailerConfigured, sendMail } from "./mailer.js";
import { sendPushToUser } from "../routes/push.routes.js";

/**
 * Sends both email and push notifications when a document is forwarded to a user
 * @param {Object} options - Notification options
 * @param {number} options.userId - User ID to notify
 * @param {number} options.companyId - Company ID
 * @param {string} options.documentType - Type of document (e.g., SALES_ORDER, PURCHASE_ORDER)
 * @param {number} options.documentId - Document ID/Reference number
 * @param {string} options.documentRef - Document reference code (e.g., PO-001)
 * @param {string} options.title - Notification title
 * @param {string} options.message - Notification message
 * @param {string} options.actionType - Action type (APPROVE, REVIEW, etc.)
 * @param {string} options.senderName - Name of person forwarding the document
 * @param {string} options.workflowInstanceId - Workflow instance ID (optional)
 * @param {Object} options.req - Express request object (for protocol, headers, etc.)
 * @returns {Promise<void>}
 */
export async function sendDocumentForwardNotification(options) {
  const {
    userId,
    companyId,
    documentType,
    documentId,
    documentRef,
    title,
    message,
    actionType,
    senderName,
    workflowInstanceId,
    req,
  } = options;

  if (!userId || !companyId) {
    console.warn("Missing userId or companyId for document notification");
    return;
  }

  try {
    const link = workflowInstanceId
      ? `/administration/workflows/approvals/${workflowInstanceId}`
      : `/notifications`;
    try {
      await query(
        `INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
         VALUES (:companyId, :userId, :title, :message, :link, 0)`,
        {
          companyId,
          userId,
          title: title || "Document Forwarded",
          message:
            message ||
            `A ${documentType} ${documentRef || documentId} has been forwarded to you.`,
          link,
        },
      );
    } catch {}

    // Get user details
    console.log(
      `[DocumentNotification] Fetching user ${userId} for company ${companyId}`,
    );
    const userRows = await query(
      `SELECT id, email, username, is_active FROM adm_users WHERE id = :userId AND company_id = :companyId AND is_active = 1 LIMIT 1`,
      { userId, companyId },
    );

    if (!userRows.length) {
      console.warn(
        `[DocumentNotification] User ${userId} not found or inactive`,
      );
      try {
        await query(
          `INSERT INTO adm_system_logs (company_id, user_id, module_name, action, message, url_path)
           VALUES (:companyId, :userId, 'DocumentForward', 'EMAIL_SKIPPED', :message, :url)`,
          {
            companyId,
            userId,
            message: `User not found or inactive; email not sent`,
            url: `/notifications`,
          },
        );
      } catch {}
      return;
    }

    const user = userRows[0];
    const userEmail = user.email;
    const userName = user.username;

    console.log(
      `[DocumentNotification] User found: ${userName}, Email: ${userEmail || "NOT SET"}`,
    );

    // Get notification preferences
    let userEmailEnabled = 1;
    let userPushEnabled = 1;
    try {
      const prefRows = await query(
        `
        SELECT email_enabled, push_enabled
        FROM adm_notification_prefs 
        WHERE user_id = :userId AND pref_key IN ('workflow-approvals','workflow','document-forward')
        ORDER BY CASE pref_key WHEN 'workflow-approvals' THEN 0 WHEN 'document-forward' THEN 1 ELSE 2 END
        LIMIT 1
        `,
        { userId },
      );
      if (prefRows.length) {
        userEmailEnabled = Number(prefRows[0].email_enabled) === 1 ? 1 : 0;
        userPushEnabled = Number(prefRows[0].push_enabled) === 1 ? 1 : 0;
        console.log(
          `[DocumentNotification] Notification prefs loaded: email=${userEmailEnabled}, push=${userPushEnabled}`,
        );
      } else {
        console.log(
          `[DocumentNotification] No notification prefs found for user, using defaults`,
        );
      }
    } catch (err) {
      console.warn(
        `Error fetching notification preferences for user ${userId}:`,
        err,
      );
    }

    const forceEmail = envTrue(process.env.WORKFLOW_FORCE_EMAIL);
    const forcePush = envTrue(process.env.WORKFLOW_FORCE_PUSH);

    console.log(
      `[DocumentNotification] Decision: userEmailEnabled=${userEmailEnabled}, forceEmail=${forceEmail}, hasEmail=${!!userEmail}`,
    );

    // Send EMAIL notification
    if ((userEmailEnabled || forceEmail) && userEmail) {
      console.log(`[DocumentNotification] ✓ Sending email to ${userEmail}`);
      await sendDocumentForwardEmail({
        to: userEmail,
        userName,
        documentType,
        documentRef,
        documentId,
        title,
        message,
        actionType,
        senderName,
        workflowInstanceId,
        req,
        companyId,
        userId,
      });
    } else {
      let skipMsg = null;
      if (!userEmail) {
        skipMsg = "User has no email address";
        console.log(`[DocumentNotification] ✗ Email NOT sent: ${skipMsg}`);
      } else if (!userEmailEnabled && !forceEmail) {
        skipMsg = "Email disabled by user preference";
        console.log(`[DocumentNotification] ✗ Email NOT sent: ${skipMsg}`);
      }
      if (skipMsg) {
        try {
          await query(
            `INSERT INTO adm_system_logs (company_id, user_id, module_name, action, message, url_path)
             VALUES (:companyId, :userId, 'DocumentForward', 'EMAIL_SKIPPED', :message, :url)`,
            {
              companyId,
              userId,
              message: skipMsg,
              url: `/notifications`,
            },
          );
        } catch {}
      }
    }

    // Send PUSH notification
    if ((userPushEnabled || forcePush) && userId) {
      console.log(`[DocumentNotification] ✓ Sending push notification`);
      await sendDocumentForwardPush({
        userId,
        documentType,
        documentRef,
        documentId,
        title,
        message,
        actionType,
        senderName,
        workflowInstanceId,
      });
    } else {
      if (!userPushEnabled && !forcePush) {
        console.log(
          `[DocumentNotification] ✗ Push NOT sent: User has push notifications disabled`,
        );
      }
    }
  } catch (err) {
    console.error("Error sending document forward notification:", err);
  }
}

/**
 * Sends email notification for document forwarding
 * @private
 */
async function sendDocumentForwardEmail(options) {
  const {
    to,
    userName,
    documentType,
    documentRef,
    documentId,
    title,
    message,
    actionType,
    senderName,
    workflowInstanceId,
    req,
    companyId,
    userId,
  } = options;

  try {
    console.log(`[sendDocumentForwardEmail] Starting email send to ${to}`);

    if (!isMailerConfigured()) {
      console.log(
        `[MOCK EMAIL] To: ${to} | Subject: ${title} | Message: ${message}`,
      );
      try {
        await query(
          `INSERT INTO adm_system_logs (company_id, user_id, module_name, action, message, url_path)
           VALUES (:companyId, :userId, 'DocumentForward', 'EMAIL_MOCK', :message, :url)`,
          {
            companyId,
            userId,
            message: `Mock email to ${to}`,
            url: `/notifications`,
          },
        );
      } catch {}
      return;
    }

    console.log(`[sendDocumentForwardEmail] Mailer is configured, proceeding`);

    // Check for duplicate emails in last 10 seconds
    const dupRows = await query(
      `SELECT id 
       FROM adm_system_logs 
       WHERE company_id = :companyId 
         AND user_id = :userId 
         AND module_name = 'DocumentForward' 
         AND action = 'EMAIL_SENT' 
         AND event_time >= DATE_SUB(NOW(), INTERVAL 10 SECOND)
       LIMIT 1`,
      { companyId, userId },
    ).catch(() => []);

    if (dupRows.length) {
      console.log(
        `[sendDocumentForwardEmail] ✗ Duplicate email detected for user ${userId}, skipping`,
      );
      return;
    }

    // Build absolute link safely
    let linkAbs = `/administration/workflows/approvals/${workflowInstanceId}`;
    if (req && req.protocol && req.headers?.host) {
      linkAbs = `${req.protocol}://${req.headers.host}${linkAbs}`;
    } else if (process.env.APP_URL) {
      linkAbs = `${process.env.APP_URL}${linkAbs}`;
    } else {
      linkAbs = `http://localhost:3000${linkAbs}`;
    }

    const subject = title || "Document Forwarded for Your Action";
    const nowStr = new Date().toISOString();

    const textContent = [
      `Hello ${userName},`,
      ``,
      message || `A document has been forwarded to you.`,
      ``,
      `Document Type: ${documentType}`,
      `Reference: ${documentRef || documentId}`,
      `Forwarded by: ${senderName}`,
      `Action Required: ${actionType}`,
      `Date & Time: ${nowStr}`,
      ``,
      `View Document: ${linkAbs}`,
      ``,
      `Thank you.`,
      `Omnisuite ERP System`,
    ].join("\n");

    const htmlContent = [
      `<p>Hello <strong>${userName}</strong>,</p>`,
      `<p>${message || "A document has been forwarded to you."}</p>`,
      `<div style="background-color: #f5f5f5; padding: 12px; border-radius: 4px; margin: 16px 0;">`,
      `  <p><strong>Document Type:</strong> ${documentType}</p>`,
      `  <p><strong>Reference:</strong> ${documentRef || documentId}</p>`,
      `  <p><strong>Forwarded by:</strong> ${senderName}</p>`,
      `  <p><strong>Action Required:</strong> ${actionType}</p>`,
      `  <p><strong>Date & Time:</strong> ${nowStr}</p>`,
      `</div>`,
      `<p><a href="${linkAbs}" style="background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">View Document</a></p>`,
      `<p>Thank you,<br/>Omnisuite ERP System</p>`,
    ].join("\n");

    console.log(
      `[sendDocumentForwardEmail] Calling sendMail with to=${to}, subject=${subject}`,
    );

    await sendMail({
      to,
      cc: process.env.WORKFLOW_EMAIL_CC || undefined,
      subject,
      text: textContent,
      html: htmlContent,
      meta: { suppressLog: true },
    });

    console.log(
      `[sendDocumentForwardEmail] ✓ Email sent successfully to ${to}`,
    );

    // Log successful email send
    try {
      await query(
        `INSERT INTO adm_system_logs (company_id, user_id, module_name, action, message, url_path)
         VALUES (:companyId, :userId, 'DocumentForward', 'EMAIL_SENT', :message, :url)`,
        {
          companyId,
          userId,
          message: `Document forward email sent to ${to}`,
          url: `/notifications`,
        },
      );
    } catch {}
  } catch (err) {
    console.error("Error sending document forward email:", err);
    // Log email error
    try {
      await query(
        `INSERT INTO adm_system_logs (company_id, user_id, module_name, action, message, url_path)
         VALUES (:companyId, :userId, 'DocumentForward', 'EMAIL_ERROR', :message, :url)`,
        {
          companyId,
          userId,
          message: `Email error: ${err?.message || err}`,
          url: `/notifications`,
        },
      );
    } catch {}
  }
}

/**
 * Sends push notification for document forwarding
 * @private
 */
async function sendDocumentForwardPush(options) {
  const {
    userId,
    documentType,
    documentRef,
    documentId,
    title,
    message,
    actionType,
    senderName,
    workflowInstanceId,
  } = options;

  try {
    const pushPayload = {
      title: title || "Document Forwarded",
      message: message || `A ${documentType} has been forwarded to you.`,
      type: "document-forward",
      documentType,
      documentRef: documentRef || String(documentId),
      actionType,
      senderName,
      link: workflowInstanceId
        ? `/administration/workflows/approvals/${workflowInstanceId}`
        : `/notifications`,
      icon: "/OMNISUITE_ICON_CLEAR.png",
      badge: "/OMNISUITE_ICON_CLEAR.png",
      tag: `doc-forward-${documentId}`,
      timestamp: new Date().toISOString(),
    };

    await sendPushToUser(userId, pushPayload);
  } catch (err) {
    console.error("Error sending document forward push notification:", err);
  }
}

/**
 * Helper to check if an environment variable is true
 * @private
 */
function envTrue(v) {
  if (v == null) return false;
  const s = String(v).toLowerCase().trim();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

/**
 * Batch notify multiple users about document forwarding
 * @param {Object} options - Notification options
 * @param {number[]} options.userIds - Array of user IDs to notify
 * @param {Object} options.notificationData - Data for each notification
 * @returns {Promise<void>}
 */
export async function broadcastDocumentForwardNotification(options) {
  const { userIds, notificationData, req } = options;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return;
  }

  // Send notifications in parallel
  const promises = userIds.map((userId) =>
    sendDocumentForwardNotification({
      ...notificationData,
      userId,
      req,
    }).catch((err) => {
      console.error(`Failed to notify user ${userId}:`, err);
    }),
  );

  await Promise.all(promises);
}
