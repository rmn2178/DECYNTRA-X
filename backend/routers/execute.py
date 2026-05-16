from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.schemas.execution import EmailDraft, WeeklyBrief, ActionQueueItem
from backend.services.execution_engine import (
    draft_reminder_email,
    draft_vendor_delay_request,
    generate_weekly_brief,
    queue_action,
    list_queue,
    update_action_status,
)

router = APIRouter(prefix="/api/execute", tags=["execute"])

DEFAULT_ORG = "org-1"
DEFAULT_USER = "user-1"


class ReminderRequest(BaseModel):
    invoice_id: str


class VendorDelayRequest(BaseModel):
    vendor_id: str
    payable_id: str


class ApproveRequest(BaseModel):
    action_id: str


class RejectRequest(BaseModel):
    action_id: str
    reason: str


@router.post("/draft-reminder", response_model=EmailDraft)
async def draft_reminder(req: ReminderRequest):
    try:
        draft = await draft_reminder_email(req.invoice_id, DEFAULT_ORG)
        await queue_action("draft_reminder", draft.model_dump(), DEFAULT_USER, DEFAULT_ORG)
        return draft
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/draft-vendor-delay", response_model=EmailDraft)
async def draft_vendor_delay(req: VendorDelayRequest):
    try:
        draft = await draft_vendor_delay_request(req.vendor_id, req.payable_id, DEFAULT_ORG)
        await queue_action("draft_vendor_delay", draft.model_dump(), DEFAULT_USER, DEFAULT_ORG)
        return draft
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/weekly-brief", response_model=WeeklyBrief)
async def weekly_brief():
    try:
        return await generate_weekly_brief(DEFAULT_ORG)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/queue", response_model=list[ActionQueueItem])
async def get_queue():
    try:
        return await list_queue(DEFAULT_ORG)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/approve", response_model=ActionQueueItem)
async def approve(req: ApproveRequest):
    try:
        return await update_action_status(req.action_id, "approved", DEFAULT_USER, None)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reject", response_model=ActionQueueItem)
async def reject(req: RejectRequest):
    try:
        return await update_action_status(req.action_id, "rejected", DEFAULT_USER, req.reason)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
