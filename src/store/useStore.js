import { create } from 'zustand';
import { storage } from '../utils/storage';
import { authAPI } from '../utils/api';

const useStore = create((set, get) => ({
  isAuthenticated: false,
  isHydrated: false,
  user: null,
  token: null,
  refreshToken: null,
  restaurantName: null,
  restaurantLogo: null,
  _isLoggingOut: false,
  fcmToken: null,
  deviceFingerprint: null,
  notificationsEnabled: false,
  pendingToast: null,
  themeMode: 'system',
  liveOrders: [],
  orderHistory: [],

  // ── liveOrderCount: written by HomeScreen, read by App.js to control alert sound
  // App.js owns the sound — survives navigation completely
  liveOrderCount: 0,
  setLiveOrderCount: (count) => set({ liveOrderCount: count }),

  login: async (userData, token, refreshToken = null) => {
    await storage.setItem('user', userData);
    await storage.setItem('token', token);
    if (refreshToken) await storage.setItem('refreshToken', refreshToken);
    set({ isAuthenticated: true, user: userData, token, refreshToken });
  },

  setProfile: async (profileData) => {
    const restaurantName = profileData?.restaurantName ?? null;
    const restaurantLogo = profileData?.Logo ?? null;
    await storage.setItem('restaurantName', restaurantName);
    await storage.setItem('restaurantLogo', restaurantLogo);
    set({ restaurantName, restaurantLogo });
  },

  setFcmToken: async (token) => {
    if (token === null || token === undefined) return;
    await storage.setItem('fcmToken', token);
    set({ fcmToken: token });
  },

  setDeviceFingerprint: async (fingerprint) => {
    if (!fingerprint) return;
    await storage.setItem('deviceFingerprint', fingerprint);
    set({ deviceFingerprint: fingerprint });
  },

  setPendingToast: (toast) => set({ pendingToast: toast }),
  clearPendingToast: () => set({ pendingToast: null }),

  setNotificationsEnabled: async (enabled) => {
    await storage.setItem('notificationsEnabled', enabled);
    set({ notificationsEnabled: enabled });
  },

  logout: async () => {
    if (get()._isLoggingOut) return;
    set({ _isLoggingOut: true });

    if (global.fcmTokenRefreshInterval) {
      clearInterval(global.fcmTokenRefreshInterval);
      global.fcmTokenRefreshInterval = null;
    }

    const { deviceFingerprint } = get();
    try {
      await authAPI.logout({ deviceFingerprint: deviceFingerprint ?? '' });
    } catch {}

    set({ pendingToast: { message: 'Logged out successfully', type: 'success' } });
    await storage.removeItem('user');
    await storage.removeItem('token');
    await storage.removeItem('refreshToken');
    await storage.removeItem('restaurantName');
    await storage.removeItem('restaurantLogo');
    await storage.removeItem('fcmToken');
    await storage.removeItem('deviceFingerprint');
    await storage.removeItem('notificationsEnabled');
    set({
      _isLoggingOut: false,
      isAuthenticated: false,
      user: null, token: null, refreshToken: null,
      restaurantName: null, restaurantLogo: null,
      fcmToken: null, deviceFingerprint: null, notificationsEnabled: false,
      liveOrders: [], orderHistory: [],
      liveOrderCount: 0,   // reset alert on logout
    });
  },

  setThemeMode: async (mode) => {
    await storage.setItem('themeMode', mode);
    set({ themeMode: mode });
  },

  loadPersistedState: async () => {
    try {
      const user               = await storage.getItem('user');
      const token              = await storage.getItem('token');
      const refreshToken       = await storage.getItem('refreshToken');
      const savedTheme         = await storage.getItem('themeMode');
      const restaurantName     = await storage.getItem('restaurantName');
      const restaurantLogo     = await storage.getItem('restaurantLogo');
      const fcmToken           = await storage.getItem('fcmToken');
      const deviceFingerprint  = await storage.getItem('deviceFingerprint');
      const notificationsEnabled = await storage.getItem('notificationsEnabled');

      if (user && token) {
        set({
          isAuthenticated: true,
          user, token, refreshToken,
          restaurantName:      restaurantName      ?? null,
          restaurantLogo:      restaurantLogo      ?? null,
          fcmToken:            fcmToken            ?? null,
          deviceFingerprint:   deviceFingerprint   ?? null,
          notificationsEnabled: notificationsEnabled ?? false,
        });
      }

      if (savedTheme) set({ themeMode: savedTheme });
    } catch {}
    finally {
      set({ isHydrated: true });
    }
  },

  setLiveOrders:   (orders)  => set({ liveOrders: orders }),
  setOrderHistory: (history) => set({ orderHistory: history }),

  addLiveOrder: (order) =>
    set((state) => ({ liveOrders: [order, ...state.liveOrders] })),

  updateOrderStatus: (orderId, status) =>
    set((state) => ({
      liveOrders: state.liveOrders.map((order) =>
        order.id === orderId ? { ...order, status } : order
      ),
    })),
}));

export default useStore;