import React, { useState, useRef, useEffect } from 'react';
import { Bell, Sun, Moon } from 'lucide-react';
import useStore from '../../store';
import styles from './TopBar.module.css';

const TopBar: React.FC = () => {
  const { org, notifications, darkMode, toggleDarkMode, markNotificationRead } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className={styles.topbar}>
      <div className={styles.orgName}>{org?.name ?? 'DECYNTRA-X'}</div>
      <div className={styles.actions}>
        {/* Dark mode toggle */}
        <button className={styles.iconBtn} onClick={toggleDarkMode} title="Toggle dark mode">
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Notification Bell */}
        <div className={styles.bellWrapper} ref={ref}>
          <button className={styles.iconBtn} onClick={() => setOpen(!open)}>
            <Bell size={16} />
            {unread > 0 && <span className={styles.badge}>{unread}</span>}
          </button>

          {open && (
            <div className={styles.dropdown}>
              <div className={styles.dropdownHeader}>Notifications</div>
              {notifications.length === 0 && (
                <div className={styles.empty}>All caught up</div>
              )}
              {notifications.map((n) => (
                <button
                  key={n.id}
                  className={`${styles.notifItem} ${n.read ? styles.read : ''}`}
                  onClick={() => markNotificationRead(n.id)}
                >
                  <span className={`${styles.dot} ${styles[n.type]}`} />
                  <span>{n.message}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Avatar */}
        <div className={styles.avatar}>G</div>
      </div>
    </header>
  );
};

export default TopBar;
