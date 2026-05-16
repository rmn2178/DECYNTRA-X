import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/axios';
import {
  LayoutDashboard, Network, BrainCircuit, Zap, BookOpen,
  Dna, TrendingUp, ScrollText, Menu, X, ChevronLeft
} from 'lucide-react';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
  { label: 'Dashboard',       path: '/',               icon: <LayoutDashboard size={16} /> },
  { label: 'Knowledge Graph', path: '/graph',           icon: <Network size={16} /> },
  { label: 'Decision Center', path: '/decisions',       icon: <BrainCircuit size={16} /> },
  { label: 'Actions',         path: '/actions',         icon: <Zap size={16} /> },
  { label: 'Memory',          path: '/memory',          icon: <BookOpen size={16} /> },
  { label: 'Decision DNA',    path: '/decision-dna',    icon: <Dna size={16} /> },
  { label: 'Impact',          path: '/impact',          icon: <TrendingUp size={16} /> },
  { label: 'Audit Log',       path: '/audit',           icon: <ScrollText size={16} /> },
];

const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Fetch pending decisions count
  const { data: pendingDecisions = [] } = useQuery({
    queryKey: ['pending-decisions'],
    queryFn: () => api.get('/api/decisions/pending').then(r => r.data),
    retry: false,
    refetchInterval: 30000, // poll every 30s
  });

  const criticalPending = pendingDecisions.some((d: any) => d.risk_analysis?.urgency_score >= 8);
  const pendingCount = pendingDecisions.length;

  return (
    <>
      {/* Mobile hamburger */}
      <button className={styles.hamburger} onClick={() => setMobileOpen(true)}>
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className={styles.overlay} onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${mobileOpen ? styles.mobileOpen : ''}`}
      >
        {/* Header */}
        <div className={styles.header}>
          {!collapsed && (
            <div className={styles.logo}>
              <span className={styles.logoMark}>D</span>
              <span className={styles.logoText}>DECYNTRA-X</span>
            </div>
          )}
          <button className={styles.collapseBtn} onClick={() => { setCollapsed(!collapsed); setMobileOpen(false); }}>
            {mobileOpen ? <X size={16} /> : <ChevronLeft size={16} className={collapsed ? styles.rotated : ''} />}
          </button>
        </div>

        {/* Nav */}
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const isDecisions = item.path === '/decisions';
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive ? styles.active : ''}`
                }
                title={collapsed ? item.label : undefined}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                {!collapsed && (
                  <span className={styles.navLabel} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    {item.label}
                    {isDecisions && pendingCount > 0 && (
                      <span className={`${styles.pendingBadge} ${criticalPending ? styles.pendingBadgeCritical : ''}`}>
                        {pendingCount}
                      </span>
                    )}
                  </span>
                )}
                {/* Collapsed dot indicator */}
                {collapsed && isDecisions && pendingCount > 0 && (
                  <span className={`${styles.collapsedDot} ${criticalPending ? styles.collapsedDotCritical : ''}`} />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className={styles.footer}>
            <span className={styles.footerText}>Prevent crises 10 days early</span>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
