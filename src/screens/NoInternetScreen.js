import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet,
  Animated, Dimensions, PixelRatio,
  StatusBar
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import HapticTouchable from '../components/GlobalHaptic';

const { width: SW } = Dimensions.get('window');
const sc = SW / 390;
const rs = (n) => Math.round(n * Math.min(sc, 1.35));
const nz = (n) => Math.round(PixelRatio.roundToNearestPixel(n * Math.min(sc, 1.35)));

const BG   = '#F6F7F9';
const TX   = '#111827';
const SB   = '#6B7280';
const CARD = '#FFFFFF';
const RED  = '#EF4444';
const RED2 = '#FEF2F2';

export default function OfflineScreen({ onRetry }) {
  const insets     = useSafeAreaInsets();
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

    ripple(pulse1, 0);
    ripple(pulse2, 500);
    ripple(pulse3, 1000);
  }, []);

  const ringOpacity = (anim) =>
    anim.interpolate({ inputRange: [1, 1.55], outputRange: [0.35, 0] });

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <Animated.View style={[s.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={s.iconWrap}>
          {[pulse1, pulse2, pulse3].map((anim, i) => (
            <Animated.View
              key={i}
              style={[s.ring, {
                transform: [{ scale: anim }],
                opacity:   ringOpacity(anim),
              }]}
            />
          ))}
          <View style={s.iconCircle}>
            <Feather name="wifi-off" size={nz(32)} color={RED} />
          </View>
        </View>

        <Text style={s.title}>No Internet</Text>
        <Text style={s.sub}>Check your connection and try again</Text>
        <View style={s.pills}>
          {['Wi-Fi', 'Mobile Data', 'Airplane Mode'].map((label) => (
            <View key={label} style={s.pill}>
              <Text style={s.pillText}>{label}</Text>
            </View>
          ))}
        </View>

        <HapticTouchable
          onPress={handleRetry}
          disabled={retrying}
          activeOpacity={0.8}
          style={s.retryBtn}
        >
          <Feather
            name="refresh-cw"
            size={nz(15)}
            color="#FFFFFF"
            style={retrying && { opacity: 0.5 }}
          />
          <Text style={s.retryText}>{retrying ? 'Checking…' : 'Try Again'}</Text>
        </HapticTouchable>
      </Animated.View>
    </View>
  );
}

const RING_SIZE = rs(140);
const ICON_SIZE = rs(80);

const s = StyleSheet.create({
  root: {
    position:        'absolute', 
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: BG,
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          9999,
    elevation:       9999,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: rs(32),
  },

  iconWrap: {
    width:  RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: rs(28),
  },
  ring: {
    position:    'absolute',
    width:       ICON_SIZE,
    height:      ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    borderWidth:  rs(2),
    borderColor:  RED,
  },
  iconCircle: {
    width:           ICON_SIZE,
    height:          ICON_SIZE,
    borderRadius:    ICON_SIZE / 2,
    backgroundColor: RED2,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     rs(1.5),
    borderColor:     '#FECACA',
  },

  // text
  title: {
    fontSize:      nz(24),
    fontWeight:    '800',
    color:         TX,
    letterSpacing: -0.5,
    marginBottom:  rs(8),
  },
  sub: {
    fontSize:     nz(14),
    color:        SB,
    fontWeight:   '400',
    textAlign:    'center',
    lineHeight:   nz(21),
    marginBottom: rs(24),
  },

  pills: {
    flexDirection:  'row',
    gap:            rs(8),
    marginBottom:   rs(24),
    flexWrap:       'wrap',
    justifyContent: 'center',
  },
  pill: {
    backgroundColor: CARD,
    borderRadius:    rs(20),
    paddingHorizontal: rs(12),
    paddingVertical:   rs(6),
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     '#E5E7EB',
  },
  pillText: {
    fontSize:   nz(12),
    color:      SB,
    fontWeight: '500',
  },

  retryBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    backgroundColor:   RED,
    borderRadius:      rs(14),
    paddingHorizontal: rs(28),
    paddingVertical:   rs(13),
    marginBottom:      rs(12),
    gap:               rs(8),
    shadowColor:       RED,
    shadowOffset:      { width: 0, height: rs(4) },
    shadowOpacity:     0.3,
    shadowRadius:      rs(8),
    elevation:         4,
  },
  retryText: {
    fontSize:   nz(14),
    fontWeight: '700',
    color:      '#FFFFFF',
  },

  card: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   CARD,
    borderRadius:      rs(14),
    paddingHorizontal: rs(16),
    paddingVertical:   rs(12),
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       '#E5E7EB',
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: rs(1) },
    shadowOpacity:     0.04,
    shadowRadius:      rs(4),
    elevation:         1,
  },
  cardText: {
    fontSize:   nz(13),
    color:      SB,
    fontWeight: '500',
  },
});