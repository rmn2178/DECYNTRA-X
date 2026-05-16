import React from 'react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import styles from './Page.module.css';

const DNA_FACTORS = [
  { factor: 'Receivables age > 14 days', weight: 38, direction: 'critical' },
  { factor: 'Vendor payable due < 5 days', weight: 27, direction: 'warning' },
  { factor: 'Cash runway < 10 days', weight: 22, direction: 'critical' },
  { factor: 'AI accuracy trend positive', weight: 8, direction: 'safe' },
  { factor: 'Borderline customer count', weight: 5, direction: 'warning' },
];

const DecisionDNA: React.FC = () => (
  <div className={styles.page}>
    <div className={styles.content}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Decision DNA</h1>
        <p className={styles.pageSubtitle}>How the AI weighs your cash flow signals</p>
      </div>

      <Card header="Signal Weights">
        <div className={styles.timelineList}>
          {DNA_FACTORS.map((f, i) => (
            <div key={i} className={styles.timelineItem}>
              <div className={styles.timelineDot} />
              <div className={styles.timelineText}>{f.factor}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ width: 80, height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${f.weight * 2.5}%`, height: '100%', background: 'var(--accent)' }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{f.weight}%</span>
                <Badge variant={f.direction as any}>{f.direction}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  </div>
);

export default DecisionDNA;
