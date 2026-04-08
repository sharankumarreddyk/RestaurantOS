import { create } from 'zustand';
import { api, setToken } from '../api/client';

const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  isAuthenticated: !!localStorage.getItem('accessToken'),
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      setToken(data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      set({ user: data.user, isAuthenticated: true, loading: false });
      return data.user;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      // Logout even if API fails
    }
    setToken(null);
    localStorage.removeItem('user');
    set({ user: null, isAuthenticated: false });
  },

  setCustomerSession: (token, session) => {
    setToken(token);
    const user = {
      role: 'customer',
      tableNumber: session.tableNumber,
      tableLabel: session.tableLabel,
      restaurantName: session.restaurantName,
      sessionId: session.id,
    };
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },
}));

export default useAuthStore;
