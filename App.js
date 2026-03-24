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
  const loadPersistedState = useStore((s) => s.loadPersistedState);
  const setNotificationsEnabled = useStore((s) => s.setNotificationsEnabled);
  const liveOrderCount = useStore((s) => s.liveOrderCount);
  const { updateRequired, checking: checkingVersion, currentVersion, checkVersion } = useAppVersion();

// ── Load sounds once — remove loadPersistedState from here ─────────────
useEffect(() => {
  // ✅ REMOVED loadPersistedState() — AppNavigator already handles it
  loadSound('accept', require('./assets/slide.mp3'));
  loadSound('deliver', require('./assets/deliver.mp3'));
  loadSound('order_auto_sound', require('./assets/notification.mp3'));
}, []);

// ── Fix goToHomeLiveTab — safe navigation ───────────────────────────────
const goToHomeLiveTab = useCallback(() => {
  const nav = navigationRef.current;
  if (!nav || !nav.isReady()) return;

  const state = nav.getState();
  const isAuthenticated = useStore.getState().isAuthenticated;
  if (!isAuthenticated) return; // ✅ don't navigate if not logged in

  try {
    nav.navigate('Auth', {
      screen: 'Main',
      params: {
        screen: 'Home',
        params: { initialTab: 0 },
      },
    });
  } catch (e) {
    // ✅ silently ignore navigation errors
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

  // ── AppState: resume/stop sound based on current count ─────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (liveOrderCount > 0) {
          playLoopSound('order_auto_sound');
        } else {
          stopSound('order_auto_sound');
        }
      } else if (state === 'background' || state === 'inactive') {
        stopSound('order_auto_sound');
      }
    });
    return () => sub.remove();
  }, [liveOrderCount]);

  // ── Internet check ──────────────────────────────────────────────────────
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
    // Initialize badge management
    const cleanup = initBadgeManagement();
    
    return () => {
      // Cleanup on app unmount
      if (cleanup) cleanup();
    };
  }, []);

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