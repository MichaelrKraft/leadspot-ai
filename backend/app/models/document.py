"""
Document metadata database model
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class Document(Base):
    """Document metadata model for tracking indexed content"""

    __tablename__ = "documents"

    document_id = Column(
        String(36),
        primary_key=True,
        default=generate_uuid,
        index=True
    )
    organization_id = Column(
        String(36),
        ForeignKey("organizations.organization_id"),
        nullable=False,
        index=True
    )
    # Source info
    source_system = Column(String(50), nullable=False, default="upload", index=True)
    source_id = Column(String(255), nullable=True, index=True)  # External source ID (e.g., Google Drive file ID)
    source_url = Column(Text, nullable=True)  # External URL to view in source system
    user_id = Column(String(36), nullable=True)  # User who uploaded/synced

    # Document metadata
    title = Column(String(500), nullable=False)
    author = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)

    # File info
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=True)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String(100), nullable=True)

    # Content
    content = Column(Text, nullable=True)  # Extracted text content

    # URLs
    url = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_modified = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    indexed_at = Column(DateTime, nullable=True)  # When vectors were created

    # Status
    status = Column(String(50), default="pending", nullable=False)  # pending, processing, indexed, failed

    # Relationships
    organization = relationship("Organization", back_populates="documents")

    def __repr__(self):
        return f"<Document(title='{self.title}', source='{self.source_system}')>"

    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            "id": self.document_id,
            "organization_id": self.organization_id,
            "title": self.title,
            "author": self.author,
            "description": self.description,
            "filename": self.filename,
            "file_size": self.file_size,
            "mime_type": self.mime_type,
            "url": self.url,
            "source_system": self.source_system,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_modified": self.last_modified.isoformat() if self.last_modified else None,
            "indexed_at": self.indexed_at.isoformat() if self.indexed_at else None,
        }
