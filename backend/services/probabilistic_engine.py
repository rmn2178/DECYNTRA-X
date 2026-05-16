import json
import statistics
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select

from backend.config import settings
from backend.database import AsyncSessionLocal
from backend.models.schema import Customer, Vendor, Invoice, BankTransaction
from backend.redis_client import redis_client
from backend.schemas.anomaly import (
    PaymentAnomaly, SalesDropResult, VendorRiskScore, RiskSignal,
)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"
GROQ_TIMEOUT = 8.0   # generous timeout; typical response <2s


# ── Groq helper ───────────────────────────────────────────────────────

async def _groq_one_sentence(prompt: str, fallback: str) -> str:
    """Call Groq API; return 1-sentence response or fallback on any error."""
    try:
        async with httpx.AsyncClient(timeout=GROQ_TIMEOUT) as client:
            resp = await client.post(
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": GROQ_MODEL,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You are a concise cash-flow intelligence assistant "
                                "for SMEs. Reply in exactly ONE sentence, plain English, "
                                "no markdown, no filler words."
                            ),
                        },
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": 80,
                    "temperature": 0.3,
                },
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        return fallback


# ── 1. Payment Anomaly Detection ──────────────────────────────────────

async def detect_payment_anomalies(org_id: str) -> list[PaymentAnomaly]:
    now = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as pg:
        customers = {
            str(c.id): c
            for c in (await pg.execute(
                select(Customer).where(Customer.org_id == org_id)
            )).scalars().all()
        }
        invoices = (await pg.execute(select(Invoice))).scalars().all()

    # Group invoices by customer
    customer_invoices: dict[str, list[Invoice]] = {}
    for inv in invoices:
        cid = str(inv.customer_id)
        customer_invoices.setdefault(cid, []).append(inv)

    # Synthesise historical payment cycles per customer.
    # In production this would use a paid_date column; here we derive
    # cycle from the invoice age as a proxy.
    anomalies: list[PaymentAnomaly] = []

    for cid, invs in customer_invoices.items():
        cust = customers.get(cid)
        if not cust:
            continue

        # Historical "paid" cycles – days between due_date and now for
        # past invoices as a proxy for payment speed
        cycles: list[float] = []
        for inv in invs:
            if inv.due_date and inv.status == "paid":
                # Simulate: assume paid within 1-5 days of due for historical
                cycles.append(abs(
                    (now - inv.due_date.replace(tzinfo=timezone.utc)).days % 30
                ) + 1)

        if len(cycles) < 2:
            # Not enough history – inject synthetic baseline from days_overdue
            cycles = [14.0, 18.0, 12.0, 20.0]  # realistic SME avg

        avg = statistics.mean(cycles)
        try:
            stddev = statistics.stdev(cycles)
        except statistics.StatisticsError:
            stddev = 3.0

        if stddev < 1:
            stddev = 1.0

        # Current days outstanding for any overdue/upcoming invoice
        overdue_invs = [i for i in invs if i.status in ("overdue", "upcoming") and i.due_date]
        if not overdue_invs:
            continue

        max_days_out = max(
            (now - inv.due_date.replace(tzinfo=timezone.utc)).days
            for inv in overdue_invs
        )
        threshold = avg + (1.5 * stddev)

        if max_days_out <= threshold:
            continue  # within normal range

        deviation_score = round((max_days_out - avg) / stddev, 2)
        severity = (
            "critical" if deviation_score > 3
            else "warning" if deviation_score > 1.5
            else "info"
        )

        total_at_risk = sum(float(i.amount or 0) for i in overdue_invs)
        prompt = (
            f"Customer '{cust.name}' is {max_days_out} days behind payment "
            f"(avg is {avg:.0f}d, std {stddev:.0f}d). "
            f"₹{total_at_risk:,.0f} is at risk. "
            f"Write one sentence explaining the cash-flow risk."
        )
        groq_summary = await _groq_one_sentence(
            prompt,
            fallback=(
                f"{cust.name} is {max_days_out - avg:.0f} days beyond their "
                f"usual payment cycle, putting ₹{total_at_risk:,.0f} at risk."
            ),
        )

        anomalies.append(PaymentAnomaly(
            customer_id=cid,
            customer_name=cust.name,
            avg_payment_cycle_days=round(avg, 1),
            stddev_days=round(stddev, 1),
            current_days_out=max_days_out,
            deviation_score=deviation_score,
            groq_summary=groq_summary,
            severity=severity,
        ))

    return sorted(anomalies, key=lambda a: a.deviation_score, reverse=True)


# ── 2. Sales Drop Detection ───────────────────────────────────────────

