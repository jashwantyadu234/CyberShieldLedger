"""Deterministic fallback risk scoring used when no model score is available."""
def score(amount: float | None, has_indicators: bool, category: str | None) -> int:
    amount_score = 35 if (amount or 0) >= 50_000 else 15 if amount else 0
    indicator_score = 20 if has_indicators else 0
    category_score = 25 if category in {"Financial Fraud", "Crypto Scam"} else 10
    return min(100, amount_score + indicator_score + category_score)
