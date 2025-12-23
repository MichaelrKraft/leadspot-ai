"""SQLAlchemy Decision model for InnoSynth.ai"""

import uuid
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Decision(Base):
    """Decision model for storing business decisions."""

    __tablename__ = "decisions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=False)

    # Metadata
    category = Column(String(50), nullable=True, index=True)  # strategic, operational, tactical
    status = Column(String(50), default="active", index=True)  # active, archived, implemented

    # Context information
    context = Column(JSON, nullable=True)  # Additional structured data

    # Graph reference
    graph_node_id = Column(String(100), nullable=True, unique=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    decision_date = Column(DateTime, nullable=True)  # When the decision was actually made

    # Relationships
    user = relationship("User", back_populates="decisions")
    factors = relationship("DecisionFactor", back_populates="decision", cascade="all, delete-orphan")
    outcomes = relationship("DecisionOutcome", back_populates="decision", cascade="all, delete-orphan")

    def to_dict(self):
        """Convert decision to dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "status": self.status,
            "context": self.context,
            "graph_node_id": self.graph_node_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "decision_date": self.decision_date.isoformat() if self.decision_date else None,
            "factors": [f.to_dict() for f in self.factors] if self.factors else [],
            "outcomes": [o.to_dict() for o in self.outcomes] if self.outcomes else []
        }


class DecisionFactor(Base):
    """Factors that influenced a decision."""

    __tablename__ = "decision_factors"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    decision_id = Column(String(36), ForeignKey("decisions.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False, index=True)  # market, financial, technical, etc.
    impact_score = Column(Integer, nullable=False)  # 1-10
    explanation = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    decision = relationship("Decision", back_populates="factors")

    def to_dict(self):
        """Convert factor to dictionary."""
        return {
            "id": self.id,
            "decision_id": self.decision_id,
            "name": self.name,
            "category": self.category,
            "impact_score": self.impact_score,
            "explanation": self.explanation,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class DecisionOutcome(Base):
    """Tracked outcomes of decisions."""

    __tablename__ = "decision_outcomes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    decision_id = Column(String(36), ForeignKey("decisions.id"), nullable=False, index=True)
    description = Column(Text, nullable=False)
    outcome_type = Column(String(50), nullable=False)  # predicted, actual, risk, opportunity
    likelihood = Column(Integer, nullable=True)  # 0-100 for predictions
    impact = Column(String(20), nullable=True)  # high, medium, low
    timeframe = Column(String(50), nullable=True)  # short-term, medium-term, long-term
    status = Column(String(50), default="predicted")  # predicted, realized, unrealized

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    decision = relationship("Decision", back_populates="outcomes")

    def to_dict(self):
        """Convert outcome to dictionary."""
        return {
            "id": self.id,
            "decision_id": self.decision_id,
            "description": self.description,
            "outcome_type": self.outcome_type,
            "likelihood": self.likelihood,
            "impact": self.impact,
            "timeframe": self.timeframe,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