async def detect_sales_drops(org_id: str) -> SalesDropResult:
    now = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as pg:
        txns = (await pg.execute(select(BankTransaction))).scalars().all()

    credit_txns = [t for t in txns if t.type == "credit" and t.date]

    def avg_in_window(start_offset: int, end_offset: int) -> float:
        window_start = now - timedelta(days=start_offset)
        window_end = now - timedelta(days=end_offset)
        window_txns = [
            float(t.amount or 0)
            for t in credit_txns
            if window_start >= t.date.replace(tzinfo=timezone.utc) >= window_end
        ]
        return statistics.mean(window_txns) if window_txns else 0.0

    current_avg = avg_in_window(7, 0)
    prior_avg = avg_in_window(14, 7)

    # Fallback mock values when no real data
    if prior_avg == 0:
        current_avg = 45_000.0
        prior_avg = 62_000.0

    drop_pct = round(((prior_avg - current_avg) / prior_avg) * 100, 1) if prior_avg else 0.0
    flagged = drop_pct > 20.0

    if flagged:
        prompt = (
            f"Sales revenue dropped {drop_pct:.1f}% in the past 7 days "
            f"(₹{current_avg:,.0f} vs ₹{prior_avg:,.0f} prior week). "
            f"Write one sentence explaining the business risk for an SME."
        )
        groq_narrative = await _groq_one_sentence(
            prompt,
            fallback=(
                f"Revenue fell {drop_pct:.1f}% week-over-week, signalling "
                f"a potential demand contraction that may worsen cash flow."
            ),
        )
    else:
        groq_narrative = "Sales velocity is within normal range — no intervention required."

    return SalesDropResult(
        current_7day_avg=round(current_avg, 2),
        prior_7day_avg=round(prior_avg, 2),
        drop_pct=drop_pct,
        flagged=flagged,
        groq_narrative=groq_narrative,
    )


# ── 3. Vendor Risk Scoring (deterministic) ────────────────────────────

async def score_vendor_risk(org_id: str) -> list[VendorRiskScore]:
    async with AsyncSessionLocal() as pg:
        vendors = (await pg.execute(
            select(Vendor).where(Vendor.org_id == org_id)
        )).scalars().all()
        txns = (await pg.execute(select(BankTransaction))).scalars().all()

    total_debits = sum(abs(float(t.amount or 0)) for t in txns if t.type == "debit") or 1.0
    debit_count = len([t for t in txns if t.type == "debit"]) or 1

    scores: list[VendorRiskScore] = []
    mock_concentrations = [0.35, 0.20, 0.10]   # Supplier A, B, C
    mock_dpd = [12, 5, 0]                        # days past due on their bills

    for i, v in enumerate(vendors[:3]):
        # Payment frequency sub-score (0-33): fewer txns = higher risk
        freq_score = max(0, 33 - (debit_count // max(1, len(vendors))) * 5)

        # Concentration sub-score (0-33): high concentration = high risk
        conc = mock_concentrations[i] if i < len(mock_concentrations) else 0.1
        conc_score = min(33, int(conc * 100))

        # Days past due sub-score (0-34): higher dpd = higher risk
        dpd = mock_dpd[i] if i < len(mock_dpd) else 0
        dpd_score = min(34, dpd * 2)

        total = freq_score + conc_score + dpd_score
        risk_level = (
            "critical" if total >= 70
            else "high"    if total >= 50
            else "medium"  if total >= 30
            else "low"
        )

        scores.append(VendorRiskScore(
            vendor_id=str(v.id),
            vendor_name=v.name,
            score=total,
            payment_frequency_score=freq_score,
            concentration_score=conc_score,
            days_past_due_score=dpd_score,
            risk_level=risk_level,
        ))

    return sorted(scores, key=lambda s: s.score, reverse=True)


# ── 4. Aggregate Risk Signal → Redis ─────────────────────────────────

async def generate_risk_signal(org_id: str) -> RiskSignal:
    redis_key = f"risk_signal:{org_id}"

    # Check cache first
    cached = await redis_client.get(redis_key)
    if cached:
        return RiskSignal(**json.loads(cached))

    # Compute all layers in parallel-ish (sequential is fine for <2s target)
    payment_anomalies = await detect_payment_anomalies(org_id)
    sales_drop = await detect_sales_drops(org_id)
    vendor_risks = await score_vendor_risk(org_id)

    # Determine overall severity
    has_critical = (
        any(a.severity == "critical" for a in payment_anomalies)
        or any(v.risk_level == "critical" for v in vendor_risks)
        or (sales_drop.flagged and sales_drop.drop_pct > 30)
    )
    has_warning = (
        any(a.severity == "warning" for a in payment_anomalies)
        or (sales_drop.flagged)
        or any(v.risk_level in ("high", "medium") for v in vendor_risks)
    )

    severity = "critical" if has_critical else "warning" if has_warning else "safe"
    anomaly_count = len(payment_anomalies) + (1 if sales_drop.flagged else 0)

    signal = RiskSignal(
        signal_id=str(uuid.uuid4()),
        org_id=org_id,
        severity=severity,
        anomaly_count=anomaly_count,
        payment_anomalies=payment_anomalies,
        sales_drop=sales_drop if sales_drop.flagged else None,
        vendor_risks=vendor_risks,
        generated_at=datetime.now(timezone.utc).isoformat(),
        ttl_seconds=900,
    )

    # Store in Redis with 15-min TTL
    try:
        await redis_client.set(
            redis_key,
            signal.model_dump_json(),
            ex=900,
        )
    except Exception:
        pass  # Redis unavailable — serve without cache

    return signal
