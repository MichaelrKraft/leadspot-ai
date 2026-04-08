"""
Demo seed data — runs on startup for demo@leadspot.ai user.
Creates demo campaigns and contacts if none exist yet.
"""

import logging
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models.campaign import Campaign
from app.models.calendar_event import CalendarEvent
from app.models.email import Email
from app.models.segment import Segment
from app.routers.conversations import Conversation, ConversationMessage, _uuid

logger = logging.getLogger(__name__)


DEMO_EMAIL = "demo@leadspot.ai"

DEMO_CAMPAIGNS = [
    {
        "name": "Welcome Email Sequence",
        "status": "Active",
        "type": "Email",
        "leads": 142,
        "opened": 98,
        "replied": 23,
    },
    {
        "name": "Q2 Outbound — SMB",
        "status": "Active",
        "type": "Multi-step",
        "leads": 87,
        "opened": 54,
        "replied": 12,
    },
    {
        "name": "Re-engagement SMS Blast",
        "status": "Paused",
        "type": "SMS",
        "leads": 310,
        "opened": 201,
        "replied": 44,
    },
    {
        "name": "Cold Outreach — Enterprise",
        "status": "Draft",
        "type": "Email",
        "leads": 0,
        "opened": 0,
        "replied": 0,
    },
]


DEMO_SEGMENTS = [
    {
        "name": "VIP Customers",
        "description": "High-value accounts with 3+ purchases",
        "color": "#6366f1",
        "contact_count": 48,
        "filter_type": "dynamic",
    },
    {
        "name": "Trial Users",
        "description": "Active trial accounts in last 14 days",
        "color": "#10b981",
        "contact_count": 67,
        "filter_type": "dynamic",
    },
    {
        "name": "Churned",
        "description": "No activity in 60+ days",
        "color": "#f43f5e",
        "contact_count": 134,
        "filter_type": "manual",
    },
]


DEMO_EMAILS = [
    {
        "subject": "Welcome to LeadSpot!",
        "status": "Sent",
        "from_addr": "demo@leadspot.ai",
        "to_addr": "sarah.johnson@acmecorp.com",
        "body": "Hi Sarah, welcome to LeadSpot! We're excited to have you on board.",
        "email_type": "Outbound",
        "opened": True,
        "replied": False,
        "sent_at": datetime(2026, 3, 15, 10, 0, 0),
    },
    {
        "subject": "Your March Marketing Digest",
        "status": "Sent",
        "from_addr": "demo@leadspot.ai",
        "to_addr": "marcus.lee@techflow.io",
        "body": "Hi Marcus, here's your monthly marketing roundup for March.",
        "email_type": "Outbound",
        "opened": True,
        "replied": True,
        "sent_at": datetime(2026, 3, 20, 9, 30, 0),
    },
    {
        "subject": "Great talking with you!",
        "status": "Draft",
        "from_addr": "demo@leadspot.ai",
        "to_addr": "priya.patel@brightrealty.com",
        "body": "Hi Priya, it was great connecting last week. I wanted to follow up on our conversation.",
        "email_type": "Outbound",
        "opened": False,
        "replied": False,
        "sent_at": None,
    },
    {
        "subject": "Re: LeadSpot proposal",
        "status": "Sent",
        "from_addr": "derek.walsh@nextstep.agency",
        "to_addr": "demo@leadspot.ai",
        "body": "Thanks for the proposal! We'd love to move forward. Can we schedule a call?",
        "email_type": "Inbound",
        "opened": True,
        "replied": True,
        "sent_at": datetime(2026, 3, 22, 14, 0, 0),
    },
]


DEMO_CALENDAR_EVENTS = [
    {
        "title": "Discovery Call — Acme Corp",
        "type": "call",
        "offset_days": 0,
        "start_hour": 10,
        "duration_minutes": 30,
        "contact_name": "Sarah Johnson",
        "notes": "Intro call to discuss their CRM needs. Warm lead from LinkedIn.",
    },
    {
        "title": "Product Demo — TechFlow",
        "type": "meeting",
        "offset_days": 1,
        "start_hour": 14,
        "duration_minutes": 60,
        "contact_name": "Marcus Lee",
        "notes": "Full demo of LeadSpot AI agents. They have 25 sales reps.",
    },
    {
        "title": "Follow-up — Bright Realty",
        "type": "follow-up",
        "offset_days": 3,
        "start_hour": 11,
        "duration_minutes": 15,
        "contact_name": "Priya Patel",
        "notes": "Check in after last week's proposal. Decision expected by end of month.",
    },
    {
        "title": "Onboarding Call — NextStep Agency",
        "type": "call",
        "offset_days": 5,
        "start_hour": 9,
        "duration_minutes": 45,
        "contact_name": "Derek Walsh",
        "notes": "New customer onboarding. Walk through voice agent setup.",
    },
    {
        "title": "Q2 Pipeline Review",
        "type": "meeting",
        "offset_days": 6,
        "start_hour": 15,
        "duration_minutes": 60,
        "contact_name": None,
        "notes": "Internal review of Q2 pipeline and targets.",
    },
]


