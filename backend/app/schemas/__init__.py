from pydantic import BaseModel, Field
from typing import Optional, Any, List
from datetime import datetime


# ============================================================
# COMPLAINT SCHEMAS
# ============================================================
class ComplaintCreate(BaseModel):
    """Schema for creating a new complaint."""
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=10)
    citizen_name: str = Field(..., min_length=1, max_length=100)
    citizen_email: str = Field(..., max_length=100)
    phone_number: Optional[str] = Field(None, max_length=50)
    incident_date: Optional[str] = None
    location: Optional[str] = Field(None, max_length=255)
    fraud_category: Optional[str] = Field(None, max_length=100)
    upi_id: Optional[str] = Field(None, max_length=100)
    bank_account: Optional[str] = Field(None, max_length=100)
    crypto_wallet: Optional[str] = Field(None, max_length=255)
    website_url: Optional[str] = Field(None, max_length=500)
    suspect_email: Optional[str] = Field(None, max_length=255)
    transaction_amount: Optional[float] = Field(None, ge=0)
    anonymous: bool = False


class ComplaintUpdate(BaseModel):
    """Schema for updating complaint status/assignment."""
    status: Optional[str] = None
    assigned_officer: Optional[str] = None
    notes: Optional[str] = None


class ComplaintResponse(BaseModel):
    """Schema for complaint API responses."""
    id: int
    tracking_id: Optional[str] = None
    title: str
    description: str
    structured_data: Optional[str] = None
    crime_type: Optional[str] = None
    amount: Optional[float] = None
    phone_number: Optional[str] = None
    upi_id: Optional[str] = None
    bank_name: Optional[str] = None
    risk_score: int = 0
    duplicate_score: Optional[float] = 0.0
    status: str = "Pending"
    agency: Optional[str] = None
    citizen_name: str
    citizen_email: str
    assigned_officer: Optional[str] = None
    evidence_hash: Optional[str] = None
    blockchain_tx: Optional[str] = None
    incident_date: Optional[str] = None
    incident_location: Optional[str] = None
    fraud_category: Optional[str] = None
    anonymous: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================================
# AUDIT LOG SCHEMAS
# ============================================================
class AuditLogResponse(BaseModel):
    """Schema for audit log entries."""
    action: str
    performed_by: str
    details: Optional[str] = None
    timestamp: Optional[str] = None

    class Config:
        from_attributes = True


# ============================================================
# INVESTIGATOR SCHEMAS
# ============================================================
class StatusUpdate(BaseModel):
    """Schema for updating complaint status."""
    status: str = Field(..., description="New status value")
    officer_name: Optional[str] = Field("Investigator", max_length=100)
    notes: Optional[str] = Field(None, max_length=500)
    assigned_officer: Optional[str] = Field(None, max_length=100)


class DuplicateInfo(BaseModel):
    """Schema for duplicate complaint info."""
    id: int
    title: str
    risk_score: int
    similarity: float


class ComplaintDetailResponse(BaseModel):
    """Full complaint detail with AI analysis, duplicates, audit logs."""
    complaint: Any  # ComplaintResponse
    ai_analysis: dict = {}
    duplicates: List[DuplicateInfo] = []
    evidence_status: str = "none"
    audit_logs: List[AuditLogResponse] = []


# ============================================================
# VERIFICATION SCHEMAS
# ============================================================
class VerifyResponse(BaseModel):
    """Schema for blockchain verification results."""
    complaint_id: int
    status: str
    db_hash: Optional[str] = None
    computed_hash: Optional[str] = None
    bundle_hash: Optional[str] = None
    on_chain_hash: Optional[str] = None
    blockchain_tx: Optional[str] = None
    tampered: bool = False
    verified: bool = False


