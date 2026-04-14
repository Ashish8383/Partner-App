import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet as SL2, Animated, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import HapticTouchable from '../components/GlobalHaptic';
import { useResponsive } from '../utils/useResponsive';
 
const BG2 = '#F6F7F9', TX2 = '#111827', SB2 = '#6B7280', CARD2 = '#FFFFFF', RED = '#EF4444', RED2 = '#FEF2F2';
 
export default function OfflineScreen({ onRetry }) {
  const insets  = useSafeAreaInsets();
  const { nz, rs } = useResponsive();
  const [retrying, setRetrying] = useState(false);
 
  const handleRetry = async () => {
    if (!onRetry) return;
    setRetrying(true);
    await onRetry();
    setRetrying(false);
  };
 
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const pulse1    = useRef(new Animated.Value(1)).current;
  const pulse2    = useRef(new Animated.Value(1)).current;
  const pulse3    = useRef(new Animated.Value(1)).current;
 
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, damping: 14, stiffness: 120, useNativeDriver: true }),
    ]).start();
    const ripple = (anim, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1.55, duration: 1400, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 1,    duration: 0,    useNativeDriver: true }),
        ])
      ).start();
    ripple(pulse1, 0); ripple(pulse2, 500); ripple(pulse3, 1000);
  }, []);
 
  const RING_SIZE = rs(140);
  const ICON_SIZE = rs(80);
 
  const ringOp = (anim) => anim.interpolate({ inputRange: [1, 1.55], outputRange: [0.35, 0] });
 
  return (
    <View style={[o.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor={BG2} />
      <Animated.View style={[o.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }], paddingHorizontal: rs(32) }]}>
        <View style={[o.iconWrap, { width: RING_SIZE, height: RING_SIZE, marginBottom: rs(28) }]}>
          {[pulse1, pulse2, pulse3].map((anim, i) => (
            <Animated.View key={i} style={{ position: 'absolute', width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE / 2, borderWidth: rs(2), borderColor: RED, transform: [{ scale: anim }], opacity: ringOp(anim) }} />
          ))}
          <View style={{ width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE / 2, backgroundColor: RED2, alignItems: 'center', justifyContent: 'center', borderWidth: rs(1.5), borderColor: '#FECACA' }}>
            <Feather name="wifi-off" size={nz(32)} color={RED} />
          </View>
        </View>
        <Text style={{ fontSize: nz(24), fontWeight: '800', color: TX2, letterSpacing: -0.5, marginBottom: rs(8) }}>No Internet</Text>
        <Text style={{ fontSize: nz(14), color: SB2, textAlign: 'center', lineHeight: nz(21), marginBottom: rs(24) }}>Check your connection and try again</Text>
        <View style={{ flexDirection: 'row', gap: rs(8), marginBottom: rs(24), flexWrap: 'wrap', justifyContent: 'center' }}>
          {['Wi-Fi', 'Mobile Data', 'Airplane Mode'].map((label) => (
            <View key={label} style={{ backgroundColor: CARD2, borderRadius: rs(20), paddingHorizontal: rs(12), paddingVertical: rs(6), borderWidth: SL2.hairlineWidth, borderColor: '#E5E7EB' }}>
              <Text style={{ fontSize: nz(12), color: SB2, fontWeight: '500' }}>{label}</Text>
            </View>
          ))}
        </View>
        <HapticTouchable onPress={handleRetry} disabled={retrying} activeOpacity={0.8}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: RED, borderRadius: rs(14), paddingHorizontal: rs(28), paddingVertical: rs(13), marginBottom: rs(12), gap: rs(8), shadowColor: RED, shadowOffset: { width: 0, height: rs(4) }, shadowOpacity: 0.3, shadowRadius: rs(8), elevation: 4 }}>
          <Feather name="refresh-cw" size={nz(15)} color="#FFFFFF" style={retrying && { opacity: 0.5 }} />
          <Text style={{ fontSize: nz(14), fontWeight: '700', color: '#FFFFFF' }}>{retrying ? 'Checking…' : 'Try Again'}</Text>
        </HapticTouchable>
      </Animated.View>
    </View>
  );
}
 
const o = SL2.create({
  root:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: BG2, alignItems: 'center', justifyContent: 'center', zIndex: 9999, elevation: 9999 },
  content: { alignItems: 'center' },
  iconWrap:{ alignItems: 'center', justifyContent: 'center' },
});
