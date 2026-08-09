"""Duplicate-detection service boundary for embedding and indicator matching."""
def normalize_indicator(value: str | None) -> str:
    return (value or "").strip().lower()
