from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.services.simulation_engine import compare_scenarios
from backend.schemas.simulation import ScenarioComparison

router = APIRouter(prefix="/api/simulate", tags=["simulate"])

DEFAULT_ORG = "org-1"

class CompareRequest(BaseModel):
    package_id: str

@router.post("/compare", response_model=list[ScenarioComparison])
async def simulate_compare(req: CompareRequest):
    """Run What-If scenarios and get Gemini explanations."""
    try:
        return await compare_scenarios(req.package_id, DEFAULT_ORG)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
