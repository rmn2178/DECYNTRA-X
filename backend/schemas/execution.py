from pydantic import BaseModel
from typing import Literal, Optional


class EmailDraft(BaseModel):
    subject: str
    body: str
    recipient_email: str
    tone: Literal["polite", "firm"]
    invoice_id: Optional[str] = None
    vendor_id: Optional[str] = None


class WeeklyBrief(BaseModel):
    headline: str
    cash_summary: str
    top_risks: list[str]
    top_opportunities: list[str]
    pending_actions: list[str]
    kpi_highlights: str
    next_week_forecast: str


class ActionQueueItem(BaseModel):
    id: str
    action_type: str
    payload: dict
    status: Literal["pending", "approved", "rejected", "sent"]
    approved_by: Optional[str] = None
    org_id: str
    created_at: str
    updated_at: Optional[str] = None
    rejection_reason: Optional[str] = None
    draft: Optional[EmailDraft] = None
