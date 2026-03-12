# Email Delivery Troubleshooting - IMMEDIATE ACTION

## Status Summary

✅ **Email system is configured correctly**
✅ **SMTP credentials are valid (test-email-config.js passed)**
✅ **Code has proper error handling and logging**
✅ **Admin user (id=1) exists with email = stanleyetornam@gmail.com**

❓ **Email not received** - Need to find why

---

## Immediate Check (5 Minutes)

### Option 1: Check Gmail First

1. **Open Gmail → stanleyetornam@gmail.com**
2. **Check these folders:**
   - ✓ **Inbox** (main folder)
   - ✓ **Spam** (important - often catches emails)
   - ✓ **Promotions** (email might be here)
   - ✓ **Updates** (less likely but check)

3. **Look for email from:** `Omnisuite ERP <serianamart@omnisuite-erp.com>`

**If found in Spam:**

- Open the email
- Click "Not spam" button
- Future emails will go to inbox

---

### Option 2: Check Database Logs (2-3 Minutes)

**Use any MySQL client (MySQL Workbench, command line, phpmyadmin, etc.)**

Connect to:

- Host: localhost
- User: seriana
- Password: Origen@tor123
- Database: seriana_db

**Run this query:**

```sql
SELECT
  DATE_FORMAT(event_time, '%Y-%m-%d %H:%i:%S') as 'Time',
  action,
  message
FROM adm_system_logs
WHERE module_name IN ('Workflow', 'DocumentForward')
  AND user_id = 1
  AND action IN ('EMAIL_SENT', 'EMAIL_ERROR', 'EMAIL_SKIPPED')
ORDER BY event_time DESC
LIMIT 5;
```

**Look for these results:**

**BEST CASE - Email was sent:**

```
Time: 2026-03-11 14:30:15
action: EMAIL_SENT
message: Workflow email sent to stanleyetornam@gmail.com
```

→ Email sent successfully - must be in Gmail spam

**PROBLEM - Email failed:**

```
Time: 2026-03-11 14:30:15
action: EMAIL_ERROR
message: SMTP Error: permission denied
```

→ See error message details below

**PROBLEM - Email skipped:**

```
Time: 2026-03-11 14:30:15
action: EMAIL_SKIPPED
message: Email disabled by user
```

→ Enable email for user

**NO RESULTS - Email code not executed:**
→ Check if workflow forward was actually performed

---

## Most Likely Scenarios & Fixes

### Scenario 1: Email in Gmail Spam ✓ Most Likely

**Signs:**

- Database shows `EMAIL_SENT`
- Email is NOT in Gmail Inbox
- Happened after forwarding document

**Fix:**

1. Find email in Gmail Spam folder
2. Open it
3. Click "Not spam"
4. Mark as important (star)
5. Future emails will go to inbox

**Why this happens:**

- Gmail sees it's promotional content (workflow notification)
- If first time receiving from serianamart@omnisuite-erp.com, Gmail is cautious

---

### Scenario 2: User Email Not Set

**Signs:**

- Database shows no EMAIL_SENT or EMAIL_ERROR
- User email might be NULL/empty

**Check:**

```sql
SELECT id, username, email FROM adm_users WHERE id = 1;
```

**If email is empty:**

```sql
UPDATE adm_users SET email = 'stanleyetornam@gmail.com' WHERE id = 1;
```

Then re-forward the document

---

### Scenario 3: Email Notifications Disabled

**Signs:**

- Database shows `EMAIL_SKIPPED` with message about user preference

**Check:**

```sql
SELECT email_enabled FROM adm_notification_prefs WHERE user_id = 1 AND pref_key = 'workflow';
```

**If email_enabled = 0:**

```sql
UPDATE adm_notification_prefs SET email_enabled = 1 WHERE user_id = 1;
```

Or enable in UI: User Profile → Notification Preferences → Enable Email

---

### Scenario 4: Workflow Action Never Completed

**Signs:**

