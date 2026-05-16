import React from 'react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import styles from './Page.module.css';

const LOGS = [
  { id: 'dec-001', action: 'Chase Globex Corp', outcome: 'Payment received', ts: '2026-05-14 09:31', status: 'safe' },
  { id: 'dec-002', action: 'Defer Supplier B payment', outcome: 'Deferred 7 days', ts: '2026-05-13 14:10', status: 'pending' },
  { id: 'dec-003', action: 'Early-pay offer to Initech', outcome: 'Accepted — inflow in 3 days', ts: '2026-05-12 11:05', status: 'safe' },
  { id: 'dec-004', action: 'Watch Umbrella Corp', outcome: 'Still borderline', ts: '2026-05-10 08:44', status: 'warning' },
];

const AuditLog: React.FC = () => (
  <div className={styles.page}>
    <div className={styles.content}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Audit Log</h1>
        <p className={styles.pageSubtitle}>Complete decision and outcome history</p>
      </div>

      <Card header={`${LOGS.length} decisions logged`}>
        <div className={styles.timelineList}>
          {LOGS.map((l) => (
            <div key={l.id} className={styles.timelineItem}>
              <div className={styles.timelineDot} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className={styles.timelineText}>{l.action}</span>
                  <span className={styles.timelineDate}>{l.ts}</span>
                </div>
                <div style={{ marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Outcome: </span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l.outcome}</span>
                </div>
              </div>
              <Badge variant={l.status as any}>{l.status}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  </div>
);

export default AuditLog;
