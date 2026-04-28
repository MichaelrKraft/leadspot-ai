"""
Demo seed data — runs on startup for demo@leadspot.ai user,
and called on new user registration to populate fresh accounts.
"""

import json
import logging
import uuid
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models.campaign import Campaign
from app.models.calendar_event import CalendarEvent
from app.models.contact import Contact
from app.models.deal import Deal
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


DEMO_CONTACTS = [
    {"first_name": "Sarah", "last_name": "Johnson", "email": "sarah.johnson@acmecorp.com", "company": "Acme Corp", "phone": "555-0101", "tags": ["hot-lead", "enterprise"], "points": 850},
    {"first_name": "Marcus", "last_name": "Lee", "email": "marcus.lee@techflow.io", "company": "TechFlow Inc", "phone": "555-0102", "tags": ["demo-scheduled", "saas"], "points": 720},
    {"first_name": "Priya", "last_name": "Patel", "email": "priya.patel@brightrealty.com", "company": "Bright Realty", "phone": "555-0103", "tags": ["nurture", "real-estate"], "points": 540},
    {"first_name": "Derek", "last_name": "Walsh", "email": "derek.walsh@nextstep.agency", "company": "NextStep Agency", "phone": "555-0104", "tags": ["closed-won", "agency"], "points": 920},
    {"first_name": "James", "last_name": "Wilson", "email": "james.wilson@innovate.co", "company": "Innovate Co", "phone": "555-0105", "tags": ["trial", "startup"], "points": 310},
    {"first_name": "Emma", "last_name": "Davis", "email": "emma.davis@scaleup.dev", "company": "ScaleUp Dev", "phone": "555-0106", "tags": ["trial", "saas"], "points": 430},
    {"first_name": "Ryan", "last_name": "Martinez", "email": "ryan.martinez@growthlab.com", "company": "GrowthLab", "phone": "555-0107", "tags": ["hot-lead"], "points": 780},
    {"first_name": "Olivia", "last_name": "Chen", "email": "olivia.chen@fusionworks.io", "company": "FusionWorks", "phone": "555-0108", "tags": ["nurture", "enterprise"], "points": 620},
    {"first_name": "Noah", "last_name": "Thompson", "email": "noah.thompson@buildfast.com", "company": "BuildFast", "phone": "555-0109", "tags": ["demo-scheduled"], "points": 490},
    {"first_name": "Ava", "last_name": "Rodriguez", "email": "ava.rodriguez@pixelcraft.co", "company": "PixelCraft", "phone": "555-0110", "tags": ["cold"], "points": 150},
    {"first_name": "Liam", "last_name": "Anderson", "email": "liam.anderson@vertexsales.com", "company": "Vertex Sales", "phone": "555-0111", "tags": ["hot-lead", "saas"], "points": 810},
    {"first_name": "Sophia", "last_name": "Brown", "email": "sophia.brown@nexagroup.com", "company": "Nexa Group", "phone": "555-0112", "tags": ["nurture"], "points": 380},
    {"first_name": "Ethan", "last_name": "Taylor", "email": "ethan.taylor@clarityhq.com", "company": "Clarity HQ", "phone": "555-0113", "tags": ["trial", "startup"], "points": 260},
    {"first_name": "Mia", "last_name": "Harris", "email": "mia.harris@orbitech.io", "company": "OrbiTech", "phone": "555-0114", "tags": ["enterprise", "hot-lead"], "points": 890},
    {"first_name": "Lucas", "last_name": "Clark", "email": "lucas.clark@springboard.ai", "company": "Springboard AI", "phone": "555-0115", "tags": ["saas", "demo-scheduled"], "points": 650},
    {"first_name": "Isabella", "last_name": "Lewis", "email": "isabella.lewis@motionmedia.co", "company": "Motion Media", "phone": "555-0116", "tags": ["agency", "cold"], "points": 200},
    {"first_name": "Mason", "last_name": "Walker", "email": "mason.walker@highgear.com", "company": "HighGear", "phone": "555-0117", "tags": ["nurture", "real-estate"], "points": 470},
    {"first_name": "Charlotte", "last_name": "Hall", "email": "charlotte.hall@driftwave.io", "company": "DriftWave", "phone": "555-0118", "tags": ["trial"], "points": 330},
    {"first_name": "Aiden", "last_name": "Young", "email": "aiden.young@peaklabs.com", "company": "Peak Labs", "phone": "555-0119", "tags": ["hot-lead", "startup"], "points": 760},
    {"first_name": "Amelia", "last_name": "Scott", "email": "amelia.scott@corebridge.co", "company": "CoreBridge", "phone": "555-0120", "tags": ["enterprise"], "points": 580},
]


DEMO_DEALS = [
    {
        "title": "Acme Corp — Enterprise License",
        "contact_name": "Sarah Johnson",
        "value": 28000.0,
        "stage": "proposal",
        "priority": "high",
        "notes": "3-year contract for 50 seats. Legal review in progress.",
    },
    {
        "title": "TechFlow Inc — Pro Upgrade",
        "contact_name": "Marcus Lee",
        "value": 4680.0,
        "stage": "qualified",
        "priority": "medium",
        "notes": "Currently on trial. Decision by end of quarter.",
    },
    {
        "title": "Bright Realty — Starter Plan",
        "contact_name": "Priya Patel",
        "value": 1188.0,
        "stage": "negotiation",
        "priority": "medium",
        "notes": "Wants 20% discount for annual commitment.",
    },
    {
        "title": "NextStep Agency — Annual",
        "contact_name": "Derek Walsh",
        "value": 9480.0,
        "stage": "lead",
        "priority": "high",
        "notes": "Referred by existing customer. Very warm lead.",
    },
]


