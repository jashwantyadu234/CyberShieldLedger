"""Campaign grouping extension point for shared fraud indicators."""
def campaign_key(indicators: list[str]) -> str:
    return "|".join(sorted({item.strip().lower() for item in indicators if item.strip()}))
