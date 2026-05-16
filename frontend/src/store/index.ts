import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Notification {
  id: string;
  message: string;
  type: 'critical' | 'warning' | 'info';
  read: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

interface Org {
  id: string;
  name: string;
}

interface StoreState {
  user: User | null;
  org: Org | null;
  accessToken: string | null;
  notifications: Notification[];
  activeDecisionPackageId: string | null;
  darkMode: boolean;

  setUser: (user: User) => void;
  setOrg: (org: Org) => void;
  setAccessToken: (token: string) => void;
  addNotification: (n: Notification) => void;
  markNotificationRead: (id: string) => void;
  setActiveDecisionPackage: (id: string | null) => void;
  toggleDarkMode: () => void;
  logout: () => void;
}

const useStore = create<StoreState>()(
  persist(
    (set) => ({
      user: null,
      org: { id: 'org-1', name: 'Acme Corp' },
      accessToken: null,
      notifications: [
        { id: '1', message: 'Cash runway < 10 days detected', type: 'critical', read: false },
        { id: '2', message: 'Globex invoice 14 days overdue', type: 'warning', read: false },
        { id: '3', message: 'Weekly brief ready', type: 'info', read: true },
      ],
      activeDecisionPackageId: null,
      darkMode: false,

      setUser: (user) => set({ user }),
      setOrg: (org) => set({ org }),
      setAccessToken: (accessToken) => set({ accessToken }),
      addNotification: (n) => set((s) => ({ notifications: [n, ...s.notifications] })),
      markNotificationRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })),
      setActiveDecisionPackage: (id) => set({ activeDecisionPackageId: id }),
      toggleDarkMode: () =>
        set((s) => {
          const next = !s.darkMode;
          document.documentElement.classList.toggle('dark', next);
          return { darkMode: next };
        }),
      logout: () => set({ user: null, accessToken: null }),
    }),
    { name: 'decyntrax-store', partialize: (s) => ({ darkMode: s.darkMode }) }
  )
);

export default useStore;
