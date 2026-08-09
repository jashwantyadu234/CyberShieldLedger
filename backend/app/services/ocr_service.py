"""Practical local OCR adapter with payment-indicator extraction.

Uses Tesseract when installed; plain-text uploads are also supported without it.
"""
import io
import re


def _indicators(text: str) -> dict:
    upi = re.findall(r"\b[a-zA-Z0-9._-]{2,}@[a-zA-Z][a-zA-Z0-9.-]{1,}\b", text)
    phones = re.findall(r"(?<!\d)(?:\+?91[-\s]?)?[6-9]\d{4}[-\s]?\d{5}(?!\d)", text)
    amounts = re.findall(r"(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)", text, re.IGNORECASE)
    return {"upi_ids": list(dict.fromkeys(upi)), "phone_numbers": list(dict.fromkeys(phones)), "amounts": list(dict.fromkeys(amounts))}


def extract_text(content: bytes, content_type: str = "", filename: str = "") -> dict:
    is_text = content_type.startswith("text/") or filename.lower().endswith((".txt", ".csv"))
    if is_text:
        text = content.decode("utf-8", errors="replace").strip()
        return {"text": text, "confidence": 1.0, "provider": "plain-text", **_indicators(text)}
    try:
        from PIL import Image
        import pytesseract
        image = Image.open(io.BytesIO(content))
        data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
        words = [word for word in data["text"] if word.strip()]
        confidence_values = [float(value) for value in data["conf"] if value not in {"-1", -1}]
        text = " ".join(words)
        if not text:
            return {"error": "No readable text was found. Upload a sharper image with visible text."}
        confidence = round((sum(confidence_values) / len(confidence_values) / 100) if confidence_values else 0, 2)
        return {"text": text, "confidence": confidence, "provider": "tesseract", **_indicators(text)}
    except ImportError:
        return {"error": "OCR is not installed. Install Tesseract and the Pillow/pytesseract packages on the API server."}
    except Exception as exc:
        return {"error": f"OCR could not read this file: {str(exc)}"}
