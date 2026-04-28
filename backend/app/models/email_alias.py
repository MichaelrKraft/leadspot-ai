"""EmailAlias model — multiple email addresses per Contact.

Daemon mirror sync receives all aliases per contact so matching works against
any of them. Email is normalized (lowercase + +-suffix stripped) before hashing.

See `tasks/ghostlog-integration-plan.md` §2.3 ("Email normalization").
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Index, String, UniqueConstraint

from app.database import Base


class EmailAlias(Base):
    __tablename__ = "email_aliases"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    contact_id = Column(String(36), nullable=False)
    organization_id = Column(String(36), nullable=False)
    email_hash = Column(String(64), nullable=False)
    email_display = Column(String(255), nullable=False, default="")
    is_primary = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("organization_id", "email_hash", name="ux_email_aliases_org_hash"),
        Index("ix_email_aliases_contact", "contact_id"),
        Index("ix_email_aliases_org_hash", "organization_id", "email_hash"),
    )
