import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';

// ─── Shared permission check ──────────────────────────────────────────────────
const isNotificationPermitted = async () => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
};

// ─── Sound ────────────────────────────────────────────────────────────────────
let soundInstance = null;

export const playCustomSound = async () => {
  // ✅ Bail out immediately if user has not granted notification permission
  const permitted = await isNotificationPermitted();
  if (!permitted) {
    console.log('🔕 Sound skipped — notifications not permitted');
    return;
  }

  try {
    // Stop any currently playing instance
    if (soundInstance) {
      await soundInstance.stopAsync();
      await soundInstance.unloadAsync();
      soundInstance = null;
    }

    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    });

    const { sound } = await Audio.Sound.createAsync(
      require('../../assets/notification.wav'),
      { shouldPlay: true, volume: 1.0 }
    );

    soundInstance = sound;
    console.log('🔊 Playing custom sound...');
    await sound.playAsync();

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) {
        sound.unloadAsync();
        soundInstance = null;
        console.log('✅ Sound finished');
      }
    });
  } catch (error) {
    console.error('❌ Sound play error:', error.message);
  }
};

// ─── Notification handler ─────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // ✅ If not permitted, suppress everything
    const permitted = await isNotificationPermitted();
    if (!permitted) {
      return {
        shouldShowBanner: false,
        shouldShowSound:  false,
        shouldSetBadge:   false,
        shouldShowList:   false,
      };
    }

    const isLocal = notification.request.trigger?.type !== 'push';
    if (isLocal) {
      return {
        shouldShowBanner: false,
        shouldShowSound:  false,
        shouldSetBadge:   false,
        shouldShowList:   false,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      };
    }

    return {
      shouldShowBanner: false, // in-app popup handles this
      shouldShowSound:  false, // expo-av handles this
      shouldSetBadge:   true,
      shouldShowList:   true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    };
  },
});

// ─── Channel setup ────────────────────────────────────────────────────────────
export const setupNotificationChannel = async () => {
  console.log('🚀 setupNotificationChannel started');

  if (Platform.OS !== 'android') return;

  try {
    await Notifications.deleteNotificationChannelAsync('high_importance_channel').catch(() => {});
    await Notifications.deleteNotificationChannelAsync('order_notifications').catch(() => {});
    await Notifications.deleteNotificationChannelAsync('urgent_notifications').catch(() => {});

    const defaultChannel = await Notifications.setNotificationChannelAsync(
      'high_importance_channel',
      {
        name: 'Default Notifications',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'notification.wav',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF8C42',
        enableVibrate: true,
        enableLights: true,
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      }
    );
    console.log('✅ Default channel created:', defaultChannel?.id);

    await Notifications.setNotificationChannelAsync(
      'order_notifications',
      {
        name: 'Order Notifications',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'notification.wav',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF8C42',
        enableVibrate: true,
        enableLights: true,
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      }
    );

    const urgentChannel = await Notifications.setNotificationChannelAsync(
      'urgent_notifications',
      {
        name: 'Urgent Notifications',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'notification.wav',
        vibrationPattern: [0, 500, 500, 500],
        lightColor: '#FF0000',
        enableVibrate: true,
        enableLights: true,
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      }
    );
    console.log('✅ Urgent channel created:', urgentChannel?.id);

    const channels = await Notifications.getNotificationChannelsAsync();
    console.log(
      '📱 All active channels:',
      channels.map((c) => `${c.id} → sound: ${c.sound}`)
    );
  } catch (error) {
    console.error('❌ Channel setup error:', error.message);
  }
};

// ─── Get FCM token ────────────────────────────────────────────────────────────
export const getFCMToken = async () => {
  try {
    if (!Device.isDevice) {
      console.log('Must use physical device for push notifications');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('❌ Push notification permission not granted');
      return null;
    }

    const tokenData = await Notifications.getDevicePushTokenAsync();
    const fcmToken  = tokenData.data;

    console.log('✅ FCM Token obtained:', fcmToken.substring(0, 20) + '...');
    console.log('📱 Token type:', tokenData.type);

    return fcmToken;
  } catch (error) {
    console.error('❌ Push token error:', error);
    return null;
  }
};