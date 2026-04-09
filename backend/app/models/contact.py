"""Contact model — local SQLite storage (replaces Mautic dependency)"""

import json
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Index, Integer, String, Text

from app.database import Base


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    first_name = Column(String(100), nullable=False, default="")
    last_name = Column(String(100), nullable=False, default="")
    email = Column(String(255), nullable=False, default="")
    company = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    tags_json = Column(Text, nullable=True)   # JSON-encoded list of strings
    points = Column(Integer, nullable=False, default=0)
    last_active = Column(DateTime, nullable=True)
    organization_id = Column(String(36), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_contacts_organization_id", "organization_id"),
        Index("ix_contacts_email", "email"),
    )

    @property
    def tags(self) -> list[str]:
        if not self.tags_json:
            return []
        try:
            return json.loads(self.tags_json)
        except (ValueError, TypeError):
            return []

    @tags.setter
    def tags(self, value: list[str]) -> None:
        self.tags_json = json.dumps(value) if value else None
