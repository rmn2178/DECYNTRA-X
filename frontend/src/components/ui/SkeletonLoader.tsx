import React from 'react';
import styles from './SkeletonLoader.module.css';

interface SkeletonLoaderProps {
  lines?: number;
  height?: number;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ lines = 4, height = 18 }) => (
  <div className={styles.wrapper}>
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        className={styles.line}
        style={{ height, width: i === lines - 1 ? '60%' : '100%' }}
      />
    ))}
  </div>
);

export default SkeletonLoader;
