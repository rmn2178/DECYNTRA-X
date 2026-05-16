import React, { useCallback, useEffect, useRef, useState } from 'react';
import ForceGraph2D, { ForceGraphMethods, NodeObject, LinkObject } from 'react-force-graph-2d';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import Drawer from '../components/ui/Drawer';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import ProgressBar from '../components/ui/ProgressBar';
import SkeletonLoader from '../components/ui/SkeletonLoader';
import styles from './KnowledgeGraph.module.css';

// ── Design system colours ────────────────────────────────────────────
const NODE_COLORS: Record<string, string> = {
  Customer:    '#5C6BC0',
  Vendor:      '#F59E0B',
  Invoice:     '#22C55E',   // overdue overridden below
  Transaction: '#9CA3AF',
  BankAccount: '#0D9488',
};

const LINK_COLOR = 'rgba(100,100,100,0.35)';

// ── Types ────────────────────────────────────────────────────────────
interface GraphNode extends NodeObject {
  id: string;
  type: string;
  name?: string;
  status?: string;
  amount?: number;
  dueDate?: string;
  daysPastDue?: number;
  paymentCycleDays?: number;
  [key: string]: unknown;
}

interface GraphLink extends LinkObject {
  source: string;
  target: string;
  type: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// ── Mock data used when API is offline ─────────────────────────────
const MOCK_GRAPH: GraphData = {
  nodes: [
    { id: 'ba-org-1',  type: 'BankAccount', name: 'Main Account' },
    { id: 'c-1', type: 'Customer', name: 'Globex Corp',  paymentCycleDays: 22 },
    { id: 'c-2', type: 'Customer', name: 'Initech',      paymentCycleDays: 18 },
    { id: 'c-3', type: 'Customer', name: 'Umbrella Corp',paymentCycleDays: 9  },
    { id: 'c-4', type: 'Customer', name: 'Acme Corp',    paymentCycleDays: 5  },
    { id: 'c-5', type: 'Customer', name: 'Stark Ind.',   paymentCycleDays: 3  },
    { id: 'v-1', type: 'Vendor',   name: 'Supplier A' },
    { id: 'v-2', type: 'Vendor',   name: 'Supplier B' },
    { id: 'v-3', type: 'Vendor',   name: 'Supplier C' },
    { id: 'i-1', type: 'Invoice',  name: 'INV-001', status: 'overdue',  amount: 50000, daysPastDue: 20 },
    { id: 'i-2', type: 'Invoice',  name: 'INV-002', status: 'overdue',  amount: 80000, daysPastDue: 15 },
    { id: 'i-3', type: 'Invoice',  name: 'INV-003', status: 'overdue',  amount: 30000, daysPastDue: 1  },
    { id: 'i-4', type: 'Invoice',  name: 'INV-004', status: 'upcoming', amount: 15000, daysPastDue: 0  },
    { id: 'i-5', type: 'Invoice',  name: 'INV-005', status: 'paid',     amount: 25000, daysPastDue: 0  },
    { id: 't-1', type: 'Transaction', name: 'TXN-001', amount: -20000 },
    { id: 't-2', type: 'Transaction', name: 'TXN-002', amount:  5000  },
    { id: 't-3', type: 'Transaction', name: 'TXN-003', amount: -20000 },
  ],
  links: [
    { source: 'c-1', target: 'i-1', type: 'OWES' },
    { source: 'c-2', target: 'i-2', type: 'OWES' },
    { source: 'c-3', target: 'i-3', type: 'OWES' },
    { source: 'c-4', target: 'i-4', type: 'OWES' },
    { source: 'c-5', target: 'i-5', type: 'OWES' },
    { source: 'i-5', target: 't-2', type: 'PAID_BY' },
    { source: 'v-1', target: 't-1', type: 'BILLED' },
    { source: 'v-2', target: 't-3', type: 'BILLED' },
    { source: 'ba-org-1', target: 't-2', type: 'RECEIVED' },
    { source: 'c-1', target: 't-1', type: 'HAS_HISTORY' },
  ],
};

// ── Build stages for the ProgressBar ────────────────────────────────
const STAGES = [
  { label: 'Read PostgreSQL', done: false },
  { label: 'Clear Old Graph',  done: false },
  { label: 'Write Nodes',      done: false },
  { label: 'Write Edges',      done: false },
  { label: 'Complete',         done: false },
];

const ALL_TYPES = ['Customer', 'Vendor', 'Invoice', 'Transaction', 'BankAccount'];

const nodeColor = (node: GraphNode): string => {
  if (node.type === 'Invoice') {
    if (node.status === 'overdue') return '#EF4444';
    if (node.status === 'paid')    return '#22C55E';
    return '#60A5FA'; // upcoming
  }
  return NODE_COLORS[node.type] ?? '#9CA3AF';
};

const nodeRadius = (node: GraphNode): number => {
  if (node.type === 'BankAccount') return 12;
  if (node.type === 'Customer')    return 9;
  if (node.type === 'Vendor')      return 8;
  return 6;
};

const badgeVariant = (type: string) => {
  const map: Record<string, any> = {
    Customer: 'pending', Vendor: 'warning', Invoice: 'info',
    Transaction: 'info', BankAccount: 'safe',
  };
  return map[type] ?? 'info';
};

// ── Component ────────────────────────────────────────────────────────
const KnowledgeGraph: React.FC = () => {
  const qc = useQueryClient();
  const graphRef = useRef<ForceGraphMethods>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 500 });

  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set(ALL_TYPES));
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStages, setSyncStages] = useState(STAGES);
  const [graphData, setGraphData] = useState<GraphData>(MOCK_GRAPH);

  // Measure container for responsive canvas
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setDims({ w: el.clientWidth, h: Math.max(480, el.clientHeight) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fetch snapshot
  const { isLoading } = useQuery({
    queryKey: ['graph-snapshot'],
    queryFn: async () => {
      const { data } = await api.get('/api/graph/snapshot');
      if (data.nodes?.length) {
        setGraphData({
          nodes: data.nodes,
          links: data.edges ?? [],
        });
      }
      return data;
    },
    retry: false,
  });

  // Build mutation with staged progress simulation
  const buildMutation = useMutation({
    mutationFn: () => api.post('/api/graph/build'),
    onMutate: () => {
      setSyncing(true);
      setSyncStages(STAGES.map(s => ({ ...s, done: false })));
      // Simulate progressive stages
      STAGES.forEach((_, i) => {
        setTimeout(() => {
          setSyncStages(prev => prev.map((s, j) => j <= i ? { ...s, done: true } : s));
        }, (i + 1) * 700);
      });
    },
    onSuccess: (res) => {
      setTimeout(() => {
        setSyncing(false);
        qc.invalidateQueries({ queryKey: ['graph-snapshot'] });
      }, STAGES.length * 700 + 200);
    },
    onError: () => setSyncing(false),
  });

  // Filter graph data by visible types
  const filteredData = React.useMemo(() => {
    const filteredNodes = graphData.nodes.filter(n => visibleTypes.has(n.type));
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks = graphData.links.filter(
      l => nodeIds.has(l.source as string) && nodeIds.has(l.target as string)
    );
    return { nodes: filteredNodes, links: filteredLinks };
  }, [graphData, visibleTypes]);

  const toggleType = (type: string) => {
    setVisibleTypes(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  };

  const handleNodeClick = useCallback((node: NodeObject) => {
    setSelectedNode(node as GraphNode);
    setDrawerOpen(true);
  }, []);

  const handleNodeCanvasObject = useCallback(
    (node: NodeObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode;
      const r = nodeRadius(n);
      const x = node.x ?? 0;
      const y = node.y ?? 0;

      // Circle
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = nodeColor(n);
      ctx.fill();

      // Ring for selected
      if (selectedNode?.id === n.id) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Label (only when zoomed in)
      if (globalScale >= 1.2) {
        const label = n.name ?? n.id;
        ctx.font = `${11 / globalScale}px Inter, sans-serif`;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.textAlign = 'center';
        ctx.fillText(label, x, y + r + 10 / globalScale);
      }
    },
    [selectedNode]
  );

  return (
    <div className={styles.wrapper}>
      {/* ── Filter sidebar ─────────────────────────────────────── */}
      <aside className={styles.filterBar}>
        <div className={styles.filterTitle}>Node Types</div>
        {ALL_TYPES.map(type => (
          <button
            key={type}
            className={`${styles.typeChip} ${!visibleTypes.has(type) ? styles.typeChipOff : ''}`}
            onClick={() => toggleType(type)}
          >
            <span
              className={styles.typeDot}
              style={{ background: NODE_COLORS[type] ?? '#9CA3AF' }}
            />
            {type}
          </button>
        ))}

        <div className={styles.filterDivider} />

        <div className={styles.legend}>
          <div className={styles.filterTitle}>Relationships</div>
          {['OWES','PAID_BY','BILLED','RECEIVED','HAS_HISTORY'].map(rel => (
            <div key={rel} className={styles.legendItem}>
              <span className={styles.legendLine} />
              <span className={styles.legendLabel}>{rel}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Main canvas area ───────────────────────────────────── */}
      <div className={styles.main}>
        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div>
            <span className={styles.toolbarTitle}>Knowledge Graph</span>
            <span className={styles.toolbarSub}>
              {filteredData.nodes.length} nodes · {filteredData.links.length} edges
            </span>
          </div>
          <Button
            variant="primary"
            size="sm"
            loading={syncing}
            onClick={() => buildMutation.mutate()}
          >
            Sync Graph
          </Button>
        </div>

        {/* Sync progress */}
        {syncing && (
          <div className={styles.progressWrap}>
            <ProgressBar stages={syncStages} />
          </div>
        )}

        {/* Graph canvas */}
        <div className={styles.canvas} ref={containerRef}>
          {isLoading ? (
            <div className={styles.loadingState}><SkeletonLoader lines={5} /></div>
          ) : (
            <ForceGraph2D
              ref={graphRef}
              width={dims.w}
              height={dims.h}
              graphData={filteredData as any}
              nodeCanvasObject={handleNodeCanvasObject}
              nodeCanvasObjectMode={() => 'replace'}
              linkColor={() => LINK_COLOR}
              linkWidth={1.2}
              linkDirectionalArrowLength={5}
              linkDirectionalArrowRelPos={1}
              onNodeClick={handleNodeClick}
              cooldownTicks={80}
              backgroundColor="transparent"
            />
          )}
        </div>
      </div>

      {/* ── Drawer ─────────────────────────────────────────────── */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedNode?.name ?? selectedNode?.id ?? 'Node Detail'}
        width={380}
      >
        {selectedNode && (
          <div className={styles.drawerBody}>
            <div className={styles.drawerType}>
              <Badge variant={badgeVariant(selectedNode.type)}>{selectedNode.type}</Badge>
            </div>

            {/* Properties table */}
            <div className={styles.propsTable}>
              {Object.entries(selectedNode)
                .filter(([k]) => !['x','y','vx','vy','index','__indexColor','id'].includes(k))
                .map(([k, v]) => (
                  <div key={k} className={styles.propRow}>
                    <span className={styles.propKey}>{k}</span>
                    <span className={styles.propVal}>
                      {typeof v === 'number' && k.toLowerCase().includes('amount')
                        ? `₹${v.toLocaleString()}`
                        : String(v ?? '—')}
                    </span>
                  </div>
                ))}
            </div>

            {/* Status badge for invoices */}
            {selectedNode.type === 'Invoice' && selectedNode.status && (
              <div style={{ marginTop: 16 }}>
                <Badge
                  variant={
                    selectedNode.status === 'overdue' ? 'critical'
                    : selectedNode.status === 'paid'   ? 'safe'
                    : 'pending'
                  }
                  dot
                >
                  {selectedNode.status}
                  {selectedNode.daysPastDue ? ` — ${selectedNode.daysPastDue} days past due` : ''}
                </Badge>
              </div>
            )}

            {selectedNode.type === 'Customer' && selectedNode.paymentCycleDays != null && (
              <div style={{ marginTop: 16 }}>
                <Badge variant="info">
                  Avg payment cycle: {selectedNode.paymentCycleDays} days
                </Badge>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default KnowledgeGraph;
