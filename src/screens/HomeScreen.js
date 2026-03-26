import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  StatusBar, Animated, ActivityIndicator, Platform, AppState,
} from 'react-native';
import { TabView }           from 'react-native-tab-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import * as Notifications    from 'expo-notifications';
import { HapticTouchable }   from '../components/GlobalHaptic';
import { playSound }         from '../utils/sound';
import { useResponsive }     from '../utils/useResponsive';
import { ref, onChildAdded } from 'firebase/database';
import useStore              from '../store/useStore';
import { ordersAPI }         from '../utils/api';
import { db }                from '../utils/firebaseConfig';
import { useNavigation, useRoute } from '@react-navigation/native';
import LottieView            from 'lottie-react-native';

const GREEN = '#03954E';
const LIMIT = 30;

const TAB_ORDER = ['live', 'pending'];
const TAB_CONFIG = {
  live:    { fetcher: (p, id, extra) => ordersAPI.getLiveOrders(p, id, extra) },
  pending: { fetcher: (p, id, extra) => ordersAPI.getPendingOrders(p, id, extra) },
};
const ROUTES = [
  { key: 'live',    title: 'Live',    icon: 'circle' },
  { key: 'pending', title: 'Pending', icon: 'clock'  },
];

const isNotificationGranted = async () => {
  try { const { status } = await Notifications.getPermissionsAsync(); return status === 'granted'; }
  catch { return false; }
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const SkeletonPulse = ({ style }) => {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1,   duration: 750, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0.4, duration: 750, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[{ backgroundColor: '#E8E8E8', borderRadius: 6 }, style, { opacity: anim }]} />;
};

const SkeletonCard = ({ rs, nz, cardW }) => (
  <View style={{
    width: cardW, backgroundColor: '#fff', borderRadius: rs(16),
    padding: rs(16), marginBottom: rs(14), borderWidth: 1, borderColor: '#F0F0F0',
  }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <SkeletonPulse style={{ width: rs(42), height: rs(42), borderRadius: rs(21), marginRight: rs(10) }} />
      <View style={{ flex: 1, gap: rs(7) }}>
        <SkeletonPulse style={{ height: rs(14), width: '72%' }} />
        <SkeletonPulse style={{ height: rs(11), width: '52%' }} />
        <SkeletonPulse style={{ height: rs(11), width: '40%' }} />
      </View>
      <SkeletonPulse style={{ width: rs(68), height: rs(58), borderRadius: rs(10), marginLeft: rs(8) }} />
    </View>
    <SkeletonPulse style={{ height: rs(1), marginVertical: rs(12) }} />
    <SkeletonPulse style={{ height: rs(12), width: '80%' }} />
    <SkeletonPulse style={{ height: rs(12), width: '60%', marginTop: rs(8) }} />
    <SkeletonPulse style={{ height: rs(50), borderRadius: rs(26), marginTop: rs(16) }} />
  </View>
);

// ─── Ripple Dot ───────────────────────────────────────────────────────────────
const RippleDot = React.memo(({ color, rs }) => {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const DOT   = rs(9);
  const RING  = rs(22);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(ring1, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(ring1, { toValue: 0, duration: 0,    useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(400),
          Animated.timing(ring2, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(ring2, { toValue: 0, duration: 0,    useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const makeRing = (a) => ({
    position: 'absolute', width: DOT, height: DOT, borderRadius: DOT / 2,
    borderWidth: 1.5, borderColor: color,
    opacity:   a.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.6, 0] }),
    transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, RING / DOT] }) }],
  });

  return (
    <View style={{ width: DOT, height: DOT, alignItems: 'center', justifyContent: 'center', marginRight: rs(5) }}>
      <Animated.View style={makeRing(ring1)} />
      <Animated.View style={makeRing(ring2)} />
      <View style={{ width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: color }} />
    </View>
  );
});

