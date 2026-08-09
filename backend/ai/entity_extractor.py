import os
import json
import re
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini AI with model fallback candidates
api_key = os.getenv("GEMINI_API_KEY")
CANDIDATE_MODELS = [
    "gemini-flash-latest",
    "gemini-2.0-flash-lite",
    "gemini-pro-latest",
    "gemini-2.0-flash-lite-001",
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash"
]

if api_key:
    genai.configure(api_key=api_key)


def get_working_gemini_model():
    """Dynamically finds a functional Gemini model from candidate list."""
    if not api_key:
        return None
    for model_name in CANDIDATE_MODELS:
        try:
            m = genai.GenerativeModel(model_name)
            return m
        except Exception:
            continue
    return None


def heuristic_extract_crime_details(complaint_text: str) -> dict:
    """
    Local rule-based & regex heuristic classifier for offline / API failure fallback.
    Extracts crime_type, amount, bank_name, upi_id, phone_number, payment_method,
    risk_score, urgency, scammer_details, suggested_agency, and suggested_law_sections.
    """
    text_lower = complaint_text.lower()
    
    # 1. Crime Type Detection
    crime_type = "Banking Fraud"
    if any(k in text_lower for k in ["upi", "gpay", "paytm", "phonepe", "qr code", "vpa", "google pay"]):
        crime_type = "UPI Fraud"
    elif any(k in text_lower for k in ["invest", "crypto", "trading", "stock", "profit", "return", "bitcoin", "usdt", "telegram", "ponzi"]):
        crime_type = "Investment Scam"
    elif any(k in text_lower for k in ["nude", "video call", "blackmail", "intimate", "sextortion", "photo", "record"]):
        crime_type = "Sextortion"
    elif any(k in text_lower for k in ["bully", "harass", "stalk", "abuse", "instagram", "fake profile", "threat"]):
        crime_type = "Cyber Bullying"
    elif any(k in text_lower for k in ["impersonat", "fake id", "aadhaar", "pan card", "identity", "passport"]):
        crime_type = "Identity Theft"
    elif any(k in text_lower for k in ["link", "phishing", "fake website", "url", "click", "login page", "sms link"]):
        crime_type = "Phishing"
    elif any(k in text_lower for k in ["malware", "virus", "ransomware", "encrypt", "hack", "locked system"]):
        crime_type = "Ransomware"
    elif any(k in text_lower for k in ["bank", "sbi", "hdfc", "icici", "axis", "account", "netbanking", "card", "debit", "credit", "otp"]):
        crime_type = "Banking Fraud"

    # 2. Extract Amount
    amount = None
    amount_match = re.search(r'(?:₹|rs\.?|inr|amount|lost|stole|transferred)\s*:?\s*([\d,]+)', text_lower)
    if not amount_match:
        amount_match = re.search(r'([\d,]+)\s*(?:rupees|rs|inr|₹)', text_lower)
    if amount_match:
        try:
            val = int(amount_match.group(1).replace(",", ""))
            if 10 <= val <= 100000000:
                amount = val
        except ValueError:
            pass

    # 3. Extract Bank Name
    bank_name = None
    banks = ["SBI", "HDFC", "ICICI", "Axis Bank", "PNB", "Bank of Baroda", "Kotak", "Canara", "Union Bank", "Paytm Bank"]
    for b in banks:
        if b.lower() in text_lower:
            bank_name = b
            break

    # 4. Extract UPI ID
    upi_match = re.search(r'[\w\.\-]+@[\w\-]+', complaint_text)
    upi_id = upi_match.group(0) if upi_match else None

    # 5. Extract Phone Number
    phone_match = re.search(r'(?:\+?91[\s\-]?)?[6-9]\d{9}', complaint_text)
    phone_number = phone_match.group(0) if phone_match else None

    # 6. Payment Method
    payment_method = None
    if upi_id or any(k in text_lower for k in ["upi", "gpay", "paytm", "phonepe"]):
        payment_method = "UPI"
    elif any(k in text_lower for k in ["netbanking", "net banking", "neft", "rtgs", "imps"]):
        payment_method = "NetBanking"
    elif any(k in text_lower for k in ["card", "credit card", "debit card"]):
        payment_method = "Card"
    elif any(k in text_lower for k in ["crypto", "usdt", "btc", "bitcoin"]):
        payment_method = "Crypto"

    # 7. Risk Score Calculation
    base_risk = 35
    if amount:
        if amount >= 100000:
            base_risk += 35
        elif amount >= 25000:
            base_risk += 25
        else:
            base_risk += 15
    if upi_id or phone_number:
        base_risk += 15
    if any(k in text_lower for k in ["urgent", "police", "arrest", "otp", "blocked", "cbi", "lawyer", "threat"]):
        base_risk += 15
    risk_score = min(98, max(20, base_risk))

    # 8. Urgency
    if risk_score >= 80:
        urgency = "Critical"
    elif risk_score >= 60:
        urgency = "High"
    elif risk_score >= 40:
        urgency = "Medium"
    else:
        urgency = "Low"

    # 9. Suggested Agency
    if crime_type in ["Banking Fraud", "UPI Fraud", "Investment Scam"]:
        agency = "Cyber Crime Police & Financial Intelligence Unit"
    elif crime_type in ["Ransomware", "Phishing"]:
        agency = "CERT-In & Cyber Threat Intelligence Cell"
    else:
        agency = "Cyber Crime Police Station"

    # 10. Suggested Law Sections
    law_sections = [
        "IT Act 2000 - Section 66D (Cheating by impersonation using computer resource)",
        "IPC Section 420 / BNS Section 318 (Cheating and dishonestly inducing delivery of property)"
    ]
    if upi_id or bank_name:
        law_sections.append("IT Act 2000 - Section 66C (Punishment for identity theft)")
    if crime_type == "Sextortion":
        law_sections.append("IT Act 2000 - Section 67 / IPC Section 384 (Extortion & publishing obscene content)")

    return {
        "crime_type": crime_type,
        "amount": amount,
        "bank_name": bank_name,
        "upi_id": upi_id,
        "phone_number": phone_number,
        "payment_method": payment_method,
        "risk_score": risk_score,
        "urgency": urgency,
        "scammer_details": f"Extracted suspect attributes: {phone_number or 'No phone'} | {upi_id or 'No UPI'} | Bank: {bank_name or 'Unknown'}",
        "suggested_agency": agency,
        "suggested_law_sections": law_sections,
        "source": "heuristic_engine"
    }


