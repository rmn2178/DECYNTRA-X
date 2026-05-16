import React from 'react';
import styles from './Spinner.module.css';

interface SpinnerProps { size?: number; }

const Spinner: React.FC<SpinnerProps> = ({ size = 18 }) => (
  <div className={styles.spinner} style={{ width: size, height: size }} />
);

export default Spinner;
