import { create } from 'zustand';

/**
 * Global app state (Zustand). Deliberately tiny in Phase 1 — it currently backs
 * the dashboard counters. Enrollment/attendance repositories will feed it real
 * values in later phases.
 */
interface AppState {
  enrolledCount: number;
  pendingSyncCount: number;
  lastSyncAt: number | null; // epoch ms of last confirmed sync, or null

  setEnrolledCount: (n: number) => void;
  queueAttendance: () => void;
  markSynced: (at: number) => void;
}

export const useAppStore = create<AppState>(set => ({
  enrolledCount: 0,
  pendingSyncCount: 0,
  lastSyncAt: null,

  setEnrolledCount: n => set({ enrolledCount: n }),
  queueAttendance: () =>
    set(state => ({ pendingSyncCount: state.pendingSyncCount + 1 })),
  markSynced: at => set({ pendingSyncCount: 0, lastSyncAt: at }),
}));
