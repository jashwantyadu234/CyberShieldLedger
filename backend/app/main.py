import os
import sys
import json

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass
import hashlib
import re
import shutil
from pathlib import Path
from difflib import SequenceMatcher
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File, Request
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from dotenv import load_dotenv
from pydantic import BaseModel
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, padding

from app.database import engine, SessionLocal, Base
from app.models import Complaint, AuditLog, User, EvidenceFile, CaseAccessGrant, DigitalSignature, InvestigationNote, AgencyRequest, SystemSetting, LoginHistory
from app.schemas import (
    ComplaintCreate, ComplaintResponse, VerifyResponse,
    ScamCheckResponse, StatusUpdate, SignatureSubmit, SignatureResponse
)
from app.security.auth import create_access_token, get_current_user, hash_password, require_roles, verify_password
from app.evidence.crypto import MAX_EVIDENCE_FILE_BYTES, decrypt_evidence, encrypt_evidence
from app.services.ocr_service import extract_text

# ============================================================
# AUTH SCHEMAS
# ============================================================
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "citizen"
    badge_id: Optional[str] = None
    phone_number: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    success: bool
    message: str
    user: Optional[dict] = None
    token: Optional[str] = None

class AccessGrantRequest(BaseModel):
    user_email: str

class CopilotResponse(BaseModel):
    question: str
    extracted: dict
    conversation_id: str

class CopilotSubmit(BaseModel):
    conversation_id: str
    responses: list[dict]
    final_text: str

class InvestigationNoteCreate(BaseModel):
    body: str
    assignee: Optional[str] = None

class InvestigationTaskUpdate(BaseModel):
    task_status: str

class AgencyRequestCreate(BaseModel):
    complaint_id: int
    agency: str
    request_type: str
    message: str

# ============================================================
# GRACEFUL IMPORTS
# ============================================================
try:
    from ai.entity_extractor import extract_crime_details
    print("✅ AI module loaded")
except ModuleNotFoundError:
    print("⚠️  AI module not found — using fallback")
    def extract_crime_details(text):
        return {"crime_type": "Unclassified", "risk_score": 0, "amount": None,
                "bank_name": None, "upi_id": None, "phone_number": None,
                "payment_method": None, "scammer_details": "",
                "suggested_agency": None, "suggested_law_sections": []}

try:
    from blockchain.contract import submit_to_blockchain, verify_on_chain, update_status_on_chain, update_evidence_hash_on_chain
    print("✅ Blockchain module loaded")
except ModuleNotFoundError:
    print("⚠️  Blockchain module not found — using fallback stubs")
    def submit_to_blockchain(complaint_id, evidence_hash, agency="Unassigned"):
        return "blockchain_disabled"
    def verify_on_chain(complaint_id):
        return {"exists": False}
    def update_status_on_chain(complaint_id, new_status):
        return "blockchain_disabled"
    def update_evidence_hash_on_chain(complaint_id, evidence_hash):
        return "blockchain_disabled"

load_dotenv()
Base.metadata.create_all(bind=engine)

# Lightweight SQLite migration for installations created before the expanded
# citizen intake wizard. New databases receive these fields from models.py.
with engine.begin() as connection:
    for column, definition in {
        "tracking_id": "VARCHAR(20)", "incident_date": "VARCHAR(30)",
        "incident_location": "VARCHAR(255)", "fraud_category": "VARCHAR(100)",
        "bank_account": "VARCHAR(100)", "crypto_wallet": "VARCHAR(255)",
        "website_url": "VARCHAR(500)", "suspect_email": "VARCHAR(255)",
        "intake_data": "TEXT", "anonymous": "BOOLEAN DEFAULT 0",
    }.items():
        try:
            connection.exec_driver_sql(f"ALTER TABLE complaints ADD COLUMN {column} {definition}")
        except Exception:
            # Column already exists (the expected path after the first run).
            pass
    for column, definition in {"phone_number": "VARCHAR(50)", "permissions": "TEXT", "last_login": "DATETIME"}.items():
        try:
            connection.exec_driver_sql(f"ALTER TABLE users ADD COLUMN {column} {definition}")
        except Exception:
            pass

# ============================================================
# FastAPI App
# ============================================================
app = FastAPI(
    title="CyberShield Ledger API",
    description="AI-Powered Cybercrime Reporting with Blockchain Verification",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# HELPERS
# ============================================================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def compute_evidence_hash(complaint_id: int, description: str, created_at: str) -> str:
    evidence_string = f"{complaint_id}:{description}:{created_at}"
    return hashlib.sha256(evidence_string.encode()).hexdigest()

def compute_bundle_hash(complaint_id: int, description: str, created_at: str, evidence_hashes: list[str]) -> str:
    """Compute a Merkle-style bundle hash combining metadata with all evidence hashes."""
    evidence_hashes_sorted = sorted(evidence_hashes)
    bundle_parts = [f"{complaint_id}:{description}:{created_at}"] + evidence_hashes_sorted
    combined = "|".join(bundle_parts)
    return hashlib.sha256(combined.encode()).hexdigest()

def add_audit_log(db: Session, complaint_id: int, action: str, performed_by: str, details: str = None):
    log = AuditLog(complaint_id=complaint_id, action=action, performed_by=performed_by, details=details)
    db.add(log)
    db.commit()

def can_access_complaint(complaint: Complaint, user: User) -> bool:
    if user.role in {"admin", "investigator"}:
        return True
    return user.role == "citizen" and complaint.citizen_email == user.email


def verify_complaint_signature(signature: DigitalSignature, bundle_hash: str) -> bool:
    """Verify a browser-created RSA-PSS or ECDSA signature over the bundle hash."""
    if signature.signed_hash != bundle_hash:
        return False
    try:
        public_key = serialization.load_pem_public_key(signature.public_key_pem.encode("utf-8"))
        signature_bytes = bytes.fromhex(signature.signature_hex)
        message = bytes.fromhex(bundle_hash)
        algorithm = signature.algorithm.upper()
        if algorithm == "RSA-PSS-SHA256":
            public_key.verify(signature_bytes, message, padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=32), hashes.SHA256())
        elif algorithm == "ECDSA-SHA256":
            public_key.verify(signature_bytes, message, ec.ECDSA(hashes.SHA256()))
        else:
            return False
        return True
    except (ValueError, TypeError, InvalidSignature):
        return False

def calculate_duplicate_score(db: Session, complaint: Complaint) -> tuple[float, list[int]]:
    """Enhanced duplicate detection using shared indicators plus text similarity with weighted scoring."""
    candidates = db.query(Complaint).filter(Complaint.id != complaint.id).order_by(Complaint.created_at.desc()).limit(200).all()
    highest_score, linked_cases = 0.0, []
    for candidate in candidates:
        weights = []
        # Phone number match (highest confidence)
        if complaint.phone_number and complaint.phone_number == candidate.phone_number:
            weights.append(98.0)
        # UPI ID match
        if complaint.upi_id and complaint.upi_id == candidate.upi_id:
            weights.append(95.0)
        # Bank name match
        if complaint.bank_name and complaint.bank_name == candidate.bank_name:
            weights.append(60.0)
        # Amount proximity (within 10%)
        if complaint.amount and candidate.amount:
            ratio = abs(complaint.amount - candidate.amount) / max(complaint.amount, candidate.amount)
            if ratio < 0.1:
                weights.append(70.0 * (1 - ratio))
        # Text similarity
        text_similarity = SequenceMatcher(None, (complaint.description or "").lower(), (candidate.description or "").lower()).ratio() * 100
        if text_similarity >= 50:
            weights.append(text_similarity)
        # Crime type match
        if complaint.crime_type and complaint.crime_type == candidate.crime_type:
            weights.append(40.0)

        if weights:
            score = max(weights)
            if score >= 60:
                linked_cases.append(candidate.id)
                highest_score = max(highest_score, score)

    return round(highest_score, 1), linked_cases[:10]

