import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import api from '../lib/axios';
import pageStyles from './Page.module.css';
import styles from './Actions.module.css';

interface EmailDraft {
  subject: string;
  body: string;
  recipient_email: string;
  tone: 'polite' | 'firm';
  invoice_id?: string | null;
  vendor_id?: string | null;
}

interface ActionQueueItem {
  id: string;
  action_type: string;
  payload: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected' | 'sent';
  approved_by?: string | null;
  org_id: string;
  created_at: string;
  updated_at?: string | null;
  rejection_reason?: string | null;
  draft?: EmailDraft | null;
}

interface WeeklyBrief {
  headline: string;
  cash_summary: string;
  top_risks: string[];
  top_opportunities: string[];
  pending_actions: string[];
  kpi_highlights: string;
  next_week_forecast: string;
}

const MOCK_QUEUE: ActionQueueItem[] = [
  {
    id: 'a1',
    action_type: 'draft_reminder',
    payload: {
      subject: 'Payment reminder for INV-2024-089',
      body: 'Hello, this is a friendly reminder that invoice INV-2024-089 is overdue. Please confirm payment timing.',
      recipient_email: 'ap@globex.com',
      tone: 'firm',
      invoice_id: 'inv-089',
    },
    status: 'pending',
    org_id: 'org-1',
    created_at: new Date().toISOString(),
    draft: {
      subject: 'Payment reminder for INV-2024-089',
      body: 'Hello, this is a friendly reminder that invoice INV-2024-089 is overdue. Please confirm payment timing.',
      recipient_email: 'ap@globex.com',
      tone: 'firm',
      invoice_id: 'inv-089',
    },
  },
  {
    id: 'a2',
    action_type: 'draft_vendor_delay',
    payload: {
      subject: 'Request to extend payment terms',
      body: 'We request a 7-day extension on the upcoming payment while we stabilize cash flow.',
      recipient_email: 'billing@supplier-a.com',
      tone: 'polite',
      vendor_id: 'vendor-1',
    },
    status: 'pending',
    org_id: 'org-1',
    created_at: new Date().toISOString(),
    draft: {
      subject: 'Request to extend payment terms',
      body: 'We request a 7-day extension on the upcoming payment while we stabilize cash flow.',
      recipient_email: 'billing@supplier-a.com',
      tone: 'polite',
      vendor_id: 'vendor-1',
    },
  },
];

const MOCK_BRIEF: WeeklyBrief = {
  headline: 'Cash risk elevated but manageable with targeted actions',
  cash_summary: '₹1.3L in overdue receivables across 3 customers; vendor payables due in 7 days.',
  top_risks: ['Globex payment delay', 'Supplier A payable', 'Sales dip in core segment'],
  top_opportunities: ['Early-pay discount to top customers', 'Renegotiate Net-45 with suppliers', 'Accelerate collections on 2 invoices'],
  pending_actions: ['Decision pkg-123 pending approval', 'Draft reminder queued for Globex'],
  kpi_highlights: 'AI accuracy 78%, decision latency down to 15 minutes',
  next_week_forecast: 'Expect mid-week cash dip with recovery after collections on Thursday.',
};

