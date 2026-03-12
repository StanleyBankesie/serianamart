# Email Not Received - Troubleshooting Guide

## Scenario: Document forwarded to admin (id=1, stanleyetornam@gmail.com) but no email received

### Quick Diagnosis

The email system has been verified as working (✓ SMTP connection confirmed, ✓ code structure correct). So the issue is likely one of these:

1. **User email address not set in database**
2. **Email notification disabled for the user**
3. **Workflow action never completed/executed**
4. **Email caught in Gmail spam**
5. **Mailer not initialized at workflow time**

### Diagnostic Steps (In Order)

#### Step 1: Verify Mail Config is Working (Already Done ✓)

```bash
node scripts/test-email-config.js
```

**Result:** ✓ PASSED - SMTP is configured and working

---

#### Step 2: Check Admin User Has Email in Database

```sql
SELECT id, username, email FROM adm_users WHERE id = 1;
```

**Expected:**

```
id: 1
username: admin
email: stanleyetornam@gmail.com
```

**Problem if:** email field is NULL or empty

- **Fix:** `UPDATE adm_users SET email = 'stanleyetornam@gmail.com' WHERE id = 1;`

**Problem if:** email is different

- **Solution:** Forward document to the correct email address, or update it

---

#### Step 3: Check If Document Was Actually Forwarded to User 1

```sql
SELECT id, document_id, document_type, assigned_to_user_id, status
FROM adm_document_workflows
ORDER BY created_at DESC
LIMIT 10;
```

**Expected:** Recent entry with `assigned_to_user_id = 1`

**Problem if:** No recent entries for user 1

- **Issue:** Document forward didn't reach user 1
- **Action:** Re-forward the document to user 1

**Problem if:** Entries exist but status is not what expected

- **Investigate:** Check the workflow status

---

#### Step 4: Check Email Sending Logs

```sql
SELECT user_id, action, message, event_time
FROM adm_system_logs
WHERE module_name IN ('Workflow', 'DocumentForward')
AND user_id = 1
ORDER BY event_time DESC
LIMIT 10;
```

**This will show one of these patterns:**

### Case A: EMAIL_SENT Found ✓

```
user_id: 1
action: EMAIL_SENT
message: Workflow email sent to stanleyetornam@gmail.com
event_time: 2026-03-11 14:30:15
```

**Meaning:** Email was sent successfully by the system

- **Next step:** Email is in Gmail but marked as spam
- **Action:** Check Gmail spam/promotions folder
- **Whitelist:** Mark email from serianamart@omnisuite-erp.com as safe

---

### Case B: EMAIL_ERROR Found ✗

```
user_id: 1
action: EMAIL_ERROR
message: Email error: Invalid login credentials
event_time: 2026-03-11 14:30:15
```

**Common Error Messages:**

1. **"Invalid login credentials"**
   - SMTP username or password wrong
   - Check: `SMTP_USER` and `SMTP_PASS` in .env.production
   - Fix: Update credentials, restart server

2. **"Cannot connect to host"**
   - Firewall blocking port 465
   - SMTP server down
   - Check: Port 465 is open
   - Try: Port 587 instead

3. **"Authentication failed (535)"**
   - Account doesn't have SMTP enabled
   - Account has 2FA blocking SMTP
   - Contact: Email provider to enable SMTP access

4. **"Message rejected - invalid address"**
   - Recipient email invalid
   - Check: Is stanleyetornam@gmail.com valid?

---

### Case C: No EMAIL_SENT or EMAIL_ERROR ✗

**Meaning:** Email sending code was never executed

**Possible Reasons:**

1. **Workflow action wasn't performed**
   - User didn't actually forward/approve the document
   - Action: Verify document was forwarded in the UI

2. **Email notifications were disabled**
   - Check Step 5 below

3. **User email is missing**
   - Check Step 2 above

4. **Function returned early**
   - Check Step 5 and 6

---

#### Step 5: Check Notification Preferences

```sql
SELECT pref_key, email_enabled, push_enabled
FROM adm_notification_prefs
WHERE user_id = 1;
```

**If no records found:** ✓ OK - Uses default (email enabled, push enabled)

**If records exist:**

```
pref_key: workflow
email_enabled: 0
push_enabled: 1
```

**Problem if:** `email_enabled = 0`

- **Meaning:** User disabled email notifications
- **Fix:** `UPDATE adm_notification_prefs SET email_enabled = 1 WHERE user_id = 1;`