- No EMAIL_SENT, EMAIL_ERROR, or EMAIL_SKIPPED in logs
- User action wasn't actually performed

**Check:**

```sql
SELECT id, document_id, document_type, assigned_to_user_id, created_at
FROM adm_document_workflows
WHERE assigned_to_user_id = 1
ORDER BY created_at DESC
LIMIT 5;
```

**If no recent entries with user 1:**

- Document was never forwarded to this user
- Forward the document again

---

### Scenario 5: SMTP Connection Error

**Signs:**

- Database shows `EMAIL_ERROR`
- Error message mentions "connection", "auth", or "timeout"

**Common Error Messages & Fixes:**

| Error                         | Cause                                  | Fix                                   |
| ----------------------------- | -------------------------------------- | ------------------------------------- |
| `Invalid login credentials`   | Wrong SMTP password                    | Verify SMTP_PASS in .env.production   |
| `ECONNREFUSED`                | Server down / firewall blocking 465    | Try port 587 instead of 465           |
| `Permission denied`           | Credentials correct but account locked | Contact email provider                |
| `5.7.1 Authentication failed` | Account doesn't allow SMTP             | Enable SMTP in email account settings |

**To test SMTP directly:**

```bash
cd server
node scripts/test-email-config.js
```

Should pass with "✓ Test email sent successfully"

---

## Action Plan

**Do this in order:**

### Step 1: Check Gmail Spam (Fastest)

- [ ] Open Gmail
- [ ] Check Inbox, Spam, Promotions
- [ ] Look for email from Omnisuite ERP
- [ ] If found in Spam → Mark as "Not spam" ✓ DONE

### Step 2: Check Database Logs

- [ ] Connect to MySQL
- [ ] Run EMAIL_SENT/ERROR query
- [ ] Share result with these details:
  - Is EMAIL_SENT, EMAIL_ERROR, EMAIL_SKIPPED, or nothing?
  - If error, what's the exact message?

### Step 3: Based on Database Results

- [ ] If EMAIL_SENT → Check Gmail spam ✓
- [ ] If EMAIL_ERROR → Share error message, I'll help fix
- [ ] If EMAIL_SKIPPED → Check notification prefs
- [ ] If nothing → Re-forward document, watch server logs

### Step 4: Monitor Server Logs

- [ ] Restart server: `npm run dev` (in server directory)
- [ ] Forward document to admin (user 1)
- [ ] Watch console for logs starting with `[notifyUser]` or `[DocumentNotification]`
- [ ] Share what you see

---

## Questions to Answer

When reporting, tell me:

1. **Gmail check:**
   - [ ] Is email in Inbox? YES / NO
   - [ ] Is email in Spam? YES / NO
   - [ ] Is email in Promotions? YES / NO

2. **Database logs show:**
   - [ ] EMAIL_SENT: YES / NO
   - [ ] EMAIL_ERROR: YES / NO (if yes, what error?)
   - [ ] EMAIL_SKIPPED: YES / NO (if yes, why?)
   - [ ] Nothing: YES / NO

3. **Server logs show:**
   - [ ] `[notifyUser]` messages? YES / NO
   - [ ] `[DocumentNotification]` messages? YES / NO
   - [ ] Any errors? YES / NO (describe)

4. **Workflow status:**
   - [ ] Recent workflow with user 1? YES / NO
   - [ ] Document actually forwarded? YES / NO

---

## Summary

The email system is working ✓. The issue is one of these:

1. **Email in Gmail Spam** (most likely) → Mark as not spam
2. **User email not set** → Update database
3. **Email disabled for user** → Enable it
4. **Workflow not forwarded** → Re-forward document
5. **SMTP error** → Fix credentials

**Next step:** Check Gmail spam folder first, then run the database query from "Option 2" above.

---

For detailed troubleshooting: See [EMAIL_NOT_RECEIVED_DEBUG.md](EMAIL_NOT_RECEIVED_DEBUG.md)
