import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Brain, ShieldAlert, TrendingDown, Target, Zap, ChevronDown, ChevronRight, FileText, Check
} from 'lucide-react';
import api from '../lib/axios';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Drawer from '../components/ui/Drawer';
import Modal from '../components/ui/Modal';
import styles from './DecisionCenter.module.css';

// ── Types ────────────────────────────────────────────────────────────
interface DataPoint { entity_type: string; entity_id: string; entity_name: string; detail: string; }
interface RiskAnalysis { problem_statement: string; root_causes: string[]; urgency_score: number; key_data_points: DataPoint[]; }
interface StrategyOption { id: string; stance: string; action: string; pros: string[]; cons: string[]; cash_impact: number; cash_impact_days: number; confidence: number; data_references: DataPoint[]; }
interface StrategyOutput { options: StrategyOption[]; recommended_option_id: string; reasoning: string; }
interface CriticReview { option_id: string; main_risk: string; failure_probability: number; weakest_assumption: string; }
interface CriticOutput { reviews: CriticReview[]; }
interface DecisionPackage { package_id: string; signal_id: string; org_id: string; risk_analysis: RiskAnalysis; strategy: StrategyOutput; critic: CriticOutput; generated_at: string; status: string; chosen_option_id: string | null; }

// ── Mocks ────────────────────────────────────────────────────────────
const MOCK_PACKAGE: DecisionPackage = {
  package_id: 'pkg-123', signal_id: 'sig-123', org_id: 'org-1',
  generated_at: new Date().toISOString(), status: 'pending', chosen_option_id: null,
  risk_analysis: {
    problem_statement: 'Cash shortfall projected within critical severity. 3 anomalies detected.',
    root_causes: ['Overdue customer payments beyond historical norms', 'Week-over-week revenue decline', 'Upcoming vendor payables creating outflow pressure'],
    urgency_score: 8,
    key_data_points: [
      { entity_type: 'customer', entity_id: 'c-1', entity_name: 'Globex Corp', detail: '20d overdue, 1.4x deviation' },
      { entity_type: 'invoice', entity_id: 'i-1', entity_name: 'INV-2024-089', detail: '₹50,000 due from Globex Corp' }
    ]
  },
  strategy: {
    recommended_option_id: 'option_2',
    reasoning: 'The balanced approach offers the best risk-adjusted cash recovery, pulling the cash runway back above the danger threshold.',
    options: [
      {
        id: 'option_1', stance: 'conservative', action: 'Send formal payment reminders and hold new vendor orders',
        pros: ['Low risk', 'Preserves relationships'], cons: ['Slow recovery'],
        cash_impact: 30000, cash_impact_days: 14, confidence: 0.65, data_references: []
      },
      {
        id: 'option_2', stance: 'balanced', action: 'Offer 5% early-payment discount to top overdue customers, renegotiate vendor terms to Net-45',
        pros: ['Accelerates inflow', 'Maintains vendor relationships'], cons: ['Discount reduces margin'],
        cash_impact: 65000, cash_impact_days: 10, confidence: 0.78, data_references: []
      },
      {
        id: 'option_3', stance: 'aggressive', action: 'Engage collection agency for Globex Corp, pause all non-critical vendor payments',
        pros: ['Fastest cash recovery'], cons: ['Damages customer relationship', 'Vendor trust erosion'],
        cash_impact: 120000, cash_impact_days: 5, confidence: 0.55, data_references: []
      }
    ]
  },
  critic: {
    reviews: [
      { option_id: 'option_1', main_risk: 'Customer ignores reminders', failure_probability: 0.35, weakest_assumption: 'Assumes customers will respond' },
      { option_id: 'option_2', main_risk: 'Discount may not incentivise payment', failure_probability: 0.22, weakest_assumption: 'Assumes customers have liquidity to pay' },
      { option_id: 'option_3', main_risk: 'Permanent loss of Globex Corp', failure_probability: 0.45, weakest_assumption: 'Assumes no legal retaliation' }
    ]
  }
};

