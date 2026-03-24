import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  StatusBar, Animated, Dimensions, Image, ActivityIndicator, Platform
} from 'react-native';
import { TabView } from 'react-native-tab-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { HapticTouchable } from '../components/GlobalHaptic';
import { playSound } from '../utils/sound';
import { nz, rs } from '../utils/constant';
import { ref, onChildAdded } from 'firebase/database';
import useStore from '../store/useStore';
import { ordersAPI } from '../utils/api';
import { db } from '../utils/firebaseConfig';
import { useNavigation, useRoute } from '@react-navigation/native';
import LottieView from 'lottie-react-native';
import { AppState } from 'react-native';

const GREEN = '#03954E';
const LIMIT = 30;
const { width: SW } = Dimensions.get('window');
const TAB_ORDER = ['live', 'pending'];

const TAB_CONFIG = {
  live: { fetcher: (p, id, extra) => ordersAPI.getLiveOrders(p, id, extra) },
  pending: { fetcher: (p, id, extra) => ordersAPI.getPendingOrders(p, id, extra) },
};

const ROUTES = [
  { key: 'live', title: 'Live', icon: 'circle' },
  { key: 'pending', title: 'Pending', icon: 'clock' },
];

const isNotificationGranted = async () => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
};

// ─── Skeleton ────────────────────────────────────────────────────────────────

const SkeletonPulse = ({ style }) => {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[sk.base, style, { opacity: anim }]} />;
};

const SkeletonCard = () => (
  <View style={sk.card}>
    <View style={sk.topRow}>
      <SkeletonPulse style={sk.avatar} />
      <View style={sk.nameBlock}>
        <SkeletonPulse style={sk.line1} />
        <SkeletonPulse style={sk.line2} />
        <SkeletonPulse style={sk.line3} />
      </View>
      <SkeletonPulse style={sk.badge} />
    </View>
    <SkeletonPulse style={sk.divider} />
    <SkeletonPulse style={sk.itemLine} />
    <SkeletonPulse style={[sk.itemLine, { width: '60%', marginTop: rs(8) }]} />
    <SkeletonPulse style={[sk.itemLine, { width: '45%', marginTop: rs(8) }]} />
    <SkeletonPulse style={sk.divider} />
    <SkeletonPulse style={sk.btnSkeleton} />
  </View>
);

const sk = StyleSheet.create({
  base: { backgroundColor: '#E8E8E8', borderRadius: rs(6) },
  card: { backgroundColor: '#fff', borderRadius: rs(16), padding: rs(16), marginBottom: rs(14), borderWidth: 1, borderColor: '#F0F0F0' },
  topRow: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: { width: rs(42), height: rs(42), borderRadius: rs(21), marginRight: rs(10) },
  nameBlock: { flex: 1, gap: rs(7) },
  line1: { height: rs(14), width: '72%' },
  line2: { height: rs(11), width: '52%' },
  line3: { height: rs(11), width: '40%' },
  badge: { width: rs(72), height: rs(62), borderRadius: rs(10), marginLeft: rs(8) },
  divider: { height: rs(1), marginVertical: rs(12) },
  itemLine: { height: rs(12), width: '80%' },
  btnSkeleton: { height: rs(50), borderRadius: rs(26), marginTop: rs(16) },
});

// ─── Tab Bar ─────────────────────────────────────────────────────────────────

const TAB_BAR_INNER_W = SW - rs(40) - rs(8);
const TAB_W = TAB_BAR_INNER_W / 2;
const PILL_POSITIONS = [0, TAB_W];

// ─── Ripple Alert Dot ─────────────────────────────────────────────────────────
// Two expanding rings that fade out behind a solid centre dot — "water ripple" effect.
// Used on the Live tab when there are pending orders.

