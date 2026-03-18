import * as Device from 'expo-device';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getFCMToken } from './fcmToken';

export const getDeviceFingerprint = async () => {
  try {
    if (Platform.OS === 'ios') {
      const iosId = await Application.getIosIdForVendorAsync();
      return iosId || 'ios-fallback';
    } else {
  
      const androidId = Application.getAndroidId();
      return androidId || 'android-fallback';
    }
  } catch (error) {
    const stableId = `${Platform.OS}-${Device.modelName}-${Device.osVersion}`
      .replace(/\s+/g, '-')
      .toLowerCase();
    return stableId;
  }
};

export const getDeviceInfo = async () => {
  try {
    const deviceFingerprint = await getDeviceFingerprint();
    const fcmToken = await getFCMToken();

    return {
      fcmToken,
      deviceFingerprint,
      deviceInfo: {
        platform: Platform.OS === 'android'
          ? 'Android'
          : Platform.OS === 'ios'
            ? 'iOS'
            : 'Web',
        deviceName:   Device.deviceName  || 'Unknown Device',
        deviceModel:  Device.modelName   || 'Unknown Model',
        osVersion:    Device.osVersion   || String(Platform.Version),
        appVersion:   Application.nativeApplicationVersion || '1.0.0',
        userAgent:    Constants.manifest?.extra?.userAgent || 'Alfennzo Partner App',
        isDevice:     Device.isDevice,
        brand:        Device.brand,
        manufacturer: Device.manufacturer,
      }
    };
  } catch (error) {
    const stableId = `${Platform.OS}-${Device.modelName}-${Device.osVersion}`
      .replace(/\s+/g, '-')
      .toLowerCase();

    return {
      fcmToken: null,
      deviceFingerprint: stableId,
      deviceInfo: {
        platform:    Platform.OS,
        deviceName:  Device.deviceName  || 'Unknown',
        deviceModel: Device.modelName   || 'Unknown',
        osVersion:   String(Platform.Version),
        appVersion:  '1.0.0',
        userAgent:   'Alfennzo Partner App',
        isDevice:    Device.isDevice || false,
      }
    };
  }
};

export const determineLoginType = (input) => {
  const phoneRegex = /^[\+\d\s-]{10,}$/;
  const isPhone = phoneRegex.test(input.replace(/[\s-]/g, ''));
  return isPhone ? 'phone' : 'username';
};