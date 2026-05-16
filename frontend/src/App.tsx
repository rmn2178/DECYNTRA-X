import { useState } from 'react';
import './index.css';

function App() {
  const [kpis] = useState({
    decisionLatencyMs: 172800000,
    cashRiskDetectedDaysEarly: 10,
    badDecisionsAvoided: 5,
    aiAccuracyPct: 92,
    totalCashSaved: 150000,
  });

  return (
    <div className="dashboard">
      <header className="header">
        <h1>DECYNTRA-X</h1>
        <p>Decision Intelligence Engine for SME Cash Flow</p>
        <span className="badge">Prevent crises 10 days before they occur</span>
      </header>
      
      <main className="main-content">
        <section className="kpi-section">
          <h2>KPI Snapshots</h2>
          <div className="kpi-grid">
            <div className="kpi-card">
              <h3>Cash Risk Detected</h3>
              <p className="kpi-value">{kpis.cashRiskDetectedDaysEarly} Days Early</p>
            </div>
            <div className="kpi-card">
              <h3>AI Accuracy</h3>
              <p className="kpi-value">{kpis.aiAccuracyPct}%</p>
            </div>
            <div className="kpi-card">
              <h3>Total Cash Saved</h3>
              <p className="kpi-value">${kpis.totalCashSaved.toLocaleString()}</p>
            </div>
            <div className="kpi-card">
              <h3>Bad Decisions Avoided</h3>
              <p className="kpi-value">{kpis.badDecisionsAvoided}</p>
            </div>
          </div>
        </section>
        
        <section className="dashboard-grid">
          <div className="panel">
            <h3>Knowledge Graph</h3>
            <div className="placeholder-graph">
              <p>Neo4j Graph Visualization</p>
            </div>
          </div>
          <div className="panel">
            <h3>Action Queue</h3>
            <div className="placeholder-queue">
              <ul>
                <li>Re-negotiate Supplier A terms (Due in 3 days)</li>
                <li>Follow up Globex Inc (Overdue &gt; 14 days)</li>
                <li>Delay payment to Supplier B</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
