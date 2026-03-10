import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  StatusBar, Animated, Dimensions, Image, ActivityIndicator,
  Modal, TouchableOpacity, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import DateTimePicker from '@react-native-community/datetimepicker';
import { HapticTouchable } from '../components/GlobalHaptic';
import { playSound } from '../utils/sound';
import { nz, rs } from '../utils/constant';
import { ref, onChildAdded } from 'firebase/database';
import useStore from '../store/useStore';
import { ordersAPI } from '../utils/api';
import { db } from '../utils/firebaseConfig';

const GREEN     = '#03954E';
const PAGE_BG   = '#FFFFFF';
const SUBTLE_BG = '#F7F8FA';
const LIMIT     = 30;
const { width: SW } = Dimensions.get('window');
const TAB_ORDER = ['live', 'pending', 'history'];

const TAB_CONFIG = {
  live:    { fetcher: (p, id, extra) => ordersAPI.getLiveOrders(p, id, extra) },
  pending: { fetcher: (p, id, extra) => ordersAPI.getPendingOrders(p, id, extra) },
  history: { fetcher: (p, id, extra) => ordersAPI.getHistoryOrders(p, id, extra) },
};

const TABS = [
  { key: 'live',    label: 'Live',    icon: 'circle'    },
  { key: 'pending', label: 'Pending', icon: 'clock'     },
  { key: 'history', label: 'History', icon: 'file-text' },
];

// ─── Skeleton ──────────────────────────────────────────────────────────────────
const SkeletonPulse = ({ style }) => {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1,   duration: 750, useNativeDriver: true }),
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
  base:       { backgroundColor: '#E8E8E8', borderRadius: rs(6) },
  card:       {
    backgroundColor: '#fff', borderRadius: rs(16), padding: rs(16),
    marginBottom: rs(14), borderWidth: 1, borderColor: '#F0F0F0',
  },
  topRow:     { flexDirection: 'row', alignItems: 'flex-start' },
  avatar:     { width: rs(42), height: rs(42), borderRadius: rs(21), marginRight: rs(10) },
  nameBlock:  { flex: 1, gap: rs(7) },
  line1:      { height: rs(14), width: '72%' },
  line2:      { height: rs(11), width: '52%' },
  line3:      { height: rs(11), width: '40%' },
  badge:      { width: rs(72), height: rs(62), borderRadius: rs(10), marginLeft: rs(8) },
  divider:    { height: rs(1), marginVertical: rs(12) },
  itemLine:   { height: rs(12), width: '80%' },
  btnSkeleton:{ height: rs(50), borderRadius: rs(26), marginTop: rs(16) },
});

// ─── Animated Tab Bar ──────────────────────────────────────────────────────────
const AnimatedTabBar = React.memo(({ activeTab, onTabChange, counts }) => {
  const [layouts, setLayouts] = useState({});
  const pillX = useRef(new Animated.Value(0)).current;

  const anims = useRef(
    TABS.reduce((acc, t) => {
      acc[t.key] = { scale: new Animated.Value(t.key === activeTab ? 1 : 0.9) };
      return acc;
    }, {})
  ).current;

  const onLayout = useCallback((key, e) => {
    const x = e?.nativeEvent?.layout?.x;
    if (x == null) return;
    setLayouts((p) => ({ ...p, [key]: { x } }));
  }, []);

  useEffect(() => {
    const lay = layouts[activeTab];
    if (!lay) return;
    Animated.spring(pillX, {
      toValue: lay.x - rs(4),
      useNativeDriver: true,
      damping: 22, stiffness: 220, mass: 0.5,
    }).start();
    TABS.forEach((t) => {
      Animated.spring(anims[t.key].scale, {
        toValue: t.key === activeTab ? 1 : 0.9,
        useNativeDriver: true,
        damping: 18, stiffness: 200, mass: 0.3,
      }).start();
    });
  }, [activeTab, layouts]);

  const pillW = (SW - rs(40) - rs(8)) / 3;

  return (
    <View style={tb.wrapper}>
      <Animated.View
        pointerEvents="none"
        style={[tb.pill, { width: pillW, transform: [{ translateX: pillX }] }]}
      />
      {TABS.map((t) => {
        const isActive = activeTab === t.key;
        const count    = counts[t.key];
        return (
          <HapticTouchable
            key={t.key}
            onPress={() => onTabChange(t.key)}
            activeOpacity={1}
            style={tb.tab}
            onLayout={(e) => onLayout(t.key, e)}
          >
            <Animated.View style={[tb.inner, { transform: [{ scale: anims[t.key].scale }] }]}>
              {t.key === 'live' ? (
                <View style={[tb.dot, { backgroundColor: isActive ? '#fff' : '#1A1A1A' }]} />
              ) : (
                <Feather
                  name={t.icon}
                  size={nz(11)}
                  color={isActive ? '#fff' : '#1A1A1A'}
                  style={{ marginRight: rs(3) }}
                />
              )}
              <Text style={[tb.label, isActive ? tb.labelActive : tb.labelInactive]}>
                {t.label}{count > 0 ? ` (${count})` : ''}
              </Text>
            </Animated.View>
          </HapticTouchable>
        );
      })}
    </View>
  );
});

