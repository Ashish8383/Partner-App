import { create } from 'zustand';
import { storage } from '../utils/storage';

const useStore = create((set, get) => ({
  // ── Auth state ────────────────────────────────────────────────────────────
  isAuthenticated: false,
  isHydrated:      false,   // ← true once loadPersistedState() has resolved
  user:            null,
  token:           null,
  refreshToken:    null,

  // ── Orders state ──────────────────────────────────────────────────────────
  liveOrders:   [],
  orderHistory: [],

  // ── Actions ───────────────────────────────────────────────────────────────

  login: async (userData, token, refreshToken = null) => {
    await storage.setItem('user', userData);
    await storage.setItem('token', token);
    if (refreshToken) {
      await storage.setItem('refreshToken', refreshToken);
    }
    set({
      isAuthenticated: true,
      user:            userData,
      token:           token,
      refreshToken:    refreshToken,
    });
  },

  logout: async () => {
    await storage.removeItem('user');
    await storage.removeItem('token');
    await storage.removeItem('refreshToken');
    set({
      isAuthenticated: false,
      user:            null,
      token:           null,
      refreshToken:    null,
      liveOrders:      [],
      orderHistory:    [],
    });
  },

  // Called once on app start (from AppNavigator bootstrap).
  // Reads persisted auth from storage and hydrates the store.
  // Sets isHydrated = true when done so the app knows auth state is ready.
  loadPersistedState: async () => {
    try {
      const user         = await storage.getItem('user');
      const token        = await storage.getItem('token');
      const refreshToken = await storage.getItem('refreshToken');

      console.log(user, 'user is here', token, 'token is here');

      if (user && token) {
        set({
          isAuthenticated: true,
          user,
          token,
          refreshToken,
        });
      }
    } catch (e) {
      console.warn('loadPersistedState error:', e);
    } finally {
      // Always mark hydration complete — even if storage read failed
      set({ isHydrated: true });
    }
  },

  // ── Order actions ─────────────────────────────────────────────────────────
  setLiveOrders:   (orders)  => set({ liveOrders: orders }),
  setOrderHistory: (history) => set({ orderHistory: history }),

  addLiveOrder: (order) =>
    set((state) => ({
      liveOrders: [order, ...state.liveOrders],
    })),

  updateOrderStatus: (orderId, status) =>
    set((state) => ({
      liveOrders: state.liveOrders.map((order) =>
        order.id === orderId ? { ...order, status } : order
      ),
    })),
}));

export default useStore;