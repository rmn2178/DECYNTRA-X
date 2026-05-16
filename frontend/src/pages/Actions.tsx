import React, { useState } from 'react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import styles from './Page.module.css';

const QUEUE = [
  { id: 'a1', action: 'Send payment reminder to Globex Corp', status: 'pending', due: 'Today' },
  { id: 'a2', action: 'Negotiate extension with Supplier A', status: 'pending', due: 'Tomorrow' },
  { id: 'a3', action: 'Follow up Initech on overdue invoice', status: 'pending', due: 'Today' },
  { id: 'a4', action: 'Draft early-pay offer to Umbrella Corp', status: 'pending', due: 'In 2 days' },
];

const Actions: React.FC = () => {
  const [queue, setQueue] = useState(QUEUE);

  const approve = (id: string) =>
    setQueue((q) => q.map((a) => a.id === id ? { ...a, status: 'approved' } : a));

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Actions</h1>
          <p className={styles.pageSubtitle}>Execution queue — approve and dispatch actions</p>
        </div>

        <Card header={`Queue (${queue.filter(a => a.status === 'pending').length} pending)`}>
          <div className={styles.alertList}>
            {queue.map((a) => (
              <div key={a.id} className={styles.alertItem} style={{ cursor: 'default' }}>
                <div className={styles.alertLeft}>
                  <Badge variant={a.status === 'approved' ? 'safe' : 'pending'}>{a.status}</Badge>
                  <div>
                    <div className={styles.alertTitle}>{a.action}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Due: {a.due}</div>
                  </div>
                </div>
                {a.status === 'pending' && (
                  <Button variant="primary" size="sm" onClick={() => approve(a.id)}>Approve</Button>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card header="Weekly Brief Preview">
          <div className={styles.messageBubble}>
            <strong>This week's cash flow summary:</strong> You have ₹1.3L in overdue receivables across 3 customers.
            Supplier A payment of ₹25,000 is due in 3 days. Recommend prioritising Globex Corp chase and deferring
            non-critical vendor payments by 7 days to maintain a safe buffer of ₹40,000+.
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Actions;