// ─── Custom Tab Bar ───────────────────────────────────────────────────────────
const CustomTabBar = React.memo(({ position, jumpTo, counts, SW, rs, nz }) => {
  const TAB_BAR_W = SW - rs(40) - rs(8);
  const TAB_W     = TAB_BAR_W / 2;
  const pillX     = position.interpolate({ inputRange: [0, 1], outputRange: [0, TAB_W], extrapolate: 'clamp' });
  const activeOps = ROUTES.map((_, i) =>
    position.interpolate({ inputRange: [i - 1, i, i + 1], outputRange: [0, 1, 0], extrapolate: 'clamp' })
  );

  return (
    <View style={[tbS.wrapper, { borderRadius: rs(50), padding: rs(4), marginHorizontal: rs(20) }]}>
      <Animated.View pointerEvents="none"
        style={[tbS.pill, { width: TAB_W, borderRadius: rs(50), transform: [{ translateX: pillX }] }]} />
      {ROUTES.map((route, i) => {
        const count    = counts[route.key] ?? 0;
        const label    = `${route.title}${count > 0 ? ` (${count})` : ''}`;
        const activeOp = activeOps[i];
        const inactOp  = activeOp.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
        const isLive   = route.key === 'live';
        const hasAlert = isLive && count > 0;

        return (
          <HapticTouchable key={route.key} onPress={() => jumpTo(route.key)} activeOpacity={1}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: rs(10), zIndex: 1 }}>
            <Animated.View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Animated.View style={[{ flexDirection: 'row', alignItems: 'center' }, { opacity: inactOp }]}>
                {isLive
                  ? hasAlert ? <RippleDot color={GREEN} rs={rs} /> : <View style={{ width: rs(7), height: rs(7), borderRadius: rs(4), backgroundColor: '#1A1A1A', marginRight: rs(5) }} />
                  : <Feather name={route.icon} size={nz(11)} color="#1A1A1A" style={{ marginRight: rs(4) }} />}
                <Text style={{ fontSize: nz(13), fontWeight: '700', color: hasAlert ? GREEN : '#1A1A1A' }}>{label}</Text>
              </Animated.View>
              <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center' }, { opacity: activeOp }]}>
                {isLive
                  ? hasAlert ? <RippleDot color="#fff" rs={rs} /> : <View style={{ width: rs(7), height: rs(7), borderRadius: rs(4), backgroundColor: '#fff', marginRight: rs(5) }} />
                  : <Feather name={route.icon} size={nz(11)} color="#fff" style={{ marginRight: rs(4) }} />}
                <Text style={{ fontSize: nz(13), fontWeight: '700', color: '#fff' }}>{label}</Text>
              </Animated.View>
            </Animated.View>
          </HapticTouchable>
        );
      })}
    </View>
  );
});

const tbS = StyleSheet.create({
  wrapper: { flexDirection: 'row', backgroundColor: '#EBEBEB', position: 'relative', alignItems: 'center' },
  pill:    { position: 'absolute', top: 4, bottom: 4, left: 4, backgroundColor: GREEN, elevation: 6, shadowColor: GREEN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8 },
});

// ─── Slide To Accept ──────────────────────────────────────────────────────────
// cardW is the width of the card this slider lives inside — slider fills it edge to edge.
const SlideToAccept = React.memo(({ onAccepted, onSlideActiveChange, cardW, rs, nz }) => {
  const THUMB_W   = rs(52);
  const TRACK_W   = cardW - rs(32);   // 16px card padding × 2
  const MAX_SLIDE = TRACK_W - THUMB_W - rs(6);

  const slideX    = useRef(new Animated.Value(0)).current;
  const completed = useRef(false);

  const fillTX     = slideX.interpolate({ inputRange: [0, MAX_SLIDE], outputRange: [-TRACK_W, -THUMB_W * 0.4], extrapolate: 'clamp' });
  const thumbScale = slideX.interpolate({ inputRange: [0, MAX_SLIDE * 0.5, MAX_SLIDE], outputRange: [1, 1.05, 1.1], extrapolate: 'clamp' });
  const arrowOp    = slideX.interpolate({ inputRange: [MAX_SLIDE * 0.5, MAX_SLIDE * 0.8], outputRange: [1, 0], extrapolate: 'clamp' });
  const checkOp    = slideX.interpolate({ inputRange: [MAX_SLIDE * 0.65, MAX_SLIDE], outputRange: [0, 1], extrapolate: 'clamp' });
  const labelOp    = slideX.interpolate({ inputRange: [0, MAX_SLIDE * 0.2], outputRange: [1, 0], extrapolate: 'clamp' });

  const snapToEnd = useCallback((cb) => {
    Animated.spring(slideX, { toValue: MAX_SLIDE, useNativeDriver: true, damping: 22, stiffness: 450, mass: 0.22 }).start(cb);
  }, [slideX, MAX_SLIDE]);

  const snapBack = useCallback((vel = 0) => {
    Animated.spring(slideX, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 200, mass: 0.4, velocity: vel * -0.25 }).start();
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
      if (progress > 0.35 || e.velocityX > 250) {
        completed.current = true;
        snapToEnd(() => {
          playSound('accept');
          onSlideActiveChange?.(false);
          onAccepted?.();
          setTimeout(() => {
            Animated.spring(slideX, { toValue: 0, useNativeDriver: true, damping: 26, stiffness: 130, mass: 0.8 })
              .start(() => { completed.current = false; });
          }, 500);
        });
      } else {
        snapBack(e.velocityX);
        onSlideActiveChange?.(false);
      }
    })
    .onFinalize(() => { if (!completed.current) onSlideActiveChange?.(false); });

  return (
    <View style={{ marginTop: rs(16), alignItems: 'center' }}>
      <View style={{
        width: TRACK_W, height: rs(58), borderRadius: rs(29),
        backgroundColor: 'rgba(3,149,78,0.08)',
        justifyContent: 'center', overflow: 'hidden',
        alignSelf: 'center', borderWidth: 1.5, borderColor: GREEN,
      }}>
        <Animated.View style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: TRACK_W, backgroundColor: GREEN, transform: [{ translateX: fillTX }],
        }} />
        <Animated.Text style={{
          position: 'absolute', left: 0, right: 0, textAlign: 'center',
          color: GREEN, fontSize: nz(13), fontWeight: '700', letterSpacing: 0.4, opacity: labelOp,
        }}>
          Slide to Accept
        </Animated.Text>
        <GestureDetector gesture={slideGesture}>
          <Animated.View style={{
            width: rs(52), height: rs(52), borderRadius: rs(26), backgroundColor: '#F5C518',
            position: 'absolute', left: rs(3), elevation: 8,
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 6,
            zIndex: 10, transform: [{ translateX: slideX }, { scale: thumbScale }],
          }}>
            <Animated.View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', opacity: arrowOp }]}>
              <MaterialIcons name="chevron-right" size={nz(30)} color="#1A1A1A" />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', opacity: checkOp }]}>
              <MaterialIcons name="check" size={nz(24)} color="#1A1A1A" />
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}, (prev, next) =>
  prev.onAccepted          === next.onAccepted &&
  prev.onSlideActiveChange === next.onSlideActiveChange &&
  prev.cardW               === next.cardW
);