const tb = StyleSheet.create({
  wrapper: {
    flexDirection: 'row', backgroundColor: '#EBEBEB',
    borderRadius: rs(14), padding: rs(4),
    marginHorizontal: rs(20), position: 'relative', alignItems: 'center',
  },
  pill: {
    position: 'absolute', top: rs(4), bottom: rs(4), left: rs(4),
    borderRadius: rs(10), backgroundColor: GREEN,
    elevation: 6, shadowColor: GREEN,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8,
  },
  tab:          { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: rs(10), zIndex: 1 },
  inner:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  dot:          { width: rs(7), height: rs(7), borderRadius: rs(4), marginRight: rs(5) },
  label:        { fontSize: nz(13), fontWeight: '600' },
  labelActive:  { color: '#fff', fontWeight: '700' },
  labelInactive:{ color: '#1A1A1A' },
});

// ─── Slide To Accept ───────────────────────────────────────────────────────────
const SlideToAccept = React.memo(({ onAccepted, onSlideActiveChange }) => {
  const THUMB_W   = rs(48);
  const TRACK_W   = SW - rs(64);
  const MAX_SLIDE = TRACK_W - THUMB_W - rs(8);

  const slideX    = useRef(new Animated.Value(0)).current;
  const completed = useRef(false);

  const fillWidth    = slideX.interpolate({ inputRange: [0, MAX_SLIDE], outputRange: [THUMB_W + rs(8), TRACK_W], extrapolate: 'clamp' });
  const arrowOpacity = slideX.interpolate({ inputRange: [MAX_SLIDE * 0.7,  MAX_SLIDE], outputRange: [1, 0], extrapolate: 'clamp' });
  const checkOpacity = slideX.interpolate({ inputRange: [MAX_SLIDE * 0.75, MAX_SLIDE], outputRange: [0, 1], extrapolate: 'clamp' });
  const labelOpacity = slideX.interpolate({ inputRange: [0, MAX_SLIDE * 0.35], outputRange: [1, 0], extrapolate: 'clamp' });

  const slideGesture = Gesture.Pan()
    .activeOffsetX([2, 2]).failOffsetY([-8, 8]).runOnJS(true)
    .onBegin(() => onSlideActiveChange?.(true))
    .onUpdate((e) => {
      if (completed.current) return;
      slideX.setValue(Math.max(0, Math.min(e.translationX, MAX_SLIDE)));
    })
    .onEnd((e) => {
      if (completed.current) return;
      if (Math.max(0, e.translationX) / MAX_SLIDE > 0.8) {
        completed.current = true;
        Animated.spring(slideX, { toValue: MAX_SLIDE, useNativeDriver: false, damping: 20, stiffness: 200 }).start();
        playSound('accept');
        onAccepted?.();
        setTimeout(() => {
          Animated.spring(slideX, { toValue: 0, useNativeDriver: false, damping: 18, stiffness: 150 }).start(() => {
            completed.current = false;
            onSlideActiveChange?.(false);
          });
        }, 900);
      } else {
        Animated.spring(slideX, { toValue: 0, useNativeDriver: false, damping: 15, stiffness: 180, mass: 0.8 }).start();
        onSlideActiveChange?.(false);
      }
    })
    .onFinalize(() => onSlideActiveChange?.(false));

  return (
    <View style={sv.container}>
      <View style={[sv.track, { width: TRACK_W }]}>
        <Animated.View style={[sv.fill, { width: fillWidth }]} />
        <Animated.Text style={[sv.label, { opacity: labelOpacity }]}>Slide to Accept Order</Animated.Text>
        <GestureDetector gesture={slideGesture}>
          <Animated.View style={[sv.thumb, { transform: [{ translateX: slideX }] }]}>
            <Animated.View style={[StyleSheet.absoluteFill, sv.center, { opacity: arrowOpacity }]}>
              <MaterialIcons name="chevron-right" size={nz(28)} color="#1A1A1A" />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, sv.center, { opacity: checkOpacity }]}>
              <MaterialIcons name="check" size={nz(22)} color="#1A1A1A" />
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}, (prev, next) => prev.onAccepted === next.onAccepted && prev.onSlideActiveChange === next.onSlideActiveChange);

const sv = StyleSheet.create({
  container: { marginTop: rs(16), alignItems: 'center' },
  track: {
    height: rs(54), borderRadius: rs(27), backgroundColor: 'rgba(3,149,78,0.10)',
    justifyContent: 'center', overflow: 'hidden', alignSelf: 'center',
    borderWidth: rs(1.5), borderColor: GREEN,
  },
  fill:  { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: GREEN, borderRadius: rs(27) },
  label: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: GREEN, fontSize: nz(14), fontWeight: '600', letterSpacing: 0.3 },
  thumb: {
    width: rs(48), height: rs(48), borderRadius: rs(24),
    backgroundColor: '#F5C518', position: 'absolute', left: rs(3),
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18, shadowRadius: 5, zIndex: 10,
  },
  center: { justifyContent: 'center', alignItems: 'center' },
});

