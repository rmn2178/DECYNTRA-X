import React, { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import { Check, X } from 'lucide-react';
import api from '../lib/axios';
import Badge from '../components/ui/Badge';
import SkeletonLoader from '../components/ui/SkeletonLoader';
import styles from './AuditLog.module.css';

interface AuditLogEntry {
  package_id: string;
  decided_at: string;
  risk_type: string;
  recommended_option: string;
  chosen_option: string;
  agreed: boolean;
  notes: string;
  outcome: string;
  disagreement_reason: string | null;
}

const AuditLog: React.FC = () => {
  const { data: logs = [], isLoading } = useQuery<AuditLogEntry[]>({
    queryKey: ['audit-log'],
    queryFn: () => api.get('/api/decisions/log').then(r => r.data),
    retry: false
  });

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // estimated row height
    overscan: 5,
  });

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        
        <div className={styles.header}>
          <h1 className={styles.title}>Decision Audit Log</h1>
          <p className={styles.subtitle}>
            A complete, immutable record of all decisions made by humans and AI on this platform.
          </p>
        </div>

        <div className={styles.tableContainer}>
          <div ref={parentRef} className={styles.tableScroll}>
            {isLoading ? (
              <div style={{ padding: 24 }}>
                <SkeletonLoader lines={10} height={40} />
              </div>
            ) : logs.length === 0 ? (
              <div className={styles.emptyState}>No decisions recorded yet.</div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Risk Profile</th>
                    <th>Options</th>
                    <th>Agreement</th>
                    <th>Rationale & Notes</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const log = logs[virtualRow.index];
                    return (
                      <tr
                        key={virtualRow.key}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <td className={styles.dateCell}>
                          {format(new Date(log.decided_at), 'MMM d, yyyy HH:mm')}
                        </td>
                        <td>
                          <div style={{ maxWidth: 200, lineHeight: 1.5 }}>
                            {log.risk_type}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              AI: {log.recommended_option}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>
                              User: {log.chosen_option}
                            </span>
                          </div>
                        </td>
                        <td>
                          {log.agreed ? (
                            <Badge variant="safe"><Check size={12} style={{ marginRight: 4 }}/> Agreed</Badge>
                          ) : (
                            <Badge variant="warning"><X size={12} style={{ marginRight: 4 }}/> Override</Badge>
                          )}
                        </td>
                        <td>
                          <p className={styles.noteText}>{log.notes || <em>No notes provided.</em>}</p>
                          {log.disagreement_reason && (
                            <div className={styles.disagreementText}>
                              <strong>AI Override Note:</strong> {log.disagreement_reason}
                            </div>
                          )}
                        </td>
                        <td>
                          <Badge variant="info">{log.outcome}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AuditLog;
