import React, { useEffect, useRef } from 'react';
import useStore from '../../store';
import styles from './DemoOverlay.module.css';

const STEPS = [
  { step: 1, caption: 'Step 1 — Shortfall banner flashes: critical cash risk detected for TechParts SME.' },
  { step: 2, caption: 'Step 2 — Anomaly cards animate in with Groq-generated narratives.' },
  { step: 3, caption: 'Step 3 — Decision package opens; 3-agent chain (Risk → Strategy → Critic) visible.' },
  { step: 4, caption: 'Step 4 — What-If chart animates comparing 3 strategic options.' },
  { step: 5, caption: 'Step 5 — Human selects Option 1; AI Disagreement Modal fires.' },
  { step: 6, caption: 'Step 6 — Impact counter animates up, showing cash saved and decisions avoided.' },
];

const DemoOverlay: React.FC = () => {
  const { demoActive, demoStep, demoCaption, setDemoStep, stopDemo } = useStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!demoActive) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      if (demoStep >= STEPS.length) {
        stopDemo();
        return;
      }
      const next = STEPS[demoStep]; // demoStep is 1-based; STEPS[demoStep] = next step
      if (next) setDemoStep(next.step, next.caption);
      else stopDemo();
    }, 2800);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [demoActive, demoStep, setDemoStep, stopDemo]);

  if (!demoActive) return null;

  return (
    <>
      {/* Step indicator dots */}
      <div className={styles.stepDots}>
        {STEPS.map((s) => (
          <button
            key={s.step}
            className={`${styles.dot} ${demoStep === s.step ? styles.dotActive : ''} ${demoStep > s.step ? styles.dotDone : ''}`}
            onClick={() => setDemoStep(s.step, s.caption)}
            title={`Step ${s.step}`}
          />
        ))}
        <button className={styles.skipBtn} onClick={stopDemo}>✕ Exit</button>
      </div>

      {/* Sticky bottom caption bar */}
      <div className={styles.captionBar}>
        <span className={styles.stepLabel}>Step {demoStep} / {STEPS.length}</span>
        <span className={styles.caption}>{demoCaption}</span>
        <div className={styles.captionProgress}>
          <div
            className={styles.captionProgressFill}
            style={{ width: `${(demoStep / STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    </>
  );
};

export default DemoOverlay;