// ─── Order Card ───────────────────────────────────────────────────────────────
const OrderCard = React.memo(({
  item, tab, onAccepted, onDelivered, onSlideActiveChange,
  cardW, SW, rs, nz,
}) => {
  const opacity       = useRef(new Animated.Value(1)).current;
  const translateX    = useRef(new Animated.Value(0)).current;
  const flashOpacity  = useRef(new Animated.Value(0)).current;
  const maxHeight     = useRef(new Animated.Value(1200)).current;
  const marginBottom  = useRef(new Animated.Value(rs(14))).current;
  const entranceScale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.spring(entranceScale, { toValue: 1, damping: 20, stiffness: 260, mass: 0.45, useNativeDriver: true }).start();
  }, []);

  const animateOut = useCallback((callback) => {
    Animated.timing(flashOpacity, { toValue: 0.88, duration: 80, useNativeDriver: true }).start();
    Animated.parallel([
      Animated.timing(flashOpacity, { toValue: 0,        duration: 160, delay: 80, useNativeDriver: true }),
      Animated.timing(opacity,      { toValue: 0,        duration: 180, useNativeDriver: true }),
      Animated.timing(translateX,   { toValue: SW * 0.5, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      Animated.parallel([
        Animated.timing(maxHeight,    { toValue: 0, duration: 160, useNativeDriver: false }),
        Animated.timing(marginBottom, { toValue: 0, duration: 160, useNativeDriver: false }),
      ]).start(() => callback());
    });
  }, [flashOpacity, opacity, translateX, maxHeight, marginBottom, SW]);

  const handleAccept  = useCallback(() => animateOut(() => onAccepted(item.id)),  [animateOut, onAccepted, item.id]);
  const handleDeliver = useCallback(() => animateOut(() => onDelivered(item.id)), [animateOut, onDelivered, item.id]);

  // Seat badge width: 22% of cardW, min 70, max 100
  const SEAT_W = Math.min(100, Math.max(70, cardW * 0.22));

  return (
    <Animated.View style={{ maxHeight, marginBottom, overflow: 'hidden', borderRadius: rs(17), width: cardW }}>
      <Animated.View style={{ transform: [{ scale: entranceScale }] }}>
        <Animated.View style={[ocS.wrap, { borderRadius: rs(16), padding: rs(16), opacity, transform: [{ translateX }] }]}>

          {/* Flash overlay */}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {
            backgroundColor: GREEN, borderRadius: rs(16),
            alignItems: 'center', justifyContent: 'center', zIndex: 10, opacity: flashOpacity,
          }]}>
            <MaterialIcons name="check-circle" size={nz(48)} color="#fff" />
          </Animated.View>

          {/* ── Top row ─────────────────────────────────────────────────── */}
          <View style={ocS.topRow}>
            {/* Avatar */}
            <View style={[ocS.avatar, { width: rs(40), height: rs(40), borderRadius: rs(20), marginRight: rs(8) }]}>
              <Text style={{ fontSize: nz(13), fontWeight: '700', color: '#555' }}>{item.initials}</Text>
            </View>

            {/* Name + meta */}
            <View style={ocS.nameBlock}>
              <Text style={{ fontSize: nz(13), fontWeight: '700', color: '#1A1A1A', marginBottom: rs(3) }} numberOfLines={2}>
                {item.customerName}
              </Text>
              <View style={ocS.metaRow}>
                <Feather name="clock" size={nz(10)} color="#999" />
                <Text style={{ fontSize: nz(10), color: '#666', flexShrink: 1 }} numberOfLines={1}> {item.receivedAt}</Text>
              </View>
              <View style={ocS.metaRow}>
                <Feather name="calendar" size={nz(10)} color="#999" />
                <Text style={{ fontSize: nz(10), color: '#666', flexShrink: 1 }} numberOfLines={1}> {item.date}</Text>
              </View>
            </View>

            {/* Seat badge — proportional to card width */}
            <View style={[ocS.seatBadge, {
              width: SEAT_W, borderRadius: rs(10),
              paddingHorizontal: rs(6), paddingVertical: rs(6),
            }]}>
              <Text style={{ fontSize: nz(9), fontWeight: '600', color: '#1A1A1A', marginBottom: rs(2), textAlign: 'center', width: '100%' }}
                numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
                {item.seat}
              </Text>
              <Text style={{ fontSize: nz(20), fontWeight: '900', color: '#1A1A1A', width: '100%', textAlign: 'center' }}
                numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                {item.seatCode}
              </Text>
            </View>
          </View>

          <View style={ocS.divider} />

          {/* ── Items ────────────────────────────────────────────────────── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: rs(8) }}>
            <View style={{ width: rs(11), height: rs(11), borderRadius: rs(3), backgroundColor: GREEN, marginRight: rs(6) }} />
            <Text style={{ fontSize: nz(12), fontWeight: '700', color: '#1A1A1A' }}>Ordered Items :</Text>
          </View>

          {item.items.map((it, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: rs(5) }}>
              <Text style={{ fontSize: nz(11), color: '#444', flex: 1, paddingRight: rs(4) }} numberOfLines={2}>{it.name}</Text>
              <Text style={{ fontSize: nz(11), color: '#1A1A1A', fontWeight: '600' }}>{it.price}/-</Text>
            </View>
          ))}

          <View style={{ borderBottomWidth: 1, borderStyle: 'dashed', borderColor: '#CCCCCC', marginBottom: rs(8) }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(6) }}>
            <Text style={{ fontSize: nz(12), fontWeight: '700', color: '#1A1A1A' }}>Total Bill</Text>
            <Text style={{ fontSize: nz(12), fontWeight: '800', color: '#1A1A1A' }}>{item.total}/-</Text>
          </View>

          <View style={ocS.divider} />
          <Text style={{ fontSize: nz(10), color: '#AAAAAA', marginBottom: rs(8) }}>Order ID: {item.orderId}</Text>

          <View style={[ocS.noteBox, { borderRadius: rs(10), padding: rs(10), gap: rs(6) }]}>
            <MaterialIcons name="warning-amber" size={nz(15)} color="#CC8800" />
            <Text style={{ flex: 1, fontSize: nz(10.5), color: '#885500', lineHeight: nz(16) }}>{item.note}</Text>
          </View>

          {/* ── Action ───────────────────────────────────────────────────── */}
          {tab === 'live' && (
            <SlideToAccept
              onSlideActiveChange={onSlideActiveChange}
              onAccepted={handleAccept}
              cardW={cardW}
              rs={rs}
              nz={nz}
            />
          )}
          {tab === 'pending' && (
            <HapticTouchable
              onPress={handleDeliver}
              style={[ocS.deliverBtn, { borderRadius: rs(26), marginTop: rs(14), paddingVertical: rs(13) }]}
              activeOpacity={0.82}
            >
              <MaterialIcons name="check" size={nz(16)} color="#fff" style={{ marginRight: rs(5) }} />
              <Text style={{ fontSize: nz(12), fontWeight: '700', color: '#fff' }}>Mark As Delivered</Text>
            </HapticTouchable>
          )}

        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}, (prev, next) =>
  prev.item.id === next.item.id &&
  prev.tab     === next.tab     &&
  prev.cardW   === next.cardW
);