const RippleDot = React.memo(({ color }) => {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Ring 2 starts 400ms after ring 1 so they feel staggered like real ripples
    const anim = Animated.loop(
      Animated.parallel([
        // Ring 1
        Animated.sequence([
          Animated.timing(ring1, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(ring1, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
        // Ring 2 — delayed
        Animated.sequence([
          Animated.delay(400),
          Animated.timing(ring2, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(ring2, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [ring1, ring2]);

  const DOT_SIZE = rs(9);
  const RING_MAX = rs(22);   // how far rings expand

  const makeRingStyle = (anim) => ({
    position: 'absolute',
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: rs(1.5),
    borderColor: color,
    opacity: anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.6, 0] }),
    transform: [{
      scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, RING_MAX / DOT_SIZE] }),
    }],
  });

  return (
    <View style={{ width: DOT_SIZE, height: DOT_SIZE, alignItems: 'center', justifyContent: 'center', marginRight: rs(5) }}>
      {/* Ring 1 */}
      <Animated.View style={makeRingStyle(ring1)} />
      {/* Ring 2 */}
      <Animated.View style={makeRingStyle(ring2)} />
      {/* Solid centre dot */}
      <View style={{ width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2, backgroundColor: color }} />
    </View>
  );
});

const CustomTabBar = React.memo(({ position, jumpTo, counts, blinkAnim }) => {
  const pillX = position.interpolate({
    inputRange: [0, 1],
    outputRange: PILL_POSITIONS,
    extrapolate: 'clamp',
  });

  const activeOpacities = ROUTES.map((_, i) =>
    position.interpolate({
      inputRange: [i - 1, i, i + 1],
      outputRange: [0, 1, 0],
      extrapolate: 'clamp',
    })
  );

  return (
    <View style={tb.wrapper}>
      <Animated.View
        pointerEvents="none"
        style={[tb.pill, { width: TAB_W, transform: [{ translateX: pillX }] }]}
      />
      {ROUTES.map((route, i) => {
        const count = counts[route.key] ?? 0;
        const label = `${route.title}${count > 0 ? ` (${count})` : ''}`;
        const activeOp = activeOpacities[i];
        const inactiveOp = activeOp.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
        const isLive = route.key === 'live';
        const hasAlert = isLive && count > 0;

        return (
          <HapticTouchable
            key={route.key}
            onPress={() => jumpTo(route.key)}
            activeOpacity={1}
            style={tb.tab}
          >
            <Animated.View style={tb.inner}>
              {/* Inactive state */}
              <Animated.View style={[tb.row, { opacity: inactiveOp }]}>
                {isLive
                  ? hasAlert
                    ? <RippleDot color={GREEN} />
                    : <View style={[tb.dot, { backgroundColor: '#1A1A1A' }]} />
                  : <Feather name={route.icon} size={nz(11)} color="#1A1A1A" style={tb.icon} />}
                <Text style={[tb.label, tb.labelInactive, hasAlert && { color: GREEN }]}>{label}</Text>
              </Animated.View>
              {/* Active (white pill) state */}
              <Animated.View style={[tb.row, tb.rowAbsolute, { opacity: activeOp }]}>
                {isLive
                  ? hasAlert
                    ? <RippleDot color="#fff" />
                    : <View style={[tb.dot, { backgroundColor: '#fff' }]} />
                  : <Feather name={route.icon} size={nz(11)} color="#fff" style={tb.icon} />}
                <Text style={[tb.label, tb.labelActive]}>{label}</Text>
              </Animated.View>
            </Animated.View>
          </HapticTouchable>
        );
      })}
    </View>
  );
});

const tb = StyleSheet.create({
  wrapper: { flexDirection: 'row', backgroundColor: '#EBEBEB', borderRadius: rs(50), padding: rs(4), marginHorizontal: rs(20), position: 'relative', alignItems: 'center' },
  pill: { position: 'absolute', top: rs(4), bottom: rs(4), left: rs(4), borderRadius: rs(50), backgroundColor: GREEN, elevation: 6, shadowColor: GREEN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: rs(10), zIndex: 1 },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  rowAbsolute: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  dot: { width: rs(7), height: rs(7), borderRadius: rs(4), marginRight: rs(5) },
  icon: { marginRight: rs(4) },
  label: { fontSize: nz(13), fontWeight: '700' },
  labelActive: { color: '#fff' },
  labelInactive: { color: '#1A1A1A' },
});

// ─── Slide To Accept ─────────────────────────────────────────────────────────
// Performance improvements:
//  • All interpolations pre-computed once (no re-creation on render)
//  • Shorter spring/timing durations for snappier feel
//  • Threshold lowered to 0.35 (was 0.40) for faster trigger
//  • Reset delay reduced from 750ms → 500ms

const SlideToAccept = React.memo(({ onAccepted, onSlideActiveChange }) => {
  const THUMB_W = rs(52);
  const TRACK_W = SW - rs(56);
  const MAX_SLIDE = TRACK_W - THUMB_W - rs(6);

  const slideX = useRef(new Animated.Value(0)).current;
  const completed = useRef(false);

  // Pre-compute all interpolations once
  const fillTranslateX = useRef(slideX.interpolate({
    inputRange: [0, MAX_SLIDE],
    outputRange: [-TRACK_W, -THUMB_W * 0.4],
    extrapolate: 'clamp',
  })).current;

  const thumbScale = useRef(slideX.interpolate({
    inputRange: [0, MAX_SLIDE * 0.5, MAX_SLIDE],
    outputRange: [1, 1.05, 1.1],
    extrapolate: 'clamp',
  })).current;

  const arrowOpacity = useRef(slideX.interpolate({
    inputRange: [MAX_SLIDE * 0.5, MAX_SLIDE * 0.8],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  })).current;

  const checkOpacity = useRef(slideX.interpolate({
    inputRange: [MAX_SLIDE * 0.65, MAX_SLIDE],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  })).current;

  const labelOpacity = useRef(slideX.interpolate({
    inputRange: [0, MAX_SLIDE * 0.2],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  })).current;

  const snapToEnd = useCallback((cb) => {
    Animated.spring(slideX, {
      toValue: MAX_SLIDE,
      useNativeDriver: true,
      damping: 22,       // tighter snap
      stiffness: 450,    // faster
      mass: 0.22,        // lighter = quicker
    }).start(cb);
  }, [slideX, MAX_SLIDE]);

  const snapBack = useCallback((velocity = 0) => {
    Animated.spring(slideX, {
      toValue: 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 200,
      mass: 0.4,
      velocity: velocity * -0.25,
    }).start();
  }, [slideX]);

  const slideGesture = Gesture.Pan()
    .activeOffsetX([3, 3])
    .failOffsetY([-12, 12])
    .runOnJS(true)
    .onBegin(() => onSlideActiveChange?.(true))
    .onUpdate((e) => {
      if (completed.current) return;
      const raw = Math.max(0, e.translationX);
      slideX.setValue(raw > MAX_SLIDE ? MAX_SLIDE + (raw - MAX_SLIDE) * 0.08 : raw);
    })
    .onEnd((e) => {
      if (completed.current) return;
      const progress = Math.max(0, e.translationX) / MAX_SLIDE;
      const fastFlick = e.velocityX > 250;   // was 300, lower = easier trigger
      if (progress > 0.35 || fastFlick) {    // was 0.40, lower = faster accept
        completed.current = true;
        snapToEnd(() => {
          playSound('accept');
          // ✅ Re-enable swipe IMMEDIATELY so user can swipe tabs right away
          onSlideActiveChange?.(false);
          onAccepted?.();
          setTimeout(() => {
            Animated.spring(slideX, {
              toValue: 0,
              useNativeDriver: true,
              damping: 26,
              stiffness: 130,
              mass: 0.8,
            }).start(() => {
              completed.current = false;
            });
          }, 500);
        });
      } else {
        snapBack(e.velocityX);
        onSlideActiveChange?.(false);
      }
    })
    .onFinalize(() => {
      // Only reset swipe lock if accept path hasn't already done it
      if (!completed.current) onSlideActiveChange?.(false);
    });

  return (
    <View style={sv.container}>
      <View style={[sv.track, { width: TRACK_W }]}>
        <Animated.View style={[sv.fill, { width: TRACK_W, transform: [{ translateX: fillTranslateX }] }]} />
        <Animated.Text style={[sv.label, { opacity: labelOpacity }]}>Slide to Accept Order</Animated.Text>
        <GestureDetector gesture={slideGesture}>
          <Animated.View style={[sv.thumb, { transform: [{ translateX: slideX }, { scale: thumbScale }] }]}>
            <Animated.View style={[StyleSheet.absoluteFill, sv.center, { opacity: arrowOpacity }]}>
              <MaterialIcons name="chevron-right" size={nz(30)} color="#1A1A1A" />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, sv.center, { opacity: checkOpacity }]}>
              <MaterialIcons name="check" size={nz(24)} color="#1A1A1A" />
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}, (prev, next) =>
  prev.onAccepted === next.onAccepted &&
  prev.onSlideActiveChange === next.onSlideActiveChange
);

const sv = StyleSheet.create({
  container: { marginTop: rs(16), alignItems: 'center' },
  track: { height: rs(58), borderRadius: rs(29), backgroundColor: 'rgba(3,149,78,0.08)', justifyContent: 'center', overflow: 'hidden', alignSelf: 'center', borderWidth: rs(1.5), borderColor: GREEN },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: GREEN },
  label: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: GREEN, fontSize: nz(14), fontWeight: '700', letterSpacing: 0.4 },
  thumb: { width: rs(52), height: rs(52), borderRadius: rs(26), backgroundColor: '#F5C518', position: 'absolute', left: rs(3), elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 6, zIndex: 10 },
  center: { justifyContent: 'center', alignItems: 'center' },
});

// ─── Order Card ───────────────────────────────────────────────────────────────
// Performance improvements:
//  • animateOut: all 3 exit animations run in a single Animated.parallel (no sequence overhead)
//  • Collapse runs immediately after opacity hits 0 (parallel, not sequential)
//  • Total exit time: ~220ms (was ~560ms)
//  • Deliver button uses same fast animateOut

const OrderCard = React.memo(({ item, tab, onAccepted, onDelivered, onSlideActiveChange }) => {
  const opacity = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const maxHeight = useRef(new Animated.Value(1200)).current;
  const marginBottom = useRef(new Animated.Value(rs(14))).current;
  const entranceScale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.spring(entranceScale, {
      toValue: 1, damping: 20, stiffness: 260, mass: 0.45, useNativeDriver: true,
    }).start();
  }, []);

  // Faster animateOut: flash + fly + collapse all in ~220ms total
  const animateOut = useCallback((callback) => {
    // Flash in
    Animated.timing(flashOpacity, { toValue: 0.88, duration: 80, useNativeDriver: true }).start();

    // Immediately start fly-out + fade (no sequence delay)
    Animated.parallel([
      Animated.timing(flashOpacity, { toValue: 0, duration: 160, delay: 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: SW * 0.5, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      // Collapse height immediately after card vanishes
      Animated.parallel([
        Animated.timing(maxHeight, { toValue: 0, duration: 160, useNativeDriver: false }),
        Animated.timing(marginBottom, { toValue: 0, duration: 160, useNativeDriver: false }),
      ]).start(() => callback());
    });
  }, [flashOpacity, opacity, translateX, maxHeight, marginBottom]);

  const handleAccept = useCallback(() => animateOut(() => onAccepted(item.id)), [animateOut, onAccepted, item.id]);
  const handleDeliver = useCallback(() => animateOut(() => onDelivered(item.id)), [animateOut, onDelivered, item.id]);

  return (
    <Animated.View style={{ maxHeight, marginBottom, overflow: 'hidden', borderRadius: rs(17) }}>
      <Animated.View style={{ transform: [{ scale: entranceScale }] }}>
        <Animated.View style={[oc.wrap, { opacity, transform: [{ translateX }] }]}>

          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, oc.flashOverlay, { opacity: flashOpacity }]}>
            <MaterialIcons name="check-circle" size={nz(48)} color="#fff" />
          </Animated.View>

          <View style={oc.topRow}>
            {/* Avatar — fixed size, never shrinks */}
            <View style={oc.avatar}>
              <Text style={oc.initials}>{item.initials}</Text>
            </View>

            {/* Name + meta — takes all remaining space, shrinks if needed */}
            <View style={oc.nameBlock}>
              <Text style={oc.name} numberOfLines={2}>{item.customerName}</Text>
              <View style={oc.metaRow}>
                <Feather name="clock" size={nz(11)} color="#999" />
                <Text style={oc.meta} numberOfLines={1}> Received at {item.receivedAt}</Text>
              </View>
              <View style={oc.metaRow}>
                <Feather name="calendar" size={nz(11)} color="#999" />
                <Text style={oc.meta} numberOfLines={1}> {item.date}</Text>
              </View>
            </View>

            {/* Seat badge — fixed width, label wraps, code auto-shrinks */}
            <View style={oc.seatBadge}>
              <Text style={oc.seatLabel} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
                {item.seat}
              </Text>
              <Text style={oc.seatCode} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                {item.seatCode}
              </Text>
            </View>
          </View>

          <View style={oc.divider} />

          <View style={oc.itemsHeader}>
            <View style={oc.greenSquare} />
            <Text style={oc.itemsTitle}>Ordered Items :</Text>
          </View>
          {item.items.map((it, i) => (
            <View key={i} style={oc.itemRow}>
              <Text style={oc.itemName}>{it.name}</Text>
              <Text style={oc.itemPrice}>{it.price}/-</Text>
            </View>
          ))}
          <View style={oc.dashed} />
          <View style={oc.itemRow}>
            <Text style={oc.totalLabel}>Total Bill</Text>
            <Text style={oc.totalPrice}>{item.total}/-</Text>
          </View>

          <View style={oc.divider} />
          <Text style={oc.orderId}>Order ID: {item.orderId}</Text>

          <View style={oc.noteBox}>
            <MaterialIcons name="warning-amber" size={nz(18)} color="#CC8800" />
            <Text style={oc.noteText}>{item.note}</Text>
          </View>

          {tab === 'live' && (
            <SlideToAccept onSlideActiveChange={onSlideActiveChange} onAccepted={handleAccept} />
          )}
          {tab === 'pending' && (
            <HapticTouchable onPress={handleDeliver} style={oc.deliverBtn} activeOpacity={0.82}>
              <MaterialIcons name="check" size={nz(18)} color="#fff" style={{ marginRight: rs(6) }} />
              <Text style={oc.deliverTxt}>Order Mark As Delivered</Text>
            </HapticTouchable>
          )}

        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}, (prev, next) => prev.item.id === next.item.id && prev.tab === next.tab);

