import sqlite3
import json
import os
import sys

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(__file__))

from ai.entity_extractor import extract_crime_details

db_path = os.path.join(os.path.dirname(__file__), "cybershield.db")

def backfill():
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT id, title, description, crime_type, fraud_category, amount, phone_number, upi_id, bank_name FROM complaints")
    rows = cursor.fetchall()
    
    print(f"Found {len(rows)} complaints in DB.")
    updated_count = 0

    for r in rows:
        cid, title, description, crime_type, fraud_category, amount, phone_number, upi_id, bank_name = r
        full_text = f"{title or ''}. {description or ''}".strip()
        
        # Analyze using AI / Heuristic engine
        ai_res = extract_crime_details(full_text)
        
        new_crime_type = ai_res.get("crime_type") or fraud_category or "Banking Fraud"
        new_risk_score = ai_res.get("risk_score") or 65
        new_amount = amount or ai_res.get("amount")
        new_phone = phone_number or ai_res.get("phone_number")
        new_upi = upi_id or ai_res.get("upi_id")
        new_bank = bank_name or ai_res.get("bank_name")
        structured_data = json.dumps(ai_res)

        cursor.execute("""
            UPDATE complaints
            SET crime_type = ?,
                risk_score = ?,
                amount = ?,
                phone_number = ?,
                upi_id = ?,
                bank_name = ?,
                structured_data = ?
            WHERE id = ?
        """, (new_crime_type, new_risk_score, new_amount, new_phone, new_upi, new_bank, structured_data, cid))
        
        updated_count += 1
        print(f"✅ Complaint #{cid} updated: crime_type='{new_crime_type}', risk_score={new_risk_score}")

    conn.commit()
    conn.close()
    print(f"\nSuccessfully backfilled {updated_count} complaints in cybershield.db!")

if __name__ == "__main__":
    backfill()
