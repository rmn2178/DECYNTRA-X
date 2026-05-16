from pydantic import BaseModel, Field
from typing import Literal, Optional

from backend.schemas.memory import SimilarCase, PatternProfile, CalibrationResult


# ── Agent 1: Risk Analyst ─────────────────────────────────────────────

class DataPoint(BaseModel):
    entity_type: str          # "invoice", "customer", "transaction"
    entity_id: str
    entity_name: str
    detail: str


class RiskAnalysis(BaseModel):
    problem_statement: str
    root_causes: list[str]
    urgency_score: int = Field(ge=1, le=10)
    key_data_points: list[DataPoint]


# ── Agent 2: Strategist ──────────────────────────────────────────────

class StrategyOption(BaseModel):
    id: str                            # "option_1", "option_2", "option_3"
    stance: Literal["conservative", "balanced", "aggressive"]
    action: str
    pros: list[str]
    cons: list[str]
    cash_impact: float                 # +/- rupees
    cash_impact_days: int              # within N days
    confidence: float = Field(ge=0, le=1)
    adapted_confidence: Optional[float] = None
    data_references: list[DataPoint]


class StrategyOutput(BaseModel):
    options: list[StrategyOption]       # exactly 3
    recommended_option_id: str          # one of the three
    reasoning: str                      # why this option


# ── Agent 3: Critic ──────────────────────────────────────────────────

class CriticReview(BaseModel):
    option_id: str
    main_risk: str
    failure_probability: float = Field(ge=0, le=1)
    weakest_assumption: str


class CriticOutput(BaseModel):
    reviews: list[CriticReview]         # one per option


# ── Orchestrated Decision Package ────────────────────────────────────

class DecisionPackage(BaseModel):
    package_id: str
    signal_id: str
    org_id: str
    risk_analysis: RiskAnalysis
    strategy: StrategyOutput
    critic: CriticOutput
    generated_at: str
    status: Literal["pending", "chosen", "expired"] = "pending"
    chosen_option_id: Optional[str] = None
    similar_cases: list[SimilarCase] = []
    learned_preferences: list[str] = []
    calibration: Optional[CalibrationResult] = None


# ── Query answer ─────────────────────────────────────────────────────

class QueryAnswer(BaseModel):
    question: str
    answer: str
    data_references: list[DataPoint]