// ─── Order Card ────────────────────────────────────────────────────────────────
const OrderCard = React.memo(({ item, tab, onAccepted, onDelivered, onSlideActiveChange }) => {
  // ── Exit animation values ──
  const opacity      = useRef(new Animated.Value(1)).current;
  const translateX   = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const maxHeight    = useRef(new Animated.Value(1200)).current;
  const marginBottom = useRef(new Animated.Value(rs(14))).current;

  // ── Entrance animation: scale only (useNativeDriver = pure GPU, zero JS overhead) ──
  const entranceScale = useRef(new Animated.Value(0.93)).current;

  useEffect(() => {
    Animated.spring(entranceScale, {
      toValue: 1,
      damping: 18,
      stiffness: 220,
      mass: 0.5,
      useNativeDriver: true,
    }).start();
  }, []);

  const animateOut = useCallback((callback) => {
    Animated.sequence([
      Animated.timing(flashOpacity, { toValue: 0.9, duration: 130, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(flashOpacity, { toValue: 0,         duration: 200, useNativeDriver: true }),
        Animated.timing(opacity,      { toValue: 0,         duration: 260, useNativeDriver: true }),
        Animated.timing(translateX,   { toValue: SW * 0.45, duration: 300, useNativeDriver: true }),
      ]),
    ]).start(() => {
      Animated.parallel([
        Animated.timing(maxHeight,    { toValue: 0, duration: 200, useNativeDriver: false }),
        Animated.timing(marginBottom, { toValue: 0, duration: 200, useNativeDriver: false }),
      ]).start(() => callback());
    });
  }, []);

  const handleAccept  = useCallback(() => animateOut(() => onAccepted(item.id)),  [animateOut, onAccepted, item.id]);
  const handleDeliver = useCallback(() => animateOut(() => onDelivered(item.id)), [animateOut, onDelivered, item.id]);

  return (
    // ── maxHeight collapse wrapper (exit shrink) ──
    <Animated.View style={{ maxHeight, marginBottom, overflow: 'hidden' }}>

      {/* ── Entrance animation wrapper: scale only ── */}
      <Animated.View style={{ transform: [{ scale: entranceScale }] }}>

        {/* ── Exit slide + fade wrapper ── */}
        <Animated.View style={[oc.wrap, { opacity, transform: [{ translateX }], marginBottom: 0 }]}>

          {/* Green flash overlay on accept/deliver */}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, oc.flashOverlay, { opacity: flashOpacity }]}>
            <MaterialIcons name="check-circle" size={nz(48)} color="#fff" />
          </Animated.View>

          <View style={oc.topRow}>
            <View style={oc.avatar}><Text style={oc.initials}>{item.initials}</Text></View>
            <View style={oc.nameBlock}>
              <Text style={oc.name}>{item.customerName}</Text>
              <View style={oc.metaRow}><Feather name="clock" size={nz(11)} color="#999" /><Text style={oc.meta}> Received at {item.receivedAt}</Text></View>
              <View style={oc.metaRow}><Feather name="calendar" size={nz(11)} color="#999" /><Text style={oc.meta}> {item.date}</Text></View>
            </View>
            <View style={oc.seatBadge}>
              <Text style={oc.seatLabel}>{item.seat}</Text>
              <Text style={oc.seatCode}>{item.seatCode}</Text>
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
            <HapticTouchable onPress={handleDeliver} style={oc.deliverBtn} activeOpacity={0.85}>
              <MaterialIcons name="check" size={nz(18)} color="#fff" style={{ marginRight: rs(6) }} />
              <Text style={oc.deliverTxt}>Order Mark As Delivered</Text>
            </HapticTouchable>
          )}

        </Animated.View>
        {/* end exit wrapper */}

      </Animated.View>
      {/* end entrance wrapper */}

    </Animated.View>
    // end maxHeight wrapper
  );
}, (prev, next) => prev.item.id === next.item.id && prev.tab === next.tab);

