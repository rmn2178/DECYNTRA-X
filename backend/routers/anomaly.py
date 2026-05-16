from fastapi import APIRouter, HTTPException
from backend.services.probabilistic_engine import (
    detect_payment_anomalies,
    detect_sales_drops,
    score_vendor_risk,
    generate_risk_signal,
)
from backend.schemas.anomaly import (
    PaymentAnomaly, SalesDropResult, VendorRiskScore, RiskSignal,
)

router = APIRouter(prefix="/api/anomaly", tags=["anomaly"])

DEFAULT_ORG = "org-1"


@router.get("/payment-anomalies", response_model=list[PaymentAnomaly])
async def payment_anomalies():
    try:
        return await detect_payment_anomalies(DEFAULT_ORG)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sales-drop", response_model=SalesDropResult)
async def sales_drop():
    try:
        return await detect_sales_drops(DEFAULT_ORG)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vendor-risk", response_model=list[VendorRiskScore])
async def vendor_risk():
    try:
        return await score_vendor_risk(DEFAULT_ORG)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/risk-signal", response_model=RiskSignal)
async def risk_signal():
    """Aggregated risk signal with 15-min Redis cache."""
    try:
        return await generate_risk_signal(DEFAULT_ORG)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/risk-signal/cache")
async def invalidate_risk_signal_cache():
    """Force-invalidate the Redis cache for the risk signal."""
    from backend.redis_client import redis_client
    try:
        await redis_client.delete(f"risk_signal:{DEFAULT_ORG}")
        return {"status": "cache_cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
