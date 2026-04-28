"""MergeRedirect model — contact A merged into B.

When the daemon promotes a Signal targeting old_contact_id, the cloud uses
this table to attribute it to new_contact_id instead of returning 404. Without
this redirect, a signal arriving mid-merge would be lost.

See `tasks/ghostlog-integration-plan.md` §2.2 (cloud rejection handling).
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, Index, String

from app.database import Base


class MergeRedirect(Base):
    __tablename__ = "merge_redirects"

    old_contact_id = Column(String(36), primary_key=True)
    new_contact_id = Column(String(36), nullable=False)
    organization_id = Column(String(36), nullable=False)
    merged_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    merged_by_user_id = Column(String(36), nullable=True)

    __table_args__ = (
        Index("ix_merge_redirects_new", "new_contact_id"),
        Index("ix_merge_redirects_org", "organization_id"),
    )