const ocS = StyleSheet.create({
  wrap:      { backgroundColor: '#01690509', borderWidth: 1, borderColor: '#14131336' },
  topRow:    { flexDirection: 'row', alignItems: 'flex-start' },
  avatar:    { backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  nameBlock: { flex: 1, flexShrink: 1, marginRight: 4 },
  metaRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 2, flexShrink: 1 },
  seatBadge: { borderWidth: 1, borderColor: GREEN, backgroundColor: 'rgba(245,197,24,0.2)', alignItems: 'center', flexShrink: 0, alignSelf: 'flex-start' },
  divider:   { height: 1, backgroundColor: '#F2F2F2', marginVertical: 10 },
  noteBox:   { flexDirection: 'row', backgroundColor: '#fff5e6a9', alignItems: 'flex-start', borderWidth: 1, borderColor: '#ffdd0343' },
  deliverBtn:{ flexDirection: 'row', backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
});

// ─── Data helpers ─────────────────────────────────────────────────────────────
const makeTabState = () => ({ data: [], page: 1, totalDocs: 0, exhausted: false, fetching: false });

const normaliseOrder = (o) => {
  const seatParts = (o.seatNo ?? '').split('/');
  const parts     = (o.fullname ?? '').trim().split(' ').filter(Boolean);
  const initials  = (parts.length >= 2 ? parts[0][0] + parts[1][0] : (parts[0]?.[0] ?? '?')).toUpperCase();
  const d         = o.OrderPlacedAt ? new Date(o.OrderPlacedAt) : null;
  return {
    id:           o._id,
    orderRef:     o.Id,
    orderId:      o.OrderId,
    initials,
    customerName: (o.fullname ?? '').trim() || 'Customer',
    phone:        o.phone,
    receivedAt:   d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '—',
    date:         d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '—',
    seat:         seatParts[0]?.trim() ?? '',
    seatCode:     seatParts[1]?.trim() ?? '',
    items:        (o.order ?? []).map((it) => ({
      name:  `${it.quantity}x ${it.foodName}`,
      price: (() => { const n = Number(it.amount * it.quantity); return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''); })(),
    })),
    total:       (() => { const n = Number(o.TotalAmount); return n == null ? '0' : Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''); })(),
    note:        'Please ensure the invoice is provided to the customer at the time of food delivery, as the order is already entered in POS.',
    AcceptOrder: o.AcceptOrder,
    isDelivered: o.isDelivered,
    isCancelled: o.isCancelled,
  };
};

