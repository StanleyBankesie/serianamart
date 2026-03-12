# Workflow Document Forwarding - Quick Reference Guide

## Overview

Documents forwarded through the workflow system now automatically trigger both email and push notifications to the recipient user.

## Key Features

✅ **Dual Channel Notifications**

- Email notifications with rich HTML formatting
- Browser push notifications (system-level)
- Both channels respect user preferences
- Graceful fallback if one channel fails

✅ **Automatic Triggers**

- When workflow starts (document forwarded to first approver)
- When current approver forwards to next stage
- When document returns to initiator

✅ **User Preferences**

- Users can enable/disable email notifications
- Users can enable/disable push notifications
- Forced notifications available via environment variables

✅ **Comprehensive Logging**

- All notification attempts logged to `adm_system_logs`
- Success and failure tracking
- Performance metrics available

## Implementation Files

### New Files

- `server/utils/documentNotification.js` - Unified notification service

### Modified Files

- `server/controllers/workflow.controller.js` - Added notification calls

## How to Use in Code

### Send Document Forward Notification

```javascript
import { sendDocumentForwardNotification } from "../utils/documentNotification.js";

// When forwarding document to user
await sendDocumentForwardNotification({
  userId: approverId,
  companyId: companyId,
  documentType: "SALES_ORDER",
  documentId: orderId,
  documentRef: "SO-001", // Display reference
  title: "Sales Order Forwarded",
  message: "Sales order SO-001 has been forwarded for your approval",
  actionType: "APPROVE",
  senderName: currentUserName,
  workflowInstanceId: instanceId, // For direct link
  req: req, // Express request object
});
```

### Broadcast to Multiple Users

```javascript
import { broadcastDocumentForwardNotification } from "../utils/documentNotification.js";

await broadcastDocumentForwardNotification({
  userIds: [userId1, userId2, userId3],
  notificationData: {
    companyId,
    documentType: "PURCHASE_ORDER",
    documentId: poId,
    documentRef: "PO-001",
    title: "Purchase Order Awaiting Review",
    message: "Review and approve purchase order",
    actionType: "REVIEW",
    senderName: "System",
  },
  req: req,
});
```

## Configuration

### Environment Variables

**Email (SMTP)** - Already configured

```env
SMTP_HOST=webmail.nakdns.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=serianamart@omnisuite-erp.com
SMTP_PASS=Seriana@1stlady
SMTP_FROM=Omnisuite ERP <serianamart@omnisuite-erp.com>
SMTP_CC=optional-cc@example.com  # Optional
```

**Push Notifications** - Auto-generated if not set

```env
VAPID_PUBLIC_KEY=...   # Auto-generated on first run
VAPID_PRIVATE_KEY=...  # Auto-generated on first run
VAPID_CONTACT=mailto:admin@example.com
```

**Notification Options**

```env
WORKFLOW_FORCE_EMAIL=false   # Force emails even if user disabled
WORKFLOW_FORCE_PUSH=false    # Force push even if user disabled
```

## Database Queries

### Check notification logs

```sql
SELECT id, user_id, module_name, action, message, event_time
FROM adm_system_logs
WHERE module_name IN ('Workflow', 'DocumentForward')
ORDER BY event_time DESC
LIMIT 50;
```

### Check user notification preferences

```sql
SELECT user_id, pref_key, email_enabled, push_enabled
FROM adm_notification_prefs
WHERE user_id = ?;
```

### Check push subscriptions

```sql
SELECT id, user_id, endpoint, is_active, last_active_at
FROM adm_push_subscriptions
WHERE user_id = ?;
```

## Testing Workflow

### 1. Local Testing

```bash
# Start server
cd server
npm run dev

# In another terminal, run verification
node scripts/verify-workflow-notifications.js
```

### 2. Manual Testing

1. Login to application
2. Go to Settings > Enable Notifications
3. Create a document (Sales Order, Purchase Order, etc.)
4. Forward to approver
5. Check:
   - Email inbox
   - Browser notification
   - Database logs

### 3. Test Email Only

Disable push notifications in browser:

1. Settings > Disable push notifications
2. Forward document
3. Should receive only email

### 4. Test Push Only

Disable email in user preferences:

