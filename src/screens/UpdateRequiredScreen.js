import React from 'react';
import {
  View, Text, StyleSheet, Platform, StatusBar, Linking, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HapticTouchable } from '../components/GlobalHaptic';
import { nz, rs } from '../utils/constant';

// ─── Colours ──────────────────────────────────────────────────────────────────
const BG          = '#EFEFEF';   
const BTN_COLOR   = '#116903';   

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.alfennzo.alfennzo_partner';
const APP_STORE_URL  = 'https://apps.apple.com/app/YOUR_APP_ID';
const STORE_URL      = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;

export default function UpdateRequiredScreen({ currentVersion, onRetry }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + rs(24) }]}>
      <StatusBar backgroundColor={BG} barStyle="dark-content" translucent={false} />

      <View style={s.topBlock}>
        <Text style={s.title}>Update Available</Text>
        {currentVersion ? (
          <Text style={s.version}>Current version {currentVersion}</Text>
        ) : null}
      </View>

      <View style={s.logoBlock}>
        <Image
          source={require('../../assets/logo.png')}
          style={s.logo}
          resizeMode="contain"
        />
      </View>

      <View style={s.bottomBlock}>
        <Text style={s.desc}>
          We have just released a major update for Alfennzo Partner for Improvements. Please update the app to continue using it.
        </Text>

        <HapticTouchable
          style={s.updateBtn}
          onPress={() => Linking.openURL(STORE_URL).catch(() => {})}
          activeOpacity={0.88}
        >
          <Text style={s.updateBtnText}>Update App</Text>
        </HapticTouchable>

        {onRetry && (
          <HapticTouchable style={s.retryBtn} onPress={onRetry} activeOpacity={0.7}>
            <Text style={s.retryText}>Already updated? Re-check</Text>
          </HapticTouchable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rs(28),
    paddingTop: rs(16),
  },

  // ── Top ──────────────────────────────────────────────────────────────────
  topBlock: {
    alignItems: 'center',
    paddingTop: rs(12),
    gap: rs(6),
    width: '100%',
  },
  title: {
    fontSize: nz(22),
    fontWeight: '800',
    color: '#111111',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  version: {
    fontSize: nz(13.5),
    color: '#777777',
    fontWeight: '400',
    textAlign: 'center',
  },

  // ── Logo ──────────────────────────────────────────────────────────────────
  logoBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: rs(500),
    height: rs(300),
  },

  // ── Bottom ────────────────────────────────────────────────────────────────
  bottomBlock: {
    width: '100%',
    alignItems: 'center',
    gap: rs(24),
    paddingBottom: rs(8),
  },
  desc: {
    fontSize: nz(14.5),
    color: '#333333',
    textAlign: 'center',
    lineHeight: nz(23),
    fontWeight: '400',
  },
  updateBtn: {
    width: '80%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BTN_COLOR,
    borderRadius: rs(18),
    paddingVertical: rs(18),
    elevation: 6,
    shadowColor: BTN_COLOR,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.30,
    shadowRadius: 10,
  },
  updateBtnText: {
    fontSize: nz(16),
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  retryBtn: {
    paddingVertical: rs(4),
    alignItems: 'center',
  },
  retryText: {
    fontSize: nz(13),
    color: '#AAAAAA',
  },
});