// ─── Tab Scene ────────────────────────────────────────────────────────────────
/**
 * Renders orders in a responsive grid:
 *   Phone  (any orientation) → 1 column, full-width cards
 *   Tablet (portrait)        → 2 columns
 *   Tablet (landscape)       → 2 columns (cards are already wider)
 *
 * The FlatList itself is always a single-column list of *row* objects.
 * Each row is a View containing `cols` OrderCards side-by-side.
 * This keeps FlatList's recycling and windowing working correctly.
 */
const TabScene = React.memo(({
  tabKey, loading, list, refreshing, onRefresh,
  isLoadingMore, isExhausted, onEndReached,
  onAccepted, onDelivered, onSlideActiveChange,
  cols, cardW, gap, SW, rs, nz,
}) => {
  const rowKeyExtractor = useCallback((_, i) => String(i), []);

  // ── Loading skeletons ────────────────────────────────────────────────────
  if (loading) {
    const skelRows = Array(3).fill(null);
    return (
      <FlatList
        data={skelRows}
        keyExtractor={rowKeyExtractor}
        renderItem={() => (
          <View style={{ flexDirection: 'row', gap, paddingHorizontal: rs(14) }}>
            {Array(cols).fill(null).map((_, j) => (
              <SkeletonCard key={j} rs={rs} nz={nz} cardW={cardW} />
            ))}
          </View>
        )}
        contentContainerStyle={{ paddingTop: rs(6), paddingBottom: rs(24) }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      />
    );
  }

  // ── Group flat list into rows of `cols` ──────────────────────────────────
  const rows = [];
  for (let i = 0; i < list.length; i += cols) {
    rows.push(list.slice(i, i + cols));
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={rowKeyExtractor}
      renderItem={({ item: row }) => (
        <View style={{ flexDirection: 'row', gap, paddingHorizontal: rs(14), alignItems: 'flex-start' }}>
          {row.map((item) => (
            <OrderCard
              key={item.id}
              item={item}
              tab={tabKey}
              onAccepted={onAccepted}
              onDelivered={onDelivered}
              onSlideActiveChange={onSlideActiveChange}
              cardW={cardW}
              SW={SW}
              rs={rs}
              nz={nz}
            />
          ))}
          {/* Ghost spacer keeps last row aligned when count is odd */}
          {row.length < cols && <View style={{ width: cardW }} />}
        </View>
      )}
      contentContainerStyle={{ paddingTop: rs(6), paddingBottom: rs(24) }}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={Platform.OS === 'android'}
      initialNumToRender={4}
      maxToRenderPerBatch={3}
      windowSize={5}
      updateCellsBatchingPeriod={60}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.35}
      ListFooterComponent={
        isLoadingMore ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: rs(16), gap: rs(8) }}>
            <ActivityIndicator size="small" color={GREEN} />
            <Text style={{ fontSize: nz(13), color: '#AAAAAA' }}>Loading more...</Text>
          </View>
        ) : isExhausted && list.length > 0 ? (
          <Text style={{ textAlign: 'center', color: '#CCCCCC', fontSize: nz(12), paddingVertical: rs(16) }}>
            — All orders loaded —
          </Text>
        ) : null
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GREEN]} tintColor={GREEN} />
      }
      ListEmptyComponent={
        <View style={{ alignItems: 'center', paddingTop: rs(50), gap: rs(4) }}>
          <LottieView
            source={tabKey === 'live' ? require('../../assets/live.json') : require('../../assets/pending.json')}
            autoPlay loop
            style={{ width: rs(300), height: rs(240) }}
          />
          <Text style={{ fontSize: nz(18), fontWeight: '700', color: '#1A1A1A' }}>
            {tabKey === 'live' ? 'No Orders Yet' : 'All Caught Up'}
          </Text>
          <Text style={{ fontSize: nz(13), color: '#888', textAlign: 'center', paddingHorizontal: rs(30), marginTop: rs(4) }}>
            {tabKey === 'live'
              ? 'Your store is live and waiting for customers.'
              : 'You have no pending deliveries right now.'}
          </Text>
        </View>
      }
    />
  );
});

