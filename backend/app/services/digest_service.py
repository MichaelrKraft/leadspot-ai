"""Morning digest service.

Builds + renders + sends the per-user 7am digest. Two modes (decided by
daemon-credential age vs now):

- **cold-start** (first 14 days from earliest daemon_credentials.created_at
  for the user): pulls from DigestUnmatchedSample. Format: "We saw N emails
  to people not yet in your CRM — review and add?"
- **steady** (after day 14): pulls from real Signal rows. Format:
  "3 leads you started but haven't followed up on" + "Top 3 hottest leads today."

Email sending is stubbed behind a tiny EmailSender interface — the actual
Resend/SendGrid wire-up is BLOCKED on Mike's API key, so for now we log
the rendered email body to backend/logs/digest_emails.log.

See `tasks/ghostlog-integration-plan.md` §3 Phase 1 week 3.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Contact,
    DaemonCredential,
    DigestUnmatchedSample,
    Signal,
    User,
)

logger = logging.getLogger(__name__)


COLD_START_WINDOW_DAYS = 14

# How far back "today" is for "Top 3 hottest leads today" — a 24h sliding
# window beats a calendar-day cutoff because the digest fires at 7am and a
# calendar-day cutoff would always show a sparse "today."
HOT_LEADS_LOOKBACK_HOURS = 24

# How far back "started but haven't followed up" looks. Plan says "leads you
# started but haven't followed up on"; we operationalize as: contacts that
# had ≥1 signal in the last 7 days but none in the last 48 hours.
STALLED_LEADS_RECENCY_DAYS = 7
STALLED_LEADS_GAP_HOURS = 48

# Default log file for stub email sending. Path is relative to the backend
# root when run via uvicorn (cwd=backend/). Caller can override.
DEFAULT_LOG_PATH = "logs/digest_emails.log"


# =============================================================================
# Mode decision
# =============================================================================

async def _is_cold_start(db: AsyncSession, user: User) -> bool:
    """User is in cold-start if their oldest daemon credential is <14 days old.

    No daemon credential at all → cold-start (gives them something useful in
    the digest until their daemon starts producing signals).
    """
    stmt = (
        select(DaemonCredential.created_at)
        .where(DaemonCredential.user_id == str(user.user_id))
        .order_by(DaemonCredential.created_at.asc())
        .limit(1)
    )
    result = await db.execute(stmt)
    earliest = result.scalar_one_or_none()
    if not earliest:
        return True
    cutoff = datetime.utcnow() - timedelta(days=COLD_START_WINDOW_DAYS)
    return earliest > cutoff


# =============================================================================
# Builders
# =============================================================================

async def _build_cold_start_items(
    db: AsyncSession, organization_id: str
) -> list[dict[str, Any]]:
    """Group recent unmatched samples by contact_match_key and return up to 5."""
    now = datetime.utcnow()
    stmt = (
        select(DigestUnmatchedSample)
        .where(
            DigestUnmatchedSample.organization_id == organization_id,
            DigestUnmatchedSample.expires_at > now,
        )
        .order_by(desc(DigestUnmatchedSample.observed_at))
        .limit(200)  # Bounded; we'll group + truncate below.
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()

    # Group by match_key, keep the most-recent summary + source_app per group.
    grouped: dict[str, dict[str, Any]] = {}
    for r in rows:
        key = r.contact_match_key
        if key not in grouped:
            grouped[key] = {
                "match_key": key,
                "summary": r.summary or "",
                "source_app": r.source_app or "",
                "observed_at": r.observed_at.isoformat() if r.observed_at else "",
                "occurrences": 1,
            }
        else:
            grouped[key]["occurrences"] += 1

    items = sorted(
        grouped.values(),
        key=lambda x: x.get("occurrences", 0),
        reverse=True,
    )[:5]
    return items


async def _build_stalled_lead_items(
    db: AsyncSession, organization_id: str
) -> list[dict[str, Any]]:
    """"Leads you started but haven't followed up on": contacts with activity
    in the last STALLED_LEADS_RECENCY_DAYS but no activity in the last
    STALLED_LEADS_GAP_HOURS.
    """
    now = datetime.utcnow()
    recency_cutoff = now - timedelta(days=STALLED_LEADS_RECENCY_DAYS)
    gap_cutoff = now - timedelta(hours=STALLED_LEADS_GAP_HOURS)

    # Per-contact most-recent observed_at within the recency window.
    stmt = (
        select(
            Signal.contact_id,
            func.max(Signal.observed_at).label("last_seen"),
            func.count(Signal.id).label("count"),
        )
        .where(
            Signal.organization_id == organization_id,
            Signal.contact_id.is_not(None),
            Signal.deleted_at.is_(None),
            Signal.observed_at >= recency_cutoff,
        )
        .group_by(Signal.contact_id)
        .having(func.max(Signal.observed_at) < gap_cutoff)
        .order_by(desc(func.max(Signal.observed_at)))
        .limit(3)
    )
    result = await db.execute(stmt)
    rows = result.all()
    if not rows:
        return []

    contact_ids = [r.contact_id for r in rows]
    contacts = await _fetch_contacts(db, organization_id, contact_ids)

    items: list[dict[str, Any]] = []
    for r in rows:
        c = contacts.get(r.contact_id)
        if not c:
            continue
        items.append(
            {
                "contact_id": r.contact_id,
                "display_name": _display_name(c),
                "company": c.company or "",
                "last_seen": r.last_seen.isoformat() if r.last_seen else "",
                "signal_count": int(r.count or 0),
            }
        )
    return items


async def _build_hot_lead_items(
    db: AsyncSession, organization_id: str
) -> list[dict[str, Any]]:
    """Top 3 hottest leads in the last 24h, ranked by signal count."""
    now = datetime.utcnow()
    cutoff = now - timedelta(hours=HOT_LEADS_LOOKBACK_HOURS)

    stmt = (
        select(
            Signal.contact_id,
            func.count(Signal.id).label("count"),
            func.max(Signal.observed_at).label("last_seen"),
        )
        .where(
            Signal.organization_id == organization_id,
            Signal.contact_id.is_not(None),
            Signal.deleted_at.is_(None),
            Signal.observed_at >= cutoff,
        )
        .group_by(Signal.contact_id)
        .order_by(desc(func.count(Signal.id)))
        .limit(3)
    )
    result = await db.execute(stmt)
    rows = result.all()
    if not rows:
        return []

    contact_ids = [r.contact_id for r in rows]
    contacts = await _fetch_contacts(db, organization_id, contact_ids)

    items: list[dict[str, Any]] = []
    for r in rows:
        c = contacts.get(r.contact_id)
        if not c:
            continue
        items.append(
            {
                "contact_id": r.contact_id,
                "display_name": _display_name(c),
                "company": c.company or "",
                "signal_count": int(r.count or 0),
                "last_seen": r.last_seen.isoformat() if r.last_seen else "",
            }
        )
    return items


async def _fetch_contacts(
    db: AsyncSession, organization_id: str, contact_ids: list[str]
) -> dict[str, Contact]:
    if not contact_ids:
        return {}
    stmt = select(Contact).where(
        Contact.organization_id == organization_id,
        Contact.id.in_(contact_ids),
    )
    result = await db.execute(stmt)
    return {c.id: c for c in result.scalars().all()}


def _display_name(c: Contact) -> str:
    name = f"{(c.first_name or '').strip()} {(c.last_name or '').strip()}".strip()
    if name:
        return name
    return c.email or "(unknown)"


# =============================================================================
# Public API: build / render / send
# =============================================================================

async def build_user_digest(user_id: str, db: AsyncSession) -> dict[str, Any]:
    """Return a digest payload for a user.

    Shape:
        {
          "user_email": str,
          "user_id": str,
          "mode": "cold_start" | "steady",
          "items": {
            cold_start: [...],          # only present in cold_start mode
            stalled: [...],             # only present in steady mode
            hot: [...],                 # only present in steady mode
          },
        }
    """
    stmt = select(User).where(User.user_id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise ValueError(f"User not found: {user_id}")

    org_id = str(user.organization_id)
    cold_start = await _is_cold_start(db, user)

    if cold_start:
        items = {"cold_start": await _build_cold_start_items(db, org_id)}
        mode = "cold_start"
    else:
        items = {
            "stalled": await _build_stalled_lead_items(db, org_id),
            "hot": await _build_hot_lead_items(db, org_id),
        }
        mode = "steady"

    return {
        "user_email": user.email,
        "user_id": str(user.user_id),
        "mode": mode,
        "items": items,
    }


def render_digest_email(payload: dict[str, Any]) -> str:
    """Plain-text email body. No templating lib — f-string + simple lists."""
    mode = payload.get("mode", "cold_start")
    user_email = payload.get("user_email", "")
    items = payload.get("items", {}) or {}

    lines: list[str] = []
    lines.append(f"Good morning, {user_email}")
    lines.append("")
    lines.append("Here's what Ghostlog noticed for you.")
    lines.append("")

    if mode == "cold_start":
        cold = items.get("cold_start") or []
        if not cold:
            lines.append(
                "Your daemon is running but hasn't seen anything to log yet — "
                "that's normal in the first day or two. Try sending an email "
                "from your Mac and we'll log it on your contact's timeline."
            )
        else:
            lines.append(
                f"We saw {len(cold)} {'person' if len(cold) == 1 else 'people'} "
                f"on your screen who aren't in your CRM yet. Review and add?"
            )
            lines.append("")
            for it in cold:
                source = it.get("source_app") or "screen"
                summary = it.get("summary") or "(no summary)"
                occ = it.get("occurrences") or 1
                lines.append(f"  - {summary} ({source}, seen {occ}x)")
        lines.append("")
        lines.append(
            "Tip: import a CSV in Settings → Import to make Ghostlog more "
            "accurate from day 1."
        )
    else:
        stalled = items.get("stalled") or []
        hot = items.get("hot") or []

        if stalled:
            lines.append(
                f"{len(stalled)} {'lead' if len(stalled) == 1 else 'leads'} "
                f"you started but haven't followed up on:"
            )
            for it in stalled:
                name = it.get("display_name", "(unknown)")
                co = it.get("company") or ""
                co_str = f" — {co}" if co else ""
                lines.append(f"  - {name}{co_str}")
            lines.append("")

        if hot:
            lines.append("Top hottest leads today:")
            for it in hot:
                name = it.get("display_name", "(unknown)")
                count = it.get("signal_count") or 0
                co = it.get("company") or ""
                co_str = f" — {co}" if co else ""
                lines.append(f"  - {name}{co_str} ({count} signals)")
            lines.append("")

        if not stalled and not hot:
            lines.append("Nothing pressing on your desk this morning. Nice.")

    lines.append("")
    lines.append("— LeadSpot.AI")
    return "\n".join(lines)


# =============================================================================
# Email sender (interface + stub impl)
# =============================================================================

class EmailSender:
    """Pluggable interface for the digest email sender.

    The real Resend/SendGrid impl will go here once Mike provides the API key.
    For the wedge we use FileLogEmailSender, which writes to a local logfile.
    """

    async def send(self, to: str, subject: str, body: str) -> None:  # pragma: no cover
        raise NotImplementedError


class FileLogEmailSender(EmailSender):
    """Stub: write email bodies to logs/digest_emails.log.

    Production-blocking: replace with a Resend/SendGrid client once Mike's
    API key is in env. The shape of `send` won't change.
    """

    def __init__(self, log_path: str = DEFAULT_LOG_PATH) -> None:
        self.log_path = log_path

    async def send(self, to: str, subject: str, body: str) -> None:
        try:
            path = Path(self.log_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("a", encoding="utf-8") as f:
                f.write("=" * 72 + "\n")
                f.write(f"To: {to}\n")
                f.write(f"Subject: {subject}\n")
                f.write(f"Sent-At: {datetime.utcnow().isoformat()}Z\n")
                f.write("\n")
                f.write(body)
                f.write("\n\n")
        except Exception:
            # Never let a logging failure break the scheduler loop.
            logger.exception("Failed to write digest email log to %s", self.log_path)


# Default sender — overridable for tests / future Resend wire-up.
_default_sender: EmailSender = FileLogEmailSender()


def set_email_sender(sender: EmailSender) -> None:
    """Override the module-level sender. Used for tests + the future Resend swap."""
    global _default_sender
    _default_sender = sender


async def send_digest(user: User, payload: dict[str, Any], db: AsyncSession) -> None:
    """Render + send the digest. STUBBED — actually appends to the log file.

    `db` is accepted for forward compatibility (e.g., recording a "digest sent
    at" timestamp on the user) but unused right now.
    """
    body = render_digest_email(payload)
    subject = (
        "Your Ghostlog morning digest"
        if payload.get("mode") == "steady"
        else "Welcome — your first Ghostlog digest"
    )
    await _default_sender.send(to=user.email, subject=subject, body=body)
