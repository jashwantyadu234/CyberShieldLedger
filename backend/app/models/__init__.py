from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean
from app.database import Base
from datetime import datetime


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    email = Column(String(100), unique=True, index=True)
    password = Column(String(255))
    role = Column(String(50), default="citizen")  # citizen, investigator, admin
    status = Column(String(50), default="approved")  # pending, approved, rejected
    badge_id = Column(String(50), unique=True, nullable=True)
    phone_number = Column(String(50), nullable=True)
    permissions = Column(Text, nullable=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)
    tracking_id = Column(String(20), unique=True, index=True, nullable=True)
    title = Column(String(255))
    description = Column(Text)
    structured_data = Column(Text, nullable=True)
    crime_type = Column(String(50), nullable=True)
    amount = Column(Float, nullable=True)
    phone_number = Column(String(50), nullable=True, index=True)
    upi_id = Column(String(100), nullable=True, index=True)
    bank_name = Column(String(100), nullable=True)
    incident_date = Column(String(30), nullable=True)
    incident_location = Column(String(255), nullable=True)
    fraud_category = Column(String(100), nullable=True)
    bank_account = Column(String(100), nullable=True)
    crypto_wallet = Column(String(255), nullable=True)
    website_url = Column(String(500), nullable=True)
    suspect_email = Column(String(255), nullable=True)
    intake_data = Column(Text, nullable=True)
    anonymous = Column(Boolean, default=False)
    risk_score = Column(Integer, default=0)
    duplicate_score = Column(Float, default=0.0)
    status = Column(String(50), default="Pending")
    agency = Column(String(100), nullable=True)
    citizen_name = Column(String(100))
    citizen_email = Column(String(100), index=True)
    assigned_officer = Column(String(100), nullable=True)
    evidence_hash = Column(String(64), nullable=True)
    blockchain_tx = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, index=True)
    action = Column(String(200))
    performed_by = Column(String(100))
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)


class EvidenceFile(Base):
    """Encrypted evidence metadata. The original file bytes never live in the database."""
    __tablename__ = "evidence_files"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, index=True, nullable=False)
    original_filename = Column(String(255), nullable=False)
    storage_name = Column(String(255), unique=True, nullable=False)
    content_type = Column(String(120), nullable=True)
    encrypted_size = Column(Integer, nullable=False)
    sha256 = Column(String(64), index=True, nullable=False)
    nonce = Column(String(64), nullable=False)
    uploaded_by = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class CaseAccessGrant(Base):
    """Application-side access control that can later be mirrored by the smart contract."""
    __tablename__ = "case_access_grants"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, index=True, nullable=False)
    user_id = Column(Integer, index=True, nullable=False)
    granted_by = Column(String(100), nullable=False)
    on_chain_tx = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class DigitalSignature(Base):
    """Stores the user-held key signature for complaint authenticity."""
    __tablename__ = "digital_signatures"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, index=True, nullable=False)
    public_key_pem = Column(Text, nullable=False)
    signature_hex = Column(Text, nullable=False)
    signed_hash = Column(String(64), nullable=False)
    algorithm = Column(String(50), default="RSA-PSS-SHA256")
    created_at = Column(DateTime, default=datetime.utcnow)


class InvestigationNote(Base):
    """Investigator collaboration note or assigned follow-up for a complaint."""
    __tablename__ = "investigation_notes"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, index=True, nullable=False)
    author = Column(String(100), nullable=False)
    body = Column(Text, nullable=False)
    assignee = Column(String(100), nullable=True)
    task_status = Column(String(30), default="open")
    created_at = Column(DateTime, default=datetime.utcnow)


class AgencyRequest(Base):
    """Auditable outbound coordination request; delivery remains a demo integration."""
    __tablename__ = "agency_requests"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, index=True, nullable=False)
    agency = Column(String(150), nullable=False)
    request_type = Column(String(100), nullable=False)
    message = Column(Text, nullable=False)
    created_by = Column(String(100), nullable=False)
    status = Column(String(30), default="draft")
    created_at = Column(DateTime, default=datetime.utcnow)


class SystemSetting(Base):
    """Persisted administration settings, stored as JSON-safe string values."""
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LoginHistory(Base):
    """Security-relevant sign-in history, kept separately from case audit events."""
    __tablename__ = "login_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    email = Column(String(100), index=True, nullable=False)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(500), nullable=True)
    successful = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
