"""
Kane Company demo seed — populates a Leasing pipeline that looks like a
28-person NH Seacoast commercial RE firm, plus inbound emails and pending
AI stage suggestions for the review-drawer demo.

Usage:
    cd backend && .venv/bin/python -m scripts.seed_kane_demo --email you@example.com

Idempotent: re-running wipes and recreates only rows tagged as Kane demo data
(deals via source_meta.kane_demo, emails via provider_message_id prefix 'kane-').
"""

import argparse
import asyncio
import json
import sys
import uuid
from datetime import datetime, timedelta

from sqlalchemy import delete, select, text

sys.path.insert(0, ".")

from app.database import async_session_maker  # noqa: E402
from app.models.contact import Contact  # noqa: E402
from app.models.decision import Decision  # noqa: E402,F401  (User relationship needs the mapper registered)
from app.models.deal import Deal  # noqa: E402
from app.models.deal_suggestion import DealSuggestion  # noqa: E402
from app.models.email_message import EmailMessage  # noqa: E402
from app.models.user import User  # noqa: E402


def days_ago(n: int) -> datetime:
    return datetime.utcnow() - timedelta(days=n)


# (first, last, email, company) — brokers/tenants matching the deals below
CONTACTS = [
    ("Laura", "Chen", "lchen@colliers.com", "Colliers"),
    ("Marcus", "Webb", "mwebb@cbre.com", "CBRE"),
    ("Dana", "Ortiz", "dortiz@novahealth.com", "NovaHealth"),
    ("Peter", "Kim", "pkim@boulos.com", "Boulos Company"),
    ("Rachel", "Foster", "rfoster@granitelogistics.com", "GraniteLogistics"),
    ("Tom", "Alvarez", "talvarez@kwcommercial.com", "KW Commercial"),
]

DEALS = [
    # (title, property, contact, value, stage, days_in_stage, priority)
    ("Suite 210 — Pease Tradeport Office", "Pease Tradeport", "Laura Chen (Colliers)", 850_000, "inquiry", 4, "medium"),
    ("Bay 4 — Dover Industrial Park", "Dover Industrial Park", "Marcus Webb (CBRE)", 2_100_000, "loi_negotiation", 12, "high"),
    ("Suite 500 — Portsmouth Harbor Plaza", "Portsmouth Harbor Plaza", "Dana Ortiz (NovaHealth)", 3_400_000, "construction_pricing", 9, "high"),
    ("Floor 2 — Exeter Commerce Center", "Exeter Commerce Center", "Peter Kim (Boulos)", 1_600_000, "lease_drafting", 17, "medium"),
    ("Unit 12 — Nashua Gateway Industrial", "Nashua Gateway", "Rachel Foster (GraniteLogistics)", 2_800_000, "lease_negotiation", 23, "high"),
    ("Suite 320 — Manchester Millyard", "Manchester Millyard", "Tom Alvarez (KW Commercial)", 1_900_000, "signed", 6, "low"),
]

# (msg_key, from, subject, preview, days_ago, deal_index or None)
EMAILS = [
    ("kane-1", "mwebb@cbre.com", "Re: Dover Bay 4 — LOI executed",
     "Kelsey — attached is the executed LOI from the tenant. They're ready to get construction pricing on the TI package as soon as your team can turn it around.", 1, 1),
    ("kane-2", "dortiz@novahealth.com", "Portsmouth Harbor Plaza — TI pricing approved",
     "The pricing works on our end — please have legal start the lease draft. We'd like to target occupancy by Q1.", 2, 2),
    ("kane-3", "pkim@boulos.com", "Exeter Floor 2 — first redlines",
     "Attached are our comments on the draft — mostly Sections 8 (maintenance) and 14 (assignment). Ready to schedule a call to walk through them.", 3, 3),
    ("kane-4", "lchen@colliers.com", "Pease Suite 210 — tour follow-up",
     "Thanks for the tour Tuesday. My client is comparing two other spaces and will decide on next steps by end of month.", 5, 0),
    ("kane-5", "talvarez@kwcommercial.com", "Manchester Millyard — welcome package",
     "Fully executed copy attached for your records. Tenant is coordinating with property management on move-in.", 6, 5),
]

# (email_index, deal_index, suggested_stage, confidence, evidence)
SUGGESTIONS = [
    (0, 1, "construction_pricing", 84, "ready to get construction pricing on the TI package"),
    (1, 2, "lease_drafting", 91, "please have legal start the lease draft"),
    (2, 3, "lease_negotiation", 77, "Attached are our comments on the draft"),
]


