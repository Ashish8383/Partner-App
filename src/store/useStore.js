import { create } from 'zustand';
import { storage } from '../utils/storage';
import { authAPI, restaurantAPI } from '../utils/api';

const useStore = create((set, get) => ({
  // ── Auth state ────────────────────────────────────────────────────────────
  isAuthenticated: false,
  isHydrated: false,
  user: null,
  token: null,
  refreshToken: null,

  // ── Profile state ─────────────────────────────────────────────────────────
  restaurantName: null,
  restaurantLogo: null,

  // ── Internal flags ────────────────────────────────────────────────────────
  _isLoggingOut: false,   // re-entry guard — prevents logout loop

  // ── Device / FCM ──────────────────────────────────────────────────────────
  fcmToken:             null,   // stored at login, reused everywhere
  deviceFingerprint:    null,   // stored at login, reused everywhere
  notificationsEnabled: false,  // synced with device permission
  pendingToast: null,           // { message, type } — read once on next screen mount

  // ── Theme ─────────────────────────────────────────────────────────────────
  themeMode: 'system',

  // ── Orders ────────────────────────────────────────────────────────────────
  liveOrders: [],
  orderHistory: [],

  // ── Actions ───────────────────────────────────────────────────────────────

  login: async (userData, token, refreshToken = null) => {
    await storage.setItem('user', userData);
    await storage.setItem('token', token);
    if (refreshToken) await storage.setItem('refreshToken', refreshToken);
    set({ isAuthenticated: true, user: userData, token, refreshToken });
  },

  setProfile: async (profileData) => {
    const restaurantName = profileData?.restaurantName ?? null;
    const restaurantLogo = profileData?.Logo           ?? null;
    await storage.setItem('restaurantName', restaurantName);
    await storage.setItem('restaurantLogo', restaurantLogo);
    set({ restaurantName, restaurantLogo });
  },

  // ── Store FCM token + device fingerprint once at login ───────────────────
  setFcmToken: async (token) => {
    if (token === null || token === undefined) return;
    await storage.setItem('fcmToken', token);  // '' = disabled, string = active
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

    const { deviceFingerprint} = get();
    try {
      await authAPI.logout({ deviceFingerprint: deviceFingerprint ?? '' });
      console.log('[Auth] Logout success');
    } catch {
    }

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
    });
  },

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
      const fcmToken            = await storage.getItem('fcmToken');
      const deviceFingerprint      = await storage.getItem('deviceFingerprint');
      const notificationsEnabled   = await storage.getItem('notificationsEnabled');


      if (user && token) {
        set({
          isAuthenticated: true,
          user, token, refreshToken,
          restaurantName: restaurantName ?? null,
          restaurantLogo: restaurantLogo ?? null,
          fcmToken:          fcmToken          ?? null,
          deviceFingerprint:    deviceFingerprint    ?? null,
          notificationsEnabled: notificationsEnabled ?? false,
        });
      }

      if (savedTheme) set({ themeMode: savedTheme });
    } catch (e) {
    } finally {
      set({ isHydrated: true });
    }
  },

  // ── Order actions ─────────────────────────────────────────────────────────
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