from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.services.graph_builder import build_graph, get_snapshot, get_entity_neighbourhood

router = APIRouter(prefix="/api/graph", tags=["graph"])

DEFAULT_ORG = "org-1"  # replaced by JWT-extracted orgId in production


class BuildResponse(BaseModel):
    status: str
    counts: dict


@router.post("/build", response_model=BuildResponse)
async def graph_build():
    """Full sync: reads PostgreSQL, writes Neo4j. Returns node/edge counts."""
    try:
        counts = await build_graph(DEFAULT_ORG)
        return {"status": "ok", "counts": counts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/snapshot")
async def graph_snapshot():
    """Node counts + sample subgraph JSON for frontend visualisation."""
    try:
        return await get_snapshot(DEFAULT_ORG)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/entity/{entity_type}/{entity_id}")
async def graph_entity(entity_type: str, entity_id: str):
    """Node + 1-hop neighbourhood for drill-down."""
    try:
        return await get_entity_neighbourhood(entity_type, entity_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
