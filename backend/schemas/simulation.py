from pydantic import BaseModel
from typing import Literal

class DailyProjection(BaseModel):
    day: int
    value: float

class ScenarioResult(BaseModel):
    option_id: str
    projection_array: list[DailyProjection]
    best_case: list[DailyProjection]
    worst_case: list[DailyProjection]
    days_until_danger_baseline: int
    days_until_danger_option: int
    probability_of_success: float

class RiskOverlayItem(BaseModel):
    day: int
    event_description: str

class ScenarioComparison(BaseModel):
    option_id: str
    result: ScenarioResult
    gemini_explanation: str
    risk_events: list[RiskOverlayItem]
