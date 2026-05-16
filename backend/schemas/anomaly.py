from pydantic import BaseModel, Field
from typing import Literal


# ── Payment Anomaly ───────────────────────────────────────────────────

class PaymentAnomaly(BaseModel):
    customer_id: str
    customer_name: str
    avg_payment_cycle_days: float
    stddev_days: float
    current_days_out: int
    deviation_score: float          # stddevs above mean
    groq_summary: str
    severity: Literal["critical", "warning", "info"]


# ── Sales Drop ────────────────────────────────────────────────────────

class SalesDropResult(BaseModel):
    current_7day_avg: float
    prior_7day_avg: float
    drop_pct: float
    flagged: bool
    groq_narrative: str


# ── Vendor Risk ───────────────────────────────────────────────────────

class VendorRiskScore(BaseModel):
    vendor_id: str
    vendor_name: str
    score: int = Field(ge=0, le=100)
    payment_frequency_score: int    # sub-score 0-33
    concentration_score: int        # sub-score 0-33
    days_past_due_score: int        # sub-score 0-34
    risk_level: Literal["critical", "high", "medium", "low"]


# ── Aggregated Risk Signal ────────────────────────────────────────────

class RiskSignal(BaseModel):
    signal_id: str
    org_id: str
    severity: Literal["critical", "warning", "safe"]
    anomaly_count: int
    payment_anomalies: list[PaymentAnomaly]
    sales_drop: SalesDropResult | None
    vendor_risks: list[VendorRiskScore]
    generated_at: str
    ttl_seconds: int = 900
