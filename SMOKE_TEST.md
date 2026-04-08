# LeadSpot.ai — Smoke Test Checklist

Run this checklist before every beta release to verify critical email flows.

## Prerequisites

- [ ] Backend is running: `cd backend && uvicorn app.main:app --reload`
- [ ] Agent-service is running: `cd agent-service && npm run dev`
- [ ] Frontend is running: `cd frontend && npm run dev`
- [ ] `RESEND_API_KEY` is set in `agent-service/.env`
- [ ] `RESEND_WEBHOOK_SECRET` is set in `agent-service/.env`
- [ ] `FROM_EMAIL` uses a verified Resend domain

## Test 1: Basic Email Send

1. Navigate to http://localhost:3006
2. Go to Campaigns page
3. Open any campaign
4. Click "Send Test" (paper-plane icon)
5. Enter your personal email address
6. Click "Send Test"

**Expected**:
- [ ] Email arrives in your inbox within 60 seconds
- [ ] Email contains subject line
- [ ] Email footer has physical address
- [ ] Email footer has "Unsubscribe" link

## Test 2: Unsubscribe Flow

1. Click the "Unsubscribe" link in the test email from Test 1
2. Page should load showing unsubscribe confirmation

**Expected**:
- [ ] Browser shows "You've been unsubscribed" page
- [ ] Check suppression: `curl http://localhost:8000/api/suppressions/youremail@example.com`
- [ ] Response should be HTTP 200 with reason "unsubscribed"

## Test 3: Suppression Enforcement

1. Without clearing the suppression, go back to Campaigns
2. Send another test email to the same email address

**Expected**:
- [ ] UI shows "Email address is suppressed" or similar message
- [ ] No email is delivered (check inbox — nothing new should arrive)

## Test 4: Bounce Webhook (Manual Test)

Use Resend's test webhook payload to simulate a hard bounce:
```bash
# Replace with your actual webhook secret and URL
curl -X POST http://localhost:3008/api/webhooks/resend \
  -H "Content-Type: application/json" \
  -H "svix-id: test-id-123" \
  -H "svix-timestamp: $(date +%s)" \
  -H "svix-signature: v1,test-signature" \
  -d '{"type":"email.bounced","data":{"email_address":"bounced@example.com","bounce":{"type":"hard"}}}'
```

Note: Use Resend's dashboard "Test Webhooks" feature for a valid signed payload.

**Expected**:
- [ ] `curl http://localhost:8000/api/suppressions/bounced@example.com` returns 200
- [ ] Reason is "hard_bounce"

## Test 5: Campaign Action Plan

1. Go to Contacts page
2. Create or find a test contact with your email address
3. Enroll the contact in a campaign with email steps
4. Wait for the first email step to execute (or trigger manually)

**Expected**:
- [ ] Email arrives in inbox
- [ ] Email recorded in backend: `curl http://localhost:8000/api/emails` — should show new "Sent" email

## Sign-Off

| Test | Pass/Fail | Date | Tester |
|------|-----------|------|--------|
| Test 1: Basic Send | | | |
| Test 2: Unsubscribe | | | |
| Test 3: Suppression | | | |
| Test 4: Bounce Webhook | | | |
| Test 5: Action Plan | | | |

All tests passing: ☐ Yes ☐ No

Notes:
