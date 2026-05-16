import React from 'react';
import styles from './Card.module.css';

interface CardProps {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ header, footer, children, className = '' }) => (
  <div className={`${styles.card} ${className}`}>
    {header && <div className={styles.header}>{header}</div>}
    <div className={styles.body}>{children}</div>
    {footer && <div className={styles.footer}>{footer}</div>}
  </div>
);

export default Card;
