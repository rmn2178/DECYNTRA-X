import React from 'react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import styles from './Page.module.css';

const PATTERNS = [
  { pattern: 'Globex Corp consistently pays 18–25 days late in Q4', confidence: 91, type: 'warning' },
  { pattern: 'Supplier A offers flexible terms when contacted before due date', confidence: 87, type: 'safe' },
  { pattern: 'Umbrella Corp has 60% chance of borderline-to-overdue transition', confidence: 74, type: 'warning' },
  { pattern: 'Early-pay discounts accelerated Initech payments by avg 12 days', confidence: 83, type: 'safe' },
];

const Memory: React.FC = () => (
  <div className={styles.page}>
    <div className={styles.content}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Memory</h1>
        <p className={styles.pageSubtitle}>Learned patterns from past decisions and outcomes</p>
      </div>

      <Card header="Pattern Library">
        <div className={styles.timelineList}>
          {PATTERNS.map((p, i) => (
            <div key={i} className={styles.timelineItem}>
              <div className={styles.timelineDot} />
              <div className={styles.timelineText}>{p.pattern}</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <Badge variant={p.type as any}>{p.confidence}%</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card header="Outcome Feedback">
        <div className={styles.messageBubble}>
          Approved action "Chase Globex Corp" on May 10 resulted in payment received on May 14 (4 days).
          This outcome improved AI confidence for similar patterns by +3%.
        </div>
      </Card>
    </div>
  </div>
);

export default Memory;
