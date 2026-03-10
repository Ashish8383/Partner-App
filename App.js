import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, View } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import useStore from './src/store/useStore';
import { COLORS } from './src/constants/theme';
import * as Notifications from 'expo-notifications';
import { setupNotificationChannel, playCustomSound } from './src/utils/fcmToken';
import InAppNotification from './src/components/InAppNotification';
import { ThemeProvider } from './src/theme/themeContext';
import { loadSound } from './src/utils/sound';

export default function App() {
  const loadPersistedState = useStore((state) => state.loadPersistedState);
  const [inAppNotif, setInAppNotif] = useState(null);

  useEffect(() => {
    loadPersistedState();
    loadSound("accept", require('./assets/slide.mp3'));
    loadSound("order_auto_sound", require('./assets/notification.wav'));
  }, []);

  useEffect(() => {
    const init = async () => {
      await setupNotificationChannel();
    };
    init();
  }, []);

  useEffect(() => {
    const foregroundSub = Notifications.addNotificationReceivedListener(async (notification) => {
      const { title, body } = notification.request.content;

      // ✅ Sound plays ONCE here only
      await playCustomSound();


      // ✅ Show in-app popup
      setInAppNotif({ title, body });
    });

    return () => foregroundSub.remove();
  }, []);

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <View style={{ flex: 1 }}>
          <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
          <AppNavigator />

          {/* ✅ In-app notification banner */}
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