import React, { useState } from 'react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ProgressBar from '../components/ui/ProgressBar';
import Modal from '../components/ui/Modal';
import ChatBar from '../components/ui/ChatBar';
import styles from './Page.module.css';

const STAGES = [
  { label: 'Data Fetch', done: true },
  { label: 'Graph Build', done: true },
  { label: 'AI Analysis', done: true, active: true },
  { label: 'Package Ready', done: false },
];

const PACKAGES = [
  { id: 'pkg-1', title: 'Chase Globex Corp immediately', impact: '+₹50,000 within 5 days', confidence: 94, status: 'safe' },
  { id: 'pkg-2', title: 'Delay Supplier A payment by 7 days', impact: 'Preserves ₹25,000 buffer', confidence: 88, status: 'warning' },
  { id: 'pkg-3', title: 'Offer Initech 2% early-pay discount', impact: 'Accelerates ₹80,000 inflow', confidence: 79, status: 'pending' },
];

const DecisionCenter: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Decision Center</h1>
          <p className={styles.pageSubtitle}>AI-generated decision packages for your cash flow</p>
        </div>

        <Card header="Generation Progress">
          <ProgressBar stages={STAGES} />
        </Card>

        {PACKAGES.map((pkg) => (
          <Card
            key={pkg.id}
            header={<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{pkg.title}</span>
              <Badge variant={pkg.status as any}>{pkg.confidence}% confident</Badge>
            </div>}
            footer={
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  variant="primary" size="sm"
                  onClick={() => { setChosen(pkg.id); setModalOpen(true); }}
                >
                  Choose This
                </Button>
                <Button variant="ghost" size="sm">View Details</Button>
              </div>
            }
          >
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{pkg.impact}</p>
          </Card>
        ))}
      </div>

      <ChatBar onSubmit={(q) => console.log('Decision query:', q)} placeholder="Ask about a specific decision…" />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Confirm Decision"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => { setModalOpen(false); }}>Approve & Execute</Button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
          You are about to approve a decision package. This will add the corresponding action to your execution queue and update the decision log. Are you sure?
        </p>
        {chosen && (
          <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-page)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)' }}>
            Package: <strong style={{ color: 'var(--text-primary)' }}>{PACKAGES.find(p => p.id === chosen)?.title}</strong>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DecisionCenter;