const oc = StyleSheet.create({
  wrap: { backgroundColor: '#01690509', borderRadius: rs(16), marginBottom: rs(14), padding: rs(16), borderWidth: rs(1), borderColor: '#14131336' },
  topRow: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: { width: rs(42), height: rs(42), borderRadius: rs(21), backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', marginRight: rs(10), flexShrink: 0 },
  initials: { fontSize: nz(14), fontWeight: '700', color: '#555' },
  nameBlock: { flex: 1, flexShrink: 1, marginRight: rs(8) },
  name: { fontSize: nz(15), fontWeight: '700', color: '#1A1A1A', marginBottom: rs(4) },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: rs(3), flexShrink: 1 },
  meta: { fontSize: nz(12), color: '#666', flexShrink: 1 },
  // Seat badge: fixed width so it never pushes nameBlock, label wraps, code auto-fits
  seatBadge: { borderWidth: rs(1), borderColor: GREEN, backgroundColor: 'rgba(245,197,24,0.2)', borderRadius: rs(10), paddingHorizontal: rs(10), paddingVertical: rs(8), alignItems: 'center', width: rs(100), flexShrink: 0, alignSelf: 'flex-start' },
  seatLabel: { fontSize: nz(10), fontWeight: '600', color: '#1A1A1A', marginBottom: rs(3), textAlign: 'center', width: '100%' },
  seatCode: { fontSize: nz(24), fontWeight: '900', color: '#1A1A1A', letterSpacing: 0.5, width: '100%', textAlign: 'center' },
  divider: { height: 1, backgroundColor: '#F2F2F2', marginVertical: rs(12) },
  dashed: { borderBottomWidth: 1, borderStyle: 'dashed', borderColor: '#CCCCCC', marginBottom: rs(10) },
  itemsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: rs(10) },
  greenSquare: { width: rs(14), height: rs(14), borderRadius: rs(3), backgroundColor: GREEN, marginRight: rs(8) },
  itemsTitle: { fontSize: nz(14), fontWeight: '700', color: '#1A1A1A' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(8) },
  itemName: { fontSize: nz(13), color: '#444', flex: 1 },
  itemPrice: { fontSize: nz(13), color: '#1A1A1A', fontWeight: '600' },
  totalLabel: { fontSize: nz(14), fontWeight: '700', color: '#1A1A1A' },
  totalPrice: { fontSize: nz(14), fontWeight: '800', color: '#1A1A1A' },
  orderId: { fontSize: nz(12), color: '#AAAAAA', marginBottom: rs(10) },
  noteBox: { flexDirection: 'row', backgroundColor: '#fff5e6a9', borderRadius: rs(10), padding: rs(12), gap: rs(8), alignItems: 'flex-start', borderWidth: rs(1), borderColor: '#ffdd0343' },
  noteText: { flex: 1, fontSize: nz(12.5), color: '#885500', lineHeight: nz(19) },
  deliverBtn: { flexDirection: 'row', backgroundColor: GREEN, paddingVertical: rs(14), borderRadius: rs(26), alignItems: 'center', justifyContent: 'center', marginTop: rs(16) },
  deliverTxt: { fontSize: nz(15), fontWeight: '700', color: '#fff' },
  flashOverlay: { backgroundColor: GREEN, borderRadius: rs(16), alignItems: 'center', justifyContent: 'center', zIndex: 10 },
});

