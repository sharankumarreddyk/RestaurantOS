import { create } from 'zustand';
import { get, put } from '../api/client';

const useNotificationStore = create((set, getState) => ({
  notifications: [],
  unreadCount: 0,
  soundEnabled: localStorage.getItem('notification_sound') !== 'false',
  loaded: false,

  // Fetch from API
  fetchNotifications: async () => {
    try {
      const data = await get('/notifications?limit=50');
      const list = Array.isArray(data) ? data : [];
      set({ notifications: list, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const { count } = await get('/notifications/unread-count');
      set({ unreadCount: count });
    } catch {}
  },

  // Called when WebSocket receives notification:new
  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 100),
      unreadCount: state.unreadCount + 1,
    }));

    // Play sound for high-priority notifications
    if (notification.priority === 'high' && getState().soundEnabled) {
      playNotificationSound(notification.type);
    }
  },

  markRead: async (id) => {
    try {
      await put(`/notifications/${id}/read`);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch {}
  },

  markAllRead: async () => {
    try {
      await put('/notifications/read-all');
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
      }));
    } catch {}
  },

  toggleSound: () => {
    set((state) => {
      const next = !state.soundEnabled;
      localStorage.setItem('notification_sound', String(next));
      return { soundEnabled: next };
    });
  },
}));

// Simple notification sounds using oscillator (no external files)
function playNotificationSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.value = 0.3;

    if (type === 'order_new' || type === 'call_waiter' || type === 'call_bill') {
      // Urgent: two short beeps
      osc.frequency.value = 880;
      osc.start();
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0, ctx.currentTime + 0.4);
      osc.stop(ctx.currentTime + 0.5);
    } else if (type === 'order_ready') {
      // Pleasant: ascending tone
      osc.frequency.value = 523;
      osc.start();
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.15);
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0, ctx.currentTime + 0.5);
      osc.stop(ctx.currentTime + 0.6);
    } else {
      // Default: single soft beep
      osc.frequency.value = 660;
      osc.start();
      gain.gain.setValueAtTime(0, ctx.currentTime + 0.2);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch {
    // Audio not available — silent fallback
  }
}

export default useNotificationStore;
