"""Speech-to-text extension point."""
def transcribe(_: bytes) -> dict:
    return {"text": "", "confidence": 0.0, "provider": "not_configured"}
