from sqlalchemy import Column, String, Float, DateTime, ForeignKey, BigInteger, Integer, Numeric, JSON
from sqlalchemy.dialects.postgresql import UUID
from backend.database import Base
import uuid
from datetime import datetime, timezone

class Organization(Base):
    __tablename__ = "organizations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    name = Column(String(255))
    email = Column(String(255), unique=True)

class UserProfile(Base):
    __tablename__ = "user_profile"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    learned_preferences = Column(JSON, default=list)
    decision_dna_profile = Column(JSON, default=dict)

class Customer(Base):
    __tablename__ = "customers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255))
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))

class Vendor(Base):
    __tablename__ = "vendors"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255))
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))

class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"))
    amount = Column(Numeric(10, 2))
    due_date = Column(DateTime(timezone=True))
    status = Column(String(50))

class BankTransaction(Base):
    __tablename__ = "bank_transactions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    amount = Column(Numeric(10, 2))
    date = Column(DateTime(timezone=True))
    type = Column(String(50))

class KPISnapshot(Base):
    __tablename__ = "kpi_snapshots"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    snapshot_date = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    decision_latency_ms = Column(BigInteger)
    cash_risk_detected_days_early = Column(Integer)
    bad_decisions_avoided = Column(Integer)
    ai_accuracy_pct = Column(Float)
    total_cash_saved = Column(Numeric(12, 2))

class DecisionLog(Base):
    __tablename__ = "decision_log"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    package_id = Column(String, index=True)
    org_id = Column(String)
    details = Column(String)
    status = Column(String(50), default="pending")
    decided_at = Column(DateTime(timezone=True))
    chosen_option_id = Column(String)
    notes = Column(String)
    disagreement_reason = Column(String)
    user_id = Column(String)

class DecisionOutcome(Base):
    __tablename__ = "decision_outcomes"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    decision_id = Column(UUID(as_uuid=True), ForeignKey("decision_log.id"))
    outcome = Column(String)
    projected_cash_delta = Column(Numeric(12, 2))
    actual_cash_delta = Column(Numeric(12, 2))
    impact_score = Column(Integer)
    financial_delta = Column(Numeric(12, 2))
    success_label = Column(String(50))

class ActionQueue(Base):
    __tablename__ = "action_queue"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    action_type = Column(String(100))
    payload = Column(JSON, default=dict)
    status = Column(String(50), default="pending")
    approved_by = Column(String)
    org_id = Column(String)
    rejection_reason = Column(String)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True))
