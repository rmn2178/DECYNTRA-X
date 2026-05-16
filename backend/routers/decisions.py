from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.services.decision_brain import (
    generate_decision_package, answer_query, answer_query_stream, _call_groq
)
from backend.schemas.decision import DecisionPackage, QueryAnswer
from backend.redis_client import redis_client
from backend.database import AsyncSessionLocal
from backend.models.schema import DecisionLog
from sqlalchemy import select, update, desc
from datetime import datetime, timezone
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
    chosen_option_id: str
    user_id: str
    notes: str


@router.post("/choose")
async def choose(req: ChooseRequest):
    """Record which option the user chose with HitL flow."""
    try:
        cached = await redis_client.get(f"decision_package:{req.package_id}")
        if not cached:
            raise HTTPException(status_code=404, detail="Package expired")

        pkg = DecisionPackage(**json.loads(cached))
        disagreement_reason = None

        if req.chosen_option_id != pkg.strategy.recommended_option_id:
            # AI disagrees!
            system_prompt = "You are an AI decision critic."
            user_prompt = f"The AI recommended {pkg.strategy.recommended_option_id} but the human chose {req.chosen_option_id}. Briefly explain in one sentence why the AI might disagree with this choice, focusing on risk or cash flow metrics."
            raw = await _call_groq("llama-3.3-70b-versatile", system_prompt, user_prompt)
            try:
                # _call_groq might return json string due to format, let's extract or just use it.
                # Since _call_groq in decision_brain.py uses response_format json, we should expect a JSON or just string fallback.
                # Actually _call_groq there forces json. Let's adapt.
                parsed = json.loads(raw)
                disagreement_reason = parsed.get("reason") or parsed.get("disagreement_reason") or str(parsed)
            except:
                disagreement_reason = "AI flags increased failure probability with this alternative option compared to the recommended baseline."

        pkg.chosen_option_id = req.chosen_option_id
        pkg.status = "chosen"

        # Save back to cache
        await redis_client.set(
            f"decision_package:{req.package_id}",
            pkg.model_dump_json(),
            ex=3600,
        )

        # Update Database
        async with AsyncSessionLocal() as pg:
            stmt = (
                update(DecisionLog)
                .where(DecisionLog.package_id == req.package_id)
                .values(
                    status="decided",
                    decided_at=datetime.now(timezone.utc),
                    chosen_option_id=req.chosen_option_id,
                    notes=req.notes,
                    disagreement_reason=disagreement_reason,
                    user_id=req.user_id,
                    details=pkg.model_dump_json() # update details with chosen
                )
            )
            await pg.execute(stmt)
            await pg.commit()

        # Publish WebSocket event
        try:
            await redis_client.publish(
                f"decision.logged",
                json.dumps({"package_id": req.package_id, "org_id": DEFAULT_ORG})
            )
        except Exception:
            pass

        return {
            "status": "ok",
            "chosen_option_id": req.chosen_option_id,
            "disagreement_reason": disagreement_reason
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pending")
async def get_pending():
    """Unresolved packages sorted by risk_severity."""
    async with AsyncSessionLocal() as pg:
        # In a real app we'd parse JSON or join. Here we just return all pending.
        logs = (await pg.execute(select(DecisionLog).where(DecisionLog.status == "pending"))).scalars().all()
        # For mock, sort in Python
        packages = []
        for log in logs:
            if log.details:
                packages.append(json.loads(log.details))
        
        # Sort by urgency
        packages.sort(key=lambda p: p.get("risk_analysis", {}).get("urgency_score", 0), reverse=True)
        return packages


@router.get("/log")
async def get_log(limit: int = 50, offset: int = 0):
    """Full audit trail, paginated."""
    async with AsyncSessionLocal() as pg:
        logs = (await pg.execute(
            select(DecisionLog)
            .where(DecisionLog.status == "decided")
            .order_by(desc(DecisionLog.decided_at))
            .limit(limit)
            .offset(offset)
        )).scalars().all()
        
        results = []
        for l in logs:
            pkg = json.loads(l.details) if l.details else {}
            results.append({
                "package_id": l.package_id,
                "decided_at": l.decided_at,
                "risk_type": pkg.get("risk_analysis", {}).get("problem_statement", "Unknown"),
                "recommended_option": pkg.get("strategy", {}).get("recommended_option_id"),
                "chosen_option": l.chosen_option_id,
                "agreed": l.chosen_option_id == pkg.get("strategy", {}).get("recommended_option_id"),
                "notes": l.notes,
                "outcome": "Pending implementation", # Mock outcome
                "disagreement_reason": l.disagreement_reason
            })
        return results


@router.get("/disagreements")
async def get_disagreements():
    """All human-overrides of AI."""
    async with AsyncSessionLocal() as pg:
        logs = (await pg.execute(
            select(DecisionLog)
            .where(DecisionLog.disagreement_reason != None)
            .order_by(desc(DecisionLog.decided_at))
        )).scalars().all()
        
        results = []
        for l in logs:
            pkg = json.loads(l.details) if l.details else {}
            results.append({
                "package_id": l.package_id,
                "decided_at": l.decided_at,
                "user_id": l.user_id,
                "recommended_option": pkg.get("strategy", {}).get("recommended_option_id"),
                "chosen_option": l.chosen_option_id,
                "disagreement_reason": l.disagreement_reason,
                "notes": l.notes
            })
        return results


@router.post("/query", response_model=QueryAnswer)
async def query(req: QueryRequest):
    """Answer a natural-language question using Gemini with business context."""
    try:
        return await answer_query(req.question, DEFAULT_ORG)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