# ============================================================
# CRYPTO SIGNATURE SCHEMAS
# ============================================================
class SignatureSubmit(BaseModel):
    """Schema for submitting a cryptographic signature."""
    complaint_id: int
    public_key_pem: str = Field(..., description="User's RSA public key in PEM format")
    signature_hex: str = Field(..., description="Hex-encoded RSA-PSS signature of complaint hash")
    signed_hash: str = Field(..., min_length=64, max_length=64, description="SHA-256 hash that was signed")
    algorithm: str = "RSA-PSS-SHA256"


class SignatureResponse(BaseModel):
    """Schema for signature verification results."""
    exists: bool = False
    verified: bool = False
    public_key_pem: Optional[str] = None
    algorithm: Optional[str] = None
    created_at: Optional[str] = None


# ============================================================
# CITIZEN SCHEMAS
# ============================================================
class TrackRequest(BaseModel):
    """Schema for tracking complaints."""
    email: str
    complaint_id: Optional[int] = None


class ScamCheckComplaint(BaseModel):
    """Schema for a complaint in scam check results."""
    id: int
    title: str
    crime_type: Optional[str] = None
    status: str
    created_at: Optional[str] = None


class ScamCheckResponse(BaseModel):
    """Schema for scam checker results."""
    found: bool
    message: str
    risk: str = "low"
    risk_score: Optional[int] = None
    total_reports: int = 0
    complaints: Optional[List[ScamCheckComplaint]] = None


# ============================================================
# DASHBOARD SCHEMAS
# ============================================================
class DashboardStats(BaseModel):
    """Schema for investigator dashboard KPIs."""
    total_complaints: int = 0
    pending_review: int = 0
    under_investigation: int = 0
    resolved: int = 0
    high_risk: int = 0
    blockchain_verified: int = 0
    unverified: int = 0
    recent_7_days: int = 0


class CrimeTypeCount(BaseModel):
    """Schema for crime type distribution."""
    type: Optional[str] = None
    count: int = 0


class DailyTrend(BaseModel):
    """Schema for daily complaint trends."""
    date: str
    count: int = 0


# ============================================================
# ADMIN SCHEMAS
# ============================================================
class UserResponse(BaseModel):
    """Schema for user management."""
    name: str
    email: str
    role: str = "citizen"
    cases: Optional[int] = None


class AgencyResponse(BaseModel):
    """Schema for agency management."""
    id: int
    name: str
    cases: int = 0
    status: str = "active"


class AIMonitoringResponse(BaseModel):
    """Schema for AI monitoring dashboard."""
    total_processed: int = 0
    success_rate: float = 0.0
    failed: int = 0
    avg_risk_score: float = 0.0
    recent_errors: List[str] = []


class AIAccuracyResponse(BaseModel):
    """Schema for AI accuracy by crime type."""
    type: Optional[str] = None
    count: int = 0
    accuracy: float = 0.0


class ThreatIndicator(BaseModel):
    """Schema for top threat indicators."""
    phone: Optional[str] = None
    upi: Optional[str] = None
    count: int = 0


class ThreatCampaign(BaseModel):
    """Schema for fraud campaign detection."""
    indicator: str
    type: str
    complaint_count: int
    risk_level: str = "medium"


class InvestigatorWorkload(BaseModel):
    """Schema for investigator case load."""
    officer: str
    cases: int = 0


# ============================================================
# GRAPH SCHEMAS
# ============================================================
class GraphNode(BaseModel):
    """Schema for threat graph nodes."""
    id: str
    label: str
    type: str = "complaint"
    risk: int = 0
    crime: Optional[str] = None
    title: Optional[str] = None


class GraphEdge(BaseModel):
    """Schema for threat graph edges."""
    source: str
    target: str
    label: str = "used"


class GraphData(BaseModel):
    """Schema for complete threat graph."""
    nodes: List[GraphNode] = []
    edges: List[GraphEdge] = []


# ============================================================
# PAGINATION
# ============================================================
class PaginatedResponse(BaseModel):
    """Schema for paginated complaint list."""
    total: int = 0
    complaints: List[ComplaintResponse] = []
    page: int = 1
    pages: int = 1
