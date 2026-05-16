import React, { useState } from 'react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ChatBar from '../components/ui/ChatBar';
import Drawer from '../components/ui/Drawer';
import { TrendingDown, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import styles from './Page.module.css';

const KPI_DATA = [
  { label: 'Cash Runway', value: '8 days', status: 'critical', icon: <TrendingDown size={18} /> },
  { label: 'Overdue Invoices', value: '₹1.3L', status: 'warning', icon: <AlertTriangle size={18} /> },
  { label: 'Decisions Avoided', value: '5', status: 'safe', icon: <CheckCircle size={18} /> },
  { label: 'AI Latency Saved', value: '47h 28m', status: 'pending', icon: <Clock size={18} /> },
];

const ALERTS = [
  { id: 1, title: 'Globex Corp — Invoice overdue by 20 days', severity: 'critical' as const, amount: '₹50,000' },
  { id: 2, title: 'Initech — Invoice overdue by 15 days', severity: 'critical' as const, amount: '₹80,000' },
  { id: 3, title: 'Umbrella Corp — Payment due in 1 day', severity: 'warning' as const, amount: '₹30,000' },
  { id: 4, title: 'Supplier A payable due in 3 days', severity: 'warning' as const, amount: '₹25,000' },
];

const Dashboard: React.FC = () => {
  const [query, setQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<(typeof ALERTS)[0] | null>(null);

  const handleQuery = (v: string) => setQuery(v);

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Dashboard</h1>
          <p className={styles.pageSubtitle}>Prevent SME cash flow crises 10 days before they occur</p>
        </div>

        {/* KPI Row */}
        <div className={styles.kpiGrid}>
          {KPI_DATA.map((k) => (
            <Card key={k.label}>
              <div className={styles.kpiCard}>
                <div className={styles.kpiCardTop}>
                  <span className={styles.kpiIcon}>{k.icon}</span>
                  <Badge variant={k.status as any} dot>{k.status}</Badge>
                </div>
                <div className={styles.kpiValue}>{k.value}</div>
                <div className={styles.kpiLabel}>{k.label}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* Alerts */}
        <Card header="Active Alerts">
          <div className={styles.alertList}>
            {ALERTS.map((a) => (
              <button
                key={a.id}
                className={styles.alertItem}
                onClick={() => { setSelectedAlert(a); setDrawerOpen(true); }}
              >
                <div className={styles.alertLeft}>
                  <Badge variant={a.severity} dot>{a.severity}</Badge>
                  <span className={styles.alertTitle}>{a.title}</span>
                </div>
                <span className={styles.alertAmount}>{a.amount}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* NL query response area */}
        {query && (
          <Card header="AI Response">
            <div className={styles.responseArea}>
              <p className={styles.responseQuery}>You asked: <em>"{query}"</em></p>
              <p className={styles.responseText}>Based on your current cash position of ₹1.2L with ₹1.6L in overdue receivables, a shortfall of ₹40,000 is projected within 8 days. Recommended action: chase Globex Corp immediately and negotiate a 15-day extension with Supplier A.</p>
            </div>
          </Card>
        )}
      </div>

      <ChatBar onSubmit={handleQuery} />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedAlert?.title}
      >
        {selectedAlert && (
          <div className={styles.drawerContent}>
            <div className={styles.drawerRow}>
              <span className={styles.drawerKey}>Amount</span>
              <span className={styles.drawerVal}>{selectedAlert.amount}</span>
            </div>
            <div className={styles.drawerRow}>
              <span className={styles.drawerKey}>Risk Level</span>
              <Badge variant={selectedAlert.severity}>{selectedAlert.severity}</Badge>
            </div>
            <div className={styles.drawerActions}>
              <Button variant="primary">Draft Reminder</Button>
              <Button variant="secondary">View Invoice</Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default Dashboard;
