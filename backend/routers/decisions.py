from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.services.decision_brain import (
    generate_decision_package, answer_query,
)
from backend.schemas.decision import DecisionPackage, QueryAnswer
from backend.redis_client import redis_client
import json

router = APIRouter(prefix="/api/decisions", tags=["decisions"])

DEFAULT_ORG = "org-1"


class GenerateRequest(BaseModel):
    risk_signal_id: str


class QueryRequest(BaseModel):
    question: str


@router.post("/generate", response_model=DecisionPackage)
async def generate(req: GenerateRequest):
    """Orchestrate 3-agent decision brain and return the full package."""
    try:
        return await generate_decision_package(req.risk_signal_id, DEFAULT_ORG)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/package/{package_id}", response_model=DecisionPackage)
async def get_package(package_id: str):
    """Retrieve a cached decision package by ID."""
    try:
        cached = await redis_client.get(f"decision_package:{package_id}")
        if cached:
            return DecisionPackage(**json.loads(cached))
        raise HTTPException(status_code=404, detail="Package not found or expired")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ChooseRequest(BaseModel):
    package_id: str
    option_id: str


@router.post("/choose")
async def choose(req: ChooseRequest):
    """Record which option the user chose."""
    try:
        cached = await redis_client.get(f"decision_package:{req.package_id}")
        if not cached:
            raise HTTPException(status_code=404, detail="Package expired")

        pkg = DecisionPackage(**json.loads(cached))
        pkg.chosen_option_id = req.option_id
        pkg.status = "chosen"

        await redis_client.set(
            f"decision_package:{req.package_id}",
            pkg.model_dump_json(),
            ex=3600,
        )
        return {"status": "ok", "chosen": req.option_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/query", response_model=QueryAnswer)
async def query(req: QueryRequest):
    """Answer a natural-language question using Gemini with business context."""
    try:
        return await answer_query(req.question, DEFAULT_ORG)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