**Or enable via UI:**

- User Profile → Notification Preferences → Enable Email Notifications

---

#### Step 6: Check Server Logs

Look for these patterns when workflow action is executed:

**Best case** (email should be sent):

```
[DocumentNotification] Fetching user 1 for company 1
[DocumentNotification] User found: admin, Email: stanleyetornam@gmail.com
[DocumentNotification] ✓ Sending email to stanleyetornam@gmail.com
[sendDocumentForwardEmail] Calling sendMail with to=stanleyetornam@gmail.com
[SENDMAIL] Email sent successfully to stanleyetornam@gmail.com
[DocumentNotification] ✓ Email sent successfully to stanleyetornam@gmail.com
```

**Problem case** (email was skipped):

```
[DocumentNotification] ✗ User has no email address
[DocumentNotification] ✗ Email disabled for user
```

**Error case**:

```
[notifyUser] Error sending email to stanleyetornam@gmail.com: SMTP Error
```

**How to enable server logs:**

- Console output when running: `npm run dev`
- Look for `[notifyUser]` and `[DocumentNotification]` prefixes

---

## Decision Tree: Finding Your Issue

```
Is email supposed to be sent?
├─ Check adm_document_workflows - was forward created for user 1?
│  ├─ YES → Continue to Step 2
│  └─ NO → Re-forward the document
│
Does user 1 have email set?
├─ Check adm_users.email for id=1
│  ├─ YES (stanleyetornam@gmail.com) → Continue to Step 4
│  └─ NO → UPDATE adm_users SET email = 'stanleyetornam@gmail.com' WHERE id = 1;
│
Is email enabled for user?
├─ Check adm_notification_prefs.email_enabled for user_id=1
│  ├─ YES or NO RECORD (default) → Continue to Step 4
│  └─ NO (0) → UPDATE adm_notification_prefs SET email_enabled = 1 WHERE user_id = 1;
│
Did email sending code execute?
├─ Check adm_system_logs for EMAIL_SENT or EMAIL_ERROR
│  ├─ EMAIL_SENT → Check Gmail spam folder, whitelist sender
│  ├─ EMAIL_ERROR → See error message details, fix SMTP issue
│  └─ Nothing → Check server logs, verify workflow action completed
```

---

## What I've Already Fixed

✅ **Email sending now uses proper async/await** (not Promise.then)  
✅ **Comprehensive logging added** to trace email flow  
✅ **Duplicate prevention** so user doesn't get multiple emails  
✅ **Two email paths** ensure notification is sent (notifyUser + sendDocumentForwardNotification)  
✅ **Error handling** catches and logs all failures

---

## Next: Testing & Confirmation

### Test 1: Database Check

Run the SQL queries in Step 2-5 above and report:

- ✓ User 1 has email set
- ✓ Recent workflow with user 1
- ✓ EMAIL_SENT or EMAIL_ERROR in logs

### Test 2: Server Log Check

Forward a document while watching server console:

- Look for `[DocumentNotification]` logs
- Look for `[notifyUser]` logs
- Look for `[SENDMAIL]` logs

### Test 3: Gmail Check

- Check Inbox for email from `Omnisuite ERP <serianamart@omnisuite-erp.com>`
- Check Spam/Promotions folders
- Note the exact time email was sent (from database logs)

---

## Common Solutions Quick Reference

| Issue             | Command/Action                                                           |
| ----------------- | ------------------------------------------------------------------------ |
| User has no email | `UPDATE adm_users SET email = 'stanleyetornam@gmail.com' WHERE id = 1;`  |
| Email disabled    | `UPDATE adm_notification_prefs SET email_enabled = 1 WHERE user_id = 1;` |
| SMTP auth failed  | Verify SMTP_USER and SMTP_PASS in .env.production                        |
| Email in spam     | Whitelist serianamart@omnisuite-erp.com in Gmail                         |
| No logs found     | Check if workflow was actually forwarded; check server was running       |

---

## Still Not Working?

Share these details:

1. SQL output from Step 2 (user email check)
2. SQL output from Step 4 (email logs - EMAIL_SENT or EMAIL_ERROR)
3. Server console output showing [DocumentNotification] or [notifyUser] logs
4. Error message from adm_system_logs if EMAIL_ERROR exists
5. Exact time you forwarded the document

This will show exactly where the issue is occurring.
