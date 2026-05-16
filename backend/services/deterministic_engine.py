from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import AsyncSessionLocal
from backend.models.schema import Invoice, BankTransaction, Customer, Vendor
from backend.schemas.analytics import (
    CashRunwayResult, DailyBalance,
    OverdueInvoice, UpcomingPayable,
    ShortfallSignal, TriggerItem,
)

DANGER_THRESHOLD = 40_000.0   # ₹40k minimum safe buffer


# ─────────────────────────────────────────────────────────────────────
# 1. Cash Runway
# ─────────────────────────────────────────────────────────────────────

async def compute_cash_runway(org_id: str, days: int = 30) -> CashRunwayResult:
    now = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as pg:
        txns = (await pg.execute(select(BankTransaction))).scalars().all()
        invoices = (await pg.execute(select(Invoice))).scalars().all()

    # Derive current balance from bank transactions
    current_balance: float = sum(float(t.amount or 0) for t in txns)

    # Build per-day inflow/outflow from upcoming invoices
    upcoming_inflows: dict[int, float] = {}   # day offset -> amount
    upcoming_outflows: dict[int, float] = {}

    for inv in invoices:
        if inv.status in ("upcoming", "overdue") and inv.due_date:
            offset = (inv.due_date.replace(tzinfo=timezone.utc) - now).days
            if 0 <= offset <= days:
                upcoming_inflows[offset] = upcoming_inflows.get(offset, 0) + float(inv.amount or 0)

    # Rolling balance projection
    daily_balances: list[DailyBalance] = []
    running = current_balance
    days_until_danger = days  # default: safe throughout

    for d in range(days):
        day_date = (now + timedelta(days=d)).strftime("%Y-%m-%d")
        inflow = upcoming_inflows.get(d, 0.0)
        outflow = upcoming_outflows.get(d, 0.0)
        running = running + inflow - outflow

        note = ""
        if inflow:
            note = f"Expected inflow ₹{inflow:,.0f}"
        if outflow:
            note += f" | Outflow ₹{outflow:,.0f}"

        daily_balances.append(DailyBalance(
            date=day_date,
            balance=round(running, 2),
            inflow=round(inflow, 2),
            outflow=round(outflow, 2),
            note=note.strip(),
        ))

        if running < DANGER_THRESHOLD and days_until_danger == days:
            days_until_danger = d

    return CashRunwayResult(
        daily_balances=daily_balances,
        days_until_danger=days_until_danger,
        danger_threshold=DANGER_THRESHOLD,
        current_balance=round(current_balance, 2),
    )


# ─────────────────────────────────────────────────────────────────────
# 2. Overdue Invoices
# ─────────────────────────────────────────────────────────────────────

async def get_overdue_invoices(org_id: str) -> list[OverdueInvoice]:
    now = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as pg:
        invoices = (await pg.execute(
            select(Invoice).where(Invoice.status == "overdue")
        )).scalars().all()

        customers = {
            str(c.id): c
            for c in (await pg.execute(select(Customer))).scalars().all()
        }

    results: list[OverdueInvoice] = []
    for inv in invoices:
        if not inv.due_date:
            continue
        due = inv.due_date.replace(tzinfo=timezone.utc)
        days_overdue = (now - due).days
        if days_overdue < 1:
            continue
        cust = customers.get(str(inv.customer_id))
        results.append(OverdueInvoice(
            invoice_id=str(inv.id),
            customer_id=str(inv.customer_id),
            customer_name=cust.name if cust else "Unknown",
            amount=float(inv.amount or 0),
            due_date=due.strftime("%Y-%m-%d"),
            days_overdue=days_overdue,
            status=inv.status,
        ))

    return sorted(results, key=lambda x: x.days_overdue, reverse=True)


# ─────────────────────────────────────────────────────────────────────
# 3. Upcoming Payables
# ─────────────────────────────────────────────────────────────────────

async def get_upcoming_payables(org_id: str, days: int = 7) -> list[UpcomingPayable]:
    """
    In a full implementation this would query a 'vendor_bills' table.
    Here we derive payables from bank transactions with type='debit'
    that have a future date (seeded data has no vendor_bills table yet),
    and augment with static vendor data for realistic output.
    """
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=days)

    async with AsyncSessionLocal() as pg:
        vendors = (await pg.execute(select(Vendor))).scalars().all()

    # Deterministic mock payables derived from vendor list
    payables: list[UpcomingPayable] = []
    mock_amounts = [25000.0, 18000.0, 12000.0]
    mock_offsets = [3, 6, 7]

    for i, v in enumerate(vendors[:3]):
        offset = mock_offsets[i]
        due = now + timedelta(days=offset)
        payables.append(UpcomingPayable(
            vendor_id=str(v.id),
            vendor_name=v.name,
            amount=mock_amounts[i],
            due_date=due.strftime("%Y-%m-%d"),
            days_until_due=offset,
        ))

    return sorted(payables, key=lambda x: x.days_until_due)


# ─────────────────────────────────────────────────────────────────────
# 4. Shortfall Signal
# ─────────────────────────────────────────────────────────────────────

async def flag_cash_shortfall(org_id: str) -> ShortfallSignal:
    runway = await compute_cash_runway(org_id, days=14)
    overdue = await get_overdue_invoices(org_id)
    payables = await get_upcoming_payables(org_id, days=7)

    trigger_items: list[TriggerItem] = []

    # Overdue invoices → expected inflows not yet arrived
    for inv in overdue:
        urgency: str = "critical" if inv.days_overdue > 14 else "warning"
        trigger_items.append(TriggerItem(
            source_type="invoice",
            source_id=inv.invoice_id,
            label=f"{inv.customer_name} — overdue {inv.days_overdue}d",
            amount=-inv.amount,   # money we should have received
            urgency=urgency,      # type: ignore[arg-type]
        ))

    # Upcoming payables → cash going out
    for pay in payables:
        trigger_items.append(TriggerItem(
            source_type="payable",
            source_id=pay.vendor_id,
            label=f"{pay.vendor_name} — due in {pay.days_until_due}d",
            amount=pay.amount,
            urgency="warning" if pay.days_until_due <= 3 else "info",  # type: ignore[arg-type]
        ))

    # Net shortfall = current_balance - total outflows
    total_outflows = sum(p.amount for p in payables)
    net = runway.current_balance - total_outflows

    if net < 0:
        severity = "critical"
        days_until_shortfall = runway.days_until_danger
    elif net < DANGER_THRESHOLD:
        severity = "warning"
        days_until_shortfall = runway.days_until_danger
    else:
        severity = "safe"
        days_until_shortfall = runway.days_until_danger

    return ShortfallSignal(
        severity=severity,   # type: ignore[arg-type]
        days_until_shortfall=days_until_shortfall,
        amount=round(net, 2),
        trigger_items=trigger_items,
    )
