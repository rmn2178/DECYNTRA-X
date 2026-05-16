from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from backend.config import settings
from backend.database import engine
from backend.neo4j_client import neo4j_client
from backend.redis_client import redis_client
from backend.routers.graph import router as graph_router
from backend.routers.analytics import router as analytics_router
from backend.routers.anomaly import router as anomaly_router
from backend.routers.decisions import router as decisions_router
from backend.routers.simulate import router as simulate_router
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
app.include_router(analytics_router)
app.include_router(anomaly_router)
app.include_router(decisions_router)
app.include_router(simulate_router)


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