// ─── Data helpers ────────────────────────────────────────────────────────────

const makeTabState = () => ({ data: [], page: 1, totalDocs: 0, exhausted: false, fetching: false });

const normaliseOrder = (o) => {
  const seatParts = (o.seatNo ?? '').split('/');
  const parts = (o.fullname ?? '').trim().split(' ').filter(Boolean);
  const initials = (parts.length >= 2 ? parts[0][0] + parts[1][0] : (parts[0]?.[0] ?? '?')).toUpperCase();
  const d = o.OrderPlacedAt ? new Date(o.OrderPlacedAt) : null;
  return {
    id: o._id,
    orderRef: o.Id,
    orderId: o.OrderId,
    initials,
    customerName: (o.fullname ?? '').trim() || 'Customer',
    phone: o.phone,
    receivedAt: d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '—',
    date: d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '—',
    seat: seatParts[0]?.trim() ?? '',
    seatCode: seatParts[1]?.trim() ?? '',
    items: (o.order ?? []).map((it) => ({
      name: `${it.quantity}x ${it.foodName}`,
      price: (() => { const n = Number(it.amount * it.quantity); return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''); })(),
    })),
    total: (() => { const n = Number(o.TotalAmount); return n == null ? '0' : Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''); })(),
    note: 'Please ensure the invoice is provided to the customer at the time of food delivery, as the order is already entered in POS.',
    AcceptOrder: o.AcceptOrder,
    isDelivered: o.isDelivered,
    isCancelled: o.isCancelled,
  };
};

