from pydantic import BaseModel
from typing import Literal


class SimilarCase(BaseModel):
    case_id: str
    date: str
    risk_type: str
    what_was_chosen: str
    what_happened: str
    cash_delta_actual: float
    agreed_with_ai: bool


class PatternProfile(BaseModel):
    preferences: list[str]


class CalibrationResult(BaseModel):
    calibration_factor: float
    historical_accuracy_pct: float
    total_cases: int
    evaluated_cases: int


class AdaptedOption(BaseModel):
    option_id: str
    adapted_confidence: float
    stance: Literal["conservative", "balanced", "aggressive"]