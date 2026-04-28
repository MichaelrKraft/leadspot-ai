"""
Twilio Status Webhook

POST /api/webhooks/twilio/status

Receives Twilio call-status callbacks and logs them for analytics.
NOT responsible for call routing — routing is handled by LiveKit SIP directly.
The VoiceCall DB record is owned by the dashboard Next.js app; only the
dashboard webhook (LiveKit) writes to that table.  This endpoint exists so
Twilio has a verified destination for status events and so we can emit
structured logs for monitoring/alerting without coupling to the Next.js DB.
"""

import logging
import os

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from twilio.request_validator import RequestValidator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


@router.post("/twilio/status")
async def twilio_call_status(request: Request) -> Response:
    """
    Twilio status callback endpoint.

    Validates the Twilio signature, extracts call-status fields, emits a
    structured log entry, and returns an empty TwiML <Response> body.  Twilio
    requires a 200-range response with valid XML; any non-200 causes retries.
    """
    # 1. Read form-encoded body (Twilio always sends application/x-www-form-urlencoded)
    form_data = dict(await request.form())

    # 2. Validate Twilio signature to reject forged requests
    auth_token = os.getenv("TWILIO_AUTH_TOKEN", "")
    if auth_token:
        validator = RequestValidator(auth_token)

        # Reconstruct the exact URL Twilio called, respecting reverse-proxy headers
        scheme = request.headers.get("x-forwarded-proto", "https")
        host = (
            request.headers.get("x-forwarded-host")
            or request.headers.get("host", "")
        )
        url = f"{scheme}://{host}{request.url.path}"

        signature = request.headers.get("X-Twilio-Signature", "")

        if not validator.validate(url, form_data, signature):
            logger.warning(
                "Rejected Twilio request with invalid signature",
                extra={"url": url, "call_sid": form_data.get("CallSid", "")},
            )
            raise HTTPException(status_code=403, detail="Invalid Twilio signature")
    else:
        # No auth token configured — skip validation but warn loudly
        logger.warning(
            "TWILIO_AUTH_TOKEN not set; skipping signature validation. "
            "Set this environment variable in production."
        )

    # 3. Extract standard Twilio status callback fields
    call_sid = form_data.get("CallSid", "")
    call_status = form_data.get("CallStatus", "")
    to_number = form_data.get("To", "")
    from_number = form_data.get("From", "")
    call_duration = form_data.get("CallDuration", "0")
    direction = form_data.get("Direction", "")
    error_code = form_data.get("ErrorCode", "")
    error_message = form_data.get("ErrorMessage", "")

    # 4. Emit structured log for monitoring / analytics pipelines
    log_extra = {
        "call_sid": call_sid,
        "status": call_status,
        "to": to_number,
        "from": from_number,
        "duration_seconds": call_duration,
        "direction": direction,
    }

    if error_code:
        log_extra["error_code"] = error_code
        log_extra["error_message"] = error_message
        logger.error("Twilio call ended with error", extra=log_extra)
    else:
        logger.info("Twilio call status callback", extra=log_extra)

    # 5. Return empty TwiML — Twilio requires a 200 with valid XML
    return Response(
        content='<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        media_type="application/xml",
    )
