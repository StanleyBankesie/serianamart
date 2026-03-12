# Document Forwarding with Email & Push Notifications - Implementation Complete

## Overview

The workflow system has been enhanced to automatically send both email and push notifications whenever documents are forwarded to users. This improves user engagement and ensures users are notified through multiple channels.

## Changes Made

### 1. New Notification Service Created

**File**: `server/utils/documentNotification.js`

Provides unified notification interface for document forwarding:

- `sendDocumentForwardNotification()` - Sends both email and push notifications
- `sendDocumentForwardPush()` - Handles push notification delivery
- `sendDocumentForwardEmail()` - Handles formatted email delivery
- `broadcastDocumentForwardNotification()` - Batch notify multiple users

Features:

- Respects user notification preferences
- Checks for duplicate notifications (10-second window)
- Provides HTML and plain-text email formats
- Handles missing SMTP configuration gracefully
- Logs all notification attempts to system logs

### 2. Workflow Controller Updates

**File**: `server/controllers/workflow.controller.js`

#### Updated Imports

Added new imports for notification service and push notifications.

#### `startWorkflow` Function

- Replaced old email-only logic with new unified notification service
- Now sends notification when document workflow is initiated
- Sends both email and push to first approver

#### `performAction` Function - Enhanced `notifyUser` Function

- Added push notification delivery
- Improved email formatting
- Maintains backward compatibility
- Sends notifications for:
  - APPROVE (forward to next approver)
  - REJECT (notify initiator)
  - RETURN (notify initiator)

Enhanced `performAction` with additional push notification after next approver assignment.

### 3. Notification Preference Support

The system respects user notification preferences:

- `workflow-approvals` - Specific workflow approval preferences
- `workflow` - General workflow preferences
- `document-forward` - Document forwarding preferences
- `WORKFLOW_FORCE_EMAIL` envvar - Force emails even if disabled
- `WORKFLOW_FORCE_PUSH` envvar - Force push notifications even if disabled

## How It Works

### When Document is Forwarded to User:

1. **Initial Forward (startWorkflow)**
   - Document entered into workflow system
   - First approver is identified
   - Email sent with document details
   - Push notification created and sent

2. **Subsequent Forward (performAction - APPROVE)**
   - Current approver approves
   - Next approver identified
   - Email and push notification sent to next approver
   - System logs all actions

3. **Rejection/Return**
   - Document rejected or returned
   - Initiator notified via email and push
   - Document status updated

### Notification Content

**Email Subject**: "Document Forwarded for Your Action" or "Workflow Document - Action Required"

**Email Body Includes**:

- User greeting
- Document type
- Reference number
- Sender name
- Action required
- Timestamp
- Direct link to document

**Push Notification Includes**:

- Title (e.g., "Document Forwarded")
- Message with document details
- Direct link to action
- Document reference
- Sender information
- Timestamp

## Environment Variables

### Email Configuration (Already Configured)

```
SMTP_HOST=webmail.nakdns.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=serianamart@omnisuite-erp.com
SMTP_PASS=Seriana@1stlady
SMTP_FROM=Omnisuite ERP <serianamart@omnisuite-erp.com>
SMTP_CC=optional-cc@example.com
```

### Workflow Notification Config (Optional)

```
WORKFLOW_FORCE_EMAIL=false  # Force email even if user disabled notifications
WORKFLOW_FORCE_PUSH=false   # Force push even if user disabled notifications
```

## Database Integration

### Notification Logging

All notifications are logged to `adm_system_logs`:

- SUCCESS: `EMAIL_SENT`, `EMAIL_MOCK`, `PUSH_SENT`
- FAILURE: `EMAIL_ERROR`, `PUSH_ERROR`
- INFO: `EMAIL_SKIPPED` (user disabled)

### User Preferences Table

Query on `adm_notification_prefs` for user preferences:

- `email_enabled` - User allows email notifications
- `push_enabled` - User allows push notifications

### Workflow Tables Used

- `adm_workflows` - Workflow definitions
- `adm_document_workflows` - Document workflow instances
- `adm_workflow_steps` - Approval steps
- `adm_workflow_step_approvers` - Approvers configuration
- `adm_workflow_tasks` - Workflow tasks
- `adm_notifications` - In-app notifications
- `adm_push_subscriptions` - User push subscriptions

