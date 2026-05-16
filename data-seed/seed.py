import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from backend.models.schema import Organization, Customer, Vendor, Invoice, BankTransaction, KPISnapshot
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:password@localhost:5432/decyntrax")

engine = create_async_engine(DATABASE_URL, echo=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def seed_data():
    async with AsyncSessionLocal() as session:
        org_id = uuid.uuid4()
        org = Organization(id=org_id, name="Test Org")
        session.add(org)
        
        # 5 customers (2 overdue >14 days, 1 borderline)
        cust1 = Customer(id=uuid.uuid4(), name="Globex (Overdue >14)", org_id=org_id)
        cust2 = Customer(id=uuid.uuid4(), name="Initech (Overdue >14)", org_id=org_id)
        cust3 = Customer(id=uuid.uuid4(), name="Umbrella (Borderline)", org_id=org_id)
        cust4 = Customer(id=uuid.uuid4(), name="Acme (Normal)", org_id=org_id)
        cust5 = Customer(id=uuid.uuid4(), name="Stark (Normal)", org_id=org_id)
        session.add_all([cust1, cust2, cust3, cust4, cust5])
        
        # 3 vendors (1 payable due in 3 days)
        vend1 = Vendor(id=uuid.uuid4(), name="Supplier A (Due in 3)", org_id=org_id)
        vend2 = Vendor(id=uuid.uuid4(), name="Supplier B", org_id=org_id)
        vend3 = Vendor(id=uuid.uuid4(), name="Supplier C", org_id=org_id)
        session.add_all([vend1, vend2, vend3])
        
        # 10 open invoices (mix of paid/overdue/upcoming)
        now = datetime.now(timezone.utc)
        invoices = [
            Invoice(id=uuid.uuid4(), customer_id=cust1.id, amount=5000, due_date=now - timedelta(days=20), status="overdue"),
            Invoice(id=uuid.uuid4(), customer_id=cust2.id, amount=8000, due_date=now - timedelta(days=15), status="overdue"),
            Invoice(id=uuid.uuid4(), customer_id=cust3.id, amount=3000, due_date=now - timedelta(days=1), status="overdue"),
            Invoice(id=uuid.uuid4(), customer_id=cust4.id, amount=1500, due_date=now + timedelta(days=5), status="upcoming"),
            Invoice(id=uuid.uuid4(), customer_id=cust5.id, amount=12000, due_date=now + timedelta(days=10), status="upcoming"),
            Invoice(id=uuid.uuid4(), customer_id=cust4.id, amount=2500, due_date=now - timedelta(days=30), status="paid"),
            Invoice(id=uuid.uuid4(), customer_id=cust5.id, amount=4500, due_date=now - timedelta(days=25), status="paid"),
            Invoice(id=uuid.uuid4(), customer_id=cust1.id, amount=6500, due_date=now + timedelta(days=15), status="upcoming"),
            Invoice(id=uuid.uuid4(), customer_id=cust2.id, amount=3500, due_date=now + timedelta(days=2), status="upcoming"),
            Invoice(id=uuid.uuid4(), customer_id=cust3.id, amount=9500, due_date=now - timedelta(days=5), status="paid")
        ]
        session.add_all(invoices)
        
        # 45 days of bank transactions including an anomalous week
        transactions = []
        for i in range(45):
            date = now - timedelta(days=i)
            # Anomalous week (days 10-17 ago)
            if 10 <= i <= 17:
                amount = -20000
                t_type = "debit"
            else:
                amount = 1000 if i % 2 == 0 else -500
                t_type = "credit" if amount > 0 else "debit"
            transactions.append(BankTransaction(id=uuid.uuid4(), amount=amount, date=date, type=t_type))
        session.add_all(transactions)
        
        # KPI baseline row
        kpi = KPISnapshot(
            id=uuid.uuid4(),
            org_id=org_id,
            snapshot_date=now,
            decision_latency_ms=172800000,
            cash_risk_detected_days_early=0,
            bad_decisions_avoided=0,
            ai_accuracy_pct=0.0,
            total_cash_saved=0
        )
        session.add(kpi)
        
        await session.commit()
        print("Data seeded successfully!")

if __name__ == "__main__":
    asyncio.run(seed_data())
