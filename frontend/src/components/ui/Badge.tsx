import React from 'react';
import styles from './Badge.module.css';

type Variant = 'critical' | 'warning' | 'safe' | 'pending' | 'info';

interface BadgeProps {
  variant?: Variant;
  children: React.ReactNode;
  dot?: boolean;
}

const Badge: React.FC<BadgeProps> = ({ variant = 'info', dot = false, children }) => (
  <span className={`${styles.badge} ${styles[variant]}`}>
    {dot && <span className={styles.dot} />}
    {children}
  </span>
);

export default Badge;