async def seed_demo_data() -> None:
    """Seed demo campaigns, calendar events, segments, and conversations for demo@leadspot.ai if none exist."""
    async with async_session_maker() as session:
        try:
            await _seed_campaigns(session)
            await _seed_calendar_events(session)
            await _seed_segments(session)
            await _seed_emails(session)
            await _seed_conversations(session)
        except Exception as e:
            logger.warning(f"Seed data error (non-fatal): {e}")
            await session.rollback()


async def _seed_campaigns(session: AsyncSession) -> None:
    """Create demo campaigns for the demo user if they have none."""
    # Import here to avoid circular imports at module load time
    from app.models.user import User

    # Find demo user
    result = await session.execute(
        select(User).where(User.email == DEMO_EMAIL)
    )
    user = result.scalar_one_or_none()
    if not user:
        logger.info("Demo user not found — skipping campaign seed")
        return

    # Check if campaigns already exist
    existing = await session.execute(
        select(Campaign).where(Campaign.user_id == str(user.id)).limit(1)
    )
    if existing.scalar_one_or_none():
        logger.info("Demo campaigns already seeded — skipping")
        return

    # Create demo campaigns
    for data in DEMO_CAMPAIGNS:
        campaign = Campaign(
            name=data["name"],
            status=data["status"],
            type=data["type"],
            leads=data["leads"],
            opened=data["opened"],
            replied=data["replied"],
            user_id=str(user.id),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        session.add(campaign)

    await session.commit()
    logger.info(f"Seeded {len(DEMO_CAMPAIGNS)} demo campaigns for {DEMO_EMAIL}")


async def _seed_calendar_events(session: AsyncSession) -> None:
    """Create demo calendar events for the demo user if none exist."""
    from app.models.user import User

    # Find demo user
    result = await session.execute(
        select(User).where(User.email == DEMO_EMAIL)
    )
    user = result.scalar_one_or_none()
    if not user:
        logger.info("Demo user not found — skipping calendar event seed")
        return

    # Check if calendar events already exist for this org
    existing = await session.execute(
        select(CalendarEvent).where(CalendarEvent.org_id == str(user.organization_id)).limit(1)
    )
    if existing.scalar_one_or_none():
        logger.info("Demo calendar events already seeded — skipping")
        return

    # Seed events spread over the next 7 days from today
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    for data in DEMO_CALENDAR_EVENTS:
        event_start = today + timedelta(days=data["offset_days"], hours=data["start_hour"])
        event_end = event_start + timedelta(minutes=data["duration_minutes"])
        event = CalendarEvent(
            title=data["title"],
            type=data["type"],
            start=event_start,
            end=event_end,
            contact_name=data["contact_name"],
            notes=data["notes"],
            org_id=str(user.organization_id),
        )
        session.add(event)

    await session.commit()
    logger.info(f"Seeded {len(DEMO_CALENDAR_EVENTS)} demo calendar events for {DEMO_EMAIL}")


async def _seed_segments(session: AsyncSession) -> None:
    """Create demo segments for the demo user if they have none."""
    from app.models.user import User

    # Find demo user
    result = await session.execute(
        select(User).where(User.email == DEMO_EMAIL)
    )
    user = result.scalar_one_or_none()
    if not user:
        logger.info("Demo user not found — skipping segment seed")
        return

    # Check if segments already exist
    existing = await session.execute(
        select(Segment).where(Segment.user_id == str(user.id)).limit(1)
    )
    if existing.scalar_one_or_none():
        logger.info("Demo segments already seeded — skipping")
        return

    # Create demo segments
    for data in DEMO_SEGMENTS:
        segment = Segment(
            name=data["name"],
            description=data["description"],
            color=data["color"],
            contact_count=data["contact_count"],
            filter_type=data["filter_type"],
            user_id=str(user.id),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        session.add(segment)

    await session.commit()
    logger.info(f"Seeded {len(DEMO_SEGMENTS)} demo segments for {DEMO_EMAIL}")


async def _seed_emails(session: AsyncSession) -> None:
    """Create demo emails for the demo user if they have none."""
    from app.models.user import User

    result = await session.execute(
        select(User).where(User.email == DEMO_EMAIL)
    )
    user = result.scalar_one_or_none()
    if not user:
        logger.info("Demo user not found — skipping email seed")
        return

    existing = await session.execute(
        select(Email).where(Email.user_id == str(user.id)).limit(1)
    )
    if existing.scalar_one_or_none():
        logger.info("Demo emails already seeded — skipping")
        return

    for data in DEMO_EMAILS:
        email = Email(
            subject=data["subject"],
            status=data["status"],
            from_addr=data["from_addr"],
            to_addr=data["to_addr"],
            body=data["body"],
            email_type=data["email_type"],
            opened=data["opened"],
            replied=data["replied"],
            sent_at=data["sent_at"],
            user_id=str(user.id),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        session.add(email)

    await session.commit()
    logger.info(f"Seeded {len(DEMO_EMAILS)} demo emails for {DEMO_EMAIL}")


async def _seed_conversations(session: AsyncSession) -> None:
    """Create demo conversations for the demo user's org if none exist."""
    from app.models.user import User

    result = await session.execute(select(User).where(User.email == DEMO_EMAIL))
    user = result.scalar_one_or_none()
    if not user:
        logger.info("Demo user not found — skipping conversation seed")
        return

    org_id = str(user.organization_id)

    existing = await session.execute(
        select(Conversation).where(Conversation.org_id == org_id).limit(1)
    )
    if existing.scalar_one_or_none():
        logger.info("Demo conversations already seeded — skipping")
        return

    now = datetime.utcnow()

    demo_convos = [
        {
            "type": "email",
            "contact_name": "Sarah Johnson",
            "contact_email": "sarah@acme.com",
            "subject": "Enterprise plan proposal",
            "last_message": "Thanks for the proposal! Let me review with my team.",
            "unread_count": 1,
            "offset_hours": 2,
            "messages": [
                {
                    "direction": "outbound",
                    "body": "Hi Sarah,\n\nFollowing up on our conversation about the Enterprise plan. I've attached the updated proposal with the custom pricing we discussed.\n\nLet me know if you have any questions!",
                    "offset_hours": 26,
                },
                {
                    "direction": "inbound",
                    "body": "Thanks for the proposal! Let me review with my team. We should have a decision by end of week.",
                    "offset_hours": 2,
                },
            ],
        },
        {
            "type": "sms",
            "contact_name": "James Wilson",
            "contact_email": "james@innovate.co",
            "subject": None,
            "last_message": "Got it, see you at 2pm tomorrow!",
            "unread_count": 0,
            "offset_hours": 48,
            "messages": [
                {
                    "direction": "outbound",
                    "body": "Hi James, confirming our meeting tomorrow at 2pm. Looking forward to it!",
                    "offset_hours": 50,
                },
                {
                    "direction": "inbound",
                    "body": "Got it, see you at 2pm tomorrow!",
                    "offset_hours": 48,
                },
            ],
        },
        {
            "type": "email",
            "contact_name": "Emma Davis",
            "contact_email": "emma@scaleup.dev",
            "subject": "API webhook question",
            "last_message": "Perfect, I'll check it out. Thanks!",
            "unread_count": 0,
            "offset_hours": 72,
            "messages": [
                {
                    "direction": "inbound",
                    "body": "Love the product! Quick question about the API — do you support webhooks for contact updates?",
                    "offset_hours": 74,
                },
                {
                    "direction": "outbound",
                    "body": "Hi Emma! Yes, we support webhooks. Configure them in Settings > Integrations > Webhooks.",
                    "offset_hours": 72,
                },
                {
                    "direction": "inbound",
                    "body": "Perfect, I'll check it out. Thanks!",
                    "offset_hours": 71,
                },
            ],
        },
    ]

    for data in demo_convos:
        convo_id = _uuid()
        convo = Conversation(
            id=convo_id,
            type=data["type"],
            contact_name=data["contact_name"],
            contact_email=data["contact_email"],
            subject=data["subject"],
            last_message=data["last_message"],
            last_message_at=now - timedelta(hours=data["offset_hours"]),
            unread_count=data["unread_count"],
            org_id=org_id,
            created_at=now - timedelta(hours=data["offset_hours"] + 1),
        )
        session.add(convo)

        for msg_data in data["messages"]:
            msg = ConversationMessage(
                id=_uuid(),
                conversation_id=convo_id,
                direction=msg_data["direction"],
                body=msg_data["body"],
                sent_at=now - timedelta(hours=msg_data["offset_hours"]),
            )
            session.add(msg)

    await session.commit()
    logger.info(f"Seeded {len(demo_convos)} demo conversations for {DEMO_EMAIL}")
