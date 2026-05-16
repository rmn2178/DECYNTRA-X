import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';
import api from '../lib/axios';
import useStore from '../store';
import useCountUp from '../lib/useCountUp';
import pageStyles from './Page.module.css';
import styles from './Impact.module.css';

interface OutcomeEvaluation {
  decision_id: string;
  projected_cash_delta: number;
  actual_cash_delta: number;
  impact_score: number;
  financial_delta: number;
  success_label: string;
}

interface SystemValue {
  org_id: string;
  total_cash_saved: number;
  risks_prevented_count: number;
  avg_decision_latency_ms: number;
  ai_accuracy_pct: number;
  decision_speed_improvement_vs_baseline: number;
  recent_outcomes: OutcomeEvaluation[];
}

const MOCK_SUMMARY: SystemValue = {
  org_id: 'org-1',
  total_cash_saved: 150000,
  risks_prevented_count: 6,
  avg_decision_latency_ms: 900000,
  ai_accuracy_pct: 78,
  decision_speed_improvement_vs_baseline: 89,
  recent_outcomes: [
    { decision_id: 'dec-1', projected_cash_delta: 65000, actual_cash_delta: 72000, impact_score: 82, financial_delta: 7000, success_label: 'under-estimated' },
    { decision_id: 'dec-2', projected_cash_delta: 30000, actual_cash_delta: 29000, impact_score: 92, financial_delta: -1000, success_label: 'accurate' },
    { decision_id: 'dec-3', projected_cash_delta: 120000, actual_cash_delta: 90000, impact_score: 68, financial_delta: -30000, success_label: 'over-estimated' },
  ],
};

const fmtLatency = (ms: number) => {
  if (!ms) return '—';
  const hours = ms / 3600000;
  return hours >= 1 ? `${hours.toFixed(1)}h` : `${Math.round(ms / 60000)}m`;
};

const Impact: React.FC = () => {
  const org = useStore((s) => s.org);
  const orgId = org?.id || 'org-1';

  const { data: summary = MOCK_SUMMARY } = useQuery<SystemValue>({
    queryKey: ['impact-summary', orgId],
    queryFn: () => api.get(`/api/outcomes/summary/${orgId}`).then(r => r.data),
    retry: false,
  });

  const cashSaved = useCountUp(summary.total_cash_saved, { durationMs: 1400 });
  const accuracyValue = summary.ai_accuracy_pct;
  const speedRatio = Math.min(100, Math.max(0, summary.decision_speed_improvement_vs_baseline));

  const radialData = [{ name: 'Accuracy', value: accuracyValue, fill: '#0EA5E9' }];

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.content}>
        <div className={pageStyles.pageHeader}>
          <h1 className={pageStyles.pageTitle}>Impact</h1>
          <p className={pageStyles.pageSubtitle}>Outcome intelligence across all decisions</p>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.panelTitle}>Outcome Intelligence Engine</div>
              <div className={styles.panelSubtitle}>System value and decision performance</div>
            </div>
          </div>

          <div className={styles.kpiRow}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiValue}>₹{Math.round(cashSaved).toLocaleString()}</div>
              <div className={styles.kpiLabel}>Total cash saved</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiValue}>{summary.risks_prevented_count}</div>
              <div className={styles.kpiLabel}>Risks prevented</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiValue}>{fmtLatency(summary.avg_decision_latency_ms)}</div>
              <div className={styles.kpiLabel}>Avg decision latency</div>
            </div>
          </div>

          <div className={styles.kpiRow}>
            <div className={styles.kpiCard}>
              <div className={styles.radialWrap}>
                <div style={{ width: 120, height: 120 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart innerRadius="70%" outerRadius="100%" data={radialData} startAngle={90} endAngle={-270}>
                      <RadialBar dataKey="value" cornerRadius={10} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <div className={styles.radialValue}>{accuracyValue}%</div>
                  <div className={styles.kpiLabel}>AI accuracy</div>
                </div>
              </div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiValue}>{speedRatio}%</div>
              <div className={styles.kpiLabel}>Decision speed improvement</div>
              <div className={styles.ratioBar}>
                <div className={styles.ratioFill} style={{ width: `${speedRatio}%` }} />
              </div>
              <div className={styles.kpiLabel}>5 min avg vs 48hr baseline</div>
            </div>
          </div>

          <div>
            <div className={styles.panelTitle} style={{ fontSize: 13 }}>Per-decision outcomes</div>
            <table className={styles.outcomeTable}>
              <thead>
                <tr>
                  <th>Decision</th>
                  <th>Predicted</th>
                  <th>Actual</th>
                  <th>Variance</th>
                  <th>Label</th>
                </tr>
              </thead>
              <tbody>
                {summary.recent_outcomes.map((o) => (
                  <tr key={o.decision_id}>
                    <td>{o.decision_id}</td>
                    <td>₹{Math.round(o.projected_cash_delta).toLocaleString()}</td>
                    <td>₹{Math.round(o.actual_cash_delta).toLocaleString()}</td>
                    <td>₹{Math.round(o.financial_delta).toLocaleString()}</td>
                    <td><span className={styles.outcomeLabel}>{o.success_label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Impact;
