# Email Delivery - Quick Test Guide

## Problem

✓ Push notifications working  
✗ Emails not being sent

## Quick Fix Steps

### Step 1: Test Email Configuration (2 minutes)

Run this command to verify your SMTP settings:

```bash
cd server
node scripts/test-email-config.js
```

**What to expect:**

- ✓ All environment variables loaded
- ✓ SMTP connection verified
- ✓ Test email sent to serianamart@omnisuite-erp.com

**If it fails:**

- Read the error message carefully
- Common issues:
  - "Cannot connect" = Firewall/network issue
  - "Invalid login" = Wrong credentials in .env
  - "Authentication failed" = Account needs SMTP enabled

### Step 2: Check Inbox

Look for email from: `Omnisuite ERP <serianamart@omnisuite-erp.com>`

Check:

1. **Inbox** - Normal location
2. **Spam/Junk** - May need to whitelist sender
3. **Promotions/Updates** - Gmail may categorize it

### Step 3: Verify .env Has SMTP Settings

Open `.env` file and ensure these lines exist:

```env
SMTP_HOST=webmail.nakdns.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=serianamart@omnisuite-erp.com
SMTP_PASS=Seriana@1stlady
SMTP_FROM=Omnisuite ERP <serianamart@omnisuite-erp.com>
```

If missing:

1. Add the lines above
2. Restart the server
3. Re-run the test script

### Step 4: Test Through API (if test-email-config.js passes)

If the standalone test passes, the API endpoints should also work:

```bash
# Get current email status
curl -X GET http://localhost:4002/api/email-test/status \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Run full diagnostics
curl -X POST http://localhost:4002/api/email-test/diagnose \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### Step 5: Test With Actual Workflow

1. Log in to the application
2. Create a document (Sales Order, PO, etc.)
3. Forward it to another user with "Notify" selected
4. Check logs for email send attempts:

```sql
SELECT * FROM adm_system_logs
WHERE module_name = 'DocumentForward'
ORDER BY event_time DESC LIMIT 5;
```

Look for:

- `action = 'EMAIL_SENT'` = Success! Email sent.
- `action = 'EMAIL_ERROR'` = Error occurred. Check message column.
- `action = 'EMAIL_SKIPPED'` = Email was skipped (user has email disabled).

## Troubleshooting by Error

### "Mailer not configured"

- Check .env file has all SMTP\_\* variables
- Restart server
- Run test script again

### "ECONNREFUSED - Connection refused"

- SMTP server unreachable
- Try:
  ```bash
  # Test connectivity (Windows)
  Test-NetConnection -ComputerName webmail.nakdns.com -Port 465
  ```
- Firewall may be blocking port 465
- Contact hosting provider if port is blocked

### "Invalid login (535)"

- Wrong username or password
- Verify:
  - SMTP_USER=serianamart@omnisuite-erp.com
  - SMTP_PASS=Seriana@1stlady
- Check for extra spaces in .env file
- Password may have special characters - verify exact text

### "5.7.1 Authentication unsuccessful"

- Email account may not have SMTP enabled
- Solution options:
  1. Enable SMTP in email provider settings
  2. Use app-specific password if available
  3. Allow "Less Secure Applications" (if applicable)
  4. Contact hosting support

### "Unknown authentication method"

- Nodemailer version may be outdated
- Update: `npm install nodemailer@latest`
- Restart server

## Did It Work?

**Yes** = Move on!

- Emails now send when documents are forwarded
- Push notifications + Emails both working ✓

**No** = Try this:

1. **Run test script again** - Get exact error
2. **Check spam folder** - Some emails go there
3. **Verify SMTP credentials** - Wrong password is common
4. **Check firewall** - Port 465 may be blocked
5. **Contact hosting provider** - They can verify SMTP settings are live

## Email Integration Points

Once email is working:

### When Do Emails Send?

1. **Document Forwarded** → Email to approver notified
2. **Workflow Initiated** → Email to first approver
3. **Document Approved** → Email to originator (if enabled)
4. **Action Requested** → Email to assigned user

### What Email Contains?

- Document reference #
- Approver/action requested
- Link to document in system
- Action needed with button

### How to Disable Email?

User can disable email notifications in their profile settings:

- User Profile → Notification Preferences → Uncheck "Email"

## Quick Reference

```bash
# Test email config (standalone)
node server/scripts/test-email-config.js

# Check logs for email activity
# In database: SELECT * FROM adm_system_logs WHERE module_name='DocumentForward'

# Test API (with auth token)
POST http://localhost:4002/api/email-test/diagnose
POST http://localhost:4002/api/email-test/send (with recipient)
GET http://localhost:4002/api/email-test/status

# Server logs show startup status
# Look for: "Mailer configured: ✓ YES"
```

## Next Steps After Email Works

1. Configure email branding (logo, colors, footer)
2. Add email templates for other modules
3. Set up CC for audit trail (optional)
4. Test with multiple users
5. Monitor email delivery in system logs

---

**Still having issues?**

1. Check the detailed guide: [EMAIL_TROUBLESHOOTING_GUIDE.md](EMAIL_TROUBLESHOOTING_GUIDE.md)
2. Monitor system logs: `adm_system_logs` table
3. Enable debug mode in mailer.js for more detailed errors
4. Contact your email provider's support team
