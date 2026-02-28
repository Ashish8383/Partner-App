import * as Device from 'expo-device';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getFCMToken } from './fcmToken';

export const getDeviceInfo = async () => {
  try {
    // Get device fingerprint
    const deviceFingerprint = await getDeviceFingerprint();

    // Get FCM token
    const fcmToken = await getFCMToken();

    return {
      fcmToken,
      deviceFingerprint,
      deviceInfo: {
        platform:Platform.OS === 'android'
          ? 'Android'
          : Platform.OS === 'ios'
            ? 'iOS'
            : 'Web',
        deviceName: Device.deviceName || 'Unknown Device',
        deviceModel: Device.modelName || 'Unknown Model',
        osVersion: Device.osVersion || Platform.Version,
        appVersion: Application.nativeApplicationVersion || '1.0.0',
        userAgent: Constants.manifest?.extra?.userAgent || 'Alfennzo Partner App',
        isDevice: Device.isDevice,
        brand: Device.brand,
        manufacturer: Device.manufacturer,
      }
    };
  } catch (error) {
    console.error('Error getting device info:', error);
    return {
      fcmToken: null,
      deviceFingerprint: 'unknown-' + Date.now(),
      deviceInfo: {
        platform: Platform.OS,
        deviceName: 'Unknown',
        deviceModel: 'Unknown',
        osVersion: 'Unknown',
        appVersion: '1.0.0',
        userAgent: 'Alfennzo Partner App',
        isDevice: false,
      }
    };
  }
};

export const getDeviceFingerprint = async () => {
  try {
    if (Platform.OS === 'ios') {
      // For iOS, use identifierForVendor
      return await Application.getIosIdForVendorAsync() || 'ios-' + Date.now();
    } else {
      // For Android, use Android ID
      return Application.androidId || 'android-' + Date.now();
    }
  } catch (error) {
    // Fallback fingerprint
    return Platform.OS + '-' + Date.now() + '-' + Math.random().toString(36).substring(7);
  }
};

export const determineLoginType = (input) => {
  // Check if input is phone number (contains only digits and optional +, -, space)
  const phoneRegex = /^[\+\d\s-]{10,}$/;
  const isPhone = phoneRegex.test(input.replace(/[\s-]/g, ''));

  return isPhone ? 'phone' : 'username';
};