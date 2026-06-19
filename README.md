# 🧠 DECYNTRA-X: The Autonomous Decision Copilot for Cash Flow

<p align="center">
  <img src="https://img.shields.io/badge/Status-Production_Ready-brightgreen?style=flat-square" alt="Status">
  <img src="https://img.shields.io/badge/AI-Multi_Agent_(Groq_+_Gemini)-blue?style=flat-square" alt="AI Model">
  <img src="https://img.shields.io/badge/Backend-FastAPI_(Async)-009688?style=flat-square" alt="Backend">
  <img src="https://img.shields.io/badge/Frontend-React_+_TypeScript-61DAFB?style=flat-square" alt="Frontend">
  <img src="https://img.shields.io/badge/Graph_Database-Neo4j-018BFF?style=flat-square" alt="Neo4j">
</p>

**DECYNTRA-X** is not just another analytics dashboard. It is a first-of-its-kind **Autonomous Decision Copilot** designed specifically for SME cash flow management. By combining the raw speed of Groq, the deep reasoning of Gemini, Knowledge Graphs, and Episodic Memory, DECYNTRA-X detects financial risks and *autonomously generates, critiques, and executes* decision packages—learning from human feedback over time.

---

## 🚨 The Problem It Solves

Traditional financial tools suffer from three fatal flaws:
1.  **Reactive, Not Proactive:** They show you a red dashboard *after* cash is already tight. They don't predict the cliff edge until you're falling off it.
2.  **Analysis Paralysis:** They highlight that "Invoice X is overdue," but they don't tell you *what to do about it*. Should you delay a vendor payment? Offer a discount? Take a loan? They leave the hard thinking to the stressed CEO.
3.  **Context Amnesia:** Standard AI tools treat every decision in a vacuum. They don't remember that "The last time we delayed Vendor Y, they penalized us 5%," nor do they adapt to the specific risk tolerance of the human user.

**Result:** SMEs make costly, isolated decisions based on gut feeling, leading to $X billion in avoidable cash flow crunches annually.

---

## ✨ The Innovation

DECYNTRA-X introduces a paradigm shift: **Decision-as-a-Service (DaaS)**.

*   **The 3-Agent Brain:** Instead of one monolithic LLM, DECYNTRA-X uses a specialized pipeline:
    *   **Agent 1 (Risk Analyst - Groq Llama 3.3):** Analyzes anomalies in <2s.
    *   **Agent 2 (Strategist - Gemini 1.5 Pro):** Generates nuanced 3-option strategies based on deep context.
    *   **Agent 3 (Critic - Groq Mixtral):** Plays devil's advocate, scoring failure probabilities to prevent blind spots.
*   **Decision DNA:** The system profiles the human user. If you are "aggressive," it adapts its recommendations. If you tend to override the AI, it learns *why* and shifts its strategy next time.
*   **Episodic Memory Engine:** It maintains a vector/graph history of past decisions. Before suggesting a solution, it checks: *"Did we try this before? Did it work?"*
*   **Knowledge Graph Context (Neo4j):** It understands relationships. It knows that delaying Vendor A affects Customer B's supply chain, creating a multi-hop risk analysis impossible in standard SQL.
*   **Human-in-the-Loop (HitL) Execution:** It doesn't just advise; it drafts the emails, queues the actions, and waits for one click of approval.

---

## 🏗️ Working Structure & Architecture

DECYNTRA-X is a full-stack async application separated into a **React/TypeScript Frontend**, a **FastAPI Backend**, and a **Multi-Database Layer**.

### High-Level Flow
`Data Ingestion` ➡️ `Anomaly Detection (Sensors)` ➡️ `Risk Signal (Redis)` ➡️ `Decision Brain (3 Agents)` ➡️ `Human Choice (UI)` ➡️ `Execution Engine` ➡️ `Outcome Feedback (Learning Loop)`

### Directory Map & Component Breakdown

