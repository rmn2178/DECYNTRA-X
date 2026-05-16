import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './Drawer.module.css';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: number;
}

const Drawer: React.FC<DrawerProps> = ({ open, onClose, title, children, width = 440 }) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      <div className={`${styles.overlay} ${open ? styles.visible : ''}`} onClick={onClose} />
      <div className={`${styles.drawer} ${open ? styles.open : ''}`} style={{ width }}>
        <div className={styles.header}>
          {title && <h2 className={styles.title}>{title}</h2>}
          <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </>
  );
};

export default Drawer;
