import json
from datetime import datetime, timezone
from typing import Optional

import httpx
from sqlalchemy import select, update

from backend.config import settings
from backend.database import AsyncSessionLocal
from backend.models.schema import ActionQueue, Customer, Invoice, Vendor, DecisionLog
from backend.schemas.execution import EmailDraft, WeeklyBrief, ActionQueueItem
from backend.services.outcome_engine import compute_system_value

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_TIMEOUT = 10.0
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-1.5-pro-latest:generateContent"
)
GEMINI_TIMEOUT = 15.0


async def _call_groq(prompt: str, system: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=GROQ_TIMEOUT) as client:
            resp = await client.post(
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": 700,
                    "temperature": 0.4,
                    "response_format": {"type": "json_object"},
                },
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
    except Exception as e:
        return json.dumps({"error": str(e)})


async def _call_gemini(prompt: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=GEMINI_TIMEOUT) as client:
            resp = await client.post(
                f"{GEMINI_URL}?key={settings.GEMINI_API_KEY}",
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.35,
                        "maxOutputTokens": 1200,
                        "responseMimeType": "application/json",
                    },
                },
            )
            resp.raise_for_status()
            return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        return json.dumps({"error": str(e)})


async def draft_reminder_email(invoice_id: str, org_id: str) -> EmailDraft:
    async with AsyncSessionLocal() as pg:
        invoice = (await pg.execute(
            select(Invoice).where(Invoice.id == invoice_id)
        )).scalars().first()
        if not invoice:
            raise ValueError("Invoice not found")
        customer = (await pg.execute(
            select(Customer).where(Customer.id == invoice.customer_id)
        )).scalars().first()

    days_past_due = 0
    if invoice.due_date:
        days_past_due = (datetime.now(timezone.utc) - invoice.due_date).days

    payment_pattern = "repeat offender" if days_past_due > 14 else "first time"
    tone = "firm" if payment_pattern == "repeat offender" else "polite"

    prompt = (
        f"Draft a {tone} payment reminder email.\n"
        f"Customer: {customer.name if customer else 'Unknown'}\n"
        f"Invoice #: {invoice_id}\n"
        f"Amount: {float(invoice.amount or 0):.2f}\n"
        f"Days past due: {days_past_due}\n"
        f"Payment history pattern: {payment_pattern}\n"
        f"Org tone setting: professional, direct, empathetic\n"
        "Return JSON with subject, body, recipient_email, tone."
    )

    system = "You are an accounts receivable assistant. Output JSON only."
    raw = await _call_groq(prompt, system)

    try:
        data = json.loads(raw)
        return EmailDraft(
            subject=data.get("subject", "Payment reminder"),
            body=data.get("body", "Please settle the overdue invoice."),
            recipient_email=data.get("recipient_email", "accounts@customer.com"),
            tone=tone,
            invoice_id=str(invoice_id),
        )
    except Exception:
        return EmailDraft(
            subject="Payment reminder",
            body="This is a friendly reminder that your invoice is overdue. Please advise on expected payment date.",
            recipient_email="accounts@customer.com",
            tone=tone,
            invoice_id=str(invoice_id),
        )


async def draft_vendor_delay_request(vendor_id: str, payable_id: str, org_id: str) -> EmailDraft:
    async with AsyncSessionLocal() as pg:
        vendor = (await pg.execute(
            select(Vendor).where(Vendor.id == vendor_id)
        )).scalars().first()

    prompt = (
        "Draft a vendor payment delay request.\n"
        f"Vendor: {vendor.name if vendor else 'Unknown'}\n"
        f"Payable ID: {payable_id}\n"
        "Requested delay days: 7\n"
        "Cash position context: temporary short-term liquidity crunch, proactive communication.\n"
        "Return JSON with subject, body, recipient_email, tone."
    )

    system = "You are a vendor management assistant. Output JSON only."
    raw = await _call_groq(prompt, system)

    try:
        data = json.loads(raw)
        return EmailDraft(
            subject=data.get("subject", "Request for payment extension"),
            body=data.get("body", "We request a short extension on this payment."),
            recipient_email=data.get("recipient_email", "billing@vendor.com"),
            tone="polite",
            vendor_id=str(vendor_id),
        )
    except Exception:
        return EmailDraft(
            subject="Request for payment extension",
            body="We are requesting a short extension on this payment due to temporary cash constraints.",
            recipient_email="billing@vendor.com",
            tone="polite",
            vendor_id=str(vendor_id),
        )


