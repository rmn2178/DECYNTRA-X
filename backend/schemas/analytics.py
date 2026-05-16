from pydantic import BaseModel
from typing import Literal
from datetime import date


# ── Primitives ────────────────────────────────────────────────────────

class DailyBalance(BaseModel):
    date: str          # ISO date string
    balance: float
    inflow: float
    outflow: float
    note: str = ""


class CashRunwayResult(BaseModel):
    daily_balances: list[DailyBalance]
    days_until_danger: int
    danger_threshold: float
    current_balance: float


# ── Overdue Invoices ──────────────────────────────────────────────────

class OverdueInvoice(BaseModel):
    invoice_id: str
    customer_id: str
    customer_name: str
    amount: float
    due_date: str
    days_overdue: int
    status: str


# ── Upcoming Payables ─────────────────────────────────────────────────

class UpcomingPayable(BaseModel):
    vendor_id: str
    vendor_name: str
    amount: float
    due_date: str
    days_until_due: int


# ── Shortfall Signal ──────────────────────────────────────────────────

class TriggerItem(BaseModel):
    source_type: Literal["invoice", "payable", "transaction"]
    source_id: str
    label: str
    amount: float
    urgency: Literal["critical", "warning", "info"]


class ShortfallSignal(BaseModel):
    severity: Literal["critical", "warning", "safe"]
    days_until_shortfall: int
    amount: float          # negative = shortfall, positive = surplus
    trigger_items: list[TriggerItem]