## Frontend Integration

### Automatic Subscriptions

Users are automatically subscribed to push notifications in:

- `client/src/layout/AppShell.jsx` - On login
- `client/src/pages/modules/administration/SettingsPage.jsx` - Manual subscription

### Service Worker

`client/public/sw.js` handles:

- Push notification reception
- Display of notifications
- Click handling and navigation

### Notification Display

- Browser push notifications (system-level)
- In-app notification panel
- Badge counter updates

## Testing Instructions

### 1. Test Email Notification

- Create a purchase order or sales order
- Forward for approval
- Check email inbox for notification
- Verify all document details are included

### 2. Test Push Notification

- Enable notifications in Settings page
- Grant browser notification permission
- Create a document and forward
- Should see browser push notification
- Click to navigate to approval page

### 3. Test User Preferences

- Go to Settings > Notification Preferences
- Disable email notifications
- Create and forward document
- Email should be skipped (logged as EMAIL_SKIPPED)
- Push should still send (if enabled)

### 4. Monitor Logs

Check `adm_system_logs` for:

- `module_name = 'DocumentForward'`
- `module_name = 'Workflow'`
- Action: EMAIL_SENT, EMAIL_ERROR, EMAIL_SKIPPED, PUSH_SENT, PUSH_ERROR

## Document Types Supported

All workflow-enabled documents automatically support these notifications:

- Sales Orders
- Purchase Orders (Import & Local)
- Goods Receipt Notes (GRN)
- Stock Adjustments
- Payment Vouchers (PV)
- Receipt Vouchers (RV)
- Contra Vouchers (CV)
- Journal Vouchers (JV)
- Material Requisitions
- Return to Stores (RTS)
- Sales Returns
- Service Requests

## Error Handling

### Missing Email Configuration

- System logs error but continues
- Push notification still sent
- No exception thrown to user

### Push Subscription Issues

- Inactive subscriptions automatically removed
- Graceful fallback to next subscription
- Error logged but non-blocking

### Database Errors

- Notifications don't block document operations
- Errors logged to system logs
- Document workflow proceeds normally

## Performance Considerations

1. **Async Operations**
   - Notifications sent asynchronously
   - Don't block workflow completion
   - Parallel execution for batch notifications

2. **Duplicate Prevention**
   - 10-second deduplication window
   - Prevents spam for same document
   - Configurable in code

3. **Batch Operations**
   - `broadcastDocumentForwardNotification()` for multiple users
   - Parallel Promise execution
   - Efficient resource usage

## Troubleshooting

### Emails Not Sending

1. Check env vars: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`
2. Check `adm_system_logs` for `EMAIL_ERROR` entries
3. Verify user email is set and valid
4. Check user notification preferences

### Push Notifications Not Received

1. Verify browser notifications are enabled
2. Check service worker is registered: `navigator.serviceWorker.controller`
3. Check `adm_push_subscriptions` for user entries
4. Check browser console for registration errors
5. Verify VAPID keys are configured

### Endless Loop Prevention

- Each notification type (email, push) checked separately
- User preference filtering applied
- 10-second duplicate window prevents loops

## Future Enhancements

1. **SMS Notifications** - Add SMS channel
2. **Slack Integration** - Direct Slack messages
3. **Custom Templates** - User-defined notification templates
4. **Scheduling** - Batch send during off-peak hours
5. **Analytics** - Notification delivery metrics
6. **Polling** - Fallback for browsers without push support

## Files Modified

### Backend

- `server/utils/documentNotification.js` (NEW)
- `server/controllers/workflow.controller.js`

### No Changes Required To

- `server/routes/workflow.routes.js` (uses updated controller)
- `server/routes/push.routes.js` (existing push infrastructure)
- `server/utils/mailer.js` (existing email infrastructure)
- Database schema (uses existing tables)

### Frontend

- No changes required (automatic integration)
- Existing push subscription and notification systems handle delivery

## Summary

The document forwarding system now provides a complete notification experience:

- ✅ Email notifications with rich HTML formatting
- ✅ Push notifications with rich metadata
- ✅ User preference respect
- ✅ Comprehensive error handling
- ✅ System logging for audit trail
- ✅ Automatic deduplication
- ✅ Async, non-blocking operations
- ✅ Support for all workflow-enabled documents
- ✅ Graceful degradation
