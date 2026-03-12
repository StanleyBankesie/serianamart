# Email Delivery Issue Analysis

## Problem Found

There are **TWO** competing email sending mechanisms in the workflow system:

### Path 1: `sendDocumentForwardNotification()` (documentNotification.js)

- Called from `startWorkflow()` and `performAction()`
- Uses: `await sendMail()` (properly awaited)
- Logs: Email attempts to `adm_system_logs` table
- Has: Duplicate prevention (10-second window)

### Path 2: `notifyUser()` (workflow.controller.js)

- Called from `performAction()`
- Uses: `Promise.resolve().then(sendMail()).catch()` (NOT awaited)
- Logs: Email attempts to `adm_system_logs` table
- Has: Duplicate prevention (10-second window)

## Why Emails Aren't Sending

### Issue 1: Promise Handling in notifyUser()

```javascript
Promise.resolve()
  .then(() => sendMail({...}))
  .catch(async (e) => { /* log error */ });
```

**Problem:** This creates a Promise but doesn't await/return it. If the workflow function completes before the Promise settles, errors may be lost.

### Issue 2: Duplicate Prevention Interference

Both paths check for duplicates in `adm_system_logs` table within 10 seconds:

- If Path 1 sends and logs as `EMAIL_SENT`
- Then Path 2 tries to send
- Path 2's duplicate check finds Path 1's log and returns early

**Result:** Only ONE email gets sent, the other silently skips

### Issue 3: User Email Field

The `notifyUser()` function checks:

```javascript
if (userRes.length && userRes[0].email) {
  // send email
} else {
  console.log("[MOCK EMAIL] ..."); // silent mock
}
```

If `userRes[0].email` is NULL or empty, it falls back to `[MOCK EMAIL]` log only.

**Missing:** No error log when user email is missing!

## Solution

Need to **eliminate Path 2's email sending** and use ONLY `sendDocumentForwardNotification()`.

The `notifyUser()` function should:

1. Keep push notifications
2. Keep database notifications
3. Remove email sending (let sendDocumentForwardNotification handle it)

## Implementation

Remove the email sending code from `notifyUser()` in workflow.controller.js (lines ~1240-1375)

Keep only:

1. Database notification insert (lines 1205-1220)
2. Push notification call (lines 1222-1232)
3. Remove: Email sending via Promise (lines 1236-1378)

This way:

- ✅ One clear email path (sendDocumentForwardNotification)
- ✅ Proper error handling and logging
- ✅ No duplicate emails
- ✅ Consistent behavior