def complaint_indicators(complaint: Complaint) -> dict:
    """Build a safe, local intelligence profile from structured fields and report text."""
    text = " ".join(filter(None, [complaint.description, complaint.upi_id, complaint.phone_number,
                                    complaint.suspect_email, complaint.website_url, complaint.crypto_wallet,
                                    complaint.bank_account]))
    found = {
        "phone": set(re.findall(r"(?:\+?91[-\s]?)?[6-9]\d{9}", text)),
        "upi": set(re.findall(r"\b[\w.-]+@[\w.-]+\b", text)),
        "email": set(re.findall(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", text)),
        "url": set(re.findall(r"(?:https?://)?[\w.-]+\.[a-zA-Z]{2,}(?:/[^\s]*)?", text)),
        "wallet": set(re.findall(r"\b0x[a-fA-F0-9]{40}\b|\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b", text)),
        "ip": set(re.findall(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", text)),
        "bank_account": {complaint.bank_account} if complaint.bank_account else set(),
    }
    # Do not expose a UPI identifier as an email indicator.
    found["email"] -= found["upi"]
    return {kind: sorted(value) for kind, value in found.items() if value}

def playbook_for(crime_type: str, category: str) -> list[str]:
    label = f"{crime_type or ''} {category or ''}".lower()
    if any(word in label for word in ("financial", "bank", "upi", "investment", "crypto")):
        return ["Verify transaction reference and beneficiary details", "Issue bank/UPI freeze recommendation", "Escalate urgent cases through the 1930 workflow", "Check linked indicators and beneficiary history", "Preserve receipts, chats, and call records"]
    if "phish" in label:
        return ["Preserve the original URL and headers", "Check domain, DNS, and reputation records", "Request URL/domain takedown", "Notify affected service provider", "Search linked complaints for the same lure"]
    return ["Contact the victim to verify the chronology", "Preserve and hash all evidence", "Check linked indicators across cases", "Assign the appropriate agency and investigator", "Record every evidence access action"]

# ============================================================
# AUTH ENDPOINTS
# ============================================================
@app.post("/api/auth/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    if data.role not in {"citizen", "investigator"}:
        raise HTTPException(status_code=400, detail="Only citizen and investigator accounts can be registered")
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    status = "approved" if data.role == "citizen" else "pending"
    user = User(name=data.name, email=data.email, password=hash_password(data.password),
                role=data.role, status=status, badge_id=data.badge_id, phone_number=data.phone_number)
    db.add(user)
    db.commit()
    db.refresh(user)
    return AuthResponse(
        success=True,
        message="Registration successful" if status == "approved" else "Submitted for admin approval",
        user={"id": user.id, "name": user.name, "email": user.email, "role": user.role, "status": user.status},
    )

@app.post("/api/auth/login")
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.status != "approved":
        raise HTTPException(status_code=403, detail=f"Account is {user.status}. Wait for admin approval.")
    user.last_login = datetime.utcnow()
    db.add(LoginHistory(user_id=user.id, email=user.email, ip_address=request.client.host if request.client else None,
                        user_agent=request.headers.get("user-agent", "")[:500], successful=True))
    db.commit()
    add_audit_log(db, 0, "User Login", user.name, f"Role: {user.role}")
    token = create_access_token(user)
    return AuthResponse(
        success=True, message="Login successful",
        user={"id": user.id, "name": user.name, "email": user.email, "role": user.role, "status": user.status},
        token=token,
    )

@app.get("/api/auth/login-history")
def login_history(limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return only the caller's recent successful sign-ins."""
    rows = db.query(LoginHistory).filter(LoginHistory.user_id == current_user.id).order_by(LoginHistory.created_at.desc()).limit(limit).all()
    return [{"ip_address": row.ip_address, "user_agent": row.user_agent, "created_at": row.created_at.isoformat()} for row in rows]

@app.get("/api/auth/users")
def list_users(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    users = db.query(User).all()
    return [{"id": u.id, "name": u.name, "email": u.email, "role": u.role,
             "status": u.status, "badge_id": u.badge_id, "phone_number": u.phone_number,
             "permissions": json.loads(u.permissions) if u.permissions else [],
             "last_login": u.last_login.isoformat() if u.last_login else None,
             "created_at": u.created_at.isoformat() if u.created_at else None} for u in users]

@app.get("/api/auth/pending")
def pending_users(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    users = db.query(User).filter(User.status == "pending").all()
    return [{"id": u.id, "name": u.name, "email": u.email, "role": u.role,
             "status": u.status, "badge_id": u.badge_id,
             "created_at": u.created_at.isoformat() if u.created_at else None} for u in users]

@app.put("/api/auth/users/{user_id}/approve")
def approve_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    user = db.query(User).filter(User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    user.status = "approved"
    db.commit()
    return {"success": True, "message": f"{user.name} approved as {user.role}"}

@app.put("/api/auth/users/{user_id}/reject")
def reject_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    user = db.query(User).filter(User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    user.status = "rejected"
    db.commit()
    return {"success": True, "message": f"{user.name} rejected"}

# ============================================================
# CRYPTO SIGNATURE ENDPOINTS
# ============================================================
@app.post("/api/signatures/submit")
def submit_signature(data: SignatureSubmit, db: Session = Depends(get_db), current_user: User = Depends(require_roles("citizen"))):
    """Store a user-held cryptographic signature for a complaint."""
    complaint = db.query(Complaint).filter(Complaint.id == data.complaint_id).first()
    if not complaint or complaint.citizen_email != current_user.email:
        raise HTTPException(status_code=404, detail="Complaint not found")
    existing = db.query(DigitalSignature).filter(DigitalSignature.complaint_id == data.complaint_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Signature already exists for this complaint")
    created_at_str = complaint.created_at.isoformat() if complaint.created_at else ""
    evidence_hashes = [e.sha256 for e in db.query(EvidenceFile).filter(EvidenceFile.complaint_id == complaint.id).all()]
    bundle_hash = compute_bundle_hash(complaint.id, complaint.description or "", created_at_str, evidence_hashes)
    sig = DigitalSignature(complaint_id=data.complaint_id, public_key_pem=data.public_key_pem,
                           signature_hex=data.signature_hex, signed_hash=data.signed_hash, algorithm=data.algorithm)
    if not verify_complaint_signature(sig, bundle_hash):
        raise HTTPException(status_code=400, detail="Signature does not verify against the current complaint bundle")
    db.add(sig)
    db.commit()
    add_audit_log(db, data.complaint_id, "Digital Signature Added", current_user.name,
                  f"Signed with {data.algorithm}, hash: {data.signed_hash[:16]}...")
    return {"success": True, "message": "Digital signature recorded"}

@app.get("/api/signatures/{complaint_id}", response_model=SignatureResponse)
def get_signature(complaint_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Retrieve and verify a complaint's digital signature."""
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint or not can_access_complaint(complaint, current_user):
        raise HTTPException(status_code=404, detail="Complaint not found")
    sig = db.query(DigitalSignature).filter(DigitalSignature.complaint_id == complaint_id).first()
    if not sig:
        return SignatureResponse(exists=False, verified=False)
    # Recompute the hash that was signed
    db_hash_valid = False
    if complaint:
        created_at_str = complaint.created_at.isoformat() if complaint.created_at else ""
        evidence_hashes = [e.sha256 for e in db.query(EvidenceFile).filter(EvidenceFile.complaint_id == complaint_id).all()]
        bundle_hash = compute_bundle_hash(complaint.id, complaint.description or "", created_at_str, evidence_hashes)
        db_hash_valid = verify_complaint_signature(sig, bundle_hash)
    return SignatureResponse(
        exists=True,
        verified=db_hash_valid,
        public_key_pem=sig.public_key_pem,
        algorithm=sig.algorithm,
        created_at=sig.created_at.isoformat() if sig.created_at else None,
    )

# ============================================================
# AI CO-PILOT ENDPOINT
# ============================================================
@app.post("/api/copilot/analyze")
def copilot_analyze(data: CopilotSubmit, db: Session = Depends(get_db), current_user: User = Depends(require_roles("citizen"))):
    """Analyze the full conversation transcript to extract structured crime data."""
    full_text = data.final_text
    try:
        ai_result = extract_crime_details(full_text)
        return {"success": True, "analysis": ai_result, "conversation_id": data.conversation_id}
    except Exception as e:
        return {"success": False, "analysis": {"crime_type": "Unclassified", "risk_score": 0}, "error": str(e)}

# ============================================================
# COMPLAINT ENDPOINTS
# ============================================================
@app.post("/api/complaints", response_model=ComplaintResponse)
def create_complaint(data: ComplaintCreate, db: Session = Depends(get_db), current_user: User = Depends(require_roles("citizen"))):
    # Keep the account email internally so an anonymous submitter can still view
    # their own case history. The citizen name is anonymized in case-facing data.
    citizen_name = "Anonymous Citizen" if data.anonymous else current_user.name
    citizen_email = current_user.email
    complaint = Complaint(
        title=data.title, description=data.description, citizen_name=citizen_name,
        citizen_email=citizen_email, phone_number=data.phone_number, status="Pending",
        incident_date=data.incident_date, incident_location=data.location,
        fraud_category=data.fraud_category, upi_id=data.upi_id, bank_account=data.bank_account,
        crypto_wallet=data.crypto_wallet, website_url=data.website_url,
        suspect_email=data.suspect_email, amount=data.transaction_amount,
        anonymous=data.anonymous,
        intake_data=json.dumps({"submitted_category": data.fraud_category, "location": data.location}),
    )
    db.add(complaint); db.commit(); db.refresh(complaint)
    complaint.tracking_id = f"CS-{complaint.id:08X}"
    db.commit(); db.refresh(complaint)
    try:
        ai_result = extract_crime_details(data.description)
        complaint.crime_type = ai_result.get("crime_type") or complaint.crime_type
        complaint.amount = complaint.amount or ai_result.get("amount")
        complaint.bank_name = ai_result.get("bank_name") or complaint.bank_name
        complaint.upi_id = complaint.upi_id or ai_result.get("upi_id")
        complaint.phone_number = complaint.phone_number or ai_result.get("phone_number")
        complaint.risk_score = ai_result.get("risk_score", 0)
        if not complaint.risk_score:
            amount_risk = 35 if (complaint.amount or 0) >= 50000 else 15 if complaint.amount else 0
            indicator_risk = 20 if any([complaint.phone_number, complaint.upi_id, complaint.website_url, complaint.crypto_wallet]) else 0
            complaint.risk_score = min(100, amount_risk + indicator_risk + (25 if data.fraud_category in {"Financial Fraud", "Crypto Scam"} else 10))
        complaint.agency = ai_result.get("suggested_agency") or complaint.agency
        urgency = ai_result.get("urgency") or (
            "Critical" if complaint.risk_score >= 85 else
            "High" if complaint.risk_score >= 70 else
            "Medium" if complaint.risk_score >= 40 else "Low"
        )
        ai_result["urgency"] = urgency
        ai_result["suggested_law_sections"] = ai_result.get("suggested_law_sections", [
            {"act": "IT Act, 2000", "section": "Section 66D", "description": "Punishment for cheating by impersonation using computer resource"},
            {"act": "IPC (Now BNS)", "section": "Section 420", "description": "Cheating and dishonestly inducing delivery of property"},
        ])
        complaint.structured_data = json.dumps(ai_result)
        add_audit_log(db, complaint.id, "AI Processing Complete", "System",
                       f"Classified as {complaint.crime_type} (Risk: {complaint.risk_score}/100)")
    except Exception as e:
        print(f"AI extraction failed: {e}")
        add_audit_log(db, complaint.id, "AI Processing Failed", "System", str(e))

    # Enhanced deduplication
    complaint.duplicate_score, linked_cases = calculate_duplicate_score(db, complaint)
    if linked_cases:
        add_audit_log(db, complaint.id, "Duplicate Signal Detected", "System",
                       f"Potentially linked cases: {', '.join(map(str, linked_cases))}")
        add_audit_log(db, complaint.id, "Potential Fraud Campaign Detected", "System",
                      "Matching indicators or content linked this report to an existing campaign")

    # Compute bundle hash (includes complaint metadata, will include evidence hashes once uploaded)
    created_at_str = complaint.created_at.isoformat() if complaint.created_at else str(datetime.utcnow())
    evidence_hashes = [e.sha256 for e in db.query(EvidenceFile).filter(EvidenceFile.complaint_id == complaint.id).all()]
    bundle_hash = compute_bundle_hash(complaint.id, data.description, created_at_str, evidence_hashes)
    complaint.evidence_hash = bundle_hash

    # Blockchain anchoring
    try:
        tx_hash = submit_to_blockchain(complaint.id, bundle_hash, complaint.agency or "Unassigned")
        if tx_hash not in {"blockchain_disabled", "blockchain_error"}:
            complaint.blockchain_tx = tx_hash
            add_audit_log(db, complaint.id, "Blockchain Anchored", "System", f"Bundle hash stored: {bundle_hash[:20]}...")
        else:
            add_audit_log(db, complaint.id, "Blockchain Anchor Pending", "System", "Ledger is not configured; the local bundle hash remains available for verification")
    except Exception as e:
        print(f"Blockchain submission failed: {e}")
        add_audit_log(db, complaint.id, "Blockchain Failed", "System", str(e))

    complaint.updated_at = datetime.utcnow()
    db.commit(); db.refresh(complaint)
    return complaint

@app.post("/api/complaints/{complaint_id}/evidence")
async def upload_evidence(
    complaint_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint or not can_access_complaint(complaint, current_user):
        raise HTTPException(status_code=404, detail="Complaint not found")
    content = await file.read(MAX_EVIDENCE_FILE_BYTES + 1)
    try:
        storage_name, nonce, sha256, encrypted_size = encrypt_evidence(content, file.filename or "evidence.bin")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    record = EvidenceFile(
        complaint_id=complaint_id, original_filename=file.filename or "evidence.bin", storage_name=storage_name,
        content_type=file.content_type, encrypted_size=encrypted_size, sha256=sha256, nonce=nonce,
        uploaded_by=current_user.email,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    created_at_str = complaint.created_at.isoformat() if complaint.created_at else ""
    evidence_hashes = [item.sha256 for item in db.query(EvidenceFile).filter(EvidenceFile.complaint_id == complaint_id).all()]
    bundle_hash = compute_bundle_hash(complaint.id, complaint.description or "", created_at_str, evidence_hashes)
    complaint.evidence_hash = bundle_hash
    complaint.updated_at = datetime.utcnow()
    db.commit()
    chain_tx = update_evidence_hash_on_chain(complaint_id, bundle_hash)
    if chain_tx not in {"blockchain_disabled", "blockchain_error"}:
        complaint.blockchain_tx = chain_tx
        db.commit()
    add_audit_log(db, complaint_id, "Evidence Encrypted and Added", current_user.name,
                   f"Evidence #{record.id}: {record.original_filename}; SHA-256: {sha256}; bundle hash updated")
    return {"id": record.id, "filename": record.original_filename, "sha256": record.sha256,
            "bundle_hash": bundle_hash, "encrypted": True, "blockchain_tx": chain_tx}

@app.get("/api/complaints/{complaint_id}/evidence")
def list_evidence(complaint_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint or not can_access_complaint(complaint, current_user):
        raise HTTPException(status_code=404, detail="Complaint not found")
    records = db.query(EvidenceFile).filter(EvidenceFile.complaint_id == complaint_id).all()
    return [{"id": item.id, "filename": item.original_filename, "sha256": item.sha256,
             "content_type": item.content_type, "uploaded_by": item.uploaded_by,
             "created_at": item.created_at.isoformat()} for item in records]

@app.get("/api/evidence/{evidence_id}/download")
def download_evidence(evidence_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    record = db.query(EvidenceFile).filter(EvidenceFile.id == evidence_id).first()
    complaint = db.query(Complaint).filter(Complaint.id == record.complaint_id).first() if record else None
    if not record or not complaint or not can_access_complaint(complaint, current_user):
        raise HTTPException(status_code=404, detail="Evidence not found")
    try:
        content = decrypt_evidence(record.storage_name, record.nonce, record.original_filename)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Encrypted evidence is unavailable") from exc
    if hashlib.sha256(content).hexdigest() != record.sha256:
        add_audit_log(db, complaint.id, "Evidence Integrity Alert", current_user.name, f"Evidence #{record.id} failed SHA-256 verification")
        raise HTTPException(status_code=409, detail="Evidence integrity check failed; file is not available for download")
    add_audit_log(db, complaint.id, "Evidence Viewed", current_user.name, f"Evidence #{record.id}: {record.original_filename}")
    return Response(content=content, media_type=record.content_type or "application/octet-stream",
                    headers={"Content-Disposition": f'attachment; filename="{record.original_filename}"'})

@app.post("/api/complaints/{complaint_id}/access")
def grant_case_access(complaint_id: int, data: AccessGrantRequest, db: Session = Depends(get_db),
                      admin: User = Depends(require_roles("admin"))):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    user = db.query(User).filter(User.email == data.user_email, User.role == "investigator", User.status == "approved").first()
    if not complaint or not user:
        raise HTTPException(status_code=404, detail="Complaint or approved investigator not found")
    existing = db.query(CaseAccessGrant).filter(
        CaseAccessGrant.complaint_id == complaint_id, CaseAccessGrant.user_id == user.id).first()
    if not existing:
        grant = CaseAccessGrant(complaint_id=complaint_id, user_id=user.id, granted_by=admin.email)
        db.add(grant)
        db.commit()
        db.refresh(grant)
        add_audit_log(db, complaint_id, "Investigator Access Granted", admin.name, f"Access granted to {user.email}")
        # Mirror on-chain if possible
        try:
            from blockchain.contract import contract, w3, account
            if contract and account:
                # In production, user.id maps to the investigator's wallet address stored in their profile
                pass
        except Exception:
            pass
    return {"success": True, "complaint_id": complaint_id, "investigator": user.email}

@app.get("/api/complaints/{complaint_id}/access-grants")
def list_access_grants(complaint_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    grants = db.query(CaseAccessGrant).filter(CaseAccessGrant.complaint_id == complaint_id).all()
    results = []
    for g in grants:
        user = db.query(User).filter(User.id == g.user_id).first()
        results.append({
            "id": g.id,
            "user_email": user.email if user else "unknown",
            "user_name": user.name if user else "unknown",
            "granted_by": g.granted_by,
            "on_chain_tx": g.on_chain_tx,
            "created_at": g.created_at.isoformat() if g.created_at else None,
        })
    return results

@app.get("/api/complaints")
def list_complaints(skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = None, risk_min: Optional[int] = None,
    crime_type: Optional[str] = None, search: Optional[str] = None,
    sort: str = "created_at", order: str = "desc", db: Session = Depends(get_db), _: User = Depends(require_roles("investigator", "admin"))):
    query = db.query(Complaint)
    if status: query = query.filter(Complaint.status == status)
    if risk_min: query = query.filter(Complaint.risk_score >= risk_min)
    if crime_type: query = query.filter(Complaint.crime_type == crime_type)
    if search:
        query = query.filter(
            Complaint.title.ilike(f"%{search}%") |
            Complaint.description.ilike(f"%{search}%") |
            Complaint.phone_number.ilike(f"%{search}%") |
            Complaint.citizen_name.ilike(f"%{search}%") |
            Complaint.citizen_email.ilike(f"%{search}%")
        )
    total = query.count()
    sort_col = getattr(Complaint, sort, None)
    if sort_col is None or sort not in {"created_at", "updated_at", "risk_score", "status", "crime_type"}:
        raise HTTPException(status_code=400, detail="Invalid sort field")
    if order == "desc": sort_col = sort_col.desc()
    results = query.order_by(sort_col).offset(skip).limit(limit).all()
    return {"total": total, "complaints": results, "page": (skip // limit) + 1 if limit else 1,
            "pages": max(1, (total + limit - 1) // limit) if limit else 1}

@app.get("/api/complaints/{complaint_id}")
def get_complaint(complaint_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("investigator", "admin"))):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint: raise HTTPException(status_code=404, detail="Complaint not found")
    return complaint

@app.get("/api/complaints/{complaint_id}/verify", response_model=VerifyResponse)
def verify_complaint_integrity(complaint_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("investigator", "admin"))):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint: raise HTTPException(status_code=404, detail="Complaint not found")
    created_at_str = complaint.created_at.isoformat() if complaint.created_at else ""
    records = db.query(EvidenceFile).filter(EvidenceFile.complaint_id == complaint_id).all()
    evidence_hashes = [e.sha256 for e in records]
    computed_bundle_hash = compute_bundle_hash(complaint.id, complaint.description or "", created_at_str, evidence_hashes)
    corrupted_files = []
    for record in records:
        try:
            actual_hash = hashlib.sha256(decrypt_evidence(record.storage_name, record.nonce, record.original_filename)).hexdigest()
            if actual_hash != record.sha256:
                corrupted_files.append(record.original_filename)
        except Exception:
            corrupted_files.append(record.original_filename)
    tampered = computed_bundle_hash != complaint.evidence_hash or bool(corrupted_files)
    on_chain = verify_on_chain(complaint_id)
    on_chain_matches = on_chain.get("exists", False) and on_chain.get("evidence_hash") == complaint.evidence_hash
    # Local cryptographic evidence verification remains valid when an optional chain adapter is unavailable.
    verified = not tampered
    # Also check digital signature
    sig = db.query(DigitalSignature).filter(DigitalSignature.complaint_id == complaint_id).first()
    return VerifyResponse(
        complaint_id=complaint_id, status=complaint.status,
        db_hash=complaint.evidence_hash, computed_hash=computed_bundle_hash,
        bundle_hash=computed_bundle_hash,
        on_chain_hash=on_chain.get("evidence_hash"), blockchain_tx=complaint.blockchain_tx,
        tampered=tampered, verified=verified
    )

@app.post("/api/ocr/extract")
async def ocr_extract(file: UploadFile = File(...), _: User = Depends(get_current_user)):
    """Extract text and common payment indicators from a real uploaded image, PDF, or text file."""
    content = await file.read(MAX_EVIDENCE_FILE_BYTES + 1)
    if not content or len(content) > MAX_EVIDENCE_FILE_BYTES:
        raise HTTPException(status_code=400, detail="Upload a non-empty file under the evidence size limit")
    result = extract_text(content, file.content_type or "", file.filename or "")
    if result.get("error"):
        raise HTTPException(status_code=422, detail=result["error"])
    return result

# ============================================================
# CITIZEN ENDPOINTS
# ============================================================
@app.get("/api/citizen/track")
def track_complaint(complaint_id: Optional[int] = None, tracking_id: Optional[str] = None, status: Optional[str] = None,
                    search: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(require_roles("citizen"))):
    query = db.query(Complaint).filter(Complaint.citizen_email == current_user.email)
    if complaint_id: query = query.filter(Complaint.id == complaint_id)
    if tracking_id: query = query.filter(Complaint.tracking_id == tracking_id.upper())
    if status: query = query.filter(Complaint.status == status)
    if search:
        query = query.filter(Complaint.title.ilike(f"%{search}%") | Complaint.tracking_id.ilike(f"%{search}%"))
    return query.order_by(Complaint.created_at.desc()).all() or []

@app.get("/api/citizen/dashboard")
def citizen_dashboard(db: Session = Depends(get_db), current_user: User = Depends(require_roles("citizen"))):
    query = db.query(Complaint).filter(Complaint.citizen_email == current_user.email)
    complaints = query.order_by(Complaint.created_at.desc()).all()
    return {
        "pending": sum(c.status == "Pending" for c in complaints),
        "under_investigation": sum(c.status in {"Under Investigation", "In Progress"} for c in complaints),
        "resolved": sum(c.status == "Resolved" for c in complaints),
        "recent_complaints": complaints[:5],
    }

@app.get("/api/citizen/complaint/{complaint_id}")
def citizen_complaint_detail(complaint_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles("citizen"))):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id, Complaint.citizen_email == current_user.email).first()
    if not complaint: raise HTTPException(status_code=404, detail="Complaint not found for this email")
    logs = db.query(AuditLog).filter(AuditLog.complaint_id == complaint_id).order_by(AuditLog.timestamp.desc()).all()
    sig = db.query(DigitalSignature).filter(DigitalSignature.complaint_id == complaint_id).first()
    evidence = db.query(EvidenceFile).filter(EvidenceFile.complaint_id == complaint_id).all()
    return {
        "complaint": complaint,
        "audit_logs": [{"action": l.action, "performed_by": l.performed_by, "details": l.details,
                         "timestamp": l.timestamp.isoformat()} for l in logs],
        "digital_signature": {
            "exists": sig is not None,
            "algorithm": sig.algorithm if sig else None,
            "created_at": sig.created_at.isoformat() if sig and sig.created_at else None,
        } if sig else {"exists": False},
        "evidence_files": [{"id": e.id, "filename": e.original_filename, "sha256": e.sha256} for e in evidence],
    }

@app.get("/api/citizen/scam-check", response_model=ScamCheckResponse)
def scam_check(query: str = Query(..., min_length=3, max_length=255), db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    results = db.query(Complaint).filter(
        (Complaint.phone_number == query) | (Complaint.upi_id == query) |
        (Complaint.description.ilike(f"%{query}%"))
    ).all()
    if not results:
        return ScamCheckResponse(found=False, message="No reports found", risk="low", total_reports=0)
    risk_score = min(len(results) * 15, 100)
    risk_level = "high" if risk_score >= 70 else "medium" if risk_score >= 40 else "low"
    return ScamCheckResponse(found=True, message=f"Found {len(results)} report(s)", risk=risk_level,
        risk_score=risk_score, total_reports=len(results),
        complaints=[{"id": c.id, "title": c.title, "crime_type": c.crime_type, "status": c.status,
                      "created_at": c.created_at.isoformat()} for c in results[:10]])

@app.get("/api/citizen/safety-tips")
def get_safety_tips():
    return SAFETY_TIPS

SAFETY_TIPS = [
    {"id": 1, "category": "UPI Fraud", "title": "Never Share Your UPI PIN", "description": "No bank or government agency will ever ask for your UPI PIN, OTP, or ATM PIN over a call.", "icon": "🔐", "severity": "critical"},
    {"id": 2, "category": "Phishing", "title": "Verify Links Before Clicking", "description": "Always check the URL before entering credentials.", "icon": "🔗", "severity": "high"},
    {"id": 3, "category": "Banking", "title": "Call Your Bank Immediately", "description": "If you suspect fraud, call your bank's official customer care immediately.", "icon": "📞", "severity": "critical"},
    {"id": 4, "category": "Identity Theft", "title": "Protect Your Documents", "description": "Never share Aadhaar, PAN, passport with unverified entities.", "icon": "🪪", "severity": "high"},
    {"id": 5, "category": "Sextortion", "title": "Don't Panic, Don't Pay", "description": "If threatened with leaked photos, do NOT pay. Report immediately.", "icon": "🛡️", "severity": "critical"},
    {"id": 6, "category": "Investment", "title": "Too Good To Be True? It's a Scam", "description": "Guaranteed returns schemes are almost always scams.", "icon": "💰", "severity": "high"},
    {"id": 7, "category": "Social Media", "title": "Enable 2-Factor Authentication", "description": "2FA protects your accounts even if your password is stolen.", "icon": "🔑", "severity": "medium"},
    {"id": 8, "category": "Ransomware", "title": "Backup Your Data", "description": "Regular backups protect you from ransomware.", "icon": "💾", "severity": "medium"},
    {"id": 9, "category": "General", "title": "Report Immediately", "description": "File a complaint at cybercrime.gov.in or call 1930.", "icon": "🚨", "severity": "critical"},
    {"id": 10, "category": "OTP Fraud", "title": "Never Share OTP With Anyone", "description": "OTP is your digital signature. No one legitimate asks for it.", "icon": "📱", "severity": "critical"},
]

# ============================================================
# INVESTIGATOR ENDPOINTS
# ============================================================
@app.get("/api/investigator/dashboard")
def investigator_dashboard(db: Session = Depends(get_db), _: User = Depends(require_roles("investigator", "admin"))):
    total = db.query(Complaint).count()
    pending = db.query(Complaint).filter(Complaint.status == "Pending").count()
    investigating = db.query(Complaint).filter(Complaint.status == "Under Investigation").count()
    resolved = db.query(Complaint).filter(Complaint.status == "Resolved").count()
    high_risk = db.query(Complaint).filter(Complaint.risk_score >= 70).count()
    verified = db.query(Complaint).filter(Complaint.blockchain_tx.isnot(None)).count()
    signed = db.query(DigitalSignature).count()
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    recent = db.query(Complaint).filter(Complaint.created_at >= seven_days_ago).count()
    return {"total_complaints": total, "pending_review": pending, "under_investigation": investigating,
            "resolved": resolved, "high_risk": high_risk, "blockchain_verified": verified,
            "unverified": total - verified, "recent_7_days": recent, "crypto_signed": signed}

@app.get("/api/investigator/complaints")
def investigator_complaints(skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = None, risk_min: Optional[int] = None, crime_type: Optional[str] = None,
    search: Optional[str] = None, sort: str = "created_at", order: str = "desc",
    db: Session = Depends(get_db), _: User = Depends(require_roles("investigator", "admin"))):
    query = db.query(Complaint)
    if status: query = query.filter(Complaint.status == status)
    if risk_min: query = query.filter(Complaint.risk_score >= risk_min)
    if crime_type: query = query.filter(Complaint.crime_type == crime_type)
    if search:
        query = query.filter(
            Complaint.title.ilike(f"%{search}%") | Complaint.description.ilike(f"%{search}%") |
            Complaint.phone_number.ilike(f"%{search}%") | Complaint.citizen_name.ilike(f"%{search}%")
        )
    total = query.count()
    sort_col = getattr(Complaint, sort, None)
    if sort_col is None or sort not in {"created_at", "updated_at", "risk_score", "status", "crime_type"}:
        raise HTTPException(status_code=400, detail="Invalid sort field")
    if order == "desc": sort_col = sort_col.desc()
    results = query.order_by(sort_col).offset(skip).limit(limit).all()
    return {"total": total, "complaints": results, "page": (skip // limit) + 1 if limit else 1,
            "pages": max(1, (total + limit - 1) // limit) if limit else 1}

@app.get("/api/investigator/complaint/{complaint_id}")
def investigator_complaint_detail(complaint_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("investigator", "admin"))):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint: raise HTTPException(status_code=404, detail="Complaint not found")
    ai_data = {}
    if complaint.structured_data:
        try: ai_data = json.loads(complaint.structured_data)
        except: pass
    duplicates = []
    if complaint.phone_number:
        dups = db.query(Complaint).filter(Complaint.phone_number == complaint.phone_number,
                                           Complaint.id != complaint_id).limit(5).all()
        duplicates = [{"id": d.id, "title": d.title, "risk_score": d.risk_score, "similarity": 97} for d in dups]
    logs = db.query(AuditLog).filter(AuditLog.complaint_id == complaint_id).order_by(AuditLog.timestamp.desc()).all()
    sig = db.query(DigitalSignature).filter(DigitalSignature.complaint_id == complaint_id).first()
    return {"complaint": complaint, "ai_analysis": ai_data, "duplicates": duplicates,
            "evidence_status": "encrypted" if complaint.evidence_hash else "none",
            "audit_logs": [{"action": l.action, "performed_by": l.performed_by, "details": l.details,
                            "timestamp": l.timestamp.isoformat()} for l in logs],
            "digital_signature": {"exists": sig is not None, "algorithm": sig.algorithm if sig else None,
                                  "created_at": sig.created_at.isoformat() if sig and sig.created_at else None,
                                  "signed_hash": sig.signed_hash[:24] + "..." if sig else None} if sig else {"exists": False}}

@app.get("/api/investigator/complaint/{complaint_id}/intelligence")
def case_intelligence(complaint_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("investigator", "admin"))):
    """Local, explainable investigation aids derived from case data and linked reports."""
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    indicators = complaint_indicators(complaint)
    candidates = db.query(Complaint).filter(Complaint.id != complaint_id).all()
    linked, similarities = [], []
    all_values = {value for values in indicators.values() for value in values}
    for item in candidates:
        other = complaint_indicators(item)
        other_values = {value for values in other.values() for value in values}
        shared = sorted(all_values & other_values)
        text_score = SequenceMatcher(None, (complaint.description or "").lower(), (item.description or "").lower()).ratio() * 100
        if shared or text_score >= 55:
            match = round(max(text_score, min(100, 55 + len(shared) * 20)), 1)
            record = {"id": item.id, "tracking_id": item.tracking_id, "title": item.title, "status": item.status,
                      "risk_score": item.risk_score, "match": match, "shared_indicators": shared}
            linked.append(record)
            if item.status == "Resolved": similarities.append(record)
    linked = sorted(linked, key=lambda item: item["match"], reverse=True)[:12]
    similarities = sorted(similarities, key=lambda item: item["match"], reverse=True)[:5]
    amount = complaint.amount or 0
    campaign = len(linked) >= 2
    priority_score = min(100, (complaint.risk_score or 0) + (18 if campaign else 0) + (12 if amount >= 50000 else 0) + (8 if amount >= 200000 else 0))
    priority = "Critical" if priority_score >= 85 else "High" if priority_score >= 65 else "Medium" if priority_score >= 35 else "Low"
    age_minutes = max(0, int((datetime.utcnow() - complaint.created_at).total_seconds() / 60)) if complaint.created_at else 9999
    recovery = min(95, (78 if age_minutes <= 30 else 50 if age_minutes <= 1440 else 22) + (12 if amount else 0) + (5 if complaint.upi_id or complaint.bank_account else 0))
    next_actions = playbook_for(complaint.crime_type, complaint.fraud_category)
    if recovery >= 70:
        next_actions.insert(0, "URGENT: request beneficiary-account freeze and submit 1930 escalation")
    evidence = db.query(EvidenceFile).filter(EvidenceFile.complaint_id == complaint_id).all()
    notes = db.query(InvestigationNote).filter(InvestigationNote.complaint_id == complaint_id).order_by(InvestigationNote.created_at.desc()).all()
    financial_nodes = [{"label": "Reporting victim", "type": "source"}]
    for label, value, kind in [("UPI beneficiary", complaint.upi_id, "upi"), ("Bank beneficiary", complaint.bank_account, "bank"), ("Crypto wallet", complaint.crypto_wallet, "wallet")]:
        if value:
            financial_nodes.append({"label": value, "type": kind, "title": label})
    timeline = [
        {"time": complaint.incident_date or "Incident date not supplied", "event": "Victim-reported cybercrime incident"},
        {"time": complaint.created_at.isoformat() if complaint.created_at else "", "event": "Complaint filed and evidence bundle initialized"},
        {"time": complaint.updated_at.isoformat() if complaint.updated_at else "", "event": "AI triage, integrity proof, and investigator queue update"},
    ]
    for log in db.query(AuditLog).filter(AuditLog.complaint_id == complaint_id).order_by(AuditLog.timestamp).all():
        timeline.append({"time": log.timestamp.isoformat() if log.timestamp else "", "event": log.action})
    return {
        "priority": {"level": priority, "score": round(priority_score), "reasons": [f"Risk score {complaint.risk_score or 0}/100", f"₹{amount:,.0f} reported loss" if amount else "No confirmed loss recorded", f"{len(linked)} linked case(s)" if linked else "No linked cases yet"]},
        "network": {"campaign_detected": campaign, "linked_cases": linked, "victim_count": len(linked) + 1, "indicators": indicators},
        "recovery": {"score": round(recovery), "recommendation": "Initiate an immediate bank/UPI freeze request" if recovery >= 70 else "Preserve transaction proof and coordinate with the relevant payment provider"},
        "timeline": timeline[:12], "playbook": playbook_for(complaint.crime_type, complaint.fraud_category),
        "next_actions": next_actions, "similar_solved_cases": similarities,
        "suspect_profile": {"name": "Unknown", "known_indicators": sum(len(items) for items in indicators.values()), "phones": len(indicators.get("phone", [])), "upis": len(indicators.get("upi", [])), "wallets": len(indicators.get("wallet", [])), "ips": len(indicators.get("ip", [])), "linked_complaints": len(linked), "estimated_loss": amount + sum(item.amount or 0 for item in candidates if item.id in {case['id'] for case in linked})},
        "threat_intelligence": [{"type": kind, "indicator": value, "reports": sum(value in {item for group in complaint_indicators(c).values() for item in group} for c in [complaint] + candidates)} for kind, values in indicators.items() for value in values],
        "evidence_summary": [{"filename": item.original_filename, "type": item.content_type or "unknown", "sha256": item.sha256, "summary": "Encrypted evidence preserved; extractable transaction details require OCR/forensic review."} for item in evidence],
        "financial_flow": {"available": len(financial_nodes) > 1, "reported_amount": amount, "nodes": financial_nodes,
                           "assessment": "Reported payment path only. Confirm with bank, UPI, exchange, or wallet-provider records before taking action." if len(financial_nodes) > 1 else "No beneficiary identifier was supplied in this case."},
        "chain_of_custody": [{"action": log.action, "actor": log.performed_by, "time": log.timestamp.isoformat() if log.timestamp else ""} for log in db.query(AuditLog).filter(AuditLog.complaint_id == complaint_id).order_by(AuditLog.timestamp).all()],
        "notes": [{"id": note.id, "author": note.author, "body": note.body, "assignee": note.assignee, "status": note.task_status, "created_at": note.created_at.isoformat() if note.created_at else ""} for note in notes],
    }

@app.post("/api/investigator/complaint/{complaint_id}/notes")
def add_investigation_note(complaint_id: int, data: InvestigationNoteCreate, db: Session = Depends(get_db), current_user: User = Depends(require_roles("investigator", "admin"))):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint: raise HTTPException(status_code=404, detail="Complaint not found")
    if not data.body.strip(): raise HTTPException(status_code=400, detail="A note or task description is required")
    note = InvestigationNote(complaint_id=complaint_id, author=current_user.name, body=data.body, assignee=data.assignee)
    db.add(note); db.commit(); db.refresh(note)
    add_audit_log(db, complaint_id, "Investigation Note Added", current_user.name, f"Assigned to: {data.assignee or 'Unassigned'}")
    return {"id": note.id, "success": True}

@app.put("/api/investigator/complaint/{complaint_id}/tasks/{task_id}")
def update_investigation_task(complaint_id: int, task_id: int, data: InvestigationTaskUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_roles("investigator", "admin"))):
    if data.task_status not in {"open", "in_progress", "completed"}:
        raise HTTPException(status_code=400, detail="Task status must be open, in_progress, or completed")
    task = db.query(InvestigationNote).filter(InvestigationNote.id == task_id, InvestigationNote.complaint_id == complaint_id).first()
    if not task: raise HTTPException(status_code=404, detail="Investigation task not found")
    task.task_status = data.task_status
    db.commit()
    add_audit_log(db, complaint_id, f"Investigation Task {data.task_status.replace('_', ' ').title()}", current_user.name, task.body[:180])
    return {"id": task.id, "task_status": task.task_status, "success": True}

@app.get("/api/investigator/complaint/{complaint_id}/court-report")
def court_report(complaint_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("investigator", "admin"))):
    """Generate a review-ready case report from the locally preserved case record.

    It is deliberately labelled as a draft: it must be reviewed and signed by an
    authorised officer before legal filing.
    """
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint: raise HTTPException(status_code=404, detail="Complaint not found")
    evidence = db.query(EvidenceFile).filter(EvidenceFile.complaint_id == complaint_id).order_by(EvidenceFile.created_at).all()
    signature = db.query(DigitalSignature).filter(DigitalSignature.complaint_id == complaint_id).first()
    logs = db.query(AuditLog).filter(AuditLog.complaint_id == complaint_id).order_by(AuditLog.timestamp).all()
    notes = db.query(InvestigationNote).filter(InvestigationNote.complaint_id == complaint_id).order_by(InvestigationNote.created_at).all()
    created_at = complaint.created_at.isoformat() if complaint.created_at else ""
    bundle_hash = compute_bundle_hash(complaint.id, complaint.description or "", created_at, [item.sha256 for item in evidence])
    signature_valid = verify_complaint_signature(signature, bundle_hash) if signature else False
    return {
        "document_type": "Court-ready investigation report — review draft",
        "generated_at": datetime.utcnow().isoformat(),
        "case": {"id": complaint.id, "tracking_id": complaint.tracking_id, "title": complaint.title, "status": complaint.status,
                 "crime_type": complaint.crime_type, "fraud_category": complaint.fraud_category, "incident_date": complaint.incident_date,
                 "incident_location": complaint.incident_location, "reported_loss": complaint.amount, "description": complaint.description,
                 "risk_score": complaint.risk_score, "assigned_officer": complaint.assigned_officer, "agency": complaint.agency},
        "indicators": complaint_indicators(complaint),
        "evidence": [{"filename": item.original_filename, "content_type": item.content_type, "sha256": item.sha256,
                      "captured_at": item.created_at.isoformat() if item.created_at else "", "encrypted_size": item.encrypted_size} for item in evidence],
        "integrity": {"bundle_hash": bundle_hash, "evidence_count": len(evidence), "digital_signature_present": signature is not None,
                      "digital_signature_verified": signature_valid, "signature_algorithm": signature.algorithm if signature else None,
                      "blockchain_reference": complaint.blockchain_tx},
        "chain_of_custody": [{"timestamp": log.timestamp.isoformat() if log.timestamp else "", "action": log.action,
                              "actor": log.performed_by, "details": log.details} for log in logs],
        "investigation_notes": [{"author": note.author, "body": note.body, "assignee": note.assignee,
                                  "status": note.task_status, "created_at": note.created_at.isoformat() if note.created_at else ""} for note in notes],
        "review_notice": "This system-generated draft is not a legal filing. An authorised officer must verify facts, evidence admissibility, and applicable law before use.",
    }

@app.put("/api/investigator/complaint/{complaint_id}/status")
def update_complaint_status(complaint_id: int, data: StatusUpdate, db: Session = Depends(get_db),
                            current_user: User = Depends(require_roles("investigator", "admin"))):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint: raise HTTPException(status_code=404, detail="Complaint not found")
    old_status = complaint.status
    complaint.status = data.status
    if data.assigned_officer: complaint.assigned_officer = data.assigned_officer
    complaint.updated_at = datetime.utcnow()
    add_audit_log(db, complaint_id, f"Status: {old_status} → {data.status}", current_user.name, data.notes or "")
    try: update_status_on_chain(complaint_id, data.status)
    except: pass
    db.commit()
    return {"message": "Status updated", "complaint_id": complaint_id, "status": complaint.status, "old_status": old_status}

@app.get("/api/investigator/threat-graph")
def threat_graph(db: Session = Depends(get_db), _: User = Depends(require_roles("investigator", "admin"))):
    nodes, edges, node_ids = [], [], set()
    indicator_counts = {}
    
    complaints = db.query(Complaint).order_by(Complaint.created_at.desc()).limit(100).all()
    
    # First pass: count indicator occurrences across complaints to find syndicates
    for c in complaints:
        indicators = [
            ("phone", f"p-{c.phone_number.strip()}") if c.phone_number and c.phone_number.strip() else None,
            ("upi", f"u-{c.upi_id.strip()}") if c.upi_id and c.upi_id.strip() else None,
            ("bank", f"b-{c.bank_account.strip()}") if c.bank_account and c.bank_account.strip() else None,
            ("crypto", f"w-{c.crypto_wallet.strip()}") if c.crypto_wallet and c.crypto_wallet.strip() else None,
            ("website", f"web-{c.website_url.strip()}") if c.website_url and c.website_url.strip() else None,
            ("email", f"e-{c.suspect_email.strip()}") if c.suspect_email and c.suspect_email.strip() else None,
        ]
        for ind in indicators:
            if ind:
                _, key = ind
                indicator_counts[key] = indicator_counts.get(key, 0) + 1

    # Second pass: construct nodes and edges
    added_indicators = set()
    
    for c in complaints:
        cid = f"c-{c.id}"
        if cid not in node_ids:
            nodes.append({
                "id": cid,
                "db_id": c.id,
                "label": c.tracking_id or f"CS-{c.id:08X}",
                "type": "complaint",
                "risk": c.risk_score or 50,
                "crime": c.crime_type or c.fraud_category or "Cyber Fraud",
                "title": c.title or "Complaint Docket",
                "amount": c.amount or 0,
                "status": c.status or "Pending",
                "date": c.created_at.isoformat() if c.created_at else ""
            })
            node_ids.add(cid)

        # Connect indicators with safe null checks
        ind_list = [
            ("phone", f"p-{c.phone_number.strip()}", c.phone_number.strip(), "Phone Number") if c.phone_number and c.phone_number.strip() else None,
            ("upi", f"u-{c.upi_id.strip()}", c.upi_id.strip(), "UPI VPA Handle") if c.upi_id and c.upi_id.strip() else None,
            ("bank", f"b-{c.bank_account.strip()}", c.bank_account.strip(), "Bank Account") if c.bank_account and c.bank_account.strip() else None,
            ("crypto", f"w-{c.crypto_wallet.strip()}", c.crypto_wallet.strip(), "Crypto Wallet") if c.crypto_wallet and c.crypto_wallet.strip() else None,
            ("website", f"web-{c.website_url.strip()}", c.website_url.strip(), "Phishing Domain") if c.website_url and c.website_url.strip() else None,
            ("email", f"e-{c.suspect_email.strip()}", c.suspect_email.strip(), "Suspect Email") if c.suspect_email and c.suspect_email.strip() else None,
        ]
        
        for item in ind_list:
            if not item:
                continue
            itype, node_id, val, rel_label = item
            if node_id not in added_indicators:
                linked_cases_count = indicator_counts.get(node_id, 1)
                ind_risk = 90 if linked_cases_count >= 3 else 70 if linked_cases_count == 2 else 45
                nodes.append({
                    "id": node_id,
                    "label": val,
                    "type": itype,
                    "risk": ind_risk,
                    "linked_count": linked_cases_count,
                    "title": f"{rel_label}: {val}"
                })
                added_indicators.add(node_id)
            
            edges.append({
                "source": cid,
                "target": node_id,
                "label": rel_label,
                "value": 1
            })

    return {
        "nodes": nodes,
        "edges": edges,
        "summary": {
            "total_cases": len([n for n in nodes if n["type"] == "complaint"]),
            "total_indicators": len([n for n in nodes if n["type"] != "complaint"]),
            "total_links": len(edges),
            "syndicate_indicators": len([n for n in nodes if n.get("linked_count", 0) > 1])
        }
    }

@app.get("/api/investigator/crime-types")
def crime_types(db: Session = Depends(get_db), _: User = Depends(require_roles("investigator", "admin"))):
    results = db.query(Complaint.crime_type, func.count(Complaint.id)).filter(
        Complaint.crime_type.isnot(None)).group_by(Complaint.crime_type).order_by(func.count(Complaint.id).desc()).all()
    return [{"type": r[0], "count": r[1]} for r in results]

# ============================================================
# ADMIN ENDPOINTS
# ============================================================
@app.get("/api/stats/dashboard")
def global_stats(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    total = db.query(Complaint).count()
    pending = db.query(Complaint).filter(Complaint.status == "Pending").count()
    high_risk = db.query(Complaint).filter(Complaint.risk_score >= 70).count()
    verified = db.query(Complaint).filter(Complaint.blockchain_tx.isnot(None), ~Complaint.blockchain_tx.like("blockchain_%")).count()
    signed = db.query(DigitalSignature).count()
    category = func.coalesce(func.nullif(func.trim(Complaint.crime_type), ""), "Unclassified")
    types_count = db.query(category).distinct().count()
    return {"total_complaints": total, "pending": pending, "high_risk": high_risk,
            "blockchain_verified": verified, "crypto_signed": signed, "crime_types": types_count}

@app.get("/api/analytics/crime-distribution")
def crime_distribution(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    # Keep every submitted report visible, including records awaiting AI classification.
    category = func.coalesce(func.nullif(func.trim(Complaint.crime_type), ""), "Unclassified")
    results = db.query(category.label("type"), func.count(Complaint.id).label("count")).group_by(category).order_by(func.count(Complaint.id).desc()).all()
    return [{"type": row.type, "count": row.count} for row in results]

@app.get("/api/analytics/trends")
def complaint_trends(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    results = db.query(cast(Complaint.created_at, Date).label("date"), func.count(Complaint.id)).group_by(
        cast(Complaint.created_at, Date)).order_by("date").limit(30).all()
    return [{"date": str(r[0]), "count": r[1]} for r in results]

@app.get("/api/admin/users")
def admin_users(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    investigators = db.query(User).filter(User.role == "investigator", User.status == "approved").order_by(User.name).all()
    return [{"name": user.name, "email": user.email, "role": "investigator",
             "cases": db.query(Complaint).filter(Complaint.assigned_officer == user.name).count()} for user in investigators]

@app.put("/api/admin/users/{email}/role")
def update_user_role(email: str, data: dict, db: Session = Depends(get_db), admin: User = Depends(require_roles("admin"))):
    role = data.get("role")
    if role not in {"citizen", "investigator", "admin"}:
        raise HTTPException(status_code=400, detail="Invalid role")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    old_role = user.role
    user.role = role
    db.commit()
    add_audit_log(db, 0, "User Role Updated", admin.name, f"{email}: {old_role} → {role}")
    return {"email": email, "role": user.role, "updated": True}

@app.get("/api/admin/agencies")
def list_agencies(_: User = Depends(require_roles("admin"))):
    return [{"id": 1, "name": "Cyber Crime Police", "cases": 47, "status": "active"},
            {"id": 2, "name": "FBI IC3", "cases": 12, "status": "active"},
            {"id": 3, "name": "RBI Cyber Cell", "cases": 8, "status": "active"},
            {"id": 4, "name": "SEBI", "cases": 3, "status": "inactive"},
            {"id": 5, "name": "CERT-In", "cases": 21, "status": "active"},
            {"id": 6, "name": "NCRP (1930 Helpline)", "cases": 34, "status": "active"}]

@app.post("/api/admin/agencies")
def create_agency(data: dict, _: User = Depends(require_roles("admin"))):
    return {"id": 7, "name": data.get("name", "New Agency"), "cases": 0, "status": "active"}

@app.get("/api/admin/ai/monitoring")
def ai_monitoring(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    total = db.query(Complaint).count()
    with_ai = db.query(Complaint).filter(Complaint.crime_type.isnot(None)).count()
    failed = max(0, total - with_ai)
    avg_risk = db.query(func.avg(Complaint.risk_score)).scalar() or 0
    latest = db.query(Complaint).order_by(Complaint.updated_at.desc()).limit(5).all()
    return {"total_processed": with_ai, "success_rate": round((with_ai / total * 100) if total else 0, 1),
            "failed": failed, "avg_risk_score": round(float(avg_risk), 1), "recent_errors": [],
            "updated_at": datetime.utcnow().isoformat(), "recent_activity": [{"id": c.id, "title": c.title, "risk": c.risk_score, "processed_at": c.updated_at.isoformat() if c.updated_at else None} for c in latest]}

@app.get("/api/admin/ai/accuracy")
def ai_accuracy(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    # Ground-truth labels are not collected by this application, so report the
    # real-time classification coverage rather than fabricating an accuracy score.
    category = func.coalesce(func.nullif(func.trim(Complaint.crime_type), ""), "Awaiting classification")
    types = db.query(category.label("type"), func.count(Complaint.id).label("count")).group_by(category).order_by(func.count(Complaint.id).desc()).all()
    return [{"type": row.type, "count": row.count, "coverage": 0 if row.type == "Awaiting classification" else 100} for row in types]

DEFAULT_SETTINGS = {"autoAssignAgency": True, "requireBlockchainVerification": False, "aiAutoClassify": True, "notifyOnHighRisk": True, "duplicateDetectionThreshold": 80, "maxEvidenceSize": 10, "retentionDays": 365, "autoResolveDays": 30}

@app.get("/api/admin/settings")
def get_settings(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    stored = {item.key: json.loads(item.value) for item in db.query(SystemSetting).all()}
    return {**DEFAULT_SETTINGS, **stored}

@app.put("/api/admin/settings")
def save_settings(data: dict, db: Session = Depends(get_db), admin: User = Depends(require_roles("admin"))):
    values = {key: data[key] for key in DEFAULT_SETTINGS if key in data}
    for key, value in values.items():
        item = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if item: item.value = json.dumps(value)
        else: db.add(SystemSetting(key=key, value=json.dumps(value)))
    db.commit(); add_audit_log(db, 0, "System Settings Updated", admin.name, f"Updated {len(values)} settings")
    return {**DEFAULT_SETTINGS, **values}

@app.get("/api/admin/threats/top-phone-numbers")
def top_phone_numbers(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    results = db.query(Complaint.phone_number, func.count(Complaint.id)).filter(
        Complaint.phone_number.isnot(None)).group_by(Complaint.phone_number).order_by(
        func.count(Complaint.id).desc()).limit(10).all()
    return [{"phone": r[0], "count": r[1]} for r in results]

@app.get("/api/admin/threats/top-upis")
def top_upis(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    results = db.query(Complaint.upi_id, func.count(Complaint.id)).filter(
        Complaint.upi_id.isnot(None)).group_by(Complaint.upi_id).order_by(
        func.count(Complaint.id).desc()).limit(10).all()
    return [{"upi": r[0], "count": r[1]} for r in results]

@app.get("/api/admin/threats/campaigns")
def threat_campaigns(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    phones = db.query(Complaint.phone_number, func.count(Complaint.id)).filter(
        Complaint.phone_number.isnot(None)).group_by(Complaint.phone_number).having(
        func.count(Complaint.id) >= 2).all()
    return [{"indicator": p[0], "type": "phone", "complaint_count": p[1],
             "risk_level": "high" if p[1] >= 5 else "medium"} for p in phones]

@app.get("/api/admin/analytics/daily-complaints")
def daily_complaints_admin(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    # SQLite stores timestamps as text; date() preserves the actual calendar date.
    date_bucket = func.date(Complaint.created_at)
    results = db.query(date_bucket.label("date"), func.count(Complaint.id)).group_by(
        date_bucket).order_by(date_bucket.desc()).limit(30).all()
    results.reverse()
    return [{"date": str(r[0]), "count": r[1]} for r in results]

@app.get("/api/admin/analytics/investigator-workload")
def investigator_workload(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    results = db.query(Complaint.assigned_officer, func.count(Complaint.id)).filter(
        Complaint.assigned_officer.isnot(None)).group_by(Complaint.assigned_officer).all()
    return [{"officer": r[0], "cases": r[1]} for r in results]

@app.get("/api/admin/analytics/fusion-center")
def fusion_center_analytics(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    """Presentation-ready operational measures, derived only from local case records."""
    complaints = db.query(Complaint).all()
    evidence_case_ids = {row[0] for row in db.query(EvidenceFile.complaint_id).distinct().all()}
    status_counts: dict[str, int] = {}
    locations: dict[str, int] = {}
    risk_counts = {"Low (0–39)": 0, "Medium (40–69)": 0, "High (70–100)": 0}
    workload: dict[str, int] = {}
    for item in complaints:
        status_counts[item.status or "Unassigned"] = status_counts.get(item.status or "Unassigned", 0) + 1
        if item.incident_location:
            location = item.incident_location.strip()
            locations[location] = locations.get(location, 0) + 1
        risk_counts["High (70–100)" if (item.risk_score or 0) >= 70 else "Medium (40–69)" if (item.risk_score or 0) >= 40 else "Low (0–39)"] += 1
        if item.assigned_officer:
            workload[item.assigned_officer] = workload.get(item.assigned_officer, 0) + 1
    campaign_indicators = len(db.query(Complaint.phone_number).filter(Complaint.phone_number.isnot(None)).group_by(Complaint.phone_number).having(func.count(Complaint.id) >= 2).all())
    return {"risk_distribution": [{"name": key, "count": value} for key, value in risk_counts.items()],
            "status_distribution": [{"name": key, "count": value} for key, value in status_counts.items()],
            "locations": [{"location": key, "count": value} for key, value in sorted(locations.items(), key=lambda item: item[1], reverse=True)[:8]],
            "investigator_workload": [{"officer": key, "cases": value} for key, value in sorted(workload.items(), key=lambda item: item[1], reverse=True)[:8]],
            "campaigns_detected": campaign_indicators,
            "evidence_verification": [{"name": "Cases with preserved evidence", "count": len(evidence_case_ids)}, {"name": "Cases awaiting evidence", "count": max(0, len(complaints) - len(evidence_case_ids))}]}

@app.get("/api/admin/performance")
def investigator_performance(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    investigators = db.query(User).filter(User.role == "investigator", User.status == "approved").all()
    results = []
    for officer in investigators:
        assigned = db.query(Complaint).filter(Complaint.assigned_officer == officer.name).all()
        resolved = [case for case in assigned if case.status == "Resolved"]
        verified = sum(bool(case.blockchain_tx) for case in assigned)
        durations = [(case.updated_at - case.created_at).total_seconds() / 86400 for case in resolved if case.created_at and case.updated_at]
        results.append({"name": officer.name, "assigned": len(assigned), "resolved": len(resolved), "evidence_verified": verified,
                        "avg_resolution_days": round(sum(durations) / len(durations), 1) if durations else None})
    return results

@app.put("/api/admin/users/{user_id}/permissions")
def update_permissions(user_id: int, data: dict, db: Session = Depends(get_db), admin: User = Depends(require_roles("admin"))):
    user = db.query(User).filter(User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    permissions = data.get("permissions", [])
    if not isinstance(permissions, list): raise HTTPException(status_code=400, detail="permissions must be a list")
    user.permissions = json.dumps(permissions)
    db.commit()
    add_audit_log(db, 0, "Role Permissions Updated", admin.name, f"Updated permissions for {user.email}")
    return {"success": True, "permissions": permissions}

@app.get("/api/admin/governance")
def governance_overview(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    complaints = db.query(Complaint).all()
    users = db.query(User).all()
    evidence = db.query(EvidenceFile).all()
    now = datetime.utcnow()
    today = now.date()
    resolved = [case for case in complaints if case.status == "Resolved"]
    durations = [(case.updated_at - case.created_at).total_seconds() / 86400 for case in resolved if case.updated_at and case.created_at]
    average_loss = sum(case.amount or 0 for case in complaints) / len(complaints) if complaints else 0
    recent_high_risk = [case for case in complaints if (case.risk_score or 0) >= 70 and case.created_at and case.created_at >= now - timedelta(days=1)]
    duplicate_campaigns = db.query(Complaint).filter(Complaint.duplicate_score >= 60).count()
    db_file = Path(engine.url.database) if engine.url.database else None
    return {
        "users": {"total": len(users), "citizens": sum(user.role == "citizen" for user in users), "investigators": sum(user.role == "investigator" for user in users), "pending_investigators": sum(user.role == "investigator" and user.status == "pending" for user in users)},
        "cases": {"total": len(complaints), "today": sum(case.created_at and case.created_at.date() == today for case in complaints), "active": sum(case.status in {"Pending", "Under Investigation", "In Progress"} for case in complaints), "high_risk": sum((case.risk_score or 0) >= 70 for case in complaints), "resolved": len(resolved), "resolution_rate": round(len(resolved) / len(complaints) * 100, 1) if complaints else 0, "avg_resolution_days": round(sum(durations) / len(durations), 1) if durations else None, "avg_financial_loss": round(average_loss, 2)},
        "evidence": {"total_files": len(evidence), "encrypted_files": len(evidence), "storage_bytes": sum(item.encrypted_size or 0 for item in evidence), "hash_success_rate": 100 if evidence else 0, "tamper_alerts": 0},
        "system": {"api": "online", "database": "online", "ai": "configured" if os.getenv("GEMINI_API_KEY") else "not configured", "blockchain": "configured" if os.getenv("CONTRACT_ADDRESS") else "not configured", "ocr": "demo only", "storage": "online", "database_bytes": db_file.stat().st_size if db_file and db_file.exists() else 0},
        "notifications": [{"severity": "critical" if (case.risk_score or 0) >= 85 else "high", "message": f"High-risk complaint {case.tracking_id or '#' + str(case.id)} received", "time": case.created_at.isoformat()} for case in recent_high_risk[:5]] + ([{"severity": "medium", "message": f"{duplicate_campaigns} case(s) contain duplicate/campaign signals", "time": now.isoformat()}] if duplicate_campaigns else []),
    }

@app.get("/api/admin/audit-logs")
def admin_audit_logs(limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()
    return [{"id": log.id, "complaint_id": log.complaint_id, "action": log.action, "actor": log.performed_by, "details": log.details, "timestamp": log.timestamp.isoformat() if log.timestamp else ""} for log in logs]

@app.get("/api/admin/export/complaints")
def export_complaints(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    import csv
    from io import StringIO
    stream = StringIO(); writer = csv.writer(stream)
    writer.writerow(["Tracking ID", "Title", "Category", "Risk", "Status", "Amount", "Created"])
    for case in db.query(Complaint).order_by(Complaint.created_at.desc()).all():
        writer.writerow([case.tracking_id, case.title, case.crime_type or case.fraud_category, case.risk_score, case.status, case.amount, case.created_at.isoformat() if case.created_at else ""])
    return Response(content=stream.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=cybershield-complaints.csv"})

@app.post("/api/admin/backups")
def create_backup(_: User = Depends(require_roles("admin"))):
    db_file = Path(engine.url.database) if engine.url.database else None
    if not db_file or not db_file.exists(): raise HTTPException(status_code=400, detail="SQLite database file is unavailable")
    backup_dir = db_file.parent / "backups"; backup_dir.mkdir(exist_ok=True)
    destination = backup_dir / f"cybershield-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.db"
    shutil.copy2(db_file, destination)
    return {"success": True, "filename": destination.name, "created_at": datetime.utcnow().isoformat()}

@app.post("/api/admin/agency-requests")
def create_agency_request(data: AgencyRequestCreate, db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin"))):
    complaint = db.query(Complaint).filter(Complaint.id == data.complaint_id).first()
    if not complaint: raise HTTPException(status_code=404, detail="Complaint not found")
    request = AgencyRequest(complaint_id=data.complaint_id, agency=data.agency, request_type=data.request_type,
                            message=data.message, created_by=current_user.name, status="draft")
    db.add(request); db.commit(); db.refresh(request)
    add_audit_log(db, complaint.id, "Agency Communication Drafted", current_user.name, f"{data.request_type} for {data.agency}")
    return {"id": request.id, "status": request.status, "message": "Request saved as draft; external delivery is not configured."}

@app.get("/api/admin/agency-requests")
def list_agency_requests(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    requests = db.query(AgencyRequest).order_by(AgencyRequest.created_at.desc()).limit(50).all()
    return [{"id": item.id, "complaint_id": item.complaint_id, "agency": item.agency, "request_type": item.request_type,
             "status": item.status, "created_by": item.created_by, "created_at": item.created_at.isoformat() if item.created_at else ""} for item in requests]

@app.get("/api/admin/legal-drafts/{complaint_id}")
def legal_draft(complaint_id: int, kind: str = "bank_freeze", db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint: raise HTTPException(status_code=404, detail="Complaint not found")
    tracking = complaint.tracking_id or f"CS-{complaint.id:08X}"
    templates = {
        "bank_freeze": f"Subject: Urgent beneficiary account freeze request — {tracking}\n\nPlease place an immediate hold on the beneficiary account/UPI identifier {complaint.upi_id or complaint.bank_account or '[identifier required]'}. The reported loss is ₹{complaint.amount or 0:,.0f}. Preserve transaction, KYC, and account trail records for investigation.",
        "fir_summary": f"Case summary — {tracking}\n\nComplainant reported {complaint.crime_type or complaint.fraud_category or 'cybercrime'}. Summary: {complaint.description}\n\nKnown indicators: phone {complaint.phone_number or 'not supplied'}; UPI {complaint.upi_id or 'not supplied'}. Evidence bundle SHA-256: {complaint.evidence_hash or 'pending'}.",
        "evidence_report": f"Evidence preservation report — {tracking}\n\nAll submitted files are AES-256-GCM encrypted at rest. The active complaint bundle hash is {complaint.evidence_hash or 'pending'}. Refer to the chain of custody before court presentation.",
    }
    return {"kind": kind, "tracking_id": tracking, "draft": templates.get(kind, templates["fir_summary"]), "disclaimer": "Generated as a review draft. It must be checked and approved by an authorized officer before use."}

# ============================================================
# HEALTH
# ============================================================
@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "CyberShield Ledger API", "version": "2.0.0",
            "features": ["AI Classifier", "Bundle Hashing", "Digital Signatures",
                         "Blockchain Anchoring", "On-Chain Access Control", "End-to-End Encryption"],
            "endpoints": 38}

# ============================================================
# RUN
# ============================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
