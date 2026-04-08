"""Email suppression list model"""
import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, String
from app.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class EmailSuppression(Base):
    __tablename__ = "email_suppressions"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    reason = Column(String(50), nullable=False)  # 'hard_bounce', 'spam_complaint', 'unsubscribed', 'manual'
    source = Column(String(50), nullable=True)   # 'resend_webhook', 'user_click', 'admin'
    suppressed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<EmailSuppression(email='{self.email}', reason='{self.reason}')>"
