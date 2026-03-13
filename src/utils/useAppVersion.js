/**
 * useAppVersion
 *
 * Calls /user/matchVersion with the current device type + app version.
 * If the server says isVersionMatched: false → show the update gate.
 *
 * Usage in App.jsx:
 *   const { updateRequired, checking, checkVersion } = useAppVersion();
 */

import { useState, useEffect, useCallback } from 'react';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import api from '../utils/api';

// ── Change to match this build ────────────────────────────────────────────────
// Options: 'USER' | 'WAITER' | 'PARTNER' | 'WORKER'
const APP_TYPE = 'PARTNER';

export default function useAppVersion() {
  const currentVersion =
    Constants.expoConfig?.version ??
    Constants.manifest?.version ??
    Constants.manifest2?.extra?.expoClient?.version ??
    '0.0.0';

  const deviceType = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';

  const [updateRequired, setUpdateRequired] = useState(false);
  const [checking,       setChecking]       = useState(true);

  const checkVersion = useCallback(async () => {
    setChecking(true);
    try {
      const res = await api.post('/user/matchVersion', {
        type:    deviceType,
        version: currentVersion,
        app:     APP_TYPE,
      });

      const isMatched = res?.data?.data?.isVersionMatched ?? true;
      setUpdateRequired(!isMatched);
    } catch {
      // Fail open — never block the user on a network error
      setUpdateRequired(false);
    } finally {
      setChecking(false);
    }
  }, [currentVersion, deviceType]);

  useEffect(() => {
    checkVersion();
  }, [checkVersion]);

  return {
    updateRequired,  // boolean — true means show the update gate
    checking,        // boolean — true while API call is in-flight
    currentVersion,  // string  — installed version e.g. "1.0.3"
    checkVersion,    // fn      — re-run check (retry button)
  };
}