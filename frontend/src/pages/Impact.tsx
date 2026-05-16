import React from 'react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import styles from './Page.module.css';

const IMPACT_DATA = [
  { metric: 'Cash Risk Detected Days Early', before: 0, after: 10, unit: 'days', status: 'safe' },
  { metric: 'Decision Latency', before: 172800000, after: 900000, unit: 'ms', status: 'safe' },
  { metric: 'AI Accuracy', before: 0, after: 92, unit: '%', status: 'safe' },
  { metric: 'Total Cash Saved', before: 0, after: 150000, unit: '₹', status: 'safe' },
  { metric: 'Bad Decisions Avoided', before: 0, after: 5, unit: '', status: 'safe' },
];

const fmt = (val: number, unit: string) => {
  if (unit === 'ms') return `${(val / 3600000).toFixed(1)}h`;
  if (unit === '₹') return `₹${val.toLocaleString()}`;
  return `${val}${unit}`;
};

const Impact: React.FC = () => (
  <div className={styles.page}>
    <div className={styles.content}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Impact</h1>
        <p className={styles.pageSubtitle}>Before vs. after DECYNTRA-X deployment</p>
      </div>

      <Card header="KPI Improvement Summary">
        <div className={styles.timelineList}>
          {IMPACT_DATA.map((d, i) => (
            <div key={i} className={styles.timelineItem}>
              <div className={styles.timelineDot} />
              <div style={{ flex: 1 }}>
                <div className={styles.timelineText}>{d.metric}</div>
                <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Before: <strong style={{ color: 'var(--text-secondary)' }}>{fmt(d.before, d.unit)}</strong>
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    After: <strong style={{ color: 'var(--text-primary)' }}>{fmt(d.after, d.unit)}</strong>
                  </span>
                </div>
              </div>
              <Badge variant={d.status as any}>improved</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  </div>
);

export default Impact;
