import json
from datetime import datetime, timezone
from typing import Iterable

from sqlalchemy import select

from backend.database import AsyncSessionLocal
from backend.models.schema import User, UserProfile, KPISnapshot
from backend.neo4j_client import neo4j_client
from backend.schemas.anomaly import RiskSignal
from backend.schemas.decision import DecisionPackage, StrategyOption
from backend.schemas.memory import SimilarCase, PatternProfile, CalibrationResult


async def store_decision(decision_log_entry) -> None:
    """Write DecisionCase node and edges to involved entities in Neo4j."""
    details = decision_log_entry.details
    if not details:
        return

    pkg = DecisionPackage(**json.loads(details))
    option = next(
        (o for o in pkg.strategy.options if o.id == pkg.strategy.recommended_option_id),
        None,
    )
    confidence = option.confidence if option else 0.5
    urgency = pkg.risk_analysis.urgency_score
    risk_severity = "critical" if urgency >= 8 else "warning" if urgency >= 5 else "info"

    properties = {
        "case_id": pkg.package_id,
        "org_id": pkg.org_id,
        "date": pkg.generated_at,
        "risk_type": pkg.risk_analysis.problem_statement,
        "risk_severity": risk_severity,
        "ai_recommended_option_id": pkg.strategy.recommended_option_id,
        "human_chosen_option_id": decision_log_entry.chosen_option_id,
        "agreed": decision_log_entry.chosen_option_id == pkg.strategy.recommended_option_id,
        "cash_delta_actual": 0.0,
        "outcome": "pending",
        "confidence_at_decision": confidence,
    }

    async with neo4j_client.driver.session() as session:
        await session.run(
            """
            MERGE (dc:DecisionCase {case_id: $case_id})
            SET dc.org_id = $org_id,
                dc.date = $date,
                dc.risk_type = $risk_type,
                dc.risk_severity = $risk_severity,
                dc.ai_recommended_option_id = $ai_recommended_option_id,
                dc.human_chosen_option_id = $human_chosen_option_id,
                dc.agreed = $agreed,
                dc.cash_delta_actual = $cash_delta_actual,
                dc.outcome = $outcome,
                dc.confidence_at_decision = $confidence_at_decision
            """,
            properties,
        )

        for dp in pkg.risk_analysis.key_data_points:
            if dp.entity_type.lower() not in ("customer", "vendor", "invoice"):
                continue
            label = dp.entity_type.capitalize()
            await session.run(
                f"""
                MATCH (dc:DecisionCase {{case_id: $case_id}})
                MERGE (e:{label} {{id: $entity_id}})
                MERGE (dc)-[:INVOLVED]->(e)
                """,
                {"case_id": pkg.package_id, "entity_id": dp.entity_id},
            )


async def find_similar_cases(
    risk_signal: RiskSignal,
    org_id: str,
    limit: int = 3,
) -> list[SimilarCase]:
    entity_labels = set()
    if risk_signal.payment_anomalies:
        entity_labels.add("Customer")
    if risk_signal.vendor_risks:
        entity_labels.add("Vendor")
    if risk_signal.sales_drop:
        entity_labels.add("Invoice")

    labels = list(entity_labels) or ["Customer", "Vendor", "Invoice"]
    label_match = " OR ".join([f"n:{l}" for l in labels])

    query = (
        "MATCH (dc:DecisionCase {org_id: $org_id})-[:INVOLVED]->(n) "
        f"WHERE ({label_match}) AND dc.risk_severity = $risk_severity "
        "AND dc.cash_delta_actual >= $min_cash AND dc.cash_delta_actual <= $max_cash "
        "RETURN DISTINCT dc "
        "ORDER BY dc.date DESC "
        "LIMIT $limit"
    )

    cash_anchor = 0.0
    cash_window = 100000.0
    async with neo4j_client.driver.session() as session:
        result = await session.run(
            query,
            {
                "org_id": org_id,
                "risk_severity": risk_signal.severity,
                "min_cash": cash_anchor - cash_window,
                "max_cash": cash_anchor + cash_window,
                "limit": limit,
            },
        )
        records = await result.data()

    cases: list[SimilarCase] = []
    for r in records:
        dc = r.get("dc") or {}
        cases.append(SimilarCase(
            case_id=dc.get("case_id", ""),
            date=dc.get("date", ""),
            risk_type=dc.get("risk_type", ""),
            what_was_chosen=dc.get("human_chosen_option_id") or dc.get("ai_recommended_option_id", ""),
            what_happened=dc.get("outcome", "pending"),
            cash_delta_actual=float(dc.get("cash_delta_actual", 0.0)),
            agreed_with_ai=bool(dc.get("agreed", False)),
        ))

    return cases


