# Email Delivery Troubleshooting Guide

## Overview

Push notifications are working but emails are not being delivered. This guide helps you diagnose and fix the issue.

## Quick Diagnosis API Endpoints

Run these endpoints to diagnose email issues (requires authentication):

### 1. Check Email Status

```bash
curl -X GET http://localhost:4002/api/email-test/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response:**

```json
{
  "configured": true,
  "smtpHost": "webmail.nakdns.com",
  "smtpPort": 465,
  "smtpSecure": true,
  "smtpFrom": "Omnisuite ERP <serianamart@omnisuite-erp.com>",
  "hasAuth": true
}
```

### 2. Run Full Diagnostics

```bash
curl -X POST http://localhost:4002/api/email-test/diagnose \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Returns:**

- Configuration status (SMTP host, port, security settings)
- SMTP connection verification
- Test email send attempt
- Detailed error messages if something fails

### 3. Send Test Email

```bash
curl -X POST http://localhost:4002/api/email-test/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "recipient@example.com",
    "subject": "Test Email",
    "message": "This is a test email from Omnisuite ERP"
  }'
```

## Common Issues and Solutions

### Issue 1: "Mailer not configured"

**Symptoms:**

- Email status shows: `"configured": false`
- Emails never sent

**Causes:**

- Missing SMTP_HOST or SMTP_FROM in .env file
- Typo in environment variable names

**Solution:**

```
Check .env file has:
  SMTP_HOST=webmail.nakdns.com
  SMTP_PORT=465
  SMTP_SECURE=true
  SMTP_USER=serianamart@omnisuite-erp.com
  SMTP_PASS=Seriana@1stlady
  SMTP_FROM=Omnisuite ERP <serianamart@omnisuite-erp.com>

Then restart the server
```

### Issue 2: "SMTP connection failed"

**Symptoms:**

- `"configured": true` but diagnosis shows "SMTP connection failed"
- SMTP verification fails

**Causes:**

- Wrong password
- SMTP server unreachable
- Firewall blocking port 465
- Incorrect host/port

**Solution:**

```bash
# Test SMTP connectivity first
# Using port 465 with secure=true
nc -zv webmail.nakdns.com 465

# If connection fails, check:
1. SMTP_PORT - should be 465
2. SMTP_SECURE - should be true
3. Firewall/network rules
4. SMTP credentials
```

### Issue 3: "Test email sent but not received"

**Symptoms:**

- Diagnosis shows "Test email sent successfully"
- But email doesn't arrive in inbox
- Check spam/junk folder

**Causes:**

- Email goes to spam
- Recipient email invalid
- Mail server delays
- Email filter rules

**Solution:**

1. Check spam/junk folder first
2. Verify recipient email is correct
3. Check email-test logs in adm_system_logs:

```sql
SELECT * FROM adm_system_logs
WHERE module_name = 'EmailDiagnosis'
ORDER BY event_time DESC LIMIT 10;
```

4. Try sending to a different email address

### Issue 4: "User has no email configured"

**Symptoms:**

- Emails should be sent to logged-in user
- Diagnosis says "User has no email configured"

**Solution:**

1. Go to user profile settings
2. Add/verify email address
3. Save changes
4. Try sending email again

## System Logs

Monitor email activity in `adm_system_logs`:

```sql
-- Recent email diagnostics
SELECT * FROM adm_system_logs
WHERE module_name IN ('EmailDiagnosis', 'DocumentForward', 'Workflow')
AND action IN ('EMAIL_SENT', 'EMAIL_ERROR', 'EMAIL_SKIPPED')
ORDER BY event_time DESC
LIMIT 20;

-- Check for specific errors
SELECT action, message, COUNT(*) as count
FROM adm_system_logs
WHERE module_name = 'DocumentForward'
AND action LIKE 'EMAIL%'
GROUP BY action, message
ORDER BY event_time DESC;
```

## Server Logs

When the server starts, look for these messages:

```
=============== SERVER STARTUP INFO ===============
Server running on port 4002
Mailer configured: ✓ YES
  - SMTP Host: webmail.nakdns.com
  - SMTP Port: 465
  - SMTP Secure: true
  - SMTP User: SET
  - SMTP From: Omnisuite ERP <serianamart@omnisuite-erp.com>
Mailer SMTP verified: ✓ YES
```

**If any show ✗, that's your issue.**

## Manual Test Procedure

1. **Start server and check logs**

   ```bash
   npm run dev
   ```

   Look for the startup info with mailer configuration

2. **Run diagnostics endpoint**

   ```bash
   # Use browser or curl to access:
   POST http://localhost:4002/api/email-test/diagnose
   # With authentication header
   ```

3. **Check system logs**

   ```sql
   SELECT * FROM adm_system_logs
   WHERE module_name = 'EmailDiagnosis'
   ORDER BY event_time DESC LIMIT 5;
   ```

4. **Look at the result codes**
   - `TEST_SEND_SUCCESS` = Email likely delivered
   - `TEST_SEND_FAIL` = Issues with SMTP connection
   - `CONFIGURATION_ERROR` = .env settings wrong

## SMTP Credentials Verification

Current configured SMTP:

- **Host:** webmail.nakdns.com
- **Port:** 465
- **Secure:** true (SSL/TLS)
- **User:** serianamart@omnisuite-erp.com
- **Password:** Seriana@1stlady
- **From:** Omnisuite ERP <serianamart@omnisuite-erp.com>

If you're not sure these are correct:

1. Contact your email provider (usually hosting company)
2. Check the webmail login settings
3. Request SMTP settings from email administrator

## Advanced: Check Email Queue

In the workflow controller, when documents are forwarded:

1. **Notification is triggered** → `sendDocumentForwardNotification()` called
2. **Email is prepared** → HTML/text content built
3. **sendMail() is called** → Attempted to send
4. **Result is logged** → Success or error recorded

Check what happened:

```sql
SELECT
  user_id,
  action,
  message,
  event_time
FROM adm_system_logs
WHERE module_name = 'DocumentForward'
ORDER BY event_time DESC
LIMIT 10;
```

## If Still Not Working

1. **Verify .env is loaded**
   - Add temporary console.log in mailer.js
   - Restart server
   - Check if values appear in startup logs

2. **Test with different email**
   - Try sending to Gmail account (less filtering)
   - Check junk/spam there

3. **Enable detailed logging**
   - Add `console.log()` statements in documentNotification.js
   - Check server terminal for detailed error messages

4. **Check firewall**
   - Test port 465 connectivity
   - Try port 587 if 465 blocked

5. **Contact email provider**
   - Verify SMTP settings are correct
   - Check if account allows SMTP access
   - Verify password/credentials

## Next Steps

After fixing email issues:

1. Test with workflow document forwarding
2. Verify email reaches inbox (not spam)
3. Click email link to ensure it works
4. Test both email AND push notifications together

## Environment Variables Reference

```env
# REQUIRED for emails
SMTP_HOST=webmail.nakdns.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=serianamart@omnisuite-erp.com
SMTP_PASS=Seriana@1stlady
SMTP_FROM=Omnisuite ERP <serianamart@omnisuite-erp.com>

# OPTIONAL
SMTP_CC=optional-cc@example.com
WORKFLOW_FORCE_EMAIL=false   # Force emails even if user disabled
WORKFLOW_FORCE_PUSH=false    # Force push even if user disabled
APP_URL=http://localhost:3000  # For email links (auto-detected if not set)
```

## Still Need Help?

1. Run `/api/email-test/diagnose` and share the results (hide passwords)
2. Check `adm_system_logs` for error messages
3. Share server startup log
4. Verify SMTP credentials with email provider
