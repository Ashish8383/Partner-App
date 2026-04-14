import React from 'react';
import { View, Text, StyleSheet as SL3, Image, StatusBar, Linking, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HapticTouchable } from '../components/GlobalHaptic';
import { useResponsive } from '../utils/useResponsive';
 
const BTN_COLOR   = '#116903';
const PLAY_STORE  = 'https://play.google.com/store/apps/details?id=com.alfennzo.alfennzo_partner';
const APP_STORE   = 'https://apps.apple.com/app/YOUR_APP_ID';
const STORE_URL   = Platform.OS === 'ios' ? APP_STORE : PLAY_STORE;
 
export default function UpdateRequiredScreen({ currentVersion, onRetry }) {
  const insets = useSafeAreaInsets();
  const { nz, rs, isTablet, SW } = useResponsive();
 
  // Logo: landscape tablet needs tighter size to leave room for text
  const LOGO_W = Math.min(rs(420), SW * 0.75);
  const LOGO_H = Math.round(LOGO_W * (300 / 500));
 
  return (
    <View style={[u.root, {
      paddingTop: insets.top + rs(16),
      paddingBottom: insets.bottom + rs(24),
      paddingHorizontal: isTablet ? rs(60) : rs(28),
    }]}>
      <StatusBar backgroundColor="#EFEFEF" barStyle="dark-content" translucent={false} />
 
      <View style={u.top}>
        <Text style={{ fontSize: nz(22), fontWeight: '800', color: '#111111', letterSpacing: -0.2, textAlign: 'center' }}>Update Available</Text>
        {currentVersion ? <Text style={{ fontSize: nz(13.5), color: '#777777', textAlign: 'center' }}>Current version {currentVersion}</Text> : null}
      </View>
 
      <View style={u.logoBlock}>
        <Image source={require('../../assets/logo.png')} style={{ width: LOGO_W, height: LOGO_H }} resizeMode="contain" />
      </View>
 
      <View style={[u.bottom, { gap: rs(24) }]}>
        <Text style={{ fontSize: nz(14.5), color: '#333333', textAlign: 'center', lineHeight: nz(23) }}>
          We have just released a major update for Alfennzo Partner. Please update the app to continue.
        </Text>
        <HapticTouchable
          style={[u.updateBtn, { borderRadius: rs(18), paddingVertical: rs(18), shadowColor: BTN_COLOR }]}
          onPress={() => Linking.openURL(STORE_URL).catch(() => {})}
          activeOpacity={0.88}
        >
          <Text style={{ fontSize: nz(16), fontWeight: '600', color: '#FFFFFF', letterSpacing: 0.2 }}>Update App</Text>
        </HapticTouchable>
        {onRetry && (
          <HapticTouchable style={{ paddingVertical: rs(4), alignItems: 'center' }} onPress={onRetry} activeOpacity={0.7}>
            <Text style={{ fontSize: nz(13), color: '#AAAAAA' }}>Already updated? Re-check</Text>
          </HapticTouchable>
        )}
      </View>
    </View>
  );
}
 
const u = SL3.create({
  root:      { flex: 1, backgroundColor: '#EFEFEF', alignItems: 'center', justifyContent: 'space-between' },
  top:       { alignItems: 'center', gap: 6, width: '100%' },
  logoBlock: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottom:    { width: '100%', alignItems: 'center' },
  updateBtn: { width: '80%', alignItems: 'center', justifyContent: 'center', backgroundColor: BTN_COLOR, elevation: 6, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.30, shadowRadius: 10 },
});