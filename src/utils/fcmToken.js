import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';

const isNotificationPermitted = async () => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
};

let soundInstance = null;

export const playCustomSound = async () => {
  const permitted = await isNotificationPermitted();
  if (!permitted) {
    return;
  }

  try {
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
      require('../../assets/notification.mp3'),
      { shouldPlay: true, volume: 1.0 }
    );

    soundInstance = sound;
    await sound.playAsync();

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) {
        sound.unloadAsync();
        soundInstance = null;
      }
    });
  } catch (error) {
  }
};

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
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
      shouldShowBanner: false,
      shouldShowSound:  false, 
      shouldSetBadge:   true,
      shouldShowList:   true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    };
  },
});

export const setupNotificationChannel = async () => {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.deleteNotificationChannelAsync('high_importance_channel').catch(() => {});
    await Notifications.deleteNotificationChannelAsync('order_notifications').catch(() => {});
    await Notifications.deleteNotificationChannelAsync('urgent_notifications').catch(() => {});

    await Notifications.setNotificationChannelAsync(
      'high_importance_channel',
      {
        name: 'Default Notifications',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'notification.mp3',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF8C42',
        enableVibrate: true,
        enableLights: true,
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      }
    );
    await Notifications.setNotificationChannelAsync(
      'order_notifications',
      {
        name: 'Order Notifications',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'notification.mp3',
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
        sound: 'notification.mp3',
        vibrationPattern: [0, 500, 500, 500],
        lightColor: '#FF0000',
        enableVibrate: true,
        enableLights: true,
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      }
    );
    await Notifications.getNotificationChannelsAsync();
  } catch (error) {
  }
};

export const getFCMToken = async () => {
  try {
    if (!Device.isDevice) {
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const tokenData = await Notifications.getDevicePushTokenAsync();
    const fcmToken  = tokenData.data;
    return fcmToken;
  } catch (error) {
    return null;
  }
};