// ─── Home Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, restaurantName } = useStore();
  const navigation = useNavigation();
  const route      = useRoute();

  // ── Reactive sizing — re-runs on every orientation change ────────────────
  const { SW, nz, rs, isTablet } = useResponsive();

  /**
   * Layout strategy:
   *   Phone  → 1 col, full-width
   *   Tablet → 2 cols with a gap
   */
  const COLS    = isTablet ? 2 : 1;
  const H_PAD   = rs(14);
  const COL_GAP = isTablet ? rs(12) : 0;
  const CARD_W  = (SW - H_PAD * 2 - COL_GAP * (COLS - 1)) / COLS;

  const [tabIndex,     setTabIndex]     = useState(route.params?.initialTab ?? 0);
  const [swipeEnabled, setSwipeEnabled] = useState(true);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      const tab = route.params?.initialTab;
      if (tab !== undefined) setTabIndex(tab);
    });
    return unsub;
  }, [navigation, route.params?.initialTab]);

  const tabs = useRef({ live: makeTabState(), pending: makeTabState() });
  const [liveList,       setLiveList]       = useState([]);
  const [pendingList,    setPendingList]    = useState([]);
  const [loadingMoreMap, setLoadingMoreMap] = useState({ live: false, pending: false });
  const [exhaustedMap,   setExhaustedMap]   = useState({ live: false, pending: false });
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);

  const setLiveOrderCount = useStore((s) => s.setLiveOrderCount);
  const blinkAnim    = useRef(new Animated.Value(1)).current;
  const blinkLoopRef = useRef(null);
  const alertActive  = useRef(false);

  const startBlink = useCallback(() => {
    if (alertActive.current) return;
    alertActive.current = true;
    blinkLoopRef.current = Animated.loop(Animated.sequence([
      Animated.timing(blinkAnim, { toValue: 0.15, duration: 500, useNativeDriver: true }),
      Animated.timing(blinkAnim, { toValue: 1,    duration: 500, useNativeDriver: true }),
    ]));
    blinkLoopRef.current.start();
  }, [blinkAnim]);

  const stopBlink = useCallback(() => {
    if (!alertActive.current) return;
    alertActive.current = false;
    blinkLoopRef.current?.stop();
    blinkLoopRef.current = null;
    Animated.timing(blinkAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  }, [blinkAnim]);

  useEffect(() => {
    setLiveOrderCount(liveList.length);
    liveList.length > 0 ? startBlink() : stopBlink();
  }, [liveList.length, setLiveOrderCount, startBlink, stopBlink]);

  useEffect(() => () => { blinkLoopRef.current?.stop(); setLiveOrderCount(0); }, []);

  const setListMap = useRef({ live: setLiveList, pending: setPendingList }).current;
  const flushTab   = useCallback((tab) => { setListMap[tab]([...tabs.current[tab].data]); }, [setListMap]);
  const exhaustTab = useCallback((tab) => {
    tabs.current[tab].exhausted = true;
    setExhaustedMap((p) => ({ ...p, [tab]: true }));
  }, []);

  const getTodayParams = useCallback(() => {
    const s = new Date(); s.setHours(0, 0, 0, 0);
    const e = new Date(); e.setHours(23, 59, 59, 999);
    return { startDate: s.toISOString(), endDate: e.toISOString() };
  }, []);

  const loadTab = useCallback(async (tab) => {
    const id    = user?.restaurantId ?? '';
    const extra = getTodayParams();
    try {
      const res        = await TAB_CONFIG[tab].fetcher({ page: 1, limit: LIMIT }, id, extra);
      const meta       = res?.data?.data?.orderData;
      const raw        = Array.isArray(meta?.data) ? meta.data : [];
      const totalDocs  = meta?.totalDocuments ?? 0;
      const normalised = raw.map(normaliseOrder);
      tabs.current[tab].data      = normalised;
      tabs.current[tab].page      = 1;
      tabs.current[tab].totalDocs = totalDocs;
      tabs.current[tab].exhausted = normalised.length === 0 || normalised.length >= totalDocs;
      flushTab(tab);
      setExhaustedMap((p) => ({ ...p, [tab]: tabs.current[tab].exhausted }));
    } catch { exhaustTab(tab); }
  }, [user?.restaurantId, flushTab, exhaustTab, getTodayParams]);

  const loadMoreTab = useCallback(async (tab) => {
    const t = tabs.current[tab];
    if (t.exhausted || t.fetching) return;
    t.fetching = true;
    setLoadingMoreMap((p) => ({ ...p, [tab]: true }));
    const nextPage = t.page + 1;
    const id    = user?.restaurantId ?? '';
    const extra = getTodayParams();
    try {
      const res       = await TAB_CONFIG[tab].fetcher({ page: nextPage, limit: LIMIT }, id, extra);
      const meta      = res?.data?.data?.orderData;
      const raw       = Array.isArray(meta?.data) ? meta.data : [];
      const totalDocs = meta?.totalDocuments ?? t.totalDocs;
      if (raw.length === 0) {
        exhaustTab(tab);
      } else {
        const ids   = new Set(t.data.map((o) => o.id));
        const fresh = raw.map(normaliseOrder).filter((o) => !ids.has(o.id));
        t.data      = [...t.data, ...fresh];
        t.page      = nextPage;
        t.totalDocs = totalDocs;
        t.exhausted = fresh.length === 0 || nextPage * LIMIT >= totalDocs;
        flushTab(tab);
        setExhaustedMap((p) => ({ ...p, [tab]: t.exhausted }));
      }
    } catch { exhaustTab(tab); }
    finally {
      t.fetching = false;
      setLoadingMoreMap((p) => ({ ...p, live: false, pending: false }));
    }
  }, [user?.restaurantId, flushTab, exhaustTab, getTodayParams]);

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
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') initialLoad(); });
    return () => sub.remove();
  }, [initialLoad]);

  useEffect(() => {
    const restaurantId = user?.restaurantId;
    if (!restaurantId) return;
    const eventsRef = ref(db, `${restaurantId}/events`);
    const skip  = { current: true };
    const timer = setTimeout(() => { skip.current = false; }, 1500);
    const unsub = onChildAdded(eventsRef, async (snapshot) => {
      if (skip.current) return;
      const eventType = snapshot.val()?.data;
      if (eventType === 'ORDERPLACED') {
        const granted = await isNotificationGranted();
        if (!granted) playSound('order_auto_sound');
        tabs.current.live = makeTabState();
        setExhaustedMap((p) => ({ ...p, live: false }));
        loadTab('live');
      } else if (eventType === 'ACCEPTORDER') {
        tabs.current.live = makeTabState(); tabs.current.pending = makeTabState();
        setExhaustedMap({ live: false, pending: false });
        Promise.all([loadTab('live'), loadTab('pending')]);
      } else if (eventType === 'ORDERDELIVERED') {
        tabs.current.pending = makeTabState();
        setExhaustedMap((p) => ({ ...p, pending: false }));
        loadTab('pending');
      }
    });
    return () => { clearTimeout(timer); unsub(); };
  }, [user?.restaurantId, loadTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    tabs.current = { live: makeTabState(), pending: makeTabState() };
    setExhaustedMap({ live: false, pending: false });
    setLoadingMoreMap({ live: false, pending: false });
    setLiveList([]); setPendingList([]);
    await Promise.all(TAB_ORDER.map(loadTab));
    setRefreshing(false);
  }, [loadTab]);

  const handleSlideActiveChange = useCallback((active) => { setSwipeEnabled(!active); }, []);

  const endReachedHandlers = useRef({
    live:    () => { if (!tabs.current.live.exhausted    && !tabs.current.live.fetching)    loadMoreTab('live');    },
    pending: () => { if (!tabs.current.pending.exhausted && !tabs.current.pending.fetching) loadMoreTab('pending'); },
  }).current;

  const handleAccepted = useCallback(async (id) => {
    const idx = tabs.current.live.data.findIndex((o) => o.id === id);
    if (idx === -1) return;
    const [order] = tabs.current.live.data.splice(idx, 1);
    tabs.current.pending.data.unshift({ ...order, AcceptOrder: true });
    flushTab('live'); flushTab('pending');
    if (tabs.current.live.data.length === 0) setTimeout(() => setTabIndex(1), 280);
    try { await ordersAPI.acceptOrder({ OrderId: order.orderRef, Id: user?.restaurantId ?? '' }); }
    catch {
      tabs.current.pending.data.shift();
      tabs.current.live.data.splice(idx, 0, order);
      flushTab('live'); flushTab('pending');
      if (tabs.current.live.data.length === 1) setTabIndex(0);
    }
  }, [flushTab, user?.restaurantId]);

  const handleDelivered = useCallback(async (id) => {
    const idx = tabs.current.pending.data.findIndex((o) => o.id === id);
    if (idx === -1) return;
    const [order] = tabs.current.pending.data.splice(idx, 1);
    playSound('deliver');
    flushTab('pending');
    if (tabs.current.pending.data.length === 0) setTimeout(() => setTabIndex(0), 280);
    try { await ordersAPI.deliverOrder({ OrderId: order.orderRef, Id: user?.restaurantId ?? '' }); }
    catch { tabs.current.pending.data.splice(idx, 0, order); flushTab('pending'); }
  }, [flushTab, user?.restaurantId]);

  const counts  = { live: liveList.length, pending: pendingList.length };
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const renderScene = useCallback(({ route: r }) => (
    <TabScene
      tabKey={r.key}
      loading={loading}
      list={r.key === 'live' ? liveList : pendingList}
      refreshing={refreshing}
      onRefresh={onRefresh}
      isLoadingMore={loadingMoreMap[r.key]}
      isExhausted={exhaustedMap[r.key]}
      onEndReached={endReachedHandlers[r.key]}
      onAccepted={handleAccepted}
      onDelivered={handleDelivered}
      onSlideActiveChange={handleSlideActiveChange}
      cols={COLS}
      cardW={CARD_W}
      gap={COL_GAP}
      SW={SW}
      rs={rs}
      nz={nz}
    />
  ), [
    loading, liveList, pendingList, refreshing, loadingMoreMap, exhaustedMap,
    onRefresh, handleAccepted, handleDelivered, handleSlideActiveChange,
    endReachedHandlers, COLS, CARD_W, COL_GAP, SW, rs, nz,
  ]);

  const renderTabBar = useCallback((props) => (
    <View style={{ backgroundColor: '#fff', paddingTop: rs(2), paddingBottom: rs(14) }}>
      <CustomTabBar {...props} counts={counts} SW={SW} rs={rs} nz={nz} />
    </View>
  ), [counts, SW, rs, nz]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" translucent={false} />
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={[s.header, { paddingHorizontal: rs(20), paddingTop: rs(14), paddingBottom: rs(12) }]}>
          <View>
            <Text style={{ fontSize: nz(18), fontWeight: '800', color: '#0D0D0D', letterSpacing: -0.5 }}>
              Hello, {restaurantName ?? 'Restaurant'} 👋
            </Text>
            <Text style={{ fontSize: nz(12), color: '#363535', marginTop: rs(2) }}>{dateStr}</Text>
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
  root:   { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#fff' },
});