// ── Component ────────────────────────────────────────────────────────
const DecisionCenter: React.FC = () => {
  const qc = useQueryClient();
  const [expandedReasoning, setExpandedReasoning] = useState(false);
  const [refDrawerOpen, setRefDrawerOpen] = useState(false);
  const [selectedRef, setSelectedRef] = useState<DataPoint | null>(null);
  const [optionNotes, setOptionNotes] = useState<{ [key: string]: string }>({});
  
  // Modal state
  const [disagreementModalOpen, setDisagreementModalOpen] = useState(false);
  const [pendingOptionId, setPendingOptionId] = useState<string | null>(null);
  const [disagreementText, setDisagreementText] = useState<string | null>(null);

  // Use a hardcoded trigger ID for demo purposes unless passed via router state
  const signalId = 'demo-signal';
  const [wsProgress, setWsProgress] = useState<{stage: string, pct: number} | null>(null);

  // Fetch package
  const { data: pkg = MOCK_PACKAGE, isLoading } = useQuery<DecisionPackage>({
    queryKey: ['decision-package', signalId],
    queryFn: () => api.post('/api/decisions/generate', { risk_signal_id: signalId }).then(r => r.data),
    retry: false
  });

  const chooseMutation = useMutation({
    mutationFn: (payload: { option_id: string, notes: string }) => 
      api.post('/api/decisions/choose', { 
        package_id: pkg.package_id, 
        chosen_option_id: payload.option_id,
        user_id: "user-1",
        notes: payload.notes
      }).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['decision-package', signalId] });
      qc.invalidateQueries({ queryKey: ['pending-decisions'] });
      if (data.disagreement_reason) {
        setDisagreementText(data.disagreement_reason);
        setDisagreementModalOpen(true);
      }
    }
  });

  const handleSelectOption = (optId: string) => {
    setPendingOptionId(optId);
    chooseMutation.mutate({ option_id: optId, notes: optionNotes[optId] || '' });
  };

  const handleRefClick = (ref: DataPoint) => {
    setSelectedRef(ref);
    setRefDrawerOpen(true);
  };

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.content}>
          <div className={styles.loadingOverlay}>
            <div className={styles.spinner} />
            <div className={styles.loadingText}>
              {wsProgress ? wsProgress.stage : 'Agents deliberating...'}
            </div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${wsProgress ? wsProgress.pct : 45}%` }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>Decision Center</h1>
          <p className={styles.subtitle}>
            3 strategic options generated for the active cash shortfall signal.<br />
            Review the pros, cons, and AI critiques before executing an action.
          </p>
        </div>

        {/* Options Grid */}
        <div className={styles.grid}>
          {pkg.strategy.options.map((opt) => {
            const isRecommended = opt.id === pkg.strategy.recommended_option_id;
            const review = pkg.critic.reviews.find(r => r.option_id === opt.id);
            const isChosen = pkg.status === 'chosen' && pkg.chosen_option_id === opt.id;

            return (
              <div key={opt.id} className={`${styles.optionCard} ${isRecommended ? styles.optionCard_recommended : ''}`}>
                {isRecommended && <div className={styles.recommendedBadge}>AI RECOMMENDED</div>}
                
                <div className={styles.stance}>{opt.stance}</div>
                <h3 className={styles.action}>{opt.action}</h3>
                
                <div className={styles.metrics}>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>Cash Impact</span>
                    <span className={`${styles.metricVal} ${opt.cash_impact > 0 ? styles.valPositive : ''}`}>
                      {opt.cash_impact > 0 ? '+' : ''}₹{opt.cash_impact.toLocaleString()}
                    </span>
                  </div>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>Timeline</span>
                    <span className={styles.metricVal}>{opt.cash_impact_days} days</span>
                  </div>
                  <div className={styles.metric} style={{ flex: 1, minWidth: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className={styles.metricLabel}>Confidence</span>
                      <span className={styles.metricVal} style={{ fontSize: 12 }}>{Math.round(opt.confidence * 100)}%</span>
                    </div>
                    <div className={styles.confidenceTrack}>
                      <div className={styles.confidenceFill} style={{ width: `${opt.confidence * 100}%` }} />
                    </div>
                  </div>
                </div>

                <div className={styles.listGroup}>
                  <span className={styles.listHeader}>Pros</span>
                  <ul className={styles.list}>
                    {opt.pros.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
                
                <div className={styles.listGroup}>
                  <span className={styles.listHeader}>Cons</span>
                  <ul className={styles.list}>
                    {opt.cons.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>

                {review && (
                  <div className={styles.criticBox}>
                    <div className={styles.criticTitle}>
                      <ShieldAlert size={14} /> Critic's Warning
                    </div>
                    <strong>{Math.round(review.failure_probability * 100)}% failure risk:</strong> {review.main_risk}. 
                    <br /><em>Weakest assumption: {review.weakest_assumption}</em>
                  </div>
                )}

                <div className={styles.noteInput}>
                  <textarea 
                    placeholder="Add rationale or notes for this option..." 
                    value={optionNotes[opt.id] || ''}
                    onChange={(e) => setOptionNotes(prev => ({...prev, [opt.id]: e.target.value}))}
                    disabled={pkg.status === 'chosen'}
                  />
                </div>

                <div className={styles.actionRow}>
                  <Button 
                    variant={isRecommended ? "primary" : "secondary"} 
                    style={{ width: '100%' }}
                    onClick={() => handleSelectOption(opt.id)}
                    disabled={pkg.status === 'chosen' || chooseMutation.isPending}
                  >
                    {isChosen ? <><Check size={16} style={{ marginRight: 6 }}/> Chosen</> : 'Select this option'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* AI Reasoning Expandable */}
        <div className={styles.reasoningSection}>
          <div className={styles.reasoningHeader} onClick={() => setExpandedReasoning(!expandedReasoning)}>
            <div className={styles.reasoningTitle}>
              <Brain size={16} /> AI Agent Reasoning Chain
            </div>
            {expandedReasoning ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </div>
          
          {expandedReasoning && (
            <div className={styles.reasoningBody}>
              <div className={styles.agentChain}>
                
                <div className={styles.agentStep}>
                  <div className={styles.agentIcon}><Target size={14} /></div>
                  <div className={styles.agentContent}>
                    <div className={styles.agentName}>Agent 1: Risk Analyst (Groq Llama-3.3-70b)</div>
                    <p className={styles.agentText}>
                      <strong>Problem:</strong> {pkg.risk_analysis.problem_statement}<br />
                      <strong>Root Causes:</strong> {pkg.risk_analysis.root_causes.join('; ')}
                    </p>
                  </div>
                </div>

                <div className={styles.agentStep}>
                  <div className={styles.agentIcon}><Zap size={14} /></div>
                  <div className={styles.agentContent}>
                    <div className={styles.agentName}>Agent 2: Strategist (Gemini 1.5 Pro)</div>
                    <p className={styles.agentText}>
                      <strong>Strategy Synthesis:</strong> {pkg.strategy.reasoning}
                    </p>
                  </div>
                </div>

                <div className={styles.agentStep}>
                  <div className={styles.agentIcon}><ShieldAlert size={14} /></div>
                  <div className={styles.agentContent}>
                    <div className={styles.agentName}>Agent 3: Critic (Groq Mixtral-8x7b)</div>
                    <p className={styles.agentText}>
                      Reviewed all 3 options for logical fallacies and business risk. 
                      Highest failure probability found in Option 3 ({Math.round(pkg.critic.reviews.find(r => r.option_id === 'option_3')?.failure_probability || 0 * 100)}%).
                    </p>
                  </div>
                </div>

              </div>

              {/* Data References Grid */}
              <div style={{ marginTop: 16 }}>
                <div className={styles.reasoningTitle} style={{ fontSize: 13, marginBottom: 12 }}>
                  <FileText size={14} /> Source Data References
                </div>
                <div className={styles.refGrid}>
                  {pkg.risk_analysis.key_data_points.map((dp, i) => (
                    <div key={i} className={styles.refCard} onClick={() => handleRefClick(dp)}>
                      <div className={styles.refType}>{dp.entity_type}</div>
                      <div className={styles.refName}>{dp.entity_name}</div>
                      <p className={styles.refDetail}>{dp.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>

      </div>

      {/* Reference Detail Drawer */}
      <Drawer
        isOpen={refDrawerOpen}
        onClose={() => setRefDrawerOpen(false)}
        title="Entity Details"
      >
        {selectedRef && (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <Badge variant="info">{selectedRef.entity_type}</Badge>
            </div>
            <h2 style={{ fontSize: 18, margin: 0, fontWeight: 500, color: 'var(--text-primary)' }}>
              {selectedRef.entity_name}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {selectedRef.detail}
            </p>
            <div style={{ marginTop: 16 }}>
              <Button variant="secondary" style={{ width: '100%' }}>View in Graph</Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* AI Disagreement Modal */}
      <Modal 
        isOpen={disagreementModalOpen} 
        onClose={() => setDisagreementModalOpen(false)}
        title="AI recommends a different approach"
        maxWidth={480}
      >
        <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            {disagreementText}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="ghost" onClick={() => setDisagreementModalOpen(false)}>
              Let me reconsider
            </Button>
            <Button variant="primary" onClick={() => setDisagreementModalOpen(false)}>
              I understand, proceed
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default DecisionCenter;
