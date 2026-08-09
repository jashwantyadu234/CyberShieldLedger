"""Notification integration boundary; delivery providers are intentionally not configured."""
def queue_notification(recipient: str, subject: str) -> dict:
    return {"queued": False, "recipient": recipient, "subject": subject, "reason": "provider_not_configured"}