// ─── Tab Scene ───────────────────────────────────────────────────────────────

const TabScene = React.memo(({
  tabKey, loading, list, refreshing, onRefresh,
  isLoadingMore, isExhausted, onEndReached,
  onAccepted, onDelivered, onSlideActiveChange,
}) => {
  const renderItem = useCallback(({ item }) => (
    <OrderCard
      item={item} tab={tabKey}
      onAccepted={onAccepted} onDelivered={onDelivered}
      onSlideActiveChange={onSlideActiveChange}
    />
  ), [tabKey, onAccepted, onDelivered, onSlideActiveChange]);

  const keyExtractor = useCallback((o) => o.id, []);

  return (
    <View style={{ flex: 1 }}>
      {loading ? (
        <FlatList
          data={[1, 2, 3]} keyExtractor={(i) => String(i)}
          renderItem={() => <SkeletonCard />}
          contentContainerStyle={[s.listContent, { paddingBottom: rs(24) }]}
          showsVerticalScrollIndicator={false} scrollEnabled={false}
        />
      ) : (
        <FlatList
          data={list}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={5}
          maxToRenderPerBatch={3}
          windowSize={5}
          updateCellsBatchingPeriod={60}
          contentContainerStyle={[s.listContent, { paddingBottom: rs(24) }]}
          showsVerticalScrollIndicator={false}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.35}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={s.loadingMore}>
                <ActivityIndicator size="small" color={GREEN} />
                <Text style={s.loadingMoreText}>Loading more...</Text>
              </View>
            ) : isExhausted && list.length > 0 ? (
              <Text style={s.noMoreText}>— All orders loaded —</Text>
            ) : null
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GREEN]} tintColor={GREEN} />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              {tabKey === 'live' ? (
                <LottieView
                  source={require('../../assets/live.json')}
                  autoPlay
                  loop
                  style={s.lottie}
                />
              ) : (
                <LottieView
                  source={require('../../assets/pending.json')}
                  autoPlay
                  loop
                  style={s.lottie}
                />
              )}
              <Text style={s.emptyTitle}>
                {tabKey === 'live' ? 'No Orders Yet' : 'All Caught Up'}
              </Text>
              <Text style={s.emptySub}>
                {tabKey === 'live'
                  ? 'Your store is live and waiting for customers.'
                  : 'You have no pending deliveries right now.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
});

