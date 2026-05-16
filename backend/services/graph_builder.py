from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.models.schema import Customer, Vendor, Invoice, BankTransaction
from backend.database import AsyncSessionLocal
from backend.neo4j_client import neo4j_client
from datetime import datetime, timezone
import uuid


async def _clear_org_graph(session, org_id: str):
    """Delete all existing nodes for this org to avoid duplication."""
    await session.run(
        "MATCH (n {orgId: $orgId}) DETACH DELETE n",
        {"orgId": org_id}
    )


async def build_graph(org_id: str) -> dict:
    """
    Full async graph build:
    1. Read all rows from PostgreSQL
    2. Create Neo4j nodes (Customer, Vendor, Invoice, Transaction, BankAccount)
    3. Create typed relationships
    Returns node/edge counts.
    """
    counts = {
        "customers": 0, "vendors": 0, "invoices": 0,
        "transactions": 0, "bank_accounts": 1,  # one bank account per org
        "relationships": 0
    }

    async with AsyncSessionLocal() as pg:
        customers_rows = (await pg.execute(
            select(Customer).where(Customer.org_id == org_id)
        )).scalars().all()

        vendors_rows = (await pg.execute(
            select(Vendor).where(Vendor.org_id == org_id)
        )).scalars().all()

        invoices_rows = (await pg.execute(
            select(Invoice)
        )).scalars().all()

        txns_rows = (await pg.execute(
            select(BankTransaction)
        )).scalars().all()

    bank_account_id = f"ba-{org_id}"
    now = datetime.now(timezone.utc)

    async with neo4j_client.driver.session() as neo:

        # Clear existing org graph
        await neo.run(
            "MATCH (n {orgId: $orgId}) DETACH DELETE n",
            {"orgId": org_id}
        )

        # ── BankAccount node ──────────────────────────────────────────
        await neo.run(
            """
            MERGE (ba:BankAccount {id: $id})
            SET ba.orgId = $orgId, ba.label = $label
            """,
            {"id": bank_account_id, "orgId": org_id, "label": "Main Account"}
        )

        # ── Customer nodes ────────────────────────────────────────────
        for c in customers_rows:
            cid = str(c.id)
            await neo.run(
                """
                MERGE (c:Customer {id: $id})
                SET c.orgId = $orgId, c.name = $name
                """,
                {"id": cid, "orgId": org_id, "name": c.name}
            )
            counts["customers"] += 1

        # ── Vendor nodes ──────────────────────────────────────────────
        for v in vendors_rows:
            vid = str(v.id)
            await neo.run(
                """
                MERGE (v:Vendor {id: $id})
                SET v.orgId = $orgId, v.name = $name
                """,
                {"id": vid, "orgId": org_id, "name": v.name}
            )
            counts["vendors"] += 1

        # ── Invoice nodes + Customer→Invoice relationships ────────────
        customer_invoice_map: dict[str, list[Invoice]] = {}
        for inv in invoices_rows:
            inv_id = str(inv.id)
            cust_id = str(inv.customer_id)
            due_date_str = inv.due_date.isoformat() if inv.due_date else ""
            days_past_due = 0
            if inv.due_date and inv.status == "overdue":
                days_past_due = (now - inv.due_date.replace(tzinfo=timezone.utc)).days

            await neo.run(
                """
                MERGE (i:Invoice {id: $id})
                SET i.orgId = $orgId,
                    i.amount = $amount,
                    i.dueDate = $dueDate,
                    i.status = $status,
                    i.daysPastDue = $daysPastDue
                """,
                {
                    "id": inv_id, "orgId": org_id,
                    "amount": float(inv.amount or 0),
                    "dueDate": due_date_str,
                    "status": inv.status or "unknown",
                    "daysPastDue": days_past_due,
                }
            )
            counts["invoices"] += 1

            # (Customer)-[:OWES]->(Invoice)
            await neo.run(
                """
                MATCH (c:Customer {id: $cid}), (i:Invoice {id: $iid})
                MERGE (c)-[:OWES]->(i)
                """,
                {"cid": cust_id, "iid": inv_id}
            )
            counts["relationships"] += 1

            customer_invoice_map.setdefault(cust_id, []).append(inv)

        # ── Transaction nodes ─────────────────────────────────────────
        for t in txns_rows:
            tid = str(t.id)
            date_str = t.date.isoformat() if t.date else ""
            await neo.run(
                """
                MERGE (tx:Transaction {id: $id})
                SET tx.orgId = $orgId,
                    tx.amount = $amount,
                    tx.date = $date,
                    tx.type = $type
                """,
                {
                    "id": tid, "orgId": org_id,
                    "amount": float(t.amount or 0),
                    "date": date_str,
                    "type": t.type or "unknown",
                }
            )
            counts["transactions"] += 1

            # (BankAccount)-[:RECEIVED]->(Transaction) for credits
            if t.type == "credit":
                await neo.run(
                    """
                    MATCH (ba:BankAccount {id: $baid}), (tx:Transaction {id: $tid})
                    MERGE (ba)-[:RECEIVED]->(tx)
                    """,
                    {"baid": bank_account_id, "tid": tid}
                )
                counts["relationships"] += 1

        # ── Customer payment cycle (avg days) ─────────────────────────
        for cust_id, invs in customer_invoice_map.items():
            paid = [i for i in invs if i.status == "paid" and i.due_date]
            payment_cycle = 0.0
            if paid:
                payment_cycle = sum(
                    abs((now - i.due_date.replace(tzinfo=timezone.utc)).days)
                    for i in paid
                ) / len(paid)
            await neo.run(
                """
                MATCH (c:Customer {id: $cid})
                SET c.paymentCycleDays = $pc
                """,
                {"cid": cust_id, "pc": round(payment_cycle, 1)}
            )

    return counts


