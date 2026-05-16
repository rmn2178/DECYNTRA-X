import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import api from '../lib/axios';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ChatBar from '../components/ui/ChatBar';
import Drawer from '../components/ui/Drawer';
import SkeletonLoader from '../components/ui/SkeletonLoader';
import { TrendingDown, AlertTriangle, CheckCircle, Clock, Zap, Brain, TrendingUp, ShieldAlert } from 'lucide-react';
import styles from './Dashboard.module.css';

// ── Types ────────────────────────────────────────────────────────────
interface DailyBalance { date: string; balance: number; inflow: number; outflow: number; note: string }
interface CashRunway { daily_balances: DailyBalance[]; days_until_danger: number; danger_threshold: number; current_balance: number }
interface OverdueInvoice { invoice_id: string; customer_name: string; amount: number; due_date: string; days_overdue: number }
interface UpcomingPayable { vendor_id: string; vendor_name: string; amount: number; due_date: string; days_until_due: number }
interface TriggerItem { source_type: string; source_id: string; label: string; amount: number; urgency: string }
interface ShortfallSignal { severity: string; days_until_shortfall: number; amount: number; trigger_items: TriggerItem[] }

// Anomaly types
interface PaymentAnomaly { customer_id: string; customer_name: string; avg_payment_cycle_days: number; stddev_days: number; current_days_out: number; deviation_score: number; groq_summary: string; severity: string }
interface SalesDrop { current_7day_avg: number; prior_7day_avg: number; drop_pct: number; flagged: boolean; groq_narrative: string }
interface VendorRisk { vendor_id: string; vendor_name: string; score: number; risk_level: string }
interface RiskSignal { signal_id: string; severity: string; anomaly_count: number; payment_anomalies: PaymentAnomaly[]; sales_drop: SalesDrop | null; vendor_risks: VendorRisk[]; generated_at: string }

// ── Mocks (used when API offline) ────────────────────────────────────
const MOCK_RUNWAY: CashRunway = {
  current_balance: 120000, danger_threshold: 40000, days_until_danger: 8,
  daily_balances: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() + i * 86400000).toISOString().slice(0, 10),
    balance: Math.max(0, 120000 - i * 5200 + (i === 3 ? 80000 : 0) + (i === 10 ? 50000 : 0)),
    inflow:  i === 3 ? 80000 : i === 10 ? 50000 : 0,
    outflow: 5200,
    note: i === 3 ? 'Globex Corp expected payment' : i === 10 ? 'Initech payment' : '',
  })),
};

const MOCK_OVERDUE: OverdueInvoice[] = [
  { invoice_id: 'i-1', customer_name: 'Globex Corp',  amount: 50000, due_date: '2026-04-26', days_overdue: 20 },
  { invoice_id: 'i-2', customer_name: 'Initech',       amount: 80000, due_date: '2026-05-01', days_overdue: 15 },
  { invoice_id: 'i-3', customer_name: 'Umbrella Corp', amount: 30000, due_date: '2026-05-15', days_overdue: 1  },
];

const MOCK_PAYABLES: UpcomingPayable[] = [
  { vendor_id: 'v-1', vendor_name: 'Supplier A', amount: 25000, due_date: '2026-05-19', days_until_due: 3 },
  { vendor_id: 'v-2', vendor_name: 'Supplier B', amount: 18000, due_date: '2026-05-22', days_until_due: 6 },
  { vendor_id: 'v-3', vendor_name: 'Supplier C', amount: 12000, due_date: '2026-05-23', days_until_due: 7 },
];

const MOCK_SHORTFALL: ShortfallSignal = {
  severity: 'critical', days_until_shortfall: 8, amount: -43000,
  trigger_items: [
    { source_type: 'invoice', source_id: 'i-1', label: 'Globex Corp — overdue 20d', amount: -50000, urgency: 'critical' },
    { source_type: 'invoice', source_id: 'i-2', label: 'Initech — overdue 15d',     amount: -80000, urgency: 'critical' },
    { source_type: 'payable', source_id: 'v-1', label: 'Supplier A — due in 3d',    amount:  25000, urgency: 'warning'  },
  ],
};

