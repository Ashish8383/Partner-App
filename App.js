// App.js - Updated version

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, View, AppState } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import useStore from './src/store/useStore';
import { COLORS } from './src/constants/theme';
import * as Notifications from 'expo-notifications';
import { initBadgeManagement, setupNotificationChannel } from './src/utils/fcmToken';
import InAppNotification from './src/components/InAppNotification';
import { ThemeProvider } from './src/theme/themeContext';
import { loadSound, playLoopSound, stopSound } from './src/utils/sound';
import OfflineScreen from './src/screens/NoInternetScreen';
import useAppVersion from './src/utils/useAppVersion';
import UpdateRequiredScreen from './src/screens/UpdateRequiredScreen';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [inAppNotif, setInAppNotif] = useState(null);
  const [isOnline, setIsOnline] = useState(null);
  const navigationRef = useRef(null);

  const setNotificationsEnabled = useStore((s) => s.setNotificationsEnabled);
  const liveOrderCount = useStore((s) => s.liveOrderCount);
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const isHydrated = useStore((s) => s.isHydrated);
  const profile = useStore((s) => s.profile);

  const { updateRequired, checking: checkingVersion, currentVersion, checkVersion } = useAppVersion();

  // Get store methods
  const loadPersistedState = useStore((s) => s.loadPersistedState);
  const refreshProfile = useStore((s) => s.refreshProfile);
  const fetchProfile = useStore((s) => s.fetchProfile);
  const user = useStore((s) => s.user);

  // ─── Load persisted state on mount ──────────────────────────────────────
  useEffect(() => {
    loadPersistedState();
  }, []);

  // ─── Log profile state changes ──────────────────────────────────────────
  useEffect(() => {
    if (isHydrated) {
      if (profile) {
      }
    }
  }, [isHydrated, profile, isAuthenticated]);

  // ─── Load sounds ─────────────────────────────────────────────────────────
  useEffect(() => {
    loadSound('accept', require('./assets/slide.mp3'));
    loadSound('deliver', require('./assets/deliver.mp3'));
    loadSound('order_auto_sound', require('./assets/notification.mp3'));
  }, []);

  // ─── Fix goToHomeLiveTab — safe navigation ───────────────────────────────
  const goToHomeLiveTab = useCallback(() => {
    const nav = navigationRef.current;
    if (!nav || !nav.isReady()) return;

    const state = nav.getState();
    const isAuthenticated = useStore.getState().isAuthenticated;
    if (!isAuthenticated) return;

    try {
      nav.navigate('Auth', {
        screen: 'Main',
        params: {
          screen: 'Home',
          params: { initialTab: 0 },
        },
      });
    } catch (e) {
      // silently ignore navigation errors
    }
  }, []);

  // ── Sound: strictly tied to liveOrderCount ──────────────────────────────
  useEffect(() => {
    if (liveOrderCount > 0) {
      playLoopSound('order_auto_sound');
    } else {
      stopSound('order_auto_sound');
    }
  }, [liveOrderCount]);

  // ── AppState: resume/stop sound & REFRESH PROFILE ─────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'active') {

        // 1. Handle sound
        if (liveOrderCount > 0) {
          playLoopSound('order_auto_sound');
        } else {
          stopSound('order_auto_sound');
        }

        // 2. ✅ REFRESH PROFILE when app comes back to foreground
        if (isAuthenticated) {
          try {
            const result = await refreshProfile();
            if (result) {
            } else {
            }
          } catch (error) {
          }
        } else {
        }

        // 3. Check internet connection
        checkConnection();
      } else if (state === 'background' || state === 'inactive') {
        stopSound('order_auto_sound');
      }
    });
    return () => sub.remove();
  }, [liveOrderCount, isAuthenticated, refreshProfile]);

  // ─── Also refresh profile when hydration completes ──────────────────────
  useEffect(() => {
    if (isHydrated && isAuthenticated && !profile) {
      refreshProfile();
    }
  }, [isHydrated, isAuthenticated, profile, refreshProfile]);

  // ─── Internet check ──────────────────────────────────────────────────────
  const checkConnection = useCallback(async () => {
    try {
      const res = await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        cache: 'no-cache',
      });
      setIsOnline(res.status === 204 || res.ok);
    } catch {
      setIsOnline(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkConnection();
    });
    return () => sub.remove();
  }, [checkConnection]);

  // ── Notification permission sync ────────────────────────────────────────
  const syncPermission = useCallback(async () => {
    const { status } = await Notifications.getPermissionsAsync();
    await setNotificationsEnabled(status === 'granted');
  }, [setNotificationsEnabled]);

  useEffect(() => {
    setupNotificationChannel();
    syncPermission();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncPermission();
    });
    return () => sub.remove();
  }, [syncPermission]);

  // ── In-app notification banner ──────────────────────────────────────────
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const title = notification?.request?.content?.title;
      const body = notification?.request?.content?.body;
      if (title || body) {
        setInAppNotif({ title: title ?? '', body: body ?? '' });
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const cleanup = initBadgeManagement();
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // ─── Show loading while hydrating ──────────────────────────────────────
  if (!isHydrated) {
    return (
      <ThemeProvider>
        <SafeAreaProvider>
          <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
            {/* You can add a loading spinner here */}
          </View>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  if (!checkingVersion && updateRequired) {
    return (
      <ThemeProvider>
        <SafeAreaProvider>
          <StatusBar backgroundColor="#EFEFEF" barStyle="dark-content" />
          <UpdateRequiredScreen
            currentVersion={currentVersion}
            onRetry={checkVersion}
          />
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <View style={{ flex: 1 }}>
          <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

          <AppNavigator
            navigationRef={navigationRef}
            onStateChange={checkConnection}
          />

          {isOnline === false && (
            <OfflineScreen onRetry={checkConnection} />
          )}

          {inAppNotif && (
            <InAppNotification
              title={inAppNotif.title}
              body={inAppNotif.body}
              onPress={() => {
                goToHomeLiveTab();
                setInAppNotif(null);
              }}
              onDismiss={() => setInAppNotif(null)}
            />
          )}
        </View>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}