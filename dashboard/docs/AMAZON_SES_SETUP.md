# Amazon SES Setup Guide for Mautic

This guide will walk you through setting up Amazon Simple Email Service (SES) for your Mautic instance to enable reliable email sending.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Step 1: Create AWS Account & Access SES](#step-1-create-aws-account--access-ses)
3. [Step 2: Verify Your Domain](#step-2-verify-your-domain)
4. [Step 3: Configure SPF, DKIM, and DMARC](#step-3-configure-spf-dkim-and-dmarc)
5. [Step 4: Request Production Access](#step-4-request-production-access)
6. [Step 5: Create SMTP Credentials](#step-5-create-smtp-credentials)
7. [Step 6: Configure Mautic](#step-6-configure-mautic)
8. [Step 7: Test Email Delivery](#step-7-test-email-delivery)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- AWS account with billing enabled
- Domain name with DNS access
- Mautic instance installed and accessible
- Access to your domain's DNS settings (through your registrar or DNS provider)

---

## Step 1: Create AWS Account & Access SES

### 1.1 Create AWS Account
1. Go to [aws.amazon.com](https://aws.amazon.com)
2. Click **Create an AWS Account**
3. Follow the signup process (requires credit card)
4. Complete account verification

### 1.2 Access Amazon SES
1. Sign in to the AWS Management Console
2. In the search bar, type **SES** and select **Amazon Simple Email Service**
3. Select your preferred AWS region (e.g., `us-east-1`, `us-west-2`)
   - **Note**: Choose a region close to your server for best performance
   - Once you verify a domain in a region, you'll need to use that region's SMTP endpoint

---

## Step 2: Verify Your Domain

### 2.1 Add Domain to SES
1. In the SES console, go to **Configuration** → **Verified identities**
2. Click **Create identity**
3. Select **Domain**
4. Enter your domain (e.g., `yourdomain.com`)
5. Check **Use a custom MAIL FROM domain** (optional but recommended)
   - Enter: `mail.yourdomain.com`
6. Check **Publish DNS records to Route 53** only if your domain is hosted on Route 53
7. Click **Create identity**

### 2.2 Copy DNS Records
After creating the identity, AWS will provide DNS records. You'll see:

**DKIM Records** (3 CNAME records):
```
Name: abc123._domainkey.yourdomain.com
Type: CNAME
Value: abc123.dkim.amazonses.com
```

**Domain Verification Record** (1 TXT record):
```
Name: _amazonses.yourdomain.com
Type: TXT
Value: abc123def456...
```

**MAIL FROM Domain Records** (if you enabled custom MAIL FROM):
```
Name: mail.yourdomain.com
Type: MX
Value: 10 feedback-smtp.us-east-1.amazonses.com

Name: mail.yourdomain.com
Type: TXT
Value: "v=spf1 include:amazonses.com ~all"
```

---

## Step 3: Configure SPF, DKIM, and DMARC

### 3.1 Add DNS Records
Go to your domain registrar or DNS provider (e.g., Cloudflare, GoDaddy, Namecheap) and add the DNS records from Step 2.2.

**Example for Cloudflare:**
1. Log in to Cloudflare
2. Select your domain
3. Go to **DNS** → **Records**
4. Click **Add record**
5. Add each record with:
   - **Type**: CNAME, TXT, or MX (as specified)
   - **Name**: The subdomain part (e.g., `_amazonses` or `abc123._domainkey`)
   - **Content**: The value from AWS
   - **TTL**: Auto or 3600
   - **Proxy status**: DNS only (gray cloud)

### 3.2 Add SPF Record
If you don't already have an SPF record for your root domain:

```
Type: TXT
Name: @ (or your root domain)
Value: v=spf1 include:amazonses.com ~all
```

If you already have an SPF record, **modify** it to include `include:amazonses.com`:
```
v=spf1 include:_spf.google.com include:amazonses.com ~all
```

### 3.3 Add DMARC Record
Create a DMARC policy to improve email deliverability:

```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:postmaster@yourdomain.com
```

**DMARC Policy Levels:**
- `p=none` - Monitor only (recommended to start)
- `p=quarantine` - Send failing emails to spam
- `p=reject` - Reject failing emails entirely

### 3.4 Wait for Verification
- DNS propagation can take 5 minutes to 48 hours
- In SES console, refresh the identity page
- Status will change from "Pending verification" to "Verified" with a green checkmark

---

## Step 4: Request Production Access

By default, SES accounts are in **Sandbox Mode**, limiting you to:
- 200 emails per day
- 1 email per second
- Can only send to verified email addresses

### 4.1 Submit Production Access Request
1. In SES console, click **Account dashboard** (left sidebar)
2. Under "Sending statistics", click **Request production access**
3. Fill out the form:
   - **Mail type**: Transactional
   - **Website URL**: Your website URL
   - **Use case description**: Example below
   - **Additional contacts**: Your email
   - **Acknowledge**: Check the box

**Example Use Case Description:**
```
We are using Amazon SES to send transactional and marketing emails for our
marketing automation platform powered by Mautic. Our emails include:

1. Transactional emails: Welcome emails, password resets, account notifications
2. Marketing emails: Newsletters, product updates, promotional campaigns

We maintain our own opt-in/opt-out database via Mautic and comply with CAN-SPAM
and GDPR regulations. All emails include unsubscribe links and proper sender
information. We expect to send approximately 5,000-10,000 emails per day.
```

4. Click **Submit request**

**Approval Timeline:**
- Usually 24-48 hours
- AWS may ask follow-up questions via email
- Check your email and AWS Support Center for updates

---

## Step 5: Create SMTP Credentials

### 5.1 Generate SMTP Credentials
1. In SES console, go to **Account dashboard**
2. Click **Create SMTP credentials** (in the SMTP settings section)
3. Enter an IAM user name (e.g., `ses-smtp-user-mautic`)
4. Click **Create**
5. **IMPORTANT**: Download and save the credentials - you won't see them again!

You'll receive:
- **SMTP Username**: `AKIA...` (20 characters)
- **SMTP Password**: Long alphanumeric string (44 characters)

### 5.2 Note Your SMTP Endpoint
Based on your selected region:

| Region | SMTP Endpoint |
|--------|---------------|
| US East (N. Virginia) | `email-smtp.us-east-1.amazonaws.com` |
| US West (Oregon) | `email-smtp.us-west-2.amazonaws.com` |
| EU (Ireland) | `email-smtp.eu-west-1.amazonaws.com` |
| EU (Frankfurt) | `email-smtp.eu-central-1.amazonaws.com` |

**SMTP Port Options:**
- **Port 587**: TLS (recommended)
- **Port 465**: SSL
- **Port 25**: Unencrypted (not recommended)

---

## Step 6: Configure Mautic

### 6.1 Access Mautic Email Settings
1. Log in to your Mautic instance (`https://ploink.site`)
2. Click the gear icon (⚙️) in the top right
3. Go to **Configuration** → **Email Settings**

### 6.2 Configure SMTP Settings
Fill in the following fields:

**Service to send mail through:** `Other SMTP Server`

**SMTP host:**
```
email-smtp.us-east-1.amazonaws.com
```
*(Use your region's endpoint from Step 5.2)*

**SMTP port:** `587`

**SMTP encryption:** `TLS`

**SMTP authentication mode:** `Login`

**SMTP username:**
```
AKIA... (your SMTP username from Step 5.1)
```

**SMTP password:**
```
(your SMTP password from Step 5.1)
```

**From email:**
```
noreply@yourdomain.com
```
*(Must be a verified domain in SES)*

**From name:**
```
Your Company Name
```

### 6.3 Save Configuration
1. Scroll to the bottom
2. Click **Save & Close**

---

## Step 7: Test Email Delivery

### 7.1 Send Test Email from Mautic
1. In Mautic, go to **Configuration** → **Email Settings**
2. Scroll down to **Test Connection**
3. Enter your email address
4. Click **Send test email**
5. Check your inbox (and spam folder)

### 7.2 Verify in SES Console
1. Go to SES console → **Account dashboard**
2. Check **Sending statistics**:
   - **Sends**: Should increase by 1
   - **Delivery rate**: Should be 100%
   - **Bounce rate**: Should be 0%

### 7.3 Test with a Campaign
1. Create a simple email in Mautic
2. Create a segment with just your test contact
3. Send the email to that segment
4. Verify delivery and check SES statistics

---

## Troubleshooting

### Issue: Domain Not Verifying
**Symptoms:** Domain stays in "Pending verification" status

**Solutions:**
- Wait 24-48 hours for DNS propagation
- Use [whatsmydns.net](https://www.whatsmydns.net) to check global DNS propagation
- Verify you added the exact DNS records AWS provided (copy-paste to avoid typos)
- Check for duplicate DNS records
- Ensure DNS records are not proxied (in Cloudflare, use "DNS only" mode)

### Issue: "Email address is not verified"
**Symptoms:** Error when sending emails in Sandbox mode

**Solutions:**
- If in Sandbox mode, you can only send to verified email addresses
- Go to SES → **Verified identities** → **Create identity** → Email address
- Verify the recipient email address
- OR request production access (Step 4)

### Issue: High Bounce Rate
**Symptoms:** Emails bouncing frequently

**Solutions:**
- Clean your contact list (remove invalid emails)
- Implement double opt-in for new subscribers
- Monitor SES bounce notifications
- Check SPF/DKIM/DMARC records are correctly configured
- Use [mail-tester.com](https://www.mail-tester.com) to test email quality

### Issue: Emails Going to Spam
**Symptoms:** Emails landing in spam folders

**Solutions:**
- Verify SPF, DKIM, and DMARC are properly configured
- Warm up your sending IP by gradually increasing volume
- Avoid spam trigger words in subject lines
- Include unsubscribe links
- Maintain low complaint rate (<0.1%)
- Use authentic "From" addresses on your verified domain

### Issue: "Throttling" or Rate Limit Errors
**Symptoms:** Error messages about rate limits

**Solutions:**
- Check your SES sending limits in Account Dashboard
- If in Sandbox: Request production access
- If hitting production limits: Request a sending quota increase
- Implement retry logic in Mautic campaigns
- Distribute sends over time rather than bulk sending

### Issue: SMTP Authentication Failed
**Symptoms:** Mautic can't connect to SES

**Solutions:**
- Double-check SMTP username and password (no extra spaces)
- Verify you're using the correct regional endpoint
- Ensure port 587 is not blocked by your firewall
- Try port 465 with SSL encryption instead
- Verify IAM user has SES sending permissions

---

## Monitoring & Best Practices

### Monitor SES Metrics
Regularly check SES console for:
- **Bounce rate**: Should be <5%
- **Complaint rate**: Should be <0.1%
- **Sending quota usage**: Monitor daily limits

### Set Up SNS Notifications
1. Go to SES → **Verified identities** → Select your domain
2. Go to **Notifications** tab
3. Configure SNS topics for:
   - Bounces
   - Complaints
   - Deliveries (optional)

### Maintain List Hygiene
- Remove hard bounces immediately
- Remove soft bounces after 3-5 attempts
- Honor unsubscribe requests instantly
- Implement double opt-in for new subscribers

### Warm Up Your Sending
If you're a new sender:
- Start with 50-100 emails per day
- Gradually increase by 50% every 3-4 days
- Reach full volume over 4-6 weeks
- This builds sender reputation

---

## Additional Resources

- [AWS SES Documentation](https://docs.aws.amazon.com/ses/)
- [Mautic Email Configuration](https://docs.mautic.org/en/setup/how-to-set-up-email-delivery)
- [SPF Record Checker](https://mxtoolbox.com/spf.aspx)
- [DKIM Record Checker](https://mxtoolbox.com/dkim.aspx)
- [DMARC Record Checker](https://mxtoolbox.com/dmarc.aspx)
- [Email Tester](https://www.mail-tester.com)

---

## Support

If you encounter issues not covered in this guide:
- Check AWS SES documentation
- Review Mautic community forums
- Contact AWS Support (if you have a support plan)
- Check your Mautic error logs: `/var/www/mautic-yourinstance/var/logs/`

---

**Last Updated:** December 2024
**For:** Mautic Platform Dashboard