const oc = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff', borderRadius: rs(16), marginBottom: rs(14),
    padding: rs(16), borderWidth: 1, borderColor: '#F0F0F0',
  },
  topRow:     { flexDirection: 'row', alignItems: 'flex-start' },
  avatar:     { width: rs(42), height: rs(42), borderRadius: rs(21), backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', marginRight: rs(10) },
  initials:   { fontSize: nz(14), fontWeight: '700', color: '#555' },
  nameBlock:  { flex: 1 },
  name:       { fontSize: nz(15), fontWeight: '700', color: '#1A1A1A', marginBottom: rs(4) },
  metaRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: rs(3) },
  meta:       { fontSize: nz(12), color: '#666' },
  seatBadge:  { borderWidth: rs(1), borderColor: GREEN, backgroundColor: 'rgba(245,197,24,0.2)', borderRadius: rs(10), paddingHorizontal: rs(12), paddingVertical: rs(8), alignItems: 'center', minWidth: rs(90), marginLeft: rs(8), alignSelf: 'flex-start' },
  seatLabel:  { fontSize: nz(11), fontWeight: '600', color: '#1A1A1A', marginBottom: rs(3) },
  seatCode:   { fontSize: nz(24), fontWeight: '900', color: '#1A1A1A', letterSpacing: 0.5 },
  divider:    { height: 1, backgroundColor: '#F2F2F2', marginVertical: rs(12) },
  dashed:     { borderBottomWidth: 1, borderStyle: 'dashed', borderColor: '#CCCCCC', marginBottom: rs(10) },
  itemsHeader:{ flexDirection: 'row', alignItems: 'center', marginBottom: rs(10) },
  greenSquare:{ width: rs(14), height: rs(14), borderRadius: rs(3), backgroundColor: GREEN, marginRight: rs(8) },
  itemsTitle: { fontSize: nz(14), fontWeight: '700', color: '#1A1A1A' },
  itemRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(8) },
  itemName:   { fontSize: nz(13), color: '#444', flex: 1 },
  itemPrice:  { fontSize: nz(13), color: '#1A1A1A', fontWeight: '600' },
  totalLabel: { fontSize: nz(14), fontWeight: '700', color: '#1A1A1A' },
  totalPrice: { fontSize: nz(14), fontWeight: '800', color: '#1A1A1A' },
  orderId:    { fontSize: nz(12), color: '#AAAAAA', marginBottom: rs(10) },
  noteBox:    { flexDirection: 'row', backgroundColor: '#FFF5E6', borderRadius: rs(10), padding: rs(12), gap: rs(8), alignItems: 'flex-start' },
  noteText:   { flex: 1, fontSize: nz(12.5), color: '#885500', lineHeight: nz(19) },
  deliverBtn: { flexDirection: 'row', backgroundColor: GREEN, paddingVertical: rs(14), borderRadius: rs(26), alignItems: 'center', justifyContent: 'center', marginTop: rs(16) },
  deliverTxt: { fontSize: nz(15), fontWeight: '700', color: '#fff' },
  flashOverlay: { backgroundColor: GREEN, borderRadius: rs(16), alignItems: 'center', justifyContent: 'center', zIndex: 10 },
});

// ─── Date helpers ──────────────────────────────────────────────────────────────
const fmt      = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtShort = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
const makeToday = () => {
  const s = new Date(); s.setHours(0, 0, 0, 0);
  const e = new Date(); e.setHours(23, 59, 59, 999);
  return { start: s, end: e };
};
const makeYesterday = () => {
  const y = new Date(); y.setDate(y.getDate() - 1);
  const s = new Date(y); s.setHours(0, 0, 0, 0);
  const e = new Date(y); e.setHours(23, 59, 59, 999);
  return { start: s, end: e };
};

// ─── Date Filter Bar ───────────────────────────────────────────────────────────
const DateFilterBar = React.memo(({ activeChip, startDate, endDate, onChipSelect, onCustomApply }) => {
  const [sheetVisible,  setSheetVisible]  = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickingField,  setPickingField]  = useState(null);
  const [draft, setDraft] = useState({ start: startDate, end: endDate });

  useEffect(() => { setDraft({ start: startDate, end: endDate }); }, [startDate, endDate]);

  const openCustomSheet     = () => { setDraft({ start: startDate, end: endDate }); setSheetVisible(true); };
  const handleApply         = () => { setSheetVisible(false); onCustomApply(draft.start, draft.end); };
  const openAndroidPicker   = (field) => { setPickingField(field); setSheetVisible(false); setTimeout(() => setPickerVisible(true), 180); };
  const handleAndroidChange = (_, selected) => {
    setPickerVisible(false);
    if (selected) setDraft((p) => ({ ...p, [pickingField]: selected }));
    setTimeout(() => setSheetVisible(true), 120);
  };

  const chips = [
    { key: 'today',     label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'custom',    label: activeChip === 'custom' ? `${fmtShort(startDate)} – ${fmtShort(endDate)}` : 'Custom' },
  ];

  return (
    <>
      <View style={df.chipRow}>
        {chips.map((c) => {
          const active = activeChip === c.key;
          return (
            <HapticTouchable
              key={c.key}
              onPress={() => c.key === 'custom' ? openCustomSheet() : onChipSelect(c.key)}
              style={[df.chip, active && df.chipActive]}
              activeOpacity={0.75}
            >
              {c.key === 'custom' && (
                <Feather name="calendar" size={nz(11)} color={active ? '#fff' : '#1A1A1A'} style={{ marginRight: rs(4) }} />
              )}
              <Text style={[df.chipText, active && df.chipTextActive]} numberOfLines={1}>{c.label}</Text>
            </HapticTouchable>
          );
        })}
      </View>

      <Modal visible={sheetVisible} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setSheetVisible(false)}>
        <TouchableOpacity style={df.backdrop} activeOpacity={1} onPress={() => setSheetVisible(false)} />
        <View style={df.sheet}>
          <View style={df.handle} />
          <Text style={df.sheetTitle}>Custom Date Range</Text>
          <Text style={df.fieldLabel}>From</Text>
          {Platform.OS === 'ios' ? (
            <View style={df.iosRow}>
              <DateTimePicker value={draft.start} mode="date" display="compact" maximumDate={draft.end ?? new Date()} onChange={(_, d) => d && setDraft((p) => ({ ...p, start: d }))} themeVariant="light" />
            </View>
          ) : (
            <HapticTouchable onPress={() => openAndroidPicker('start')} style={df.dateBtn} activeOpacity={0.8}>
              <Feather name="calendar" size={nz(15)} color={GREEN} />
              <Text style={df.dateBtnText}>{fmt(draft.start)}</Text>
              <Feather name="chevron-down" size={nz(13)} color="#aaa" />
            </HapticTouchable>
          )}
          <Text style={[df.fieldLabel, { marginTop: rs(16) }]}>To</Text>
          {Platform.OS === 'ios' ? (
            <View style={df.iosRow}>
              <DateTimePicker value={draft.end} mode="date" display="compact" minimumDate={draft.start} maximumDate={new Date()} onChange={(_, d) => d && setDraft((p) => ({ ...p, end: d }))} themeVariant="light" />
            </View>
          ) : (
            <HapticTouchable onPress={() => openAndroidPicker('end')} style={df.dateBtn} activeOpacity={0.8}>
              <Feather name="calendar" size={nz(15)} color={GREEN} />
              <Text style={df.dateBtnText}>{fmt(draft.end)}</Text>
              <Feather name="chevron-down" size={nz(13)} color="#aaa" />
            </HapticTouchable>
          )}
          <HapticTouchable onPress={handleApply} style={df.applyBtn} activeOpacity={0.85}>
            <Text style={df.applyBtnText}>Apply Range</Text>
          </HapticTouchable>
        </View>
      </Modal>

      {Platform.OS === 'android' && pickerVisible && pickingField === 'start' && (
        <DateTimePicker value={draft.start} mode="date" display="default" maximumDate={draft.end ?? new Date()} onChange={handleAndroidChange} />
      )}
      {Platform.OS === 'android' && pickerVisible && pickingField === 'end' && (
        <DateTimePicker value={draft.end} mode="date" display="default" minimumDate={draft.start} maximumDate={new Date()} onChange={handleAndroidChange} />
      )}
    </>
  );
});

