from pydantic import BaseModel
from typing import Literal


class OutcomeEvaluation(BaseModel):
    decision_id: str
    projected_cash_delta: float
    actual_cash_delta: float
    impact_score: int
    financial_delta: float
    success_label: Literal["accurate", "over-estimated", "under-estimated"]


class SystemValue(BaseModel):
    org_id: str
    total_cash_saved: float
    risks_prevented_count: int
    avg_decision_latency_ms: int
    ai_accuracy_pct: float
    decision_speed_improvement_vs_baseline: float
    recent_outcomes: list[OutcomeEvaluation]