async def generate_weekly_brief(org_id: str) -> WeeklyBrief:
    system_value = await compute_system_value(org_id)

    async with AsyncSessionLocal() as pg:
        pending = (await pg.execute(
            select(DecisionLog).where(DecisionLog.status == "pending")
        )).scalars().all()

    pending_actions = [f"Decision {p.package_id} pending" for p in pending[:5]]

    prompt = (
        "Generate a weekly brief for the CFO.\n"
        "Include: cash position, top 3 risks, top 3 opportunities, pending decisions, system value metrics, next week forecast.\n"
        f"System value metrics: cash saved {system_value.total_cash_saved}, AI accuracy {system_value.ai_accuracy_pct}%.\n"
        f"Pending decisions: {', '.join(pending_actions) or 'None'}.\n"
        "Return JSON with fields: headline, cash_summary, top_risks, top_opportunities, pending_actions, kpi_highlights, next_week_forecast."
    )

    raw = await _call_gemini(prompt)
    try:
        data = json.loads(raw)
        return WeeklyBrief(
            headline=data.get("headline", "Weekly cash flow brief"),
            cash_summary=data.get("cash_summary", "Cash position remains stable."),
            top_risks=data.get("top_risks", []),
            top_opportunities=data.get("top_opportunities", []),
            pending_actions=data.get("pending_actions", pending_actions),
            kpi_highlights=data.get("kpi_highlights", "AI accuracy and speed improved."),
            next_week_forecast=data.get("next_week_forecast", "Moderate liquidity with manageable risks."),
        )
    except Exception:
        return WeeklyBrief(
            headline="Weekly cash flow brief",
            cash_summary="Cash position remains stable but tight.",
            top_risks=["Overdue receivables", "Vendor concentration"],
            top_opportunities=["Early payment discounts", "Renegotiate vendor terms"],
            pending_actions=pending_actions,
            kpi_highlights=f"AI accuracy {system_value.ai_accuracy_pct}%",
            next_week_forecast="Expect a mild cash dip mid-week with recovery by Friday.",
        )


async def queue_action(action_type: str, payload: dict, approved_by: Optional[str], org_id: str) -> ActionQueueItem:
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as pg:
        item = ActionQueue(
            action_type=action_type,
            payload=payload,
            status="pending",
            approved_by=approved_by,
            org_id=org_id,
            created_at=now,
            updated_at=now,
        )
        pg.add(item)
        await pg.commit()
        await pg.refresh(item)

    return ActionQueueItem(
        id=str(item.id),
        action_type=item.action_type,
        payload=item.payload,
        status=item.status,
        approved_by=item.approved_by,
        org_id=item.org_id,
        created_at=item.created_at.isoformat(),
        updated_at=item.updated_at.isoformat() if item.updated_at else None,
    )


async def list_queue(org_id: str) -> list[ActionQueueItem]:
    async with AsyncSessionLocal() as pg:
        items = (await pg.execute(
            select(ActionQueue).where(ActionQueue.org_id == org_id).order_by(ActionQueue.created_at.desc())
        )).scalars().all()

    results: list[ActionQueueItem] = []
    for i in items:
        draft = None
        if i.action_type in ("draft_reminder", "draft_vendor_delay"):
            payload = i.payload or {}
            draft = EmailDraft(
                subject=payload.get("subject", ""),
                body=payload.get("body", ""),
                recipient_email=payload.get("recipient_email", ""),
                tone=payload.get("tone", "polite"),
                invoice_id=payload.get("invoice_id"),
                vendor_id=payload.get("vendor_id"),
            )
        results.append(ActionQueueItem(
            id=str(i.id),
            action_type=i.action_type,
            payload=i.payload or {},
            status=i.status,
            approved_by=i.approved_by,
            org_id=i.org_id,
            created_at=i.created_at.isoformat() if i.created_at else "",
            updated_at=i.updated_at.isoformat() if i.updated_at else None,
            rejection_reason=i.rejection_reason,
            draft=draft,
        ))

    return results


async def update_action_status(action_id: str, status: str, approved_by: Optional[str], reason: Optional[str]) -> ActionQueueItem:
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as pg:
        await pg.execute(
            update(ActionQueue)
            .where(ActionQueue.id == action_id)
            .values(
                status=status,
                approved_by=approved_by,
                rejection_reason=reason,
                updated_at=now,
            )
        )
        await pg.commit()

        item = (await pg.execute(select(ActionQueue).where(ActionQueue.id == action_id))).scalars().first()

    if not item:
        raise ValueError("Action not found")

    return ActionQueueItem(
        id=str(item.id),
        action_type=item.action_type,
        payload=item.payload or {},
        status=item.status,
        approved_by=item.approved_by,
        org_id=item.org_id,
        created_at=item.created_at.isoformat() if item.created_at else "",
        updated_at=item.updated_at.isoformat() if item.updated_at else None,
        rejection_reason=item.rejection_reason,
    )