async def get_snapshot(org_id: str) -> dict:
    """Returns node counts and a sample subgraph JSON."""
    async with neo4j_client.driver.session() as session:
        result = await session.run(
            """
            MATCH (n {orgId: $orgId})
            RETURN labels(n)[0] AS label, count(n) AS count
            """,
            {"orgId": org_id}
        )
        records = await result.data()
        label_counts = {r["label"]: r["count"] for r in records}

        # Sample: customers + their invoices
        sample_result = await session.run(
            """
            MATCH (c:Customer {orgId: $orgId})-[:OWES]->(i:Invoice)
            RETURN c, i LIMIT 20
            """,
            {"orgId": org_id}
        )
        sample_records = await sample_result.data()

        nodes = {}
        edges = []
        for row in sample_records:
            c = dict(row["c"])
            i = dict(row["i"])
            nodes[c["id"]] = {**c, "type": "Customer"}
            nodes[i["id"]] = {**i, "type": "Invoice"}
            edges.append({"source": c["id"], "target": i["id"], "type": "OWES"})

        return {
            "counts": label_counts,
            "nodes": list(nodes.values()),
            "edges": edges,
        }


async def get_entity_neighbourhood(entity_type: str, entity_id: str) -> dict:
    """Returns a node and its 1-hop neighbourhood."""
    async with neo4j_client.driver.session() as session:
        result = await session.run(
            """
            MATCH (n {id: $id})
            OPTIONAL MATCH (n)-[r]-(neighbour)
            RETURN n, collect({node: neighbour, rel: type(r), dir: startNode(r) = n}) AS neighbours
            """,
            {"id": entity_id}
        )
        record = await result.single()
        if not record:
            return {"node": None, "neighbours": []}

        node = dict(record["n"])
        node["type"] = entity_type
        neighbours = []
        for nb in record["neighbours"]:
            if nb["node"]:
                n_dict = dict(nb["node"])
                neighbours.append({
                    "node": n_dict,
                    "relationship": nb["rel"],
                    "direction": "out" if nb["dir"] else "in",
                })

        return {"node": node, "neighbours": neighbours}