// ─── Home Screen ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, restaurantName, deviceFingerprint, fcmToken } = useStore();
  const navigation = useNavigation();
  const route = useRoute();
  const [tabIndex, setTabIndex] = useState(route.params?.initialTab ?? 0);
  const [swipeEnabled, setSwipeEnabled] = useState(true);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const tab = route.params?.initialTab;
      if (tab !== undefined) setTabIndex(tab);
    });
    return unsubscribe;
  }, [navigation, route.params?.initialTab]);

  const tabs = useRef({ live: makeTabState(), pending: makeTabState() });

  const [liveList, setLiveList] = useState([]);
  const [pendingList, setPendingList] = useState([]);

  const [loadingMoreMap, setLoadingMoreMap] = useState({ live: false, pending: false });
  const [exhaustedMap, setExhaustedMap] = useState({ live: false, pending: false });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Live alert: write count to store — App.js owns the sound globally ────
  const setLiveOrderCount = useStore((s) => s.setLiveOrderCount);

  // ── Live-tab blink ────────────────────────────────────────────────────────
  const blinkAnim = useRef(new Animated.Value(1)).current;
  const blinkLoopRef = useRef(null);
  const alertActiveRef = useRef(false);

  const startBlink = useCallback(() => {
    if (alertActiveRef.current) return;
    alertActiveRef.current = true;
    blinkLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0.15, duration: 500, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    blinkLoopRef.current.start();
  }, [blinkAnim]);

  const stopBlink = useCallback(() => {
    if (!alertActiveRef.current) return;
    alertActiveRef.current = false;
    blinkLoopRef.current?.stop();
    blinkLoopRef.current = null;
    Animated.timing(blinkAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  }, [blinkAnim]);

  // Watch liveList — update store count (App.js controls sound) + blink tab
  useEffect(() => {
    setLiveOrderCount(liveList.length);   // App.js reacts to this globally
    if (liveList.length > 0) {
      startBlink();
    } else {
      stopBlink();
    }
  }, [liveList.length, setLiveOrderCount, startBlink, stopBlink]);

  // Clean up blink only on unmount
  useEffect(() => {
    return () => {
      blinkLoopRef.current?.stop();
      setLiveOrderCount(0);              // stop sound in App.js on logout/unmount
    };
  }, []);

  const setListMap = useRef({ live: setLiveList, pending: setPendingList }).current;

  const flushTab = useCallback((tab) => {
    setListMap[tab]([...tabs.current[tab].data]);
  }, [setListMap]);

  const exhaustTab = useCallback((tab) => {
    tabs.current[tab].exhausted = true;
    setExhaustedMap((p) => ({ ...p, [tab]: true }));
  }, []);

  const getTodayDateParams = useCallback(() => {
    const s = new Date(); s.setHours(0, 0, 0, 0);
    const e = new Date(); e.setHours(23, 59, 59, 999);
    return { startDate: s.toISOString(), endDate: e.toISOString() };
  }, []);

  const loadTab = useCallback(async (tab) => {
    const id = user?.restaurantId ?? '';
    const extra = getTodayDateParams();
    try {
      const res = await TAB_CONFIG[tab].fetcher({ page: 1, limit: LIMIT }, id, extra);
      const meta = res?.data?.data?.orderData;
      const raw = Array.isArray(meta?.data) ? meta.data : [];
      const totalDocs = meta?.totalDocuments ?? 0;
      const normalised = raw.map(normaliseOrder);
      tabs.current[tab].data = normalised;
      tabs.current[tab].page = 1;
      tabs.current[tab].totalDocs = totalDocs;
      tabs.current[tab].exhausted = normalised.length === 0 || normalised.length >= totalDocs;
      flushTab(tab);
      setExhaustedMap((p) => ({ ...p, [tab]: tabs.current[tab].exhausted }));
    } catch {
      exhaustTab(tab);
    }
  }, [user?.restaurantId, flushTab, exhaustTab, getTodayDateParams]);

  const loadMoreTab = useCallback(async (tab) => {
    const t = tabs.current[tab];
    if (t.exhausted || t.fetching) return;
    t.fetching = true;
    setLoadingMoreMap((p) => ({ ...p, [tab]: true }));
    const nextPage = t.page + 1;
    const id = user?.restaurantId ?? '';
    const extra = getTodayDateParams();
    try {
      const res = await TAB_CONFIG[tab].fetcher({ page: nextPage, limit: LIMIT }, id, extra);
      const meta = res?.data?.data?.orderData;
      const raw = Array.isArray(meta?.data) ? meta.data : [];
      const totalDocs = meta?.totalDocuments ?? t.totalDocs;
      if (raw.length === 0) {
        exhaustTab(tab);
      } else {
        const existingIds = new Set(t.data.map((o) => o.id));
        const fresh = raw.map(normaliseOrder).filter((o) => !existingIds.has(o.id));
        t.data = [...t.data, ...fresh];
        t.page = nextPage;
        t.totalDocs = totalDocs;
        t.exhausted = fresh.length === 0 || nextPage * LIMIT >= totalDocs;
        flushTab(tab);
        setExhaustedMap((p) => ({ ...p, [tab]: t.exhausted }));
      }
    } catch {
      exhaustTab(tab);
    } finally {
      t.fetching = false;
      setLoadingMoreMap((p) => ({ ...p, live: false, pending: false }));
    }
  }, [user?.restaurantId, flushTab, exhaustTab, getTodayDateParams]);

  const initialLoad = useCallback(async () => {
    setLoading(true);
    tabs.current = { live: makeTabState(), pending: makeTabState() };
    setExhaustedMap({ live: false, pending: false });
    setLoadingMoreMap({ live: false, pending: false });
    setLiveList([]); setPendingList([]);
    await Promise.all(TAB_ORDER.map(loadTab));
    setLoading(false);
  }, [loadTab]);

  useEffect(() => { initialLoad(); }, [initialLoad]);

  // AppState: reload when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') initialLoad();
    });
    return () => subscription.remove();
  }, [initialLoad]);

  // Firebase real-time events
  useEffect(() => {
    const restaurantId = user?.restaurantId;
    if (!restaurantId) return;
    const eventsRef = ref(db, `${restaurantId}/events`);
    const skip = { current: true };
    const timer = setTimeout(() => { skip.current = false; }, 1500);

    const unsub = onChildAdded(eventsRef, async (snapshot) => {
      if (skip.current) return;
      const eventType = snapshot.val()?.data;

      if (eventType === 'ORDERPLACED') {
        const notificationsGranted = await isNotificationGranted();
        if (!notificationsGranted) playSound('order_auto_sound');
        tabs.current.live = makeTabState();
        setExhaustedMap((p) => ({ ...p, live: false }));
        setLoadingMoreMap((p) => ({ ...p, live: false }));
        loadTab('live');

      } else if (eventType === 'ACCEPTORDER') {
        tabs.current.live = makeTabState();
        tabs.current.pending = makeTabState();
        setExhaustedMap((p) => ({ ...p, live: false, pending: false }));
        setLoadingMoreMap((p) => ({ ...p, live: false, pending: false }));
        Promise.all([loadTab('live'), loadTab('pending')]);

      } else if (eventType === 'ORDERDELIVERED') {
        tabs.current.pending = makeTabState();
        setExhaustedMap((p) => ({ ...p, pending: false }));
        setLoadingMoreMap((p) => ({ ...p, pending: false }));
        loadTab('pending');
      }
    });

    return () => { clearTimeout(timer); unsub(); };
  }, [user?.restaurantId, loadTab]);
  
