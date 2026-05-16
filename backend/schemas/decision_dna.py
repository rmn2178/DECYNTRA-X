from pydantic import BaseModel
from typing import Literal


class DecisionDNAProfile(BaseModel):
    user_id: str
    org_id: str
    risk_tolerance_score: int
    speed_vs_accuracy_score: int
    cash_strategy_type: Literal["aggressive", "balanced", "conservative"]
    ai_alignment_rate: float
    override_patterns: list[str]
    decision_style_summary: str
    adaptations: list[str]