const Actions: React.FC = () => {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [edited, setEdited] = useState<Record<string, string>>({});

  const { data: queue = MOCK_QUEUE } = useQuery<ActionQueueItem[]>({
    queryKey: ['execution-queue'],
    queryFn: () => api.get('/api/execute/queue').then(r => r.data),
    retry: false,
  });

  const { data: brief = MOCK_BRIEF } = useQuery<WeeklyBrief>({
    queryKey: ['weekly-brief'],
    queryFn: () => api.get('/api/execute/weekly-brief').then(r => r.data),
    retry: false,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post('/api/execute/approve', { action_id: id }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['execution-queue'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post('/api/execute/reject', { action_id: id, reason }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['execution-queue'] }),
  });

  const pendingCount = queue.filter((q) => q.status === 'pending').length;
  const history = queue.filter((q) => q.status !== 'pending');

  const actionTitle = (item: ActionQueueItem) => {
    if (item.action_type === 'draft_reminder') return 'Payment reminder draft';
    if (item.action_type === 'draft_vendor_delay') return 'Vendor delay request draft';
    return 'Queued action';
  };

  const saveEdit = (id: string, text: string) =>
    setEdited((s) => ({ ...s, [id]: text }));

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.content}>
        <div className={pageStyles.pageHeader}>
          <h1 className={pageStyles.pageTitle}>Actions</h1>
          <p className={pageStyles.pageSubtitle}>Autonomous execution queue — review, edit, and approve drafts</p>
        </div>

        <Card header={`Queued Drafts (${pendingCount} pending)`}>
          <div className={styles.queueGrid}>
            {queue.filter((q) => q.status === 'pending').map((item) => (
              <div key={item.id} className={styles.draftCard}>
                <div className={styles.draftHeader}>
                  <div>
                    <div className={styles.draftTitle}>{actionTitle(item)}</div>
                    <div className={styles.draftMeta}>{item.draft?.recipient_email || 'recipient@company.com'}</div>
                  </div>
                  <Badge variant="pending">pending</Badge>
                </div>

                <div className={styles.subjectLine}><strong>Subject:</strong> {item.draft?.subject}</div>

                <div className={styles.bodyWrap}>
                  <div
                    className={`${styles.bodyEditable} ${expanded[item.id] ? styles.bodyExpanded : styles.bodyCollapsed}`}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => saveEdit(item.id, (e.target as HTMLDivElement).innerText)}
                  >
                    {edited[item.id] ?? item.draft?.body}
                  </div>
                  <button
                    className={styles.expandBtn}
                    onClick={() => setExpanded((s) => ({ ...s, [item.id]: !s[item.id] }))}
                  >
                    {expanded[item.id] ? 'Collapse' : 'Expand to read'}
                  </button>
                </div>

                <div className={styles.actionRow}>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => approveMutation.mutate(item.id)}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => rejectMutation.mutate({ id: item.id, reason: 'Not appropriate at this time' })}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card header="Weekly Brief">
          <div className={styles.briefCard}>
            <div className={styles.briefHeadline}>{brief.headline}</div>
            <div className={styles.briefSection}>
              <button className={styles.briefToggle} onClick={() => setExpanded((s) => ({ ...s, brief_cash: !s.brief_cash }))}>
                Cash Summary
              </button>
              {expanded.brief_cash && <div className={styles.briefBody}>{brief.cash_summary}</div>}
            </div>
            <div className={styles.briefSection}>
              <button className={styles.briefToggle} onClick={() => setExpanded((s) => ({ ...s, brief_risks: !s.brief_risks }))}>
                Top Risks
              </button>
              {expanded.brief_risks && (
                <ul className={styles.briefList}>
                  {brief.top_risks.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              )}
            </div>
            <div className={styles.briefSection}>
              <button className={styles.briefToggle} onClick={() => setExpanded((s) => ({ ...s, brief_ops: !s.brief_ops }))}>
                Top Opportunities
              </button>
              {expanded.brief_ops && (
                <ul className={styles.briefList}>
                  {brief.top_opportunities.map((o, i) => <li key={i}>{o}</li>)}
                </ul>
              )}
            </div>
            <div className={styles.briefSection}>
              <button className={styles.briefToggle} onClick={() => setExpanded((s) => ({ ...s, brief_actions: !s.brief_actions }))}>
                Pending Actions
              </button>
              {expanded.brief_actions && (
                <ul className={styles.briefList}>
                  {brief.pending_actions.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              )}
            </div>
            <div className={styles.briefSection}>
              <button className={styles.briefToggle} onClick={() => setExpanded((s) => ({ ...s, brief_kpi: !s.brief_kpi }))}>
                KPI Highlights
              </button>
              {expanded.brief_kpi && <div className={styles.briefBody}>{brief.kpi_highlights}</div>}
            </div>
            <div className={styles.briefSection}>
              <button className={styles.briefToggle} onClick={() => setExpanded((s) => ({ ...s, brief_forecast: !s.brief_forecast }))}>
                Next Week Forecast
              </button>
              {expanded.brief_forecast && <div className={styles.briefBody}>{brief.next_week_forecast}</div>}
            </div>
          </div>
        </Card>

        <Card header="Action History">
          <table className={styles.historyTable}>
            <thead>
              <tr>
                <th>Action</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {history.length ? history.map((h) => (
                <tr key={h.id}>
                  <td>{actionTitle(h)}</td>
                  <td><Badge variant={h.status === 'approved' ? 'safe' : h.status === 'rejected' ? 'warning' : 'info'}>{h.status}</Badge></td>
                  <td>{h.updated_at ? new Date(h.updated_at).toLocaleDateString() : '—'}</td>
                </tr>
              )) : (
                <tr><td colSpan={3} className={styles.emptyCell}>No completed actions yet</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
};

export default Actions;
