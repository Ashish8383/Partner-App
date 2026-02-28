import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';

// fcmToken.js

let soundInstance = null; // ← track sound instance

export const playCustomSound = async () => {
  try {
    // ✅ Stop if already playing
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

// ✅ NO playCustomSound here — only return values
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isLocal = notification.request.trigger?.type !== 'push';
    if (isLocal) {
      return {
        shouldShowBanner: false,
        shouldShowSound: false,
        shouldSetBadge: false,
        shouldShowList: false,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      };
    }

    return {
      shouldShowBanner: false, // ← in-app popup handles this
      shouldShowSound: false,  // ← expo-av handles this
      shouldSetBadge: true,
      shouldShowList: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    };
  },
});

export const setupNotificationChannel = async () => {
  console.log('🚀 setupNotificationChannel started');

  if (Platform.OS !== 'android') {
    console.log('⏭️ Skipping - not android');
    return;
  }

  try {
    console.log('🗑️ Deleting old channels...');
    await Notifications.deleteNotificationChannelAsync('default').catch(() => {});
    await Notifications.deleteNotificationChannelAsync('orders').catch(() => {});
    console.log('✅ Old channels deleted');

    const defaultChannel = await Notifications.setNotificationChannelAsync('default', {
      name: 'Default Notifications',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'notification.wav',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF8C42',
      enableVibrate: true,
      enableLights: true,
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    console.log('✅ Default channel created:', defaultChannel?.id);
    console.log('🔊 Default channel sound:', defaultChannel?.sound);

    const ordersChannel = await Notifications.setNotificationChannelAsync('orders', {
      name: 'Order Notifications',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'notification.wav',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF8C42',
      enableVibrate: true,
      enableLights: true,
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    console.log('✅ Orders channel created:', ordersChannel?.id);
    console.log('🔊 Orders channel sound:', ordersChannel?.sound);

    const channels = await Notifications.getNotificationChannelsAsync();
    console.log('📱 All active channels:', channels.map(c => `${c.id} → sound: ${c.sound}`));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('❌ Stack:', error.stack);
  }
};

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
    const fcmToken = tokenData.data;

    console.log('✅ FCM Token obtained:', fcmToken.substring(0, 20) + '...');
    console.log('📱 Token type:', tokenData.type);

    return fcmToken;
  } catch (error) {
    console.error('❌ Push token error:', error);
    return null;
  }
};