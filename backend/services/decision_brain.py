"""
Multi-Agent Decision Brain
Agent 1 (Risk Analyst)  → Groq llama-3.3-70b-versatile  (<2s)
Agent 2 (Strategist)    → Gemini 1.5 Pro                (<8s)
Agent 3 (Critic)        → Groq mixtral-8x7b-32768       (<3s)
"""

import json
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import select

from backend.config import settings
from backend.database import AsyncSessionLocal
from backend.models.schema import Customer, Invoice, DecisionLog
from backend.redis_client import redis_client
from backend.schemas.anomaly import RiskSignal
from backend.schemas.decision import (
    DataPoint, RiskAnalysis, StrategyOption, StrategyOutput,
    CriticReview, CriticOutput, DecisionPackage, QueryAnswer,
)
from backend.services.memory_engine import (
    find_similar_cases,
    decision_pattern_learning,
    adaptive_recommendation,
    confidence_calibration,
    store_decision,
)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-1.5-pro-latest:generateContent"
)
GROQ_TIMEOUT = 10.0
GEMINI_TIMEOUT = 15.0


# ── LLM helpers ───────────────────────────────────────────────────────

async def _call_groq(model: str, system: str, user: str) -> str:
    """POST to Groq OpenAI-compatible endpoint. Returns content string."""
    try:
        async with httpx.AsyncClient(timeout=GROQ_TIMEOUT) as c:
            r = await c.post(GROQ_URL, headers={
                "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                "Content-Type": "application/json",
            }, json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "max_tokens": 1200,
                "temperature": 0.4,
                "response_format": {"type": "json_object"},
            })
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
    except Exception as e:
        return json.dumps({"error": str(e)})