def extract_crime_details(complaint_text: str) -> dict:
    """
    Uses Gemini AI to extract structured crime information,
    with automatic fallback to heuristic engine if API fails.
    """
    model = get_working_gemini_model()
    
    if model is None:
        print("[AI] Gemini model unavailable — using heuristic engine fallback.")
        return heuristic_extract_crime_details(complaint_text)

    prompt = f"""You are a cybercrime analyst AI. Analyze this complaint and extract structured information.
Return ONLY valid JSON with no markdown, no code fences, no additional text.

Required JSON fields:
- crime_type: one of (Banking Fraud | UPI Fraud | Investment Scam | Sextortion | Cyber Bullying | Identity Theft | Phishing | Malware | Ransomware)
- amount: number or null
- bank_name: string or null
- upi_id: string or null
- phone_number: string or null
- payment_method: string or null (UPI | NetBanking | Card | Crypto | Cash | null)
- risk_score: integer 1-100
- urgency: one of (Low | Medium | High | Critical)
- scammer_details: string summarizing what is known about the scammer
- suggested_agency: string or null
- suggested_law_sections: array of strings

Complaint text: {complaint_text}

JSON:"""

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()

        # Robust JSON extraction using regex matching
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            text = json_match.group(0)

        result = json.loads(text)
        
        # Ensure crime_type is valid
        if not result.get("crime_type"):
            heuristic_res = heuristic_extract_crime_details(complaint_text)
            result["crime_type"] = heuristic_res["crime_type"]
            result["risk_score"] = result.get("risk_score") or heuristic_res["risk_score"]
            result["urgency"] = result.get("urgency") or heuristic_res["urgency"]
            result["suggested_law_sections"] = result.get("suggested_law_sections") or heuristic_res["suggested_law_sections"]

        return result

    except Exception as e:
        print(f"[AI] API/Parse error ({e}) — falling back to heuristic engine.")
        return heuristic_extract_crime_details(complaint_text)


def classify_crime_type(complaint_text: str) -> str:
    """Quick classification — returns just the crime type string."""
    result = extract_crime_details(complaint_text)
    return result.get("crime_type") or "Banking Fraud"


if __name__ == "__main__":
    test_text = "Someone called pretending to be SBI officer. I lost ₹50,000 via UPI paytm@upi. Phone: +919876543210."
    print(json.dumps(extract_crime_details(test_text), indent=2))
