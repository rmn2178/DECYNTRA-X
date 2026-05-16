from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from backend.config import settings
from backend.database import engine
from backend.neo4j_client import neo4j_client
from backend.redis_client import redis_client
from backend.routers.graph import router as graph_router
from sqlalchemy import text

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()
    await neo4j_client.close()
    await redis_client.close()

app = FastAPI(title="DECYNTRA-X", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(graph_router)

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "environment": settings.ENVIRONMENT}

@app.get("/api/health/detailed")
async def detailed_health():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        pg_status = "ok"
    except Exception as e:
        pg_status = str(e)

    try:
        await redis_client.ping()
        redis_status = "ok"
    except Exception as e:
        redis_status = str(e)

    try:
        await neo4j_client.driver.verify_connectivity()
        neo4j_status = "ok"
    except Exception as e:
        neo4j_status = str(e)

    return {"postgres": pg_status, "redis": redis_status, "neo4j": neo4j_status}

@app.get("/api/analytics/cash-runway")
async def cash_runway(): return {}

@app.get("/api/analytics/overdue")
async def analytics_overdue(): return {}

@app.get("/api/analytics/shortfall")
async def analytics_shortfall(): return {}

@app.post("/api/decisions/generate")
async def decisions_generate(): return {}

@app.post("/api/decisions/query")
async def decisions_query(): return {}

@app.get("/api/decisions/package/{package_id}")
async def decisions_package(package_id: str): return {}

@app.post("/api/decisions/choose")
async def decisions_choose(): return {}

@app.get("/api/decisions/log")
async def decisions_log(): return {}

@app.post("/api/simulate/compare")
async def simulate_compare(): return {}

@app.get("/api/memory/patterns/{org_id}")
async def memory_patterns(org_id: str): return {}

@app.post("/api/memory/outcome")
async def memory_outcome(): return {}

@app.get("/api/outcomes/summary/{org_id}")
async def outcomes_summary(org_id: str): return {}

@app.post("/api/execute/draft-reminder")
async def execute_draft_reminder(): return {}

@app.get("/api/execute/weekly-brief")
async def execute_weekly_brief(): return {}

@app.get("/api/execute/queue")
async def execute_queue(): return {}

@app.post("/api/execute/approve")
async def execute_approve(): return {}

@app.get("/api/kpi/{org_id}")
async def kpi_org(org_id: str): return {}