useEffect(() => {
  return () => {
    blinkLoopRef.current?.stop();
    setLiveOrderCount(0); 
  };
}, []);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    tabs.current = { live: makeTabState(), pending: makeTabState() };
    setExhaustedMap({ live: false, pending: false });
    setLoadingMoreMap({ live: false, pending: false });
    setLiveList([]); setPendingList([]);
    await Promise.all(TAB_ORDER.map(loadTab));
    setRefreshing(false);
  }, [loadTab]);

  const handleSlideActiveChange = useCallback((active) => {
    setSwipeEnabled(!active);
  }, []);

  const endReachedHandlers = useRef({
    live: () => { if (!tabs.current.live.exhausted && !tabs.current.live.fetching) loadMoreTab('live'); },
    pending: () => { if (!tabs.current.pending.exhausted && !tabs.current.pending.fetching) loadMoreTab('pending'); },
  }).current;

  // ── Accept: optimistic update, then API call ─────────────────────────────
  const handleAccepted = useCallback(async (id) => {
    const idx = tabs.current.live.data.findIndex((o) => o.id === id);
    if (idx === -1) return;
    const [order] = tabs.current.live.data.splice(idx, 1);
    tabs.current.pending.data.unshift({ ...order, AcceptOrder: true });
    flushTab('live');
    flushTab('pending');

    // Auto-switch to Live tab if pending becomes empty after this accept
    // (rare edge case — accepted order goes to pending, but if live is now empty switch there)
    if (tabs.current.live.data.length === 0) {
      setTimeout(() => setTabIndex(1), 280); // switch to Pending since order is now there
    }

    try {
      await ordersAPI.acceptOrder({ OrderId: order.orderRef, Id: user?.restaurantId ?? '' });
    } catch {
      // Rollback
      tabs.current.pending.data.shift();
      tabs.current.live.data.splice(idx, 0, order);
      flushTab('live');
      flushTab('pending');
      if (tabs.current.live.data.length === 1) setTabIndex(0);
    }
  }, [flushTab, user?.restaurantId]);

  // ── Deliver: optimistic update → auto-switch to Live if pending empty ────
  const handleDelivered = useCallback(async (id) => {
    const idx = tabs.current.pending.data.findIndex((o) => o.id === id);
    if (idx === -1) return;
    const [order] = tabs.current.pending.data.splice(idx, 1);

    playSound('deliver');
    flushTab('pending');

    // ✅ Auto-switch to Live tab when pending list becomes empty
    if (tabs.current.pending.data.length === 0) {
      setTimeout(() => setTabIndex(0), 280);
    }

    try {
      await ordersAPI.deliverOrder({ OrderId: order.orderRef, Id: user?.restaurantId ?? '' });
    } catch {
      // Rollback
      tabs.current.pending.data.splice(idx, 0, order);
      flushTab('pending');
      // Cancel the tab switch if rollback
    }
  }, [flushTab, user?.restaurantId]);

  const counts = { live: liveList.length, pending: pendingList.length };
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const renderScene = useCallback(({ route }) => (
    <TabScene
      tabKey={route.key}
      loading={loading}
      list={route.key === 'live' ? liveList : pendingList}
      refreshing={refreshing}
      onRefresh={onRefresh}
      isLoadingMore={loadingMoreMap[route.key]}
      isExhausted={exhaustedMap[route.key]}
      onEndReached={endReachedHandlers[route.key]}
      onAccepted={handleAccepted}
      onDelivered={handleDelivered}
      onSlideActiveChange={handleSlideActiveChange}
    />
  ), [
    loading, liveList, pendingList,
    refreshing, loadingMoreMap, exhaustedMap,
    onRefresh, handleAccepted, handleDelivered,
    handleSlideActiveChange, endReachedHandlers,
  ]);

  const renderTabBar = useCallback((props) => (
    <View style={s.tabSection}>
      <CustomTabBar {...props} counts={counts} />
    </View>
  ), [counts]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" translucent={false} />
      <View style={[s.root, { paddingTop: insets.top }]}>

        <View style={s.header}>
          <View>
            <Text style={s.title}>Hello, {restaurantName ?? 'Restaurant'} 👋</Text>
            <Text style={s.date}>{dateStr}</Text>
          </View>
        </View>

        <TabView
          navigationState={{ index: tabIndex, routes: ROUTES }}
          renderScene={renderScene}
          renderTabBar={renderTabBar}
          onIndexChange={setTabIndex}
          initialLayout={{ width: SW }}
          lazy
          lazyPreloadDistance={0}
          swipeEnabled={swipeEnabled}
          style={{ flex: 1 }}
        />

      </View>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: rs(20), paddingTop: rs(14), paddingBottom: rs(12), backgroundColor: '#fff' },
  title: { fontSize: nz(18), fontWeight: '800', color: '#0D0D0D', letterSpacing: -0.5 },
  lottie: { width: rs(350), height: rs(280), marginBottom: rs(0) },
  date: { fontSize: nz(12), color: '#363535', marginTop: rs(2) },
  tabSection: { backgroundColor: '#fff', paddingTop: rs(2), paddingBottom: rs(14) },
  listContent: { paddingHorizontal: rs(14), paddingTop: rs(6) },
  loadingMore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: rs(16), gap: rs(8) },
  loadingMoreText: { fontSize: nz(13), color: '#AAAAAA' },
  noMoreText: { textAlign: 'center', color: '#CCCCCC', fontSize: nz(12), paddingVertical: rs(16) },
  empty: { alignItems: 'center', paddingTop: rs(50), gap: rs(4) },
  emptyImage: { width: rs(180), height: rs(180), marginBottom: rs(8) },
  emptyTitle: { fontSize: nz(18), fontWeight: '700', color: '#1A1A1A' },
  emptySub: { fontSize: nz(13), color: '#888', textAlign: 'center', paddingHorizontal: rs(30), marginTop: rs(4) },
});