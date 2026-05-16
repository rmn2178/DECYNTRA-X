from fastapi import APIRouter, HTTPException
from backend.services.deterministic_engine import (
    compute_cash_runway,
    get_overdue_invoices,
    get_upcoming_payables,
    flag_cash_shortfall,
)
from backend.schemas.analytics import (
    CashRunwayResult, OverdueInvoice, UpcomingPayable, ShortfallSignal,
)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

DEFAULT_ORG = "org-1"


@router.get("/cash-runway", response_model=CashRunwayResult)
async def cash_runway(days: int = 30):
    try:
        return await compute_cash_runway(DEFAULT_ORG, days=days)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/overdue", response_model=list[OverdueInvoice])
async def overdue_invoices():
    try:
        return await get_overdue_invoices(DEFAULT_ORG)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/payables", response_model=list[UpcomingPayable])
async def upcoming_payables(days: int = 7):
    try:
        return await get_upcoming_payables(DEFAULT_ORG, days=days)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/shortfall", response_model=ShortfallSignal)
async def shortfall_signal():
    try:
        return await flag_cash_shortfall(DEFAULT_ORG)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
