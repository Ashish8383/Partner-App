import { create } from 'zustand';
import { storage } from '../utils/storage';

const useStore = create((set, get) => ({
  // ── Auth state ────────────────────────────────────────────────────────────
  isAuthenticated: false,
  isHydrated: false,
  user: null,
  token: null,
  refreshToken: null,

  // ── Profile state (populated after login via getProfile) ─────────────────
  restaurantName: null,   // e.g. "M Cafe"
  restaurantLogo: null,   // e.g. "https://...mcafe logo.webp"

  // ── Theme state ───────────────────────────────────────────────────────────
  themeMode: 'system', // 'light', 'dark', or 'system'

  // ── Orders state ──────────────────────────────────────────────────────────
  liveOrders: [],
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
      user: userData,
      token: token,
      refreshToken: refreshToken,
    });
  },

  // ── Called after login with full profile response ─────────────────────────
  // Stores restaurantName + Logo both in memory and persisted storage.
  setProfile: async (profileData) => {
    const restaurantName = profileData?.restaurantName ?? null;
    const restaurantLogo = profileData?.Logo           ?? null;
    await storage.setItem('restaurantName', restaurantName);
    await storage.setItem('restaurantLogo', restaurantLogo);
    set({ restaurantName, restaurantLogo });
  },

  logout: async () => {
    await storage.removeItem('user');
    await storage.removeItem('token');
    await storage.removeItem('refreshToken');
    await storage.removeItem('restaurantName');
    await storage.removeItem('restaurantLogo');
    set({
      isAuthenticated: false,
      user: null,
      token: null,
      refreshToken: null,
      restaurantName: null,
      restaurantLogo: null,
      liveOrders: [],
      orderHistory: [],
    });
  },

  // Theme action
  setThemeMode: async (mode) => {
    await storage.setItem('themeMode', mode);
    set({ themeMode: mode });
  },

  loadPersistedState: async () => {
    try {
      const user           = await storage.getItem('user');
      const token          = await storage.getItem('token');
      const refreshToken   = await storage.getItem('refreshToken');
      const savedTheme     = await storage.getItem('themeMode');
      const restaurantName = await storage.getItem('restaurantName');
      const restaurantLogo = await storage.getItem('restaurantLogo');

      console.log(user, 'user is here', token, 'token is here');

      if (user && token) {
        set({
          isAuthenticated: true,
          user,
          token,
          refreshToken,
          restaurantName: restaurantName ?? null,
          restaurantLogo: restaurantLogo ?? null,
        });
      }

      if (savedTheme) {
        set({ themeMode: savedTheme });
      }
    } catch (e) {
      console.warn('loadPersistedState error:', e);
    } finally {
      set({ isHydrated: true });
    }
  },

  // ── Order actions ─────────────────────────────────────────────────────────
  setLiveOrders: (orders) => set({ liveOrders: orders }),
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