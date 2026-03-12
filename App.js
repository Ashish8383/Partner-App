import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, View, AppState } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import useStore from './src/store/useStore';
import { COLORS } from './src/constants/theme';
import * as Notifications from 'expo-notifications';
import { setupNotificationChannel, playCustomSound } from './src/utils/fcmToken';
import InAppNotification from './src/components/InAppNotification';
import { ThemeProvider } from './src/theme/themeContext';
import { loadSound } from './src/utils/sound';
import OfflineScreen from './src/screens/NoInternetScreen';

export default function App() {
  const loadPersistedState = useStore((state) => state.loadPersistedState);
  const [inAppNotif, setInAppNotif] = useState(null);
  const [isOnline,   setIsOnline]   = useState(null); 

  useEffect(() => {
    loadPersistedState();
    loadSound('accept', require('./assets/slide.mp3'));
    loadSound('order_auto_sound', require('./assets/notification.mp3'));
  }, []);

  const checkConnection = async () => {
    try {
      const res = await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        cache:  'no-cache',
      });
      setIsOnline(res.status === 204 || res.ok);
    } catch {
      setIsOnline(false);
    }
  };

  useEffect(() => {
    checkConnection();
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkConnection();
    });

    return () => appStateSub.remove();
  }, []);



  useEffect(() => {
    setupNotificationChannel();
  }, []);

  useEffect(() => {
    const foregroundSub = Notifications.addNotificationReceivedListener(async (notification) => {
      const notifEnabled = useStore.getState().notificationsEnabled;
      if (!notifEnabled) return;

      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;

      const { title, body } = notification.request.content;
      if (!title && !body) return;

      await playCustomSound();
      setInAppNotif({ title: title ?? '', body: body ?? '' });
    });
    return () => foregroundSub.remove();
  }, []);

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <View style={{ flex: 1 }}>
          <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
          <AppNavigator onStateChange={checkConnection} />
          {isOnline === false && (
            <OfflineScreen onRetry={checkConnection} />
          )}

          {inAppNotif && (
            <InAppNotification
              title={inAppNotif.title}
              body={inAppNotif.body}
              onDismiss={() => setInAppNotif(null)}
            />
          )}
        </View>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}