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
  staffName: null,           // Staff name (e.g., "Ashish")
  staffRole: null,           // Staff role (e.g., "ORDER_MANAGER")
  staffPermissions: [],      // Staff permissions array
  restaurant: null,          // Full restaurant object
  _isLoggingOut: false,
  fcmToken: null,
  deviceFingerprint: null,
  notificationsEnabled: false,
  pendingToast: null,
  themeMode: 'system',
  liveOrders: [],
  orderHistory: [],

  // ── liveOrderCount: written by HomeScreen, read by App.js to control alert sound
  liveOrderCount: 0,
  setLiveOrderCount: (count) => set({ liveOrderCount: count }),

  // ── Computed/derived display name: Staff name takes priority over restaurant name
  getDisplayName: () => {
    const { staffName, restaurantName, restaurant } = get();
    // Priority: staffName > restaurantName (from profile) > restaurant.name (from login)
    return staffName || restaurantName || restaurant?.name || null;
  },

  login: async (userData, token, refreshToken = null) => {
    await storage.setItem('user', userData);
    await storage.setItem('token', token);
    if (refreshToken) await storage.setItem('refreshToken', refreshToken);

    // Extract and store staff/restaurant data
    const staffName = userData?.name ?? null;
    const staffRole = userData?.role ?? null;
    const staffPermissions = userData?.permissions ?? [];
    const restaurant = userData?.restaurant ?? null;

    // Store individual values
    if (staffName) await storage.setItem('staffName', staffName);
    if (staffRole) await storage.setItem('staffRole', staffRole);
    if (staffPermissions.length > 0) await storage.setItem('staffPermissions', JSON.stringify(staffPermissions));
    if (restaurant) await storage.setItem('restaurant', JSON.stringify(restaurant));

    // If staff is present, use staff name as the display name
    // Otherwise fall back to restaurant name
    const displayName = staffName || restaurant?.name || null;
    if (displayName) await storage.setItem('displayName', displayName);

    set({
      isAuthenticated: true,
      user: userData,
      token,
      refreshToken,
      restaurantName: restaurant?.name || null,  // Store restaurant name separately
      restaurantLogo: restaurant?.logo || null,   // Store restaurant logo
      staffName,
      staffRole,
      staffPermissions,
      restaurant,
    });
  },

  setProfile: async (profileData) => {
    const restaurantName = profileData?.restaurantName ?? null;
    const restaurantLogo = profileData?.Logo ?? null;
    await storage.setItem('restaurantName', restaurantName);
    await storage.setItem('restaurantLogo', restaurantLogo);

    // Only update restaurantName if no staff name exists
    // This prevents overwriting staff name with restaurant name
    const { staffName } = get();
    set({
      restaurantName: staffName ? get().restaurantName : restaurantName,  // Keep restaurant name for reference
      restaurantLogo
    });
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

  // Helper to check if user has a specific permission
  hasPermission: (permission) => {
    const { staffPermissions } = get();
    return staffPermissions.includes(permission);
  },

  // Helper to check if user has any of the specified permissions
  hasAnyPermission: (permissions) => {
    const { staffPermissions } = get();
    return permissions.some(perm => staffPermissions.includes(perm));
  },

  // Helper to check if user has all of the specified permissions
  hasAllPermissions: (permissions) => {
    const { staffPermissions } = get();
    return permissions.every(perm => staffPermissions.includes(perm));
  },

  // Helper to check if current user is a staff member
  isStaff: () => {
    const { staffName, staffRole } = get();
    return !!(staffName || staffRole);
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
    } catch { }

    set({ pendingToast: { message: 'Logged out successfully', type: 'success' } });

    // Clear all stored items
    await storage.removeItem('user');
    await storage.removeItem('token');
    await storage.removeItem('refreshToken');
    await storage.removeItem('restaurantName');
    await storage.removeItem('restaurantLogo');
    await storage.removeItem('displayName');
    await storage.removeItem('staffName');
    await storage.removeItem('staffRole');
    await storage.removeItem('staffPermissions');
    await storage.removeItem('restaurant');
    await storage.removeItem('fcmToken');
    await storage.removeItem('deviceFingerprint');
    await storage.removeItem('notificationsEnabled');

    set({
      _isLoggingOut: false,
      isAuthenticated: false,
      user: null,
      token: null,
      refreshToken: null,
      restaurantName: null,
      restaurantLogo: null,
      staffName: null,
      staffRole: null,
      staffPermissions: [],
      restaurant: null,
      fcmToken: null,
      deviceFingerprint: null,
      notificationsEnabled: false,
      liveOrders: [],
      orderHistory: [],
      liveOrderCount: 0,
    });
  },

  setThemeMode: async (mode) => {
    await storage.setItem('themeMode', mode);
    set({ themeMode: mode });
  },

  loadPersistedState: async () => {
    try {
      const user = await storage.getItem('user');
      const token = await storage.getItem('token');
      const refreshToken = await storage.getItem('refreshToken');
      const savedTheme = await storage.getItem('themeMode');
      const restaurantName = await storage.getItem('restaurantName');
      const restaurantLogo = await storage.getItem('restaurantLogo');
      const staffName = await storage.getItem('staffName');
      const staffRole = await storage.getItem('staffRole');
      const staffPermissionsStr = await storage.getItem('staffPermissions');
      const restaurantStr = await storage.getItem('restaurant');
      const fcmToken = await storage.getItem('fcmToken');
      const deviceFingerprint = await storage.getItem('deviceFingerprint');
      const notificationsEnabled = await storage.getItem('notificationsEnabled');

      // Parse JSON strings back to objects/arrays
      const staffPermissions = staffPermissionsStr ? JSON.parse(staffPermissionsStr) : [];
      const restaurant = restaurantStr ? JSON.parse(restaurantStr) : null;

      if (user && token) {
        set({
          isAuthenticated: true,
          user,
          token,
          refreshToken,
          restaurantName: restaurantName ?? null,
          restaurantLogo: restaurantLogo ?? null,
          staffName: staffName ?? null,
          staffRole: staffRole ?? null,
          staffPermissions: staffPermissions,
          restaurant: restaurant,
          fcmToken: fcmToken ?? null,
          deviceFingerprint: deviceFingerprint ?? null,
          notificationsEnabled: notificationsEnabled ?? false,
        });
      }

      if (savedTheme) set({ themeMode: savedTheme });
    } catch { }
    finally {
      set({ isHydrated: true });
    }
  },

  setLiveOrders: (orders) => set({ liveOrders: orders }),
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