import json
from datetime import datetime, timezone

import httpx
from sqlalchemy import select

from backend.config import settings
from backend.database import AsyncSessionLocal
from backend.models.schema import DecisionLog, UserProfile
from backend.schemas.decision_dna import DecisionDNAProfile

GEMINI_FLASH_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-1.5-flash-latest:generateContent"
)
GEMINI_TIMEOUT = 10.0


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
                        "temperature": 0.35,
                        "maxOutputTokens": 120,
                    },
                },
            )
            resp.raise_for_status()
            return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        return "Decision style summary unavailable right now."


def _stance_score(stance: str) -> int:
    if stance == "aggressive":
        return 85
    if stance == "balanced":
        return 60
    return 35


def _speed_score(latency_ms: int) -> int:
    if latency_ms <= 900000:
        return 90
    if latency_ms <= 3600000:
        return 75
    if latency_ms <= 14400000:
        return 60
    if latency_ms <= 86400000:
        return 45
    return 30


def _strategy_type(avg_score: float) -> str:
    if avg_score >= 72:
        return "aggressive"
    if avg_score >= 50:
        return "balanced"
    return "conservative"


from typing import Optional


def _extract_latency_ms(details: dict, decided_at: Optional[datetime]) -> int:
    try:
        generated_at = details.get("generated_at")
        if generated_at and decided_at:
            gen_dt = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
            return int((decided_at - gen_dt).total_seconds() * 1000)
    except Exception:
        return 0
    return 0


def _derive_override_patterns(decisions: list[dict]) -> list[str]:
    overrides = [d for d in decisions if d.get("override")]
    if not overrides:
        return ["Rarely overrides AI recommendations"]

    by_stance = {"conservative": 0, "balanced": 0, "aggressive": 0}
    for d in overrides:
        by_stance[d.get("chosen_stance", "balanced")] += 1

    top_stance = max(by_stance, key=by_stance.get)
    return [f"Overrides tend toward {top_stance} options"]


async def analyze_user_behavior(user_id: str, org_id: str) -> DecisionDNAProfile:
    async with AsyncSessionLocal() as pg:
        logs = (await pg.execute(
            select(DecisionLog).where(DecisionLog.user_id == user_id)
        )).scalars().all()

    decisions: list[dict] = []
    stance_scores: list[int] = []
    latency_scores: list[int] = []
    ai_agree = 0
    total = 0

    for log in logs:
        if not log.details:
            continue
        try:
            details = json.loads(log.details)
        except Exception:
            continue

        strategy = details.get("strategy", {})
        options = strategy.get("options", [])
        recommended = strategy.get("recommended_option_id")
        chosen = log.chosen_option_id

        chosen_opt = next((o for o in options if o.get("id") == chosen), None)
        rec_opt = next((o for o in options if o.get("id") == recommended), None)

        if chosen_opt:
            stance_scores.append(_stance_score(chosen_opt.get("stance", "balanced")))

        latency_ms = _extract_latency_ms(details, log.decided_at)
        if latency_ms:
            latency_scores.append(_speed_score(latency_ms))

        if chosen and recommended and chosen == recommended:
            ai_agree += 1
        if chosen:
            total += 1

        decisions.append({
            "override": chosen and recommended and chosen != recommended,
            "chosen_stance": chosen_opt.get("stance") if chosen_opt else "balanced",
        })

    avg_risk = int(sum(stance_scores) / len(stance_scores)) if stance_scores else 50
    avg_speed = int(sum(latency_scores) / len(latency_scores)) if latency_scores else 60
    alignment_rate = round((ai_agree / total) * 100, 1) if total else 0.0

    override_patterns = _derive_override_patterns(decisions)
    cash_strategy_type = _strategy_type(avg_risk)

    prompt = (
        "Summarize this user's decision style in two sentences. "
        f"Risk tolerance score: {avg_risk}/100. "
        f"Speed vs accuracy score: {avg_speed}/100. "
        f"AI alignment rate: {alignment_rate}%. "
        f"Strategy type: {cash_strategy_type}."
    )
    summary = await _call_gemini_flash(prompt)

    adaptations = [
        f"Weights {cash_strategy_type} options higher in recommendations",
        f"Calibrates confidence using historical alignment of {alignment_rate}%",
    ]

    profile = DecisionDNAProfile(
        user_id=user_id,
        org_id=org_id,
        risk_tolerance_score=avg_risk,
        speed_vs_accuracy_score=avg_speed,
        cash_strategy_type=cash_strategy_type,
        ai_alignment_rate=alignment_rate,
        override_patterns=override_patterns,
        decision_style_summary=summary,
        adaptations=adaptations,
    )

    async with AsyncSessionLocal() as pg:
        user_profile = (await pg.execute(
            select(UserProfile).where(UserProfile.user_id == user_id)
        )).scalars().first()
        if user_profile:
            user_profile.decision_dna_profile = profile.model_dump()
            await pg.commit()

    return profile


async def update_decision_dna(user_id: str, org_id: str) -> None:
    await analyze_user_behavior(user_id, org_id)
