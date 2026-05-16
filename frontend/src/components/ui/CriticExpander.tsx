import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ShieldAlert } from 'lucide-react';
import styles from './CriticExpander.module.css';

interface CriticExpanderProps {
  mainRisk: string;
  failureProbability: number;
  weakestAssumption: string;
  modelAssumptions?: string[];
}

const DEFAULT_ASSUMPTIONS = [
  'Customer has sufficient liquidity to respond to payment requests',
  'No external macro shock (FX, supply chain) in the next 14 days',
  'Historical payment cycle data is representative of current behaviour',
  'Vendor will accept renegotiation without penalty clauses',
];

const CriticExpander: React.FC<CriticExpanderProps> = ({
  mainRisk,
  failureProbability,
  weakestAssumption,
  modelAssumptions = DEFAULT_ASSUMPTIONS,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <ShieldAlert size={13} className={styles.icon} />
        <span className={styles.risk}>
          <strong>{Math.round(failureProbability * 100)}% failure risk:</strong> {mainRisk}
        </span>
      </div>
      <button className={styles.expandBtn} onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Based on:
      </button>
      {open && (
        <div className={styles.body}>
          <div className={styles.assumption}>
            <span className={styles.assumptionLabel}>Weakest assumption</span>
            <span className={styles.assumptionText}>{weakestAssumption}</span>
          </div>
          <div className={styles.assumptionLabel} style={{ marginTop: 8 }}>Model assumptions</div>
          <ul className={styles.list}>
            {modelAssumptions.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CriticExpander;
