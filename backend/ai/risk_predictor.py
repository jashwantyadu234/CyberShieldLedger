"""Model extension point for complaint-risk prediction."""
from app.services.risk_engine import score

predict_risk = score
