import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/ui/Sidebar';
import TopBar from './components/ui/TopBar';
import SkeletonLoader from './components/ui/SkeletonLoader';
import useStore from './store';
import styles from './App.module.css';

const Dashboard     = lazy(() => import('./pages/Dashboard'));
const KnowledgeGraph = lazy(() => import('./pages/KnowledgeGraph'));
const DecisionCenter = lazy(() => import('./pages/DecisionCenter'));
const Actions       = lazy(() => import('./pages/Actions'));
const Memory        = lazy(() => import('./pages/Memory'));
const DecisionDNA   = lazy(() => import('./pages/DecisionDNA'));
const Impact        = lazy(() => import('./pages/Impact'));
const AuditLog      = lazy(() => import('./pages/AuditLog'));

const PageFallback = () => (
  <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 24px' }}>
    <SkeletonLoader lines={6} height={20} />
  </div>
);

const App: React.FC = () => {
  const { darkMode } = useStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return (
    <div className={styles.layout}>
      <Sidebar />
      <div className={styles.main}>
        <TopBar />
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/"             element={<Dashboard />} />
            <Route path="/graph"         element={<KnowledgeGraph />} />
            <Route path="/decisions"     element={<DecisionCenter />} />
            <Route path="/actions"       element={<Actions />} />
            <Route path="/memory"        element={<Memory />} />
            <Route path="/decision-dna"  element={<DecisionDNA />} />
            <Route path="/impact"        element={<Impact />} />
            <Route path="/audit"         element={<AuditLog />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
};

export default App;
