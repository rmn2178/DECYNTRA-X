import React from 'react';
import styles from './ProgressBar.module.css';

interface Stage {
  label: string;
  done: boolean;
  active?: boolean;
}

interface ProgressBarProps {
  stages: Stage[];
}

const ProgressBar: React.FC<ProgressBarProps> = ({ stages }) => {
  const doneCount = stages.filter((s) => s.done).length;
  const pct = Math.round((doneCount / stages.length) * 100);

  return (
    <div className={styles.wrapper}>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.stages}>
        {stages.map((stage, i) => (
          <div key={i} className={`${styles.stage} ${stage.done ? styles.done : ''} ${stage.active ? styles.active : ''}`}>
            <div className={styles.dot} />
            <span className={styles.label}>{stage.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProgressBar;
