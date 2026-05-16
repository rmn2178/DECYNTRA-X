import json
from datetime import datetime, timezone

from sqlalchemy import select

from backend.database import AsyncSessionLocal
from backend.models.schema import DecisionLog, DecisionOutcome
from backend.schemas.outcome import OutcomeEvaluation, SystemValue


def _success_label(projected: float, actual: float) -> str:
    if projected == 0:
        return "accurate"
    diff = actual - projected
    if abs(diff) / max(1.0, abs(projected)) <= 0.1:
        return "accurate"
    return "under-estimated" if diff > 0 else "over-estimated"


def _impact_score(projected: float, actual: float) -> int:
    if projected == 0:
        return 50
    variance = abs(actual - projected) / max(1.0, abs(projected))
    return int(max(0, min(100, 100 - variance * 100)))


from typing import Optional


def _extract_projected_cash(details: dict, chosen_option_id: Optional[str]) -> float:
    strategy = details.get("strategy", {})
    for opt in strategy.get("options", []):
        if opt.get("id") == chosen_option_id:
            return float(opt.get("cash_impact", 0.0))
    return 0.0


def _decision_latency_ms(details: dict, decided_at) -> int:
    try:
        generated_at = details.get("generated_at")
        if generated_at and decided_at:
            gen_dt = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
            return int((decided_at - gen_dt).total_seconds() * 1000)
    except Exception:
        return 0
    return 0


async def evaluate_decision_impact(decision_id: str, actual_cash_delta: float) -> OutcomeEvaluation:
    async with AsyncSessionLocal() as pg:
        log = (await pg.execute(
            select(DecisionLog).where(DecisionLog.id == decision_id)
        )).scalars().first()

        if not log or not log.details:
            raise ValueError("Decision log not found")

        details = json.loads(log.details)
        projected = _extract_projected_cash(details, log.chosen_option_id)
        financial_delta = actual_cash_delta - projected
        impact_score = _impact_score(projected, actual_cash_delta)
        label = _success_label(projected, actual_cash_delta)

        outcome = DecisionOutcome(
            decision_id=log.id,
            outcome=details.get("status", "decided"),
            projected_cash_delta=projected,
            actual_cash_delta=actual_cash_delta,
            impact_score=impact_score,
            financial_delta=financial_delta,
            success_label=label,
        )
        pg.add(outcome)
        await pg.commit()

    return OutcomeEvaluation(
        decision_id=str(decision_id),
        projected_cash_delta=projected,
        actual_cash_delta=actual_cash_delta,
        impact_score=impact_score,
        financial_delta=financial_delta,
        success_label=label,
    )


async def get_outcome_by_decision(decision_id: str) -> OutcomeEvaluation:
    async with AsyncSessionLocal() as pg:
        outcome = (await pg.execute(
            select(DecisionOutcome).where(DecisionOutcome.decision_id == decision_id)
        )).scalars().first()

    if not outcome:
        raise ValueError("Outcome not found")

    return OutcomeEvaluation(
        decision_id=str(outcome.decision_id),
        projected_cash_delta=float(outcome.projected_cash_delta or 0),
        actual_cash_delta=float(outcome.actual_cash_delta or 0),
        impact_score=int(outcome.impact_score or 0),
        financial_delta=float(outcome.financial_delta or 0),
        success_label=outcome.success_label or "accurate",
    )


async def compute_system_value(org_id: str) -> SystemValue:
    async with AsyncSessionLocal() as pg:
        logs = (await pg.execute(
            select(DecisionLog).where(DecisionLog.org_id == org_id)
        )).scalars().all()
        decision_ids = [l.id for l in logs]
        outcomes = []
        if decision_ids:
            outcomes = (await pg.execute(
                select(DecisionOutcome).where(DecisionOutcome.decision_id.in_(decision_ids))
            )).scalars().all()

    total_cash_saved = sum(float(o.actual_cash_delta or 0) for o in outcomes if float(o.actual_cash_delta or 0) > 0)
    risks_prevented_count = len([o for o in outcomes if (o.impact_score or 0) >= 70])

    latencies = []
    for log in logs:
        if not log.details or not log.decided_at:
            continue
        try:
            details = json.loads(log.details)
        except Exception:
            continue
        latency = _decision_latency_ms(details, log.decided_at)
        if latency:
            latencies.append(latency)

    avg_latency = int(sum(latencies) / len(latencies)) if latencies else 0
    baseline = 172800000
    speed_improvement = round(((baseline - avg_latency) / baseline) * 100, 1) if avg_latency else 0.0

    accurate = len([o for o in outcomes if o.success_label == "accurate"])
    ai_accuracy_pct = round((accurate / len(outcomes)) * 100, 1) if outcomes else 0.0

    recent_outcomes = [
        OutcomeEvaluation(
            decision_id=str(o.decision_id),
            projected_cash_delta=float(o.projected_cash_delta or 0),
            actual_cash_delta=float(o.actual_cash_delta or 0),
            impact_score=int(o.impact_score or 0),
            financial_delta=float(o.financial_delta or 0),
            success_label=o.success_label or "accurate",
        )
        for o in outcomes[-8:]
    ]

    return SystemValue(
        org_id=org_id,
        total_cash_saved=round(total_cash_saved, 2),
        risks_prevented_count=risks_prevented_count,
        avg_decision_latency_ms=avg_latency,
        ai_accuracy_pct=ai_accuracy_pct,
        decision_speed_improvement_vs_baseline=speed_improvement,
        recent_outcomes=recent_outcomes,
    )
