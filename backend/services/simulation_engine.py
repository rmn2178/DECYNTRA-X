import json
from typing import Iterable

import httpx

from backend.config import settings
from backend.redis_client import redis_client
from backend.schemas.decision import DecisionPackage, StrategyOption
from backend.schemas.simulation import (
    DailyProjection,
    ScenarioResult,
    RiskOverlayItem,
    ScenarioComparison,
)

GEMINI_FLASH_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-1.5-flash-latest:generateContent"
)
GEMINI_TIMEOUT = 10.0
DANGER_THRESHOLD = 200000


async def _call_gemini_flash(prompt: str) -> str:
    """POST to Gemini 1.5 Flash generateContent endpoint. Returns text."""
    try:
        async with httpx.AsyncClient(timeout=GEMINI_TIMEOUT) as client:
            resp = await client.post(
                f"{GEMINI_FLASH_URL}?key={settings.GEMINI_API_KEY}",
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.3,
                        "maxOutputTokens": 120,
                    },
                },
            )
            resp.raise_for_status()
            return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        return "Unable to generate explanation due to an error."


async def simulate_cash_scenario(
    baseline_data: list[DailyProjection],
    option: StrategyOption,
) -> ScenarioResult:
    """
    Simulate a cash trajectory for a strategy option.
    Returns projection arrays and derived runway metrics.
    """
    days_until_danger_baseline = next(
        (p.day for p in baseline_data if p.value < DANGER_THRESHOLD),
        len(baseline_data) - 1,
    )

    projection_array: list[DailyProjection] = []
    best_case: list[DailyProjection] = []
    worst_case: list[DailyProjection] = []

    daily_impact = option.cash_impact / max(1, option.cash_impact_days)

    for p in baseline_data:
        val = p.value
        if p.day >= option.cash_impact_days:
            val += option.cash_impact
        elif p.day > 0:
            val += daily_impact * p.day

        projection_array.append(DailyProjection(day=p.day, value=val))
        best_case.append(DailyProjection(day=p.day, value=val * 1.1))
        worst_case.append(DailyProjection(day=p.day, value=val * 0.9))

    days_until_danger_option = next(
        (p.day for p in projection_array if p.value < DANGER_THRESHOLD),
        len(projection_array) - 1,
    )

    base_conf = option.adapted_confidence if option.adapted_confidence is not None else option.confidence
    probability_of_success = float(min(1.0, max(0.0, base_conf)))

    return ScenarioResult(
        option_id=option.id,
        projection_array=projection_array,
        best_case=best_case,
        worst_case=worst_case,
        days_until_danger_baseline=days_until_danger_baseline,
        days_until_danger_option=days_until_danger_option,
        probability_of_success=probability_of_success,
    )


async def overlay_risk_events(
    projection_array: list[DailyProjection],
    anomalies: Iterable[dict],
) -> list[RiskOverlayItem]:
    """Mark days where a known risk event occurs."""
    events: list[RiskOverlayItem] = []

    for a in anomalies or []:
        day = a.get("day") if isinstance(a, dict) else None
        desc = a.get("event_description") if isinstance(a, dict) else None
        if isinstance(day, int) and desc:
            events.append(RiskOverlayItem(day=day, event_description=desc))

    return events


async def compare_scenarios(package_id: str, org_id: str) -> list[ScenarioComparison]:
    cached = await redis_client.get(f"decision_package:{package_id}")
    if not cached:
        raise ValueError("Decision package not found or expired")

    pkg = DecisionPackage(**json.loads(cached))

    baseline_data = [
        DailyProjection(day=i, value=300000 - (i * 10000))
        for i in range(30)
    ]

    comparisons: list[ScenarioComparison] = []
    for opt in pkg.strategy.options:
        result = await simulate_cash_scenario(baseline_data, opt)
        events = await overlay_risk_events(result.projection_array, [])

        prompt = (
            "Given this cash projection, explain in one sentence why "
            "this option is safer/riskier than the baseline. "
            f"Option {opt.id} ({opt.stance}): cash impact {opt.cash_impact} "
            f"in {opt.cash_impact_days} days, runway {result.days_until_danger_option} "
            f"days vs baseline {result.days_until_danger_baseline} days."
        )

        gemini_explanation = await _call_gemini_flash(prompt)
        if "error" in gemini_explanation.lower() or not gemini_explanation.strip():
            gemini_explanation = (
                "This option shifts the cash trajectory versus the baseline, "
                "improving runway at the cost of additional execution risk."
            )

        comparisons.append(ScenarioComparison(
            option_id=opt.id,
            result=result,
            gemini_explanation=gemini_explanation.strip(),
            risk_events=events,
        ))

    return comparisons
