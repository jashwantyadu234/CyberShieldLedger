"""Safe local summary fallback."""
def summarize(text: str, limit: int = 300) -> str:
    return text.strip()[:limit]