const MOCK_RISK_SIGNAL: RiskSignal = {
  signal_id: 'mock-signal-001',
  severity: 'critical',
  anomaly_count: 3,
  generated_at: new Date().toISOString(),
  payment_anomalies: [
    {
      customer_id: 'c-1',
      customer_name: 'Globex Corp',
      avg_payment_cycle_days: 14.0,
      stddev_days: 4.2,
      current_days_out: 20,
      deviation_score: 1.43,
      groq_summary: 'Globex Corp is 6 days beyond their historical payment cycle, putting ₹50,000 in receivables at immediate risk of default.',
      severity: 'critical',
    },
    {
      customer_id: 'c-2',
      customer_name: 'Initech',
      avg_payment_cycle_days: 12.0,
      stddev_days: 3.1,
      current_days_out: 15,
      deviation_score: 0.97,
      groq_summary: 'Initech has exceeded their average payment timeline by 3 days, raising concerns about their liquidity position.',
      severity: 'warning',
    },
  ],
  sales_drop: {
    current_7day_avg: 45000,
    prior_7day_avg: 62000,
    drop_pct: 27.4,
    flagged: true,
    groq_narrative: 'A 27.4% week-over-week revenue decline signals a demand contraction that could accelerate the projected cash shortfall by 4–5 days if unchecked.',
  },
  vendor_risks: [
    { vendor_id: 'v-1', vendor_name: 'Supplier A', score: 68, risk_level: 'high' },
    { vendor_id: 'v-2', vendor_name: 'Supplier B', score: 42, risk_level: 'medium' },
    { vendor_id: 'v-3', vendor_name: 'Supplier C', score: 18, risk_level: 'low' },
  ],
};

// ── Custom tooltip for the AreaChart ─────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as DailyBalance;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipDate}>{label}</div>
      <div className={styles.tooltipRow}>
        <span>Balance</span>
        <strong>₹{d.balance.toLocaleString()}</strong>
      </div>
      {d.inflow > 0 && (
        <div className={styles.tooltipRow}>
          <span style={{ color: '#22C55E' }}>Inflow</span>
          <strong style={{ color: '#22C55E' }}>+₹{d.inflow.toLocaleString()}</strong>
        </div>
      )}
      {d.outflow > 0 && (
        <div className={styles.tooltipRow}>
          <span style={{ color: '#EF4444' }}>Outflow</span>
          <strong style={{ color: '#EF4444' }}>-₹{d.outflow.toLocaleString()}</strong>
        </div>
      )}
      {d.note && <div className={styles.tooltipNote}>{d.note}</div>}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────
