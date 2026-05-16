from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.schemas.outcome import OutcomeEvaluation, SystemValue
from backend.services.outcome_engine import (
    evaluate_decision_impact,
    compute_system_value,
    get_outcome_by_decision,
)

router = APIRouter(prefix="/api/outcomes", tags=["outcomes"])


class RecordOutcomeRequest(BaseModel):
    decision_id: str
    actual_cash_delta: float


@router.get("/summary/{org_id}", response_model=SystemValue)
async def get_outcome_summary(org_id: str):
    try:
        return await compute_system_value(org_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{decision_id}", response_model=OutcomeEvaluation)
async def get_outcome(decision_id: str):
    try:
        return await get_outcome_by_decision(decision_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/record", response_model=OutcomeEvaluation)
async def record_outcome(req: RecordOutcomeRequest):
    try:
        return await evaluate_decision_impact(req.decision_id, req.actual_cash_delta)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