async def decision_pattern_learning(org_id: str) -> PatternProfile:
    query = (
        "MATCH (dc:DecisionCase {org_id: $org_id}) "
        "RETURN dc.ai_recommended_option_id AS ai, dc.human_chosen_option_id AS human, "
        "dc.outcome AS outcome, dc.confidence_at_decision AS conf"
    )

    async with neo4j_client.driver.session() as session:
        result = await session.run(query, {"org_id": org_id})
        records = await result.data()

    preferences: list[str] = []
    if records:
        agrees = len([r for r in records if r.get("ai") and r.get("human") and r.get("ai") == r.get("human")])
        total = len([r for r in records if r.get("human")])
        if total:
            agreement_pct = round((agrees / total) * 100)
            preferences.append(f"Follows AI recommendation {agreement_pct}% of the time")

        good = len([r for r in records if r.get("outcome") == "good"])
        bad = len([r for r in records if r.get("outcome") == "bad"])
        if good + bad:
            preferences.append(f"Historical decision success rate {round((good / (good + bad)) * 100)}%")

    if not preferences:
        preferences = ["No historical preference signal yet"]

    async with AsyncSessionLocal() as pg:
        user = (await pg.execute(select(User).where(User.org_id == org_id))).scalars().first()
        if user:
            profile = (await pg.execute(select(UserProfile).where(UserProfile.user_id == user.id))).scalars().first()
            if profile:
                profile.learned_preferences = preferences
                await pg.commit()

    return PatternProfile(preferences=preferences)


async def adaptive_recommendation(org_id: str, options: list[StrategyOption]) -> list[StrategyOption]:
    profile = await decision_pattern_learning(org_id)
    preference_text = " ".join(profile.preferences).lower()

    def score(opt: StrategyOption) -> float:
        base = opt.confidence
        if "conservative" in preference_text and opt.stance == "conservative":
            return base + 0.08
        if "aggressive" in preference_text and opt.stance == "aggressive":
            return base + 0.05
        if "balanced" in preference_text and opt.stance == "balanced":
            return base + 0.06
        return base

    ranked = sorted(options, key=score, reverse=True)
    for opt in ranked:
        opt.adapted_confidence = min(1.0, max(0.0, score(opt)))

    return ranked


async def confidence_calibration(org_id: str) -> CalibrationResult:
    query = (
        "MATCH (dc:DecisionCase {org_id: $org_id}) "
        "WHERE dc.outcome IN ['good','bad'] "
        "RETURN dc.outcome AS outcome, dc.confidence_at_decision AS conf"
    )

    async with neo4j_client.driver.session() as session:
        result = await session.run(query, {"org_id": org_id})
        records = await result.data()

    total = len(records)
    good = len([r for r in records if r.get("outcome") == "good"])
    avg_conf = sum(float(r.get("conf", 0.5)) for r in records) / total if total else 0.5
    accuracy = (good / total) if total else 0.5
    calibration_factor = accuracy / avg_conf if avg_conf else 1.0

    async with AsyncSessionLocal() as pg:
        snapshot = KPISnapshot(
            org_id=org_id,
            snapshot_date=datetime.now(timezone.utc),
            ai_accuracy_pct=round(accuracy * 100, 2),
        )
        pg.add(snapshot)
        await pg.commit()

    return CalibrationResult(
        calibration_factor=round(calibration_factor, 2),
        historical_accuracy_pct=round(accuracy * 100, 2),
        total_cases=total,
        evaluated_cases=total,
    )


async def record_outcome(case_id: str, outcome_label: str, actual_cash_delta: float) -> None:
    async with neo4j_client.driver.session() as session:
        await session.run(
            """
            MATCH (dc:DecisionCase {case_id: $case_id})
            SET dc.outcome = $outcome, dc.cash_delta_actual = $cash_delta
            """,
            {"case_id": case_id, "outcome": outcome_label, "cash_delta": actual_cash_delta},
        )

        result = await session.run(
            "MATCH (dc:DecisionCase {case_id: $case_id}) RETURN dc.org_id AS org_id",
            {"case_id": case_id},
        )
        record = await result.single()

    org_id = record.get("org_id") if record else None
    if org_id:
        await confidence_calibration(org_id)
*** End Patch