const Dashboard: React.FC = () => {
  const [chartDrawerOpen, setChartDrawerOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DailyBalance | null>(null);
  const [triggerDrawerOpen, setTriggerDrawerOpen] = useState(false);
  const [selectedTrigger, setSelectedTrigger] = useState<TriggerItem | null>(null);
  const [nlQuery, setNlQuery] = useState('');
  const [decisionTarget, setDecisionTarget] = useState<string | null>(null);

  const { data: runway = MOCK_RUNWAY, isLoading: runwayLoading } =
    useQuery<CashRunway>({ queryKey: ['cash-runway'], queryFn: () => api.get('/api/analytics/cash-runway').then(r => r.data), retry: false });

  const { data: overdue = MOCK_OVERDUE } =
    useQuery<OverdueInvoice[]>({ queryKey: ['overdue'], queryFn: () => api.get('/api/analytics/overdue').then(r => r.data), retry: false });

  const { data: payables = MOCK_PAYABLES } =
    useQuery<UpcomingPayable[]>({ queryKey: ['payables'], queryFn: () => api.get('/api/analytics/payables').then(r => r.data), retry: false });

  const { data: shortfall = MOCK_SHORTFALL } =
    useQuery<ShortfallSignal>({ queryKey: ['shortfall'], queryFn: () => api.get('/api/analytics/shortfall').then(r => r.data), retry: false });

  const { data: riskSignal = MOCK_RISK_SIGNAL, isLoading: riskLoading } =
    useQuery<RiskSignal>({ queryKey: ['risk-signal'], queryFn: () => api.get('/api/anomaly/risk-signal').then(r => r.data), retry: false, staleTime: 1000 * 60 * 15 });

  const handleChartClick = (data: any) => {
    if (data?.activePayload?.[0]) {
      setSelectedDay(data.activePayload[0].payload);
      setChartDrawerOpen(true);
    }
  };

  const openTrigger = (item: TriggerItem) => {
    setSelectedTrigger(item);
    setTriggerDrawerOpen(true);
  };

  // Determine area chart gradient colour based on severity
  const chartColor = shortfall.severity === 'critical' ? '#EF4444'
    : shortfall.severity === 'warning' ? '#F59E0B'
    : '#22C55E';

  return (
    <div className={styles.page}>

      {/* ── Shortfall Banner ─────────────────────────────────────────── */}
      {shortfall.severity !== 'safe' && (
        <div className={`${styles.banner} ${styles[`banner_${shortfall.severity}`]}`}>
          <div className={styles.bannerLeft}>
            <AlertTriangle size={14} />
            <span>
              <strong>Cash shortfall in {shortfall.days_until_shortfall} days</strong>
              {' — '}₹{Math.abs(shortfall.amount).toLocaleString()} {shortfall.amount < 0 ? 'deficit' : 'buffer'}
            </span>
          </div>
          <div className={styles.bannerTriggers}>
            {shortfall.trigger_items.map((t) => (
              <button
                key={t.source_id}
                className={`${styles.bannerChip} ${styles[`chip_${t.urgency}`]}`}
                onClick={() => openTrigger(t)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.content}>

        {/* ── KPI Strip ────────────────────────────────────────────────── */}
        <div className={styles.kpiStrip}>
          <div className={styles.kpiItem}>
            <Zap size={13} className={styles.kpiStripIcon} />
            <span className={styles.kpiStripLabel}>Decision latency</span>
            <span className={styles.kpiStripValue}>5 min</span>
            <span className={styles.kpiStripBaseline}>vs 48hr baseline</span>
          </div>
          <div className={styles.kpiDivider} />
          <div className={styles.kpiItem}>
            <Clock size={13} className={styles.kpiStripIcon} />
            <span className={styles.kpiStripLabel}>Risk detected</span>
            <span className={styles.kpiStripValue}>{runway.days_until_danger} days</span>
            <span className={styles.kpiStripBaseline}>before crisis</span>
          </div>
          <div className={styles.kpiDivider} />
          <div className={styles.kpiItem}>
            <CheckCircle size={13} className={styles.kpiStripIcon} />
            <span className={styles.kpiStripLabel}>Saved this month</span>
            <span className={styles.kpiStripValue}>₹1.5L</span>
            <span className={styles.kpiStripBaseline}>5 bad decisions avoided</span>
          </div>
          <div className={styles.kpiDivider} />
          <div className={styles.kpiItem}>
            <TrendingDown size={13} className={styles.kpiStripIcon} />
            <span className={styles.kpiStripLabel}>AI accuracy</span>
            <span className={styles.kpiStripValue}>92%</span>
            <span className={styles.kpiStripBaseline}>↑ from 0% baseline</span>
          </div>
        </div>

        {/* ── Cash Runway Chart ─────────────────────────────────────────── */}
        <Card
          header={
            <div className={styles.cardHeaderRow}>
              <div>
                <span className={styles.cardTitle}>Cash Runway</span>
                <span className={styles.cardSub}> — click any day for invoice/payable detail</span>
              </div>
              <Badge
                variant={shortfall.severity === 'critical' ? 'critical' : shortfall.severity === 'warning' ? 'warning' : 'safe'}
                dot
              >
                {runway.days_until_danger === 30 ? 'Safe 30d+' : `Danger in ${runway.days_until_danger}d`}
              </Badge>
            </div>
          }
        >
          {runwayLoading ? (
            <SkeletonLoader lines={6} height={16} />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={runway.daily_balances} onClick={handleChartClick}
                margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => v.slice(5)}
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  axisLine={false} tickLine={false}
                  interval={4}
                />
                <YAxis
                  tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  axisLine={false} tickLine={false} width={52}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }} />
                <ReferenceLine
                  y={runway.danger_threshold}
                  stroke="#EF4444"
                  strokeDasharray="4 3"
                  label={{ value: 'Danger', fill: '#EF4444', fontSize: 10, position: 'insideTopRight' }}
                />
                <Area
                  type="monotone" dataKey="balance"
                  stroke={chartColor} strokeWidth={1.5}
                  fill="url(#balanceGrad)"
                  dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: chartColor }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* ── Two-column: Overdue + Payables ───────────────────────────── */}
        <div className={styles.twoCol}>

          {/* Overdue Invoices */}
          <Card header={<span className={styles.cardTitle}>Overdue Invoices</span>}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Overdue</th>
                </tr>
              </thead>
              <tbody>
                {overdue.map((inv) => (
                  <tr key={inv.invoice_id}>
                    <td>{inv.customer_name}</td>
                    <td className={styles.mono}>₹{inv.amount.toLocaleString()}</td>
                    <td>
                      <Badge variant={inv.days_overdue > 14 ? 'critical' : 'warning'} dot>
                        {inv.days_overdue}d
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Upcoming Payables */}
          <Card header={<span className={styles.cardTitle}>Upcoming Payables</span>}>
            <div className={styles.payableList}>
              {payables.map((p) => (
                <div key={p.vendor_id} className={styles.payableRow}>
                  <div>
                    <div className={styles.payableVendor}>{p.vendor_name}</div>
                    <div className={styles.payableDate}>{p.due_date}</div>
                  </div>
                  <div className={styles.payableRight}>
                    <span className={styles.mono}>₹{p.amount.toLocaleString()}</span>
                    <Badge variant={p.days_until_due <= 3 ? 'critical' : p.days_until_due <= 6 ? 'warning' : 'info'}>
                      {p.days_until_due}d
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ── Anomaly Alerts ──────────────────────────────────────────── */}
        <div className={styles.sectionHeader}>
          <ShieldAlert size={15} className={styles.sectionIcon} />
          <span>Anomaly Alerts</span>
          <Badge variant={riskSignal.severity === 'critical' ? 'critical' : riskSignal.severity === 'warning' ? 'warning' : 'safe'} dot>
            {riskSignal.anomaly_count} detected
          </Badge>
        </div>

        {riskLoading ? (
          <SkeletonLoader lines={4} height={16} />
        ) : (
          <div className={styles.anomalyList}>

            {/* Payment anomaly cards */}
            {riskSignal.payment_anomalies.map((a) => (
              <div key={a.customer_id} className={`${styles.anomalyCard} ${styles[`anomaly_${a.severity}`]}`}>
                <div className={styles.anomalyCardHeader}>
                  <div className={styles.anomalyCardLeft}>
                    <TrendingDown size={14} className={styles.anomalyIcon} />
                    <span className={styles.anomalyTitle}>{a.customer_name} — Payment Delay</span>
                  </div>
                  <Badge variant={a.severity === 'critical' ? 'critical' : a.severity === 'warning' ? 'warning' : 'info'} dot>
                    {a.severity}
                  </Badge>
                </div>
                <p className={styles.anomalyNarrative}>{a.groq_summary}</p>
                <div className={styles.anomalyMeta}>
                  <span className={styles.anomalyMetaItem}>
                    Avg cycle: {a.avg_payment_cycle_days}d
                  </span>
                  <span className={styles.anomalyMetaItem}>
                    Current: {a.current_days_out}d out
                  </span>
                  <span className={styles.anomalyMetaItem}>
                    {a.deviation_score.toFixed(1)}σ deviation
                  </span>
                </div>
                <div className={styles.anomalyActions}>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setDecisionTarget(`payment:${a.customer_id}:${riskSignal.signal_id}`)}
                  >
                    <Brain size={13} style={{ marginRight: 5 }} />
                    Generate Decision
                  </Button>
                  <Button variant="ghost" size="sm">View History</Button>
                </div>
              </div>
            ))}

            {/* Sales drop card */}
            {riskSignal.sales_drop && (
              <div className={`${styles.anomalyCard} ${styles.anomaly_warning}`}>
                <div className={styles.anomalyCardHeader}>
                  <div className={styles.anomalyCardLeft}>
                    <TrendingUp size={14} className={styles.anomalyIcon} />
                    <span className={styles.anomalyTitle}>Sales Drop Detected</span>
                  </div>
                  <Badge variant="warning" dot>warning</Badge>
                </div>
                <p className={styles.anomalyNarrative}>{riskSignal.sales_drop.groq_narrative}</p>
                <div className={styles.anomalyMeta}>
                  <span className={styles.anomalyMetaItem}>
                    This week: ₹{riskSignal.sales_drop.current_7day_avg.toLocaleString()}
                  </span>
                  <span className={styles.anomalyMetaItem}>
                    Prior week: ₹{riskSignal.sales_drop.prior_7day_avg.toLocaleString()}
                  </span>
                  <span className={`${styles.anomalyMetaItem} ${styles.metaDanger}`}>
                    ↓ {riskSignal.sales_drop.drop_pct}%
                  </span>
                </div>
                <div className={styles.anomalyActions}>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setDecisionTarget(`sales:${riskSignal.signal_id}`)}
                  >
                    <Brain size={13} style={{ marginRight: 5 }} />
                    Generate Decision
                  </Button>
                  <Button variant="ghost" size="sm">Analyse Trend</Button>
                </div>
              </div>
            )}

            {/* Vendor risk cards */}
            {riskSignal.vendor_risks.filter(v => v.risk_level !== 'low').map((v) => (
              <div key={v.vendor_id} className={`${styles.anomalyCard} ${styles[`anomaly_${v.risk_level === 'critical' || v.risk_level === 'high' ? 'warning' : 'info'}`]}`}>
                <div className={styles.anomalyCardHeader}>
                  <div className={styles.anomalyCardLeft}>
                    <ShieldAlert size={14} className={styles.anomalyIcon} />
                    <span className={styles.anomalyTitle}>{v.vendor_name} — Vendor Risk</span>
                  </div>
                  <Badge variant={v.risk_level === 'critical' ? 'critical' : v.risk_level === 'high' ? 'warning' : 'info'}>
                    {v.risk_level} · {v.score}/100
                  </Badge>
                </div>
                <p className={styles.anomalyNarrative}>
                  Risk score of {v.score}/100 — high payment concentration and overdue bills warrant closer monitoring.
                </p>
                <div className={styles.anomalyActions}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setDecisionTarget(`vendor:${v.vendor_id}:${riskSignal.signal_id}`)}
                  >
                    <Brain size={13} style={{ marginRight: 5 }} />
                    Generate Decision
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Decision queued notification */}
        {decisionTarget && (
          <div className={styles.decisionQueued}>
            <CheckCircle size={14} />
            <span>Decision queued for <code>{decisionTarget}</code> — navigate to Decision Center to review.</span>
            <button className={styles.decisionDismiss} onClick={() => setDecisionTarget(null)}>×</button>
          </div>
        )}

        {/* NL response */}
        {nlQuery && (
          <Card header="AI Response">
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              You asked: <em>"{nlQuery}"</em>
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7, marginTop: 8 }}>
              Based on current data: cash runway is {runway.days_until_danger} days.
              ₹{overdue.reduce((s, i) => s + i.amount, 0).toLocaleString()} in overdue receivables.
              Recommend chasing Globex Corp immediately and extending Supplier A's payable by 7 days.
            </p>
          </Card>
        )}
      </div>

      <ChatBar onSubmit={setNlQuery} />

      {/* ── Day Detail Drawer ─────────────────────────────────────────── */}
      <Drawer open={chartDrawerOpen} onClose={() => setChartDrawerOpen(false)}
        title={selectedDay ? `${selectedDay.date} — Detail` : 'Day Detail'}>
        {selectedDay && (
          <div className={styles.drawerBody}>
            <div className={styles.drawerStat}>
              <span>Balance</span>
              <strong>₹{selectedDay.balance.toLocaleString()}</strong>
            </div>
            {selectedDay.inflow > 0 && (
              <div className={styles.drawerStat}>
                <span style={{ color: '#22C55E' }}>Expected Inflow</span>
                <strong style={{ color: '#22C55E' }}>+₹{selectedDay.inflow.toLocaleString()}</strong>
              </div>
            )}
            {selectedDay.outflow > 0 && (
              <div className={styles.drawerStat}>
                <span style={{ color: '#EF4444' }}>Projected Outflow</span>
                <strong style={{ color: '#EF4444' }}>-₹{selectedDay.outflow.toLocaleString()}</strong>
              </div>
            )}
            {selectedDay.note && (
              <p className={styles.drawerNote}>{selectedDay.note}</p>
            )}
          </div>
        )}
      </Drawer>

      {/* ── Trigger Detail Drawer ─────────────────────────────────────── */}
      <Drawer open={triggerDrawerOpen} onClose={() => setTriggerDrawerOpen(false)}
        title={selectedTrigger?.label ?? 'Trigger Detail'}>
        {selectedTrigger && (
          <div className={styles.drawerBody}>
            <div className={styles.drawerStat}>
              <span>Type</span>
              <Badge variant="info">{selectedTrigger.source_type}</Badge>
            </div>
            <div className={styles.drawerStat}>
              <span>Amount</span>
              <strong>₹{Math.abs(selectedTrigger.amount).toLocaleString()}</strong>
            </div>
            <div className={styles.drawerStat}>
              <span>Urgency</span>
              <Badge variant={selectedTrigger.urgency as any} dot>{selectedTrigger.urgency}</Badge>
            </div>
            <div className={styles.drawerActions}>
              <Button variant="primary" size="sm">Draft Action</Button>
              <Button variant="secondary" size="sm">View Full Record</Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default Dashboard;