async def seed_org_demo_data(
    organization_id: str,
    user_id: str,
    session: AsyncSession,
) -> None:
    """
    Seed demo data for a newly registered org. Idempotent — checks demo_seeded_at
    before inserting. Should be called wrapped in try/except so failure never blocks
    registration.
    """
    from app.models.organization import Organization

    result = await session.execute(
        select(Organization).where(Organization.organization_id == organization_id)
    )
    org = result.scalar_one_or_none()
    if not org or org.demo_seeded_at is not None:
        return

    await _seed_contacts_for_org(session, organization_id)
    await _seed_deals_for_org(session, organization_id)
    await _seed_campaigns_for_user(session, user_id)
    await _seed_calendar_events_for_org(session, organization_id)
    await _seed_segments_for_user(session, user_id)

    org.demo_seeded_at = datetime.utcnow()
    await session.commit()
    logger.info(f"Seeded demo data for org {organization_id}")


async def _seed_contacts_for_org(session: AsyncSession, organization_id: str) -> None:
    existing = await session.execute(
        select(Contact).where(Contact.organization_id == organization_id).limit(1)
    )
    if existing.scalar_one_or_none():
        return

    now = datetime.utcnow()
    for data in DEMO_CONTACTS:
        contact = Contact(
            id=str(uuid.uuid4()),
            first_name=data["first_name"],
            last_name=data["last_name"],
            email=data["email"],
            company=data["company"],
            phone=data["phone"],
            tags_json=json.dumps(data["tags"]),
            points=data["points"],
            last_active=now - timedelta(days=data["points"] % 30),
            organization_id=organization_id,
            is_demo=True,
            created_at=now,
            updated_at=now,
        )
        session.add(contact)
    await session.flush()


async def _seed_deals_for_org(session: AsyncSession, organization_id: str) -> None:
    existing = await session.execute(
        select(Deal).where(Deal.org_id == organization_id).limit(1)
    )
    if existing.scalar_one_or_none():
        return

    now = datetime.utcnow()
    for data in DEMO_DEALS:
        deal = Deal(
            title=data["title"],
            contact_name=data["contact_name"],
            value=data["value"],
            stage=data["stage"],
            priority=data["priority"],
            notes=data["notes"],
            org_id=organization_id,
            is_demo=True,
            created_at=now,
            updated_at=now,
        )
        session.add(deal)
    await session.flush()


async def _seed_campaigns_for_user(session: AsyncSession, user_id: str) -> None:
    existing = await session.execute(
        select(Campaign).where(Campaign.user_id == user_id).limit(1)
    )
    if existing.scalar_one_or_none():
        return

    now = datetime.utcnow()
    for data in DEMO_CAMPAIGNS:
        campaign = Campaign(
            name=data["name"],
            status=data["status"],
            type=data["type"],
            leads=data["leads"],
            opened=data["opened"],
            replied=data["replied"],
            user_id=user_id,
            is_demo=True,
            created_at=now,
            updated_at=now,
        )
        session.add(campaign)
    await session.flush()


async def _seed_calendar_events_for_org(session: AsyncSession, organization_id: str) -> None:
    existing = await session.execute(
        select(CalendarEvent).where(CalendarEvent.org_id == organization_id).limit(1)
    )
    if existing.scalar_one_or_none():
        return

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
            org_id=organization_id,
        )
        session.add(event)
    await session.flush()


async def _seed_segments_for_user(session: AsyncSession, user_id: str) -> None:
    existing = await session.execute(
        select(Segment).where(Segment.user_id == user_id).limit(1)
    )
    if existing.scalar_one_or_none():
        return

    now = datetime.utcnow()
    for data in DEMO_SEGMENTS:
        segment = Segment(
            name=data["name"],
            description=data["description"],
            color=data["color"],
            contact_count=data["contact_count"],
            filter_type=data["filter_type"],
            user_id=user_id,
            created_at=now,
            updated_at=now,
        )
        session.add(segment)
    await session.flush()


# ── Legacy startup seeder (for demo@leadspot.ai only) ─────────────────────────

async def seed_demo_data() -> None:
    """Seed demo data for demo@leadspot.ai on startup."""
    async with async_session_maker() as session:
        try:
            from app.models.user import User
            result = await session.execute(select(User).where(User.email == DEMO_EMAIL))
            user = result.scalar_one_or_none()
            if not user:
                logger.info("Demo user not found — skipping startup seed")
                return

            await seed_org_demo_data(
                organization_id=str(user.organization_id),
                user_id=str(user.user_id),
                session=session,
            )
            # Seed emails and conversations (not included in org seed)
            await _seed_emails(session, str(user.user_id))
            await _seed_conversations(session, str(user.organization_id))
        except Exception as e:
            logger.warning(f"Seed data error (non-fatal): {e}")
            await session.rollback()


async def _seed_emails(session: AsyncSession, user_id: str) -> None:
    existing = await session.execute(
        select(Email).where(Email.user_id == user_id).limit(1)
    )
    if existing.scalar_one_or_none():
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
            user_id=user_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        session.add(email)
    await session.flush()


async def _seed_conversations(session: AsyncSession, org_id: str) -> None:
    existing = await session.execute(
        select(Conversation).where(Conversation.org_id == org_id).limit(1)
    )
    if existing.scalar_one_or_none():
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