async def main(email: str) -> None:
    async with async_session_maker() as db:
        user = (
            await db.execute(select(User).where(User.email == email))
        ).scalar_one_or_none()
        if not user:
            print(f"ERROR: no user with email {email}")
            sys.exit(1)
        org_id = str(user.organization_id)
        print(f"Seeding Kane demo into org {org_id} ({email})")

        # Wipe previous Kane demo rows (suggestions -> emails -> deals)
        old_emails = (
            await db.execute(
                select(EmailMessage.id).where(
                    EmailMessage.org_id == org_id,
                    EmailMessage.provider_message_id.like("kane-%"),
                )
            )
        ).scalars().all()
        if old_emails:
            await db.execute(
                delete(DealSuggestion).where(DealSuggestion.source_id.in_(old_emails))
            )
            await db.execute(
                delete(EmailMessage).where(EmailMessage.id.in_(old_emails))
            )
        # Deals tagged as kane demo (JSON column — filter in Python for SQLite/PG parity)
        all_leasing = (
            await db.execute(
                select(Deal).where(Deal.org_id == org_id, Deal.pipeline == "leasing")
            )
        ).scalars().all()
        for d in all_leasing:
            if d.source_meta and d.source_meta.get("kane_demo"):
                await db.delete(d)
        await db.flush()

        # Wipe + recreate broker/tenant contacts (matched by seeded email addresses)
        seed_emails = [c[2] for c in CONTACTS]
        old_contacts = (
            await db.execute(
                select(Contact).where(
                    Contact.organization_id == org_id,
                    Contact.email.in_(seed_emails),
                )
            )
        ).scalars().all()
        for c in old_contacts:
            await db.delete(c)
        await db.flush()

        contacts: list[Contact] = []
        for first, last, email_addr, company in CONTACTS:
            contact = Contact(
                first_name=first,
                last_name=last,
                email=email_addr,
                company=company,
                organization_id=org_id,
                is_demo=True,
            )
            db.add(contact)
            contacts.append(contact)
        await db.flush()

        # Create deals, linked to their contact
        deals: list[Deal] = []
        for i, (title, prop, contact_label, value, stage, days_in_stage, priority) in enumerate(DEALS):
            deal = Deal(
                title=title,
                contact_id=contacts[i].id,
                contact_name=contact_label,
                value=value,
                pipeline="leasing",
                stage=stage,
                priority=priority,
                property_name=prop,
                stage_changed_at=days_ago(days_in_stage),
                source_meta={"kane_demo": True},
                org_id=org_id,
                is_demo=True,
            )
            db.add(deal)
            deals.append(deal)
        await db.flush()

        # Create inbound emails (linked to contact + deal)
        emails: list[EmailMessage] = []
        for key, from_addr, subject, preview, d_ago, deal_idx in EMAILS:
            msg = EmailMessage(
                org_id=org_id,
                provider="seed",
                provider_message_id=key,
                from_address=from_addr,
                to_addresses="kelsey@kanecompany.com",
                subject=subject,
                body_preview=preview,
                received_at=days_ago(d_ago),
                contact_id=contacts[deal_idx].id if deal_idx is not None else None,
                deal_id=deals[deal_idx].id if deal_idx is not None else None,
                analyzed_at=datetime.utcnow(),
            )
            db.add(msg)
            emails.append(msg)
        await db.flush()

        # Create pending suggestions
        for email_idx, deal_idx, suggested, confidence, evidence in SUGGESTIONS:
            deal = deals[deal_idx]
            db.add(
                DealSuggestion(
                    org_id=org_id,
                    deal_id=deal.id,
                    current_stage=deal.stage,
                    suggested_stage=suggested,
                    confidence=confidence,
                    evidence=evidence,
                    source_type="email",
                    source_id=emails[email_idx].id,
                    status="pending",
                    created_at=days_ago(0),
                )
            )

        await db.commit()
        total = sum(v for _, _, _, v, _, _, _ in DEALS)
        print(f"Seeded {len(contacts)} contacts, {len(deals)} leasing deals (${total/1e6:.1f}M), "
              f"{len(emails)} emails, {len(SUGGESTIONS)} pending suggestions.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True, help="Login email of the target account")
    args = parser.parse_args()
    asyncio.run(main(args.email))