```text
DECYNTRA-X-main/
├── backend/
│   ├── alembic/              # Async DB Migrations
│   ├── models/               # SQLAlchemy Schema (Postgres)
│   │   └── schema.py         # Users, Invoices, Decision Logs, Action Queues
│   ├── routers/              # FastAPI Endpoints
│   │   ├── analytics.py      # Deterministic: Cash Runway, Overdues
│   │   ├── anomaly.py        # Probabilistic: Payment/Sales Anomalies
│   │   ├── decisions.py      # The Core: Generate, Choose, Query, Disagreements
│   │   ├── simulate.py       # What-If Scenario comparison
│   │   ├── execute.py        # Draft Emails, Action Queue (Approve/Reject)
│   │   ├── graph.py          # Neo4j Sync & Neighborhood queries
│   │   ├── outcomes.py       # Post-decision impact tracking
│   │   └── users.py          # Decision DNA profiling
│   ├── services/             # The "Brains" (Business Logic)
│   │   ├── decision_brain.py # The 3-Agent LLM Orchestrator
│   │   ├── deterministic_engine.py # Math-based cash calculations
│   │   ├── probabilistic_engine.py # Statistical deviation detection
│   │   ├── memory_engine.py  # Episodic memory & calibration
│   │   ├── decision_dna.py   # User preference adaptation
│   │   ├── execution_engine.py # Gemini email drafting
│   │   ├── simulation_engine.py # Gemini scenario projection
│   │   └── graph_builder.py  # SQL-to-Neo4j sync logic
│   ├── schemas/              # Pydantic validation models
│   ├── config.py             # Env settings (Pydantic)
│   ├── database.py           # Async SQLAlchemy engine
│   ├── neo4j_client.py       # Neo4j Async Driver
│   └── redis_client.py       # Redis Async connection
├── frontend/                 # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/ui/    # Custom UI Kit (Drawer, ChatBar, WhyPopover)
│   │   ├── pages/            # App Views
│   │   │   ├── DecisionCenter.tsx # The main Copilot UI
│   │   │   ├── DecisionDNA.tsx    # User profiling view
│   │   │   ├── KnowledgeGraph.tsx # Graph visualization
│   │   │   └── Impact.tsx         # Outcome tracking
│   │   └── store/            # State Management (Zustand/Redux)
└── data-seed/                # Mock data generator
```

### The Decision Brain Pipeline (In Detail)
Located in `backend/services/decision_brain.py`, this is the heart of the system.

1.  **Trigger:** A Risk Signal is pulled from Redis (generated by the Probabilistic Engine).
2.  **Context Assembly:** The system pulls the **Business Context** (SQL), **Graph Neighbors** (Neo4j), **Decision DNA** (User Profile), and **Memory** (Past Cases).
3.  **Agent 1 (Groq):** Analyzes the signal and identifies root causes in <2 seconds.
4.  **Agent 2 (Gemini):** Takes the Risk Analysis + Context and generates 3 distinct strategies (Conservative, Balanced, Aggressive) with cash impact projections.
5.  **Agent 3 (Groq):** Reviews all 3 options, assigns "Failure Probability" scores, and highlights the "Weakest Assumption" in each.
6.  **Adaptation:** The `memory_engine` adjusts the confidence scores based on historical accuracy (Calibration) and user DNA.
7.  **Output:** A `DecisionPackage` is cached and sent to the UI.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite | Fast UI, Type safety |
| **Backend** | FastAPI, Pydantic v2 | Async performance, Data validation |
| **Database (Relational)** | PostgreSQL | Invoices, Users, Audit Logs |
| **Database (Graph)** | Neo4j | Relationship mapping (Entity Neighborhoods) |
| **Cache/Queue** | Redis | Risk Signal TTL, Pub/Sub, Session Cache |
| **LLM 1 (Speed)** | Groq (Llama 3.3 70B) | Risk Analysis, Critique, Anomaly Summary |
| **LLM 2 (Reasoning)** | Google Gemini 1.5 Pro | Strategy Generation, Simulation, Email Drafting |
| **ORM/Migrations** | SQLAlchemy (Async), Alembic | DB Modeling |

---

## ⚡ Getting Started

### Prerequisites
*   Python 3.10+
*   Node.js 18+
*   Docker (recommended for Postgres, Neo4j, Redis)
*   Groq API Key & Gemini API Key

### 1. Environment Setup
Create a `.env` file in the `backend/` directory:

```env
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/decyntra
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
REDIS_URL=redis://localhost:6379/0
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIza...
JWT_SECRET=supersecret
FRONTEND_URL=http://localhost:5173
LOG_LEVEL=INFO
ENVIRONMENT=development
```

### 2. Database & Graph Initialization
```bash
# Start infra (Docker Compose recommended)
docker-compose up -d postgres neo4j redis

# Run Migrations
cd backend
alembic upgrade head

# Seed Data (Generates mock invoices/customers)
python -m data-seed.seed
```

### 3. Backend Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Visit `http://localhost:5173`.

### 5. Trigger the Magic
1.  Go to the **Knowledge Graph** page and click "Build Graph" to sync SQL to Neo4j.
2.  Go to **Analytics** to view Cash Runway.
3.  Go to **Decision Center** to see the AI generate a Decision Package based on simulated risk signals.

---

## 🎯 Key Features

*   **Autonomous Drafting:** The Execution Engine doesn't just say "Send reminder." It drafts the actual email (Polite vs. Firm tone) and queues it for 1-click approval.
*   **Disagreement Tracking:** If the human picks "Option B" but the AI recommended "Option A," the system logs the *reason* for the disagreement and uses it to recalibrate future recommendations.
*   **What-If Simulator:** Uses Gemini to project cash flow curves for different options, visualizing "Best Case," "Worst Case," and "Risk Overlays."
*   **Sub-2s Risk Detection:** Uses statistical standard deviation on payment cycles combined with Groq summarization to detect anomalies faster than traditional rules.

---