const df = StyleSheet.create({
  chipRow:        { flexDirection: 'row', gap: rs(8),paddingTop:rs(8)},
  chip:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: rs(14), paddingVertical: rs(7), borderRadius: rs(20), borderWidth: rs(1.5), borderColor: '#DDD', backgroundColor: '#F5F5F5', flexShrink: 1 },
  chipActive:     { backgroundColor: GREEN, borderColor: GREEN },
  chipText:       { fontSize: nz(12), fontWeight: '600', color: '#1A1A1A' },
  chipTextActive: { color: '#fff' },
  backdrop:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:          { backgroundColor: '#fff', borderTopLeftRadius: rs(24), borderTopRightRadius: rs(24), paddingHorizontal: rs(24), paddingBottom: rs(48), paddingTop: rs(14) },
  handle:         { width: rs(40), height: rs(4), borderRadius: rs(2), backgroundColor: '#DDD', alignSelf: 'center', marginBottom: rs(20) },
  sheetTitle:     { fontSize: nz(17), fontWeight: '700', color: '#1A1A1A', marginBottom: rs(20) },
  fieldLabel:     { fontSize: nz(13), fontWeight: '600', color: '#666', marginBottom: rs(8) },
  iosRow:         { flexDirection: 'row', alignItems: 'center' },
  dateBtn:        { flexDirection: 'row', alignItems: 'center', gap: rs(10), borderWidth: 1, borderColor: '#E0E0E0', borderRadius: rs(12), paddingHorizontal: rs(14), paddingVertical: rs(13), backgroundColor: '#F9F9F9' },
  dateBtnText:    { flex: 1, fontSize: nz(14), color: '#1A1A1A', fontWeight: '500' },
  applyBtn:       { marginTop: rs(28), backgroundColor: GREEN, borderRadius: rs(26), paddingVertical: rs(15), alignItems: 'center', elevation: 3, shadowColor: GREEN, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6 },
  applyBtnText:   { fontSize: nz(15), fontWeight: '700', color: '#fff' },
});