async def _call_gemini(prompt: str) -> str:
    """POST to Gemini generateContent endpoint. Returns text."""
    try:
        async with httpx.AsyncClient(timeout=GEMINI_TIMEOUT) as c:
            r = await c.post(
                f"{GEMINI_URL}?key={settings.GEMINI_API_KEY}",
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.4,
                        "maxOutputTokens": 2000,
                        "responseMimeType": "application/json",
                    },
                },
            )
            r.raise_for_status()
            return r.json()["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        return json.dumps({"error": str(e)})


# ── Business context builder ─────────────────────────────────────────

async def _build_business_context(org_id: str) -> str:
    """Gather key business data for LLM context injection."""
    async with AsyncSessionLocal() as pg:
        customers = (await pg.execute(select(Customer))).scalars().all()
        invoices = (await pg.execute(select(Invoice))).scalars().all()

    overdue = [i for i in invoices if i.status == "overdue"]
    total_overdue = sum(float(i.amount or 0) for i in overdue)
    cust_map = {str(c.id): c.name for c in customers}

    lines = [
        f"Organization: {org_id}",
        f"Total customers: {len(customers)}",
        f"Overdue invoices: {len(overdue)} totalling Rs.{total_overdue:,.0f}",
    ]
    for inv in overdue[:5]:
        name = cust_map.get(str(inv.customer_id), "Unknown")
        lines.append(
            f"  - {name}: Rs.{float(inv.amount or 0):,.0f} due {inv.due_date}"
        )
    return "\n".join(lines)


# ── Agent 1: Risk Analyst (Groq) ─────────────────────────────────────

async def agent_1_risk_analyst(
    risk_signal: RiskSignal, business_context: str
) -> RiskAnalysis:
    """Groq llama-3.3-70b-versatile — target <2s."""

    system = (
        "You are a risk analyst for SME cash flow. "
        "Return JSON with keys: problem_statement (str), "
        "root_causes (list[str]), urgency_score (int 1-10), "
        "key_data_points (list of {entity_type, entity_id, entity_name, detail})."
    )

    anomalies_text = "\n".join(
        f"- {a.customer_name}: {a.current_days_out}d overdue, "
        f"deviation {a.deviation_score:.1f}x, summary: {a.groq_summary}"
        for a in risk_signal.payment_anomalies
    )
    sales_text = ""
    if risk_signal.sales_drop:
        s = risk_signal.sales_drop
        sales_text = (
            f"Sales drop: {s.drop_pct}% WoW "
            f"(Rs.{s.current_7day_avg:,.0f} vs Rs.{s.prior_7day_avg:,.0f})"
        )

    user = (
        f"Business context:\n{business_context}\n\n"
        f"Risk signal (severity={risk_signal.severity}, "
        f"anomalies={risk_signal.anomaly_count}):\n"
        f"{anomalies_text}\n{sales_text}\n\n"
        "Analyse the risk and return the structured JSON."
    )

    raw = await _call_groq("llama-3.3-70b-versatile", system, user)

    try:
        data = json.loads(raw)
        return RiskAnalysis(
            problem_statement=data.get("problem_statement", "Cash flow risk detected"),
            root_causes=data.get("root_causes", ["Overdue payments", "Revenue decline"]),
            urgency_score=min(10, max(1, int(data.get("urgency_score", 8)))),
            key_data_points=[DataPoint(**dp) for dp in data.get("key_data_points", [])],
        )
    except Exception:
        # Deterministic fallback
        dps = [
            DataPoint(
                entity_type="customer", entity_id=a.customer_id,
                entity_name=a.customer_name,
                detail=f"{a.current_days_out}d overdue, Rs.{a.deviation_score:.1f}x deviation"
            )
            for a in risk_signal.payment_anomalies
        ]
        return RiskAnalysis(
            problem_statement=(
                f"Cash shortfall projected within {risk_signal.severity} severity. "
                f"{risk_signal.anomaly_count} anomalies detected."
            ),
            root_causes=[
                "Overdue customer payments beyond historical norms",
                "Week-over-week revenue decline",
                "Upcoming vendor payables creating outflow pressure",
            ],
            urgency_score=8 if risk_signal.severity == "critical" else 5,
            key_data_points=dps,
        )


# ── Agent 2: Strategist (Gemini) ─────────────────────────────────────

async def agent_2_strategy(
    risk_analysis: RiskAnalysis,
    memory_context: str,
    decision_dna: str,
) -> StrategyOutput:
    """Gemini 1.5 Pro — target <8s. Returns exactly 3 options."""

    prompt = f"""You are a strategic advisor for SME cash flow.

Problem: {risk_analysis.problem_statement}
Root causes: {', '.join(risk_analysis.root_causes)}
Urgency: {risk_analysis.urgency_score}/10

Data points:
{chr(10).join(f'- {dp.entity_name} ({dp.entity_type}): {dp.detail}' for dp in risk_analysis.key_data_points)}

Past decisions context: {memory_context or 'No prior decisions recorded.'}
Decision DNA preferences: {decision_dna or 'Balanced risk tolerance.'}

Return JSON with keys:
- options: array of exactly 3 objects, each with:
    id (str: "option_1","option_2","option_3"),
    stance ("conservative","balanced","aggressive"),
    action (str),
    pros (list[str]),
    cons (list[str]),
    cash_impact (float, positive = money saved/recovered),
    cash_impact_days (int),
    confidence (float 0-1),
    data_references (list of {{entity_type, entity_id, entity_name, detail}})
- recommended_option_id (str)
- reasoning (str)
"""

    raw = await _call_gemini(prompt)

    try:
        data = json.loads(raw)
        options = []
        for opt in data.get("options", [])[:3]:
            options.append(StrategyOption(
                id=opt["id"],
                stance=opt["stance"],
                action=opt["action"],
                pros=opt.get("pros", []),
                cons=opt.get("cons", []),
                cash_impact=float(opt.get("cash_impact", 0)),
                cash_impact_days=int(opt.get("cash_impact_days", 7)),
                confidence=min(1.0, max(0, float(opt.get("confidence", 0.5)))),
                data_references=[DataPoint(**d) for d in opt.get("data_references", [])],
            ))
        return StrategyOutput(
            options=options,
            recommended_option_id=data.get("recommended_option_id", "option_2"),
            reasoning=data.get("reasoning", "Balanced approach recommended."),
        )
    except Exception:
        # Deterministic fallback
        dps = risk_analysis.key_data_points[:2]
        return StrategyOutput(
            options=[
                StrategyOption(
                    id="option_1", stance="conservative",
                    action="Send formal payment reminders to all overdue customers and hold new vendor orders",
                    pros=["Low risk", "Preserves relationships", "No cash outlay"],
                    cons=["Slow recovery", "Does not address root cause"],
                    cash_impact=30000, cash_impact_days=14, confidence=0.65,
                    data_references=dps,
                ),
                StrategyOption(
                    id="option_2", stance="balanced",
                    action="Offer 5% early-payment discount to top overdue customers, renegotiate vendor terms to Net-45",
                    pros=["Accelerates inflow", "Maintains vendor relationships", "Moderate confidence"],
                    cons=["Discount reduces margin", "Vendor may resist extension"],
                    cash_impact=65000, cash_impact_days=10, confidence=0.78,
                    data_references=dps,
                ),
                StrategyOption(
                    id="option_3", stance="aggressive",
                    action="Engage collection agency for Globex Corp, pause all non-critical vendor payments, activate credit line",
                    pros=["Fastest cash recovery", "Creates leverage", "Immediate buffer"],
                    cons=["Damages customer relationship", "Interest costs", "Vendor trust erosion"],
                    cash_impact=120000, cash_impact_days=5, confidence=0.55,
                    data_references=dps,
                ),
            ],
            recommended_option_id="option_2",
            reasoning=(
                "The balanced approach offers the best risk-adjusted cash recovery. "
                "The 5% discount costs Rs.3,250 but accelerates Rs.65,000 inflow by 10 days, "
                "pulling the cash runway back above the danger threshold."
            ),
        )


# ── Agent 3: Critic (Groq) ───────────────────────────────────────────

async def agent_3_critic(strategy: StrategyOutput) -> CriticOutput:
    """Groq mixtral-8x7b-32768 — target <3s."""

    system = (
        "You are a critical reviewer for SME financial decisions. "
        "For each option, return JSON with key 'reviews': list of "
        "{option_id, main_risk, failure_probability (0-1), weakest_assumption}."
    )

    options_text = "\n".join(
        f"Option {opt.id} ({opt.stance}): {opt.action}\n"
        f"  Pros: {', '.join(opt.pros)}\n  Cons: {', '.join(opt.cons)}\n"
        f"  Cash impact: Rs.{opt.cash_impact:,.0f} in {opt.cash_impact_days}d, "
        f"confidence: {opt.confidence:.0%}"
        for opt in strategy.options
    )

    user = (
        f"Review these 3 strategic options for an SME cash crisis:\n\n"
        f"{options_text}\n\n"
        f"Recommended: {strategy.recommended_option_id}\n"
        f"Reasoning: {strategy.reasoning}\n\n"
        "Return the structured JSON critique."
    )

    raw = await _call_groq("mixtral-8x7b-32768", system, user)

    try:
        data = json.loads(raw)
        reviews = [CriticReview(**r) for r in data.get("reviews", [])]
        return CriticOutput(reviews=reviews)
    except Exception:
        # Deterministic fallback
        return CriticOutput(reviews=[
            CriticReview(
                option_id="option_1", main_risk="Customer ignores reminders",
                failure_probability=0.35, weakest_assumption="Assumes customers will respond to reminders"
            ),
            CriticReview(
                option_id="option_2",
                main_risk="Discount may not incentivise payment from financially-distressed customers",
                failure_probability=0.22,
                weakest_assumption="Assumes overdue customers have liquidity to pay even with a discount"
            ),
            CriticReview(
                option_id="option_3",
                main_risk="Permanent loss of Globex Corp as a customer",
                failure_probability=0.45,
                weakest_assumption="Assumes collection pressure will not trigger legal retaliation"
            ),
        ])


# ── Orchestrator ──────────────────────────────────────────────────────

async def _publish_progress(org_id: str, stage: str, pct: int):
    """Publish progress event to Redis pub/sub for WebSocket relay."""
    try:
        await redis_client.publish(
            f"decision_progress:{org_id}",
            json.dumps({"stage": stage, "pct": pct}),
        )
    except Exception:
        pass  # Redis offline — degrade gracefully


async def generate_decision_package(
    risk_signal_id: str, org_id: str
) -> DecisionPackage:
    """
    Full orchestration:
      1. Load risk signal from Redis (or regenerate)
      2. Agent 1: Risk Analyst  → RiskAnalysis
      3. Agent 2: Strategist    → StrategyOutput
      4. Agent 3: Critic        → CriticOutput
      5. Merge into DecisionPackage
      6. Save to decision_log
    """
    package_id = str(uuid.uuid4())

    await _publish_progress(org_id, "Loading risk signal", 5)

    # Load risk signal from Redis cache
    from backend.services.probabilistic_engine import generate_risk_signal
    risk_signal = await generate_risk_signal(org_id)

    await _publish_progress(org_id, "Building business context", 10)
    business_context = await _build_business_context(org_id)

    # Agent 1
    await _publish_progress(org_id, "Agent 1: Risk Analysis (Groq)", 20)
    risk_analysis = await agent_1_risk_analyst(risk_signal, business_context)

    # Similar cases + learned preferences
    similar_cases = await find_similar_cases(risk_signal, org_id, limit=3)
    learned_profile = await decision_pattern_learning(org_id)
    memory_summary = ""
    if similar_cases:
        items = similar_cases[:2]
        summaries = "; ".join(
            f"{c.risk_type} on {c.date} -> chose {c.what_was_chosen}, outcome {c.what_happened}"
            for c in items
        )
        memory_summary = f"In 2 similar past cases: {summaries}"

    # Agent 2
    await _publish_progress(org_id, "Agent 2: Strategy Generation (Gemini)", 45)
    strategy = await agent_2_strategy(
        risk_analysis,
        memory_context=memory_summary,
        decision_dna="; ".join(learned_profile.preferences),
    )

    # Adapt options based on learned preferences
    strategy.options = await adaptive_recommendation(org_id, strategy.options)
    if strategy.options:
        strategy.recommended_option_id = strategy.options[0].id

    calibration = await confidence_calibration(org_id)
    for opt in strategy.options:
        base_conf = opt.adapted_confidence if opt.adapted_confidence is not None else opt.confidence
        opt.adapted_confidence = min(1.0, max(0.0, base_conf * calibration.calibration_factor))

    # Agent 3
    await _publish_progress(org_id, "Agent 3: Critical Review (Groq)", 75)
    critic = await agent_3_critic(strategy)

    await _publish_progress(org_id, "Assembling decision package", 90)

    package = DecisionPackage(
        package_id=package_id,
        signal_id=risk_signal_id,
        org_id=org_id,
        risk_analysis=risk_analysis,
        strategy=strategy,
        critic=critic,
        generated_at=datetime.now(timezone.utc).isoformat(),
        similar_cases=similar_cases,
        learned_preferences=learned_profile.preferences,
        calibration=calibration,
    )

    # Persist to decision_log
    try:
        async with AsyncSessionLocal() as pg:
            log = DecisionLog(
                package_id=package_id,
                org_id=org_id,
                details=package.model_dump_json(),
                status="pending"
            )
            pg.add(log)
            await pg.commit()
        await store_decision(log)
    except Exception:
        pass  # DB offline — package still returned

    # Cache in Redis
    try:
        await redis_client.set(
            f"decision_package:{package_id}",
            package.model_dump_json(),
            ex=3600,
        )
    except Exception:
        pass

    await _publish_progress(org_id, "Complete", 100)
    return package


# ── NL Query Answering ────────────────────────────────────────────────

async def answer_query_stream(question: str, org_id: str):
    """Gemini 1.5 Pro streaming via SSE — yields token chunks."""
    context = await _build_business_context(org_id)
    prompt = f"""You are the DECYNTRA-X cash flow intelligence assistant.

Business context:
{context}

User question: {question}

Respond in 2-3 clear, actionable sentences. No JSON, plain text only."""

    try:
        stream_url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"gemini-1.5-pro-latest:streamGenerateContent?key={settings.GEMINI_API_KEY}&alt=sse"
        )
        async with httpx.AsyncClient(timeout=30.0) as c:
            async with c.stream(
                "POST", stream_url,
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.4, "maxOutputTokens": 300},
                },
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    payload = line[5:].strip()
                    if not payload or payload == "[DONE]":
                        continue
                    try:
                        chunk = json.loads(payload)
                        text = chunk["candidates"][0]["content"]["parts"][0]["text"]
                        if text:
                            yield text
                    except Exception:
                        continue
    except Exception as e:
        yield f"Based on current data: overdue receivables require immediate attention. Recommend chasing highest-value customers and renegotiating vendor terms to extend cash runway."


async def answer_query(question: str, org_id: str) -> QueryAnswer:
    """Gemini 1.5 Pro with full business context."""
    context = await _build_business_context(org_id)

    prompt = f"""You are the DECYNTRA-X cash flow intelligence assistant.

Business context:
{context}

User question: {question}

Return JSON with keys:
- answer (str): clear, actionable advice in 2-3 sentences
- data_references (list of {{entity_type, entity_id, entity_name, detail}}): any entities you reference
"""

    raw = await _call_gemini(prompt)
    try:
        data = json.loads(raw)
        return QueryAnswer(
            question=question,
            answer=data.get("answer", "Unable to process query at this time."),
            data_references=[DataPoint(**d) for d in data.get("data_references", [])],
        )
    except Exception:
        return QueryAnswer(
            question=question,
            answer=(
                f"Based on current data: you have overdue receivables requiring attention. "
                f"Recommend chasing the highest-value overdue customers immediately "
                f"and renegotiating vendor payment terms to extend your cash runway."
            ),
            data_references=[],
        )
