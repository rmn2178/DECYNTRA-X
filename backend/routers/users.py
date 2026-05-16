from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.services.decision_dna import analyze_user_behavior, update_decision_dna
from backend.schemas.decision_dna import DecisionDNAProfile

router = APIRouter(prefix="/api/user", tags=["users"])

DEFAULT_ORG = "org-1"


class RefreshRequest(BaseModel):
    user_id: str


@router.get("/decision-profile/{user_id}", response_model=DecisionDNAProfile)
async def get_decision_profile(user_id: str):
    try:
        return await analyze_user_behavior(user_id, DEFAULT_ORG)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/decision-profile/refresh")
async def refresh_decision_profile(req: RefreshRequest):
    try:
        await update_decision_dna(req.user_id, DEFAULT_ORG)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