// ─── State helpers ─────────────────────────────────────────────────────────────
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
    seat:     seatParts[0]?.trim() ?? '',
    seatCode: seatParts[1]?.trim() ?? '',
    items: (o.order ?? []).map((it) => ({
      name:  `${it.quantity}x ${it.foodName}`,
      price: (() => { const n = Number(it.amount * it.quantity); return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''); })(),
    })),
    total: (() => { const n = Number(o.TotalAmount); return n == null ? '0' : Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''); })(),
    note:        'Please ensure the invoice is provided to the customer at the time of food delivery, as the order is already entered in POS.',
    AcceptOrder: o.AcceptOrder,
    isDelivered: o.isDelivered,
    isCancelled: o.isCancelled,
  };
};

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, restaurantName, restaurantLogo } = useStore();

  const [activeTab,  setActiveTab]  = useState('live');
  const [logoError,  setLogoError]  = useState(false);
  const activeTabRef = useRef('live');

  const tabs = useRef({ live: makeTabState(), pending: makeTabState(), history: makeTabState() });

  const [liveList,    setLiveList]    = useState([]);
  const [pendingList, setPendingList] = useState([]);
  const [historyList, setHistoryList] = useState([]);

  const [loadingMoreMap, setLoadingMoreMap] = useState({ live: false, pending: false, history: false });
  const [exhaustedMap,   setExhaustedMap]   = useState({ live: false, pending: false, history: false });
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const makeTodayRange  = () => { const { start, end } = makeToday(); return { activeChip: 'today', start, end }; };
  const [historyFilter,  setHistoryFilter]  = useState(makeTodayRange);
  const historyFilterRef = useRef(makeTodayRange());

  const setListMap = { live: setLiveList, pending: setPendingList, history: setHistoryList };

  const flushTab = useCallback((tab) => {
    setListMap[tab]([...tabs.current[tab].data]);
  }, []);

  const exhaustTab = useCallback((tab) => {
    tabs.current[tab].exhausted = true;
    setExhaustedMap((p) => ({ ...p, [tab]: true }));
  }, []);

  const getTodayDateParams = useCallback(() => {
    const { start, end } = makeToday();
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }, []);

  const getHistoryDateParams = useCallback(() => {
    const f = historyFilterRef.current;
    const start = new Date(f.start); start.setHours(0, 0, 0, 0);
    const end   = new Date(f.end);   end.setHours(23, 59, 59, 999);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }, []);

  const getTabDateParams = useCallback((tab) => (
    tab === 'history' ? getHistoryDateParams() : getTodayDateParams()
  ), [getTodayDateParams, getHistoryDateParams]);

  const loadTab = useCallback(async (tab) => {
    const id    = user?.restaurantId ?? '';
    const extra = getTabDateParams(tab);
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
    } catch {
      exhaustTab(tab);
    }
  }, [user?.restaurantId, flushTab, exhaustTab, getTabDateParams]);

  const loadMoreTab = useCallback(async (tab) => {
    const t = tabs.current[tab];
    if (t.exhausted || t.fetching) return;
    t.fetching = true;
    setLoadingMoreMap((p) => ({ ...p, [tab]: true }));
    const nextPage = t.page + 1;
    const id       = user?.restaurantId ?? '';
    const extra    = getTabDateParams(tab);
    try {
      const res       = await TAB_CONFIG[tab].fetcher({ page: nextPage, limit: LIMIT }, id, extra);
      const meta      = res?.data?.data?.orderData;
      const raw       = Array.isArray(meta?.data) ? meta.data : [];
      const totalDocs = meta?.totalDocuments ?? t.totalDocs;
      if (raw.length === 0) {
        exhaustTab(tab);
      } else {
        const existingIds = new Set(t.data.map((o) => o.id));
        const fresh       = raw.map(normaliseOrder).filter((o) => !existingIds.has(o.id));
        t.data      = [...t.data, ...fresh];
        t.page      = nextPage;
        t.totalDocs = totalDocs;
        t.exhausted = fresh.length === 0 || nextPage * LIMIT >= totalDocs;
        flushTab(tab);
        setExhaustedMap((p) => ({ ...p, [tab]: t.exhausted }));
      }
    } catch {
      exhaustTab(tab);
    } finally {
      t.fetching = false;
      setLoadingMoreMap((p) => ({ ...p, [tab]: false }));
    }
  }, [user?.restaurantId, flushTab, exhaustTab, getTabDateParams]);

  const initialLoad = useCallback(async () => {
    setLoading(true);
    tabs.current = { live: makeTabState(), pending: makeTabState(), history: makeTabState() };
    setExhaustedMap({ live: false, pending: false, history: false });
    setLoadingMoreMap({ live: false, pending: false, history: false });
    setLiveList([]); setPendingList([]); setHistoryList([]);
    await Promise.all(TAB_ORDER.map(loadTab));
    setLoading(false);
  }, [loadTab]);

  useEffect(() => { initialLoad(); }, [initialLoad]);

  useEffect(() => {
    const restaurantId = user?.restaurantId;
    if (!restaurantId) return;

    const eventsRef = ref(db, `${restaurantId}/events`);
    const skip = { current: true };
    const timer = setTimeout(() => { skip.current = false; }, 1500);

    const unsub = onChildAdded(eventsRef, (snapshot) => {
      if (skip.current) return;

      const eventData = snapshot.val();
      const eventType = eventData?.data;

      if (eventType === 'ORDERPLACED') {
        playSound('order_auto_sound');
        tabs.current.live = makeTabState();
        setExhaustedMap((p) => ({ ...p, live: false }));
        setLoadingMoreMap((p) => ({ ...p, live: false }));
        loadTab('live');

      } else if (eventType === 'ACCEPTORDER') {
        tabs.current.live    = makeTabState();
        tabs.current.pending = makeTabState();
        setExhaustedMap((p) => ({ ...p, live: false, pending: false }));
        setLoadingMoreMap((p) => ({ ...p, live: false, pending: false }));
        Promise.all([loadTab('live'), loadTab('pending')]);

      } else if (eventType === 'ORDERDELIVERED') {
        tabs.current.pending = makeTabState();
        tabs.current.history = makeTabState();
        setExhaustedMap((p) => ({ ...p, pending: false, history: false }));
        setLoadingMoreMap((p) => ({ ...p, pending: false, history: false }));
        Promise.all([loadTab('pending'), loadTab('history')]);
      }
    });

    return () => { clearTimeout(timer); unsub(); };
  }, [user?.restaurantId, loadTab]);

  const handleEndReached = useCallback(() => {
    const tab = activeTabRef.current;
    if (tabs.current[tab].exhausted || tabs.current[tab].fetching) return;
    loadMoreTab(tab);
  }, [loadMoreTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    tabs.current = { live: makeTabState(), pending: makeTabState(), history: makeTabState() };
    setExhaustedMap({ live: false, pending: false, history: false });
    setLoadingMoreMap({ live: false, pending: false, history: false });
    setLiveList([]); setPendingList([]); setHistoryList([]);
    await Promise.all(TAB_ORDER.map(loadTab));
    setRefreshing(false);
  }, [loadTab]);

  const isSliding = useRef(false);
  const handleSlideActiveChange = useCallback((v) => { isSliding.current = v; }, []);

  const switchTab = useCallback((key) => {
    activeTabRef.current = key;
    setActiveTab(key);
  }, []);

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-12, 12]).failOffsetY([-10, 10]).runOnJS(true)
    .onEnd((e) => {
      if (isSliding.current) return;
      if (Math.abs(e.velocityX) < 200 && Math.abs(e.translationX) < 50) return;
      const idx = TAB_ORDER.indexOf(activeTabRef.current);
      if (e.translationX < 0 && idx < TAB_ORDER.length - 1) switchTab(TAB_ORDER[idx + 1]);
      if (e.translationX > 0 && idx > 0)                    switchTab(TAB_ORDER[idx - 1]);
    });

  const handleHistoryChipSelect = useCallback((chip) => {
    const range     = chip === 'today' ? makeToday() : makeYesterday();
    const newFilter = { activeChip: chip, ...range };
    historyFilterRef.current = newFilter;
    setHistoryFilter(newFilter);
    tabs.current.history = makeTabState();
    setExhaustedMap((p) => ({ ...p, history: false }));
    setLoadingMoreMap((p) => ({ ...p, history: false }));
    setHistoryList([]);
    loadTab('history');
  }, [loadTab]);

  const handleHistoryCustomApply = useCallback((start, end) => {
    const newFilter = { activeChip: 'custom', start, end };
    historyFilterRef.current = newFilter;
    setHistoryFilter(newFilter);
    tabs.current.history = makeTabState();
    setExhaustedMap((p) => ({ ...p, history: false }));
    setLoadingMoreMap((p) => ({ ...p, history: false }));
    setHistoryList([]);
    loadTab('history');
  }, [loadTab]);

  const handleAccepted = useCallback(async (id) => {
    const idx = tabs.current.live.data.findIndex((o) => o.id === id);
    if (idx === -1) return;
    const [order] = tabs.current.live.data.splice(idx, 1);
    tabs.current.pending.data.unshift({ ...order, AcceptOrder: true });
    flushTab('live'); flushTab('pending');
    try {
      await ordersAPI.acceptOrder({ OrderId: order.orderRef, Id: user?.restaurantId ?? '' });
    } catch {
      tabs.current.pending.data.shift();
      tabs.current.live.data.splice(idx, 0, order);
      flushTab('live'); flushTab('pending');
    }
  }, [flushTab, user?.restaurantId]);

  const handleDelivered = useCallback(async (id) => {
    const idx = tabs.current.pending.data.findIndex((o) => o.id === id);
    if (idx === -1) return;
    const [order] = tabs.current.pending.data.splice(idx, 1);
    playSound('accept');
    tabs.current.history.data.unshift({ ...order, isDelivered: true });
    flushTab('pending'); flushTab('history');
    try {
      await ordersAPI.deliverOrder({ OrderId: order.orderRef, Id: user?.restaurantId ?? '' });
    } catch {
      tabs.current.history.data.shift();
      tabs.current.pending.data.splice(idx, 0, order);
      flushTab('pending'); flushTab('history');
    }
  }, [flushTab, user?.restaurantId]);

  const renderItem = useCallback(({ item }) => (
    <OrderCard
      item={item} tab={activeTab}
      onAccepted={handleAccepted}
      onDelivered={handleDelivered}
      onSlideActiveChange={handleSlideActiveChange}
    />
  ), [activeTab, handleAccepted, handleDelivered, handleSlideActiveChange]);

  const list          = activeTab === 'live' ? liveList : activeTab === 'pending' ? pendingList : historyList;
  const counts        = { live: liveList.length, pending: pendingList.length, history: historyList.length };
  const isLoadingMore = loadingMoreMap[activeTab];
  const isExhausted   = exhaustedMap[activeTab];

  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar backgroundColor={PAGE_BG} barStyle="dark-content" translucent={false} />
      <View style={[s.root, { paddingTop: insets.top }]}>

        <View style={s.header}>
          <View>
            <Text style={s.title}>Hello, {restaurantName ?? 'Restaurant'} 👋</Text>
            <Text style={s.date}>{dateStr}</Text>
          </View>
          <View style={s.headerRight}>
            <HapticTouchable activeOpacity={0.8} style={s.logoWrap}>
              {restaurantLogo && !logoError ? (
                <Image source={{ uri: restaurantLogo }} style={s.restaurantLogo} resizeMode="cover" onError={() => setLogoError(true)} />
              ) : (
                <View style={s.logoPlaceholder}>
                  <Feather name="user" size={nz(18)} color="#888" />
                </View>
              )}
            </HapticTouchable>
          </View>
        </View>

        <View style={s.tabSection}>
          <AnimatedTabBar activeTab={activeTab} onTabChange={switchTab} counts={counts} />
        </View>

        <View style={s.greetBlock}>
          <>
            {activeTab === 'history' && (
              <DateFilterBar
                activeChip={historyFilter.activeChip}
                startDate={historyFilter.start}
                endDate={historyFilter.end}
                onChipSelect={handleHistoryChipSelect}
                onCustomApply={handleHistoryCustomApply}
              />
            )}
          </>
        </View>

        <GestureDetector gesture={swipeGesture}>
          <View style={s.listWrap}>
            {loading ? (
              <FlatList
                data={[1, 2, 3]}
                keyExtractor={(i) => String(i)}
                renderItem={() => <SkeletonCard />}
                contentContainerStyle={[s.listContent, { paddingBottom: rs(24) }]}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false}
              />
            ) : (
              <FlatList
                data={list}
                keyExtractor={(o) => o.id}
                renderItem={renderItem}
                contentContainerStyle={[s.listContent, { paddingBottom: rs(24) }]}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={false}
                maxToRenderPerBatch={8}
                windowSize={10}
                initialNumToRender={6}
                updateCellsBatchingPeriod={20}
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.4}
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
                    <Image
                      source={
                        activeTab === 'live'    ? require('../../assets/live.png')    :
                        activeTab === 'pending' ? require('../../assets/pending.png') :
                                                  require('../../assets/history.png')
                      }
                      style={s.emptyImage}
                      resizeMode="contain"
                    />
                    <Text style={s.emptyTitle}>
                      {activeTab === 'live' ? 'No Orders Yet' : activeTab === 'pending' ? 'All Caught Up' : 'Nothing Here Yet'}
                    </Text>
                    <Text style={s.emptySub}>
                      {activeTab === 'live'    ? 'Your store is live and waiting for customers.' :
                       activeTab === 'pending' ? 'You have no pending deliveries right now.'     : ''}
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        </GestureDetector>

      </View>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: '#F4F5F7' },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: rs(20), paddingTop: rs(14), paddingBottom: rs(12), backgroundColor: PAGE_BG },
  headerRight:     { flexDirection: 'row', alignItems: 'center', gap: rs(10), marginTop: rs(2) },
  logoWrap:        { borderRadius: rs(10), overflow: 'hidden' },
  restaurantLogo:  { width: rs(38), height: rs(38), borderRadius: rs(10), backgroundColor: '#F0F0F0' },
  logoPlaceholder: { width: rs(38), height: rs(38), borderRadius: rs(10), backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  title:           { fontSize: nz(22), fontWeight: '800', color: '#0D0D0D', letterSpacing: -0.5 },
  date:            { fontSize: nz(12), color: '#363535', marginTop: rs(2) },
  bellWrap:        { padding: rs(9), borderRadius: rs(12), backgroundColor: SUBTLE_BG, borderWidth: rs(1), borderColor: '#E8E8E8' },
  tabSection:      { backgroundColor: PAGE_BG, paddingTop: rs(2), paddingBottom: rs(14) },
  greetBlock:      { paddingHorizontal: rs(20), paddingTop: rs(1), paddingBottom: rs(1) },
  greetName:       { fontSize: nz(17), fontWeight: '700', color: '#1A1A1A' },
  greetSub:        { fontSize: nz(13), color: GREEN, marginTop: rs(3), fontWeight: '500' },
  subtitleRow:     { flexDirection: 'row', alignItems: 'center', gap: rs(8) },
  subtitleAccent:  { width: rs(4), height: rs(18), borderRadius: rs(2), backgroundColor: GREEN },
  subtitleBold:    { fontSize: nz(16), fontWeight: '700', color: '#1A1A1A' },
  listWrap:        { flex: 1 },
  listContent:     { paddingHorizontal: rs(14), paddingTop: rs(6) },
  loadingMore:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: rs(16), gap: rs(8) },
  loadingMoreText: { fontSize: nz(13), color: '#AAAAAA' },
  noMoreText:      { textAlign: 'center', color: '#CCCCCC', fontSize: nz(12), paddingVertical: rs(16) },
  empty:           { alignItems: 'center', paddingTop: rs(50), gap: rs(4) },
  emptyImage:      { width: rs(180), height: rs(180), marginBottom: rs(8) },
  emptyTitle:      { fontSize: nz(18), fontWeight: '700', color: '#1A1A1A' },
  emptySub:        { fontSize: nz(13), color: '#888', textAlign: 'center', paddingHorizontal: rs(30), marginTop: rs(4) },
});