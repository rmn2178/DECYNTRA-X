import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import styles from './WhyPopover.module.css';

interface DataPoint {
  entity_type: string;
  entity_name: string;
  detail: string;
}

interface WhyPopoverProps {
  keyDataPoints: DataPoint[];
  reasoning?: string;
  label?: string;
}

const WhyPopover: React.FC<WhyPopoverProps> = ({ keyDataPoints, reasoning, label = 'Why?' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className={styles.wrapper} ref={ref}>
      <button className={styles.trigger} onClick={() => setOpen(!open)}>
        <HelpCircle size={12} />
        {label}
      </button>
      {open && (
        <div className={styles.popover}>
          <div className={styles.popoverTitle}>Key data points</div>
          {keyDataPoints.map((dp, i) => (
            <div key={i} className={styles.dataPoint}>
              <span className={styles.entityType}>{dp.entity_type}</span>
              <span className={styles.entityName}>{dp.entity_name}</span>
              <span className={styles.detail}>{dp.detail}</span>
            </div>
          ))}
          {reasoning && (
            <>
              <div className={styles.divider} />
              <div className={styles.reasoning}>{reasoning}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default WhyPopover;