1. Settings > Notification Preferences
2. Turn off "Workflow Email Notifications"
3. Forward document
4. Should receive only push notification

### 5. Monitor Logs

```javascript
// In application
import { query } from "./db/pool.js";

// Check recent notifications
const logs = await query(
  `SELECT * FROM adm_system_logs 
   WHERE module_name IN ('Workflow', 'DocumentForward')
   ORDER BY event_time DESC LIMIT 20`,
);
console.log(logs);
```

## Document Types Supported

All workflow-enabled documents automatically support notifications:

- ✓ Sales Orders
- ✓ Purchase Orders (Import & Local)
- ✓ Goods Receipt Notes (GRN)
- ✓ Stock Adjustments
- ✓ Payment Vouchers (PV)
- ✓ Receipt Vouchers (RV)
- ✓ Contra Vouchers (CV)
- ✓ Journal Vouchers (JV)
- ✓ Material Requisitions
- ✓ Return to Stores (RTS)
- ✓ Sales Returns
- ✓ Service Requests

## Troubleshooting

### Emails Not Sending

**Problem**: Email not received after document forward

**Solution**:

1. Verify SMTP configuration in .env
2. Check `adm_system_logs` for EMAIL_ERROR entries
3. Verify user email is set in `adm_users`
4. Check notification preferences not disabled
5. Test with `WORKFLOW_FORCE_EMAIL=true`

### Push Notifications Not Received

**Problem**: Browser notification not shown

**Solution**:

1. Check notification permission granted in Settings
2. Verify service worker registered: `navigator.serviceWorker.controller`
3. Check `adm_push_subscriptions` has entry for user
4. Monitor browser console for errors
5. Check VAPID keys are generated

### User Not Receiving Notifications

**Problem**: User not notified when document forwarded

**Solution**:

1. Check user status: `SELECT is_active FROM adm_users WHERE id = ?`
2. Check user has email: `SELECT email FROM adm_users WHERE id = ?`
3. Check notification preferences unlocked
4. Check workflow is active: `SELECT is_active FROM adm_workflows WHERE id = ?`
5. Check user is assigned in workflow_step_approvers

## Performance Notes

- Notifications sent **asynchronously** (non-blocking)
- 10-second duplicate window prevents spam
- Batch notifications via `broadcastDocumentForwardNotification()`
- Graceful degradation if one channel fails
- Optimized database queries with indexes

## Common Patterns

### Forward Document in Controller

```javascript
export const submitDocumentForApproval = async (req, res, next) => {
  try {
    // ... document validation ...

    // Start workflow
    const result = await query(`INSERT INTO adm_document_workflows (...)`, {
      /* params */
    });

    // Get first approver
    const approverRows = await query(
      `SELECT approver_user_id FROM adm_workflow_step_approvers ...`,
    );

    // Send notifications (already handled in startWorkflow)

    res.json({ success: true, instanceId: result.insertId });
  } catch (err) {
    next(err);
  }
};
```

### Handle Notification Errors

```javascript
import { sendDocumentForwardNotification } from "../utils/documentNotification.js";

try {
  await sendDocumentForwardNotification({
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
  });
} catch (err) {
  // Already logged to database
  console.error("Notification failed (non-blocking):", err);
  // Continue workflow
}
```

## API Endpoints Affected

All document creation/forwarding endpoints automatically trigger notifications:

- `POST /sales/orders/:id/submit`
- `POST /purchase/orders/:id/submit`
- `POST /finance/vouchers/:id/submit`
- `POST /inventory/stock-adjustments/:id/submit`
- `POST /workflow/start` (Manual workflow start)
- `POST /workflow/:instanceId/action` (When forwarding to next approver)

## Future Enhancements

- [ ] SMS notifications
- [ ] Slack integration
- [ ] Microsoft Teams integration
- [ ] Custom email templates
- [ ] Scheduled batch notifications
- [ ] Notification analytics dashboard
- [ ] Rich media in push notifications
- [ ] Notification preferences UI in app

## Support

For issues or questions:

1. Check logs: `adm_system_logs` table
2. Review verification script: `server/scripts/verify-workflow-notifications.js`
3. Check implementation guide: `WORKFLOW_NOTIFICATIONS_IMPLEMENTATION.md`
