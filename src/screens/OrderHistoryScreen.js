import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  StatusBar, Animated, TouchableOpacity, ActivityIndicator, Platform,
  Modal, ScrollView, Dimensions,
} from 'react-native';
import { TabView } from 'react-native-tab-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import LottieView from 'lottie-react-native';
import { HapticTouchable } from '../components/GlobalHaptic';
import { useResponsive } from '../utils/useResponsive';
import useStore from '../store/useStore';
import { ordersAPI } from '../utils/api';
import { DateFilterBar } from '../components/DateFilter';

const GREEN = '#03954E';
const LIMIT = 30;

const ROUTES = [
  { key: 'today', title: 'Today', icon: 'sun' },
  { key: 'yesterday', title: 'Yesterday', icon: 'clock' },
  { key: 'custom', title: 'Custom', icon: 'calendar' },
];

// ─── Date helpers ─────────────────────────────────────────────────────────────
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
const fmtShort = (d) => d?.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) ?? '';

// ─── Normalise order ──────────────────────────────────────────────────────────
const normaliseOrder = (o) => {
  const seatParts = (o.seatNo ?? '').split('/');
  const parts = (o.fullname ?? '').trim().split(' ').filter(Boolean);
  const initials = (parts.length >= 2 ? parts[0][0] + parts[1][0] : (parts[0]?.[0] ?? '?')).toUpperCase();
  const d = o.OrderPlacedAt ? new Date(o.OrderPlacedAt) : null;
  return {
    id: o._id,
    orderRef: o.Id,
    orderId: o.OrderId,
    orderSerialNumber: o.orderSerialNumber,
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
      customization: (it.customization ?? []).map((c) => ({ name: c.name, price: c.price })),
    })),
    total: (() => { const n = Number(o.TotalAmount); return n == null ? '0' : Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''); })(),
    note: 'Please ensure the invoice is provided to the customer at the time of food delivery, as the order is already entered in POS.',
    foodnote: o.foodNote,
    AcceptOrder: o.AcceptOrder,
    isDelivered: o.isDelivered,
    isCancelled: o.isCancelled,
    // Commission breakdown fields
    sharedCommissionWithCinemaConvienveFeesBreakDown: o.sharedCommissionWithCinemaConvienveFeesBreakDown,
    sharedCommissionWithCinema: o.sharedCommissionWithCinema,
    restaurantId: o.restaurantId,
    FoodAmount: o.FoodAmount,
    TotalAmount: o.TotalAmount,
    movieInfo: o.movieInfo ?? null,
  };
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const SkeletonPulse = ({ style }) => {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 750, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0.4, duration: 750, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[{ backgroundColor: '#E8E8E8', borderRadius: 6 }, style, { opacity: anim }]} />;
};

const SkeletonCard = ({ rs, nz, cardW }) => (
  <View style={{
    width: cardW,
    backgroundColor: '#fff', borderRadius: rs(16),
    padding: rs(16), marginBottom: rs(14),
    borderWidth: 1, borderColor: '#F0F0F0',
  }}>
    <SkeletonPulse style={{ height: rs(44), marginBottom: rs(12), borderRadius: rs(8) }} />
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
    <SkeletonPulse style={{ height: rs(44), borderRadius: rs(22), marginTop: rs(14) }} />
  </View>
);

// ─── Custom Tab Bar ───────────────────────────────────────────────────────────
const CustomTabBar = React.memo(({ position, jumpTo, customLabel, SW, rs, nz }) => {
  const TAB_BAR_W = SW - rs(40) - rs(8);
  const TAB_W = TAB_BAR_W / 3;
  const PILL_POS = [0, TAB_W, TAB_W * 2];
  const pillX = position.interpolate({ inputRange: [0, 1, 2], outputRange: PILL_POS, extrapolate: 'clamp' });
  const activeOps = ROUTES.map((_, i) =>
    position.interpolate({ inputRange: [i - 1, i, i + 1], outputRange: [0, 1, 0], extrapolate: 'clamp' })
  );

  return (
    <View style={[tbS.wrapper, { borderRadius: rs(50), padding: rs(4), marginHorizontal: rs(20) }]}>
      <Animated.View pointerEvents="none"
        style={[tbS.pill, { width: TAB_W, borderRadius: rs(50), transform: [{ translateX: pillX }] }]} />
      {ROUTES.map((route, i) => {
        const activeOp = activeOps[i];
        const inactiveOp = activeOp.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
        const label = route.key === 'custom' && customLabel ? customLabel : route.title;
        return (
          <HapticTouchable
            key={route.key}
            onPress={() => jumpTo(route.key)}
            activeOpacity={1}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: rs(10), zIndex: 1 }}
          >
            <Animated.View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Animated.View style={[{ flexDirection: 'row', alignItems: 'center' }, { opacity: inactiveOp }]}>
                <Feather name={route.icon} size={nz(11)} color="#1A1A1A" style={{ marginRight: rs(4) }} />
                <Text style={{ fontSize: nz(12), fontWeight: '700', color: '#1A1A1A' }} numberOfLines={1}>{label}</Text>
              </Animated.View>
              <Animated.View style={[{
                flexDirection: 'row', alignItems: 'center',
                position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center',
              }, { opacity: activeOp }]}>
                <Feather name={route.icon} size={nz(11)} color="#fff" style={{ marginRight: rs(4) }} />
                <Text style={{ fontSize: nz(12), fontWeight: '700', color: '#fff' }} numberOfLines={1}>{label}</Text>
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
  pill: { position: 'absolute', top: 4, bottom: 4, left: 4, backgroundColor: GREEN, elevation: 0, shadowColor: GREEN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8 },
});

// ─── Empty state ──────────────────────────────────────────────────────────────
const EmptyLottie = ({ source, title, sub, rs, nz }) => (
  <View style={{ alignItems: 'center', paddingTop: rs(40), paddingHorizontal: rs(30) }}>
    <LottieView source={source} autoPlay loop style={{ width: rs(260), height: rs(260) }} />
    <Text style={{ fontSize: nz(17), fontWeight: '700', color: '#1A1A1A', marginTop: rs(8), textAlign: 'center' }}>{title}</Text>
    <Text style={{ fontSize: nz(13), color: '#AAAAAA', marginTop: rs(4), textAlign: 'center', lineHeight: nz(20) }}>{sub}</Text>
  </View>
);

// ─── Items Modal ──────────────────────────────────────────────────────────────
const ItemsModal = ({ visible, items, total, onClose, rs, nz }) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onClose}
  >
    <View style={modalS.overlay}>
      <View style={[modalS.modalContainer, { borderRadius: rs(20), padding: rs(20) }]}>
        <View style={modalS.header}>
          <Text style={[modalS.title, { fontSize: nz(18) }]}>Order Items</Text>
          <TouchableOpacity onPress={onClose} style={modalS.closeBtn}>
            <Feather name="x" size={nz(20)} color="#666" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {items.map((item, idx) => (
            <View key={idx} style={{ paddingVertical: rs(12) }}>
              <View style={[modalS.itemRow]}>
                <Text style={[modalS.itemName, { fontSize: nz(14) }]} numberOfLines={2}>{item.name}</Text>
                <Text style={[modalS.itemPrice, { fontSize: nz(14), fontWeight: '600' }]}>₹{item.price}</Text>
              </View>
              {item.customization?.length > 0 && (
                <View style={{ marginTop: rs(4), paddingLeft: rs(14), backgroundColor: '#F7F7F7', borderRadius: rs(6), paddingVertical: rs(4), paddingRight: rs(8) }}>
                  {item.customization.map((c, j) => (
                    <View key={j} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: rs(2) }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: nz(9), color: GREEN, marginRight: rs(4) }}>{'•'}</Text>
                        <Text style={{ fontSize: nz(10), color: '#555', fontWeight: '500' }}>{c.name}</Text>
                      </View>
                      <Text style={{ fontSize: nz(10), color: '#555', fontWeight: '600' }}>+₹{c.price}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}

          <View style={[modalS.divider, { marginVertical: rs(12) }]} />

          <View style={modalS.totalRow}>
            <Text style={[modalS.totalLabel, { fontSize: nz(16), fontWeight: '700' }]}>Total Amount</Text>
            <Text style={[modalS.totalAmount, { fontSize: nz(18), fontWeight: '800', color: GREEN }]}>₹{total}</Text>
          </View>
        </ScrollView>

        <TouchableOpacity
          style={[modalS.closeButton, { backgroundColor: GREEN, borderRadius: rs(25), paddingVertical: rs(12), marginTop: rs(16) }]}
          onPress={onClose}
        >
          <Text style={[modalS.closeButtonText, { fontSize: nz(14), color: '#fff' }]}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

// ─── Commission Breakdown Modal ──────────────────────────────────────────────
const CommissionBreakdownModal = ({ visible, order, onClose, rs, nz }) => {
  const breakdown = order?.sharedCommissionWithCinemaConvienveFeesBreakDown;
  const isOwner = order?.sharedCommissionWithCinema !== 0;

  if (!isOwner || !breakdown) return null;

  const formatCurrency = (amount) => {
    if (amount == null) return 'N/A';
    return `₹${amount}`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={commissionS.overlay}>
        <View style={[commissionS.modalContainer, { borderRadius: rs(20), padding: rs(24) }]}>
          <View style={commissionS.header}>
            <View>
              <Text style={[commissionS.title, { fontSize: nz(18) }]}>Commission Breakdown</Text>
              <Text style={[commissionS.subtitle, { fontSize: nz(12) }]}>Order #{order?.orderId}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={commissionS.closeBtn}>
              <Feather name="x" size={nz(24)} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Food Amount */}
            <View style={[commissionS.row, { paddingVertical: rs(14) }]}>
              <View style={commissionS.rowLeft}>
                <View style={[commissionS.iconCircle, { backgroundColor: '#E3F2FD' }]}>
                  <Feather name="coffee" size={nz(16)} color="#1976D2" />
                </View>
                <View>
                  <Text style={[commissionS.rowLabel, { fontSize: nz(14) }]}>Food Amount</Text>
                  <Text style={[commissionS.rowSub, { fontSize: nz(11) }]}>Total food value</Text>
                </View>
              </View>
              <Text style={[commissionS.rowValue, { fontSize: nz(14), fontWeight: '600' }]}>
                {formatCurrency(order?.FoodAmount)}
              </Text>
            </View>

            <View style={commissionS.divider} />

            {/* Cinema / Restaurant Fee */}
            <View style={[commissionS.row, { paddingVertical: rs(14) }]}>
              <View style={commissionS.rowLeft}>
                <View style={[commissionS.iconCircle, { backgroundColor: '#FFF3E0' }]}>
                  <Feather name="home" size={nz(16)} color="#E65100" />
                </View>
                <View>
                  <Text style={[commissionS.rowLabel, { fontSize: nz(14) }]}>Cinema / Restaurant Fee</Text>
                  <Text style={[commissionS.rowSub, { fontSize: nz(11) }]}>Fee going to restaurant</Text>
                </View>
              </View>
              <Text style={[commissionS.rowValue, { fontSize: nz(14), fontWeight: '600', color: '#E65100' }]}>
                {formatCurrency(breakdown?.convienveFeesGoesToRestaurant)}
              </Text>
            </View>

            {/* Cinema / Restaurant Fee GST */}
            <View style={[commissionS.row, { paddingVertical: rs(14) }]}>
              <View style={commissionS.rowLeft}>
                <View style={[commissionS.iconCircle, { backgroundColor: '#FCE4EC' }]}>
                  <Feather name="percent" size={nz(16)} color="#C62828" />
                </View>
                <View>
                  <Text style={[commissionS.rowLabel, { fontSize: nz(14) }]}>Cinema / Restaurant Fee GST</Text>
                  <Text style={[commissionS.rowSub, { fontSize: nz(11) }]}>GST on restaurant fee</Text>
                </View>
              </View>
              <Text style={[commissionS.rowValue, { fontSize: nz(14), fontWeight: '600', color: '#C62828' }]}>
                {formatCurrency(breakdown?.gstOnConvienveFeesGoesToRestaurant)}
              </Text>
            </View>

            <View style={commissionS.divider} />

            {/* Platform Fee */}
            <View style={[commissionS.row, { paddingVertical: rs(14) }]}>
              <View style={commissionS.rowLeft}>
                <View style={[commissionS.iconCircle, { backgroundColor: '#E8F5E9' }]}>
                  <Feather name="layers" size={nz(16)} color="#2E7D32" />
                </View>
                <View>
                  <Text style={[commissionS.rowLabel, { fontSize: nz(14) }]}>Platform Fee</Text>
                  <Text style={[commissionS.rowSub, { fontSize: nz(11) }]}>Fee going to platform</Text>
                </View>
              </View>
              <Text style={[commissionS.rowValue, { fontSize: nz(14), fontWeight: '600', color: '#2E7D32' }]}>
                {formatCurrency(breakdown?.convienveFeesGoesToAlfennzo)}
              </Text>
            </View>

            {/* Platform Fee GST */}
            <View style={[commissionS.row, { paddingVertical: rs(14) }]}>
              <View style={commissionS.rowLeft}>
                <View style={[commissionS.iconCircle, { backgroundColor: '#F3E5F5' }]}>
                  <Feather name="percent" size={nz(16)} color="#6A1B9A" />
                </View>
                <View>
                  <Text style={[commissionS.rowLabel, { fontSize: nz(14) }]}>Platform Fee GST</Text>
                  <Text style={[commissionS.rowSub, { fontSize: nz(11) }]}>GST on platform fee</Text>
                </View>
              </View>
              <Text style={[commissionS.rowValue, { fontSize: nz(14), fontWeight: '600', color: '#6A1B9A' }]}>
                {formatCurrency(breakdown?.gstOnConvienveFeesGoesToAlfennzo)}
              </Text>
            </View>

            <View style={commissionS.divider} />

            {/* Total Amount */}
            <View style={[commissionS.totalRow, { paddingVertical: rs(16) }]}>
              <View>
                <Text style={[commissionS.totalLabel, { fontSize: nz(16), fontWeight: '700' }]}>Total Amount</Text>
                <Text style={[commissionS.totalSub, { fontSize: nz(11), color: '#888' }]}>Grand total including all fees</Text>
              </View>
              <Text style={[commissionS.totalValue, { fontSize: nz(20), fontWeight: '800', color: GREEN }]}>
                {formatCurrency(order?.TotalAmount)}
              </Text>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[commissionS.closeButton, { backgroundColor: GREEN, borderRadius: rs(25), paddingVertical: rs(14), marginTop: rs(16) }]}
            onPress={onClose}
          >
            <Text style={[commissionS.closeButtonText, { fontSize: nz(14), color: '#fff', fontWeight: '600' }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const modalS = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    width: '90%',
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontWeight: '700',
    color: '#1A1A1A',
  },
  closeBtn: {
    padding: 4,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemName: {
    flex: 1,
    color: '#444',
    marginRight: 12,
  },
  itemPrice: {
    color: '#1A1A1A',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  totalLabel: {
    color: '#1A1A1A',
  },
  totalAmount: {},
  closeButton: {
    alignItems: 'center',
  },
  closeButtonText: {
    fontWeight: '600',
  },
});

// ─── Movie Details Modal ─────────────────────────────────────────────────────
const MovieDetailsModal = ({ visible, movieInfo, onClose, rs, nz }) => {
  if (!movieInfo) return null;

  const { movie, show, venue, interval } = movieInfo;

  const formatDuration = (mins) => {
    if (!mins) return '';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={movieS.overlay}>
        <View style={[movieS.modalContainer, { borderRadius: rs(20), padding: rs(20) }]}>
          <View style={movieS.header}>
            <View style={{ flex: 1 }}>
              <Text style={[movieS.title, { fontSize: nz(18) }]}>Movie Details</Text>
              <Text style={[movieS.subtitle, { fontSize: nz(12) }]}>{venue?.name}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={movieS.closeBtn}>
              <Feather name="x" size={nz(22)} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Movie Name & Info */}
            <View style={[movieS.section, { padding: rs(14), borderRadius: rs(12), marginBottom: rs(12) }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: rs(10) }}>
                <View style={[movieS.iconCircle, { backgroundColor: '#E8F5E9' }]}>
                  <MaterialIcons name="movie" size={nz(18)} color={GREEN} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: nz(16), fontWeight: '700', color: '#1A1A1A' }}>{movie?.movieName}</Text>
                  <Text style={{ fontSize: nz(12), color: '#888', marginTop: rs(2) }}>
                    {movie?.language} • {movie?.dimension} • {movie?.censor}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: rs(6), marginBottom: rs(8) }}>
                {movie?.genre?.map((g, i) => (
                  <View key={i} style={{ backgroundColor: `${GREEN}15`, paddingHorizontal: rs(10), paddingVertical: rs(4), borderRadius: rs(12) }}>
                    <Text style={{ fontSize: nz(11), fontWeight: '600', color: GREEN }}>{g}</Text>
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Feather name="clock" size={nz(12)} color="#888" />
                <Text style={{ fontSize: nz(12), color: '#666', marginLeft: rs(4) }}>Duration: {formatDuration(movie?.duration)}</Text>
              </View>
            </View>

            {/* Show Details */}
            <View style={[movieS.section, { padding: rs(14), borderRadius: rs(12), marginBottom: rs(12) }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: rs(10) }}>
                <View style={[movieS.iconCircle, { backgroundColor: '#E3F2FD' }]}>
                  <MaterialIcons name="schedule" size={nz(18)} color="#1976D2" />
                </View>
                <Text style={{ fontSize: nz(14), fontWeight: '700', color: '#1A1A1A' }}>Show Details</Text>
              </View>

              <View style={{ gap: rs(8) }}>
                <View style={movieS.detailRow}>
                  <Text style={movieS.detailLabel}>Screen</Text>
                  <Text style={movieS.detailValue}>{show?.screen}</Text>
                </View>
                <View style={movieS.detailRow}>
                  <Text style={movieS.detailLabel}>Show Time</Text>
                  <Text style={movieS.detailValue}>{show?.showTime}</Text>
                </View>
                <View style={movieS.detailRow}>
                  <Text style={movieS.detailLabel}>Time Slot</Text>
                  <Text style={movieS.detailValue}>{show?.startTimeLabel} – {show?.endTimeLabel}</Text>
                </View>
                {show?.attributes ? (
                  <View style={movieS.detailRow}>
                    <Text style={movieS.detailLabel}>Format</Text>
                    <Text style={movieS.detailValue}>{show.attributes}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Interval Info */}
            {interval?.isInterval && (
              <View style={[movieS.section, { padding: rs(14), borderRadius: rs(12), marginBottom: rs(12) }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: rs(10) }}>
                  <View style={[movieS.iconCircle, { backgroundColor: '#FFF3E0' }]}>
                    <MaterialIcons name="pause-circle-outline" size={nz(18)} color="#E65100" />
                  </View>
                  <Text style={{ fontSize: nz(14), fontWeight: '700', color: '#1A1A1A' }}>Interval</Text>
                </View>
                <View style={movieS.detailRow}>
                  <Text style={movieS.detailLabel}>Interval Time</Text>
                  <Text style={movieS.detailValue}>{interval.startTimeLabel} – {interval.endTimeLabel}</Text>
                </View>
              </View>
            )}

            {/* Venue */}
            <View style={[movieS.section, { padding: rs(14), borderRadius: rs(12), marginBottom: rs(12) }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: rs(10) }}>
                <View style={[movieS.iconCircle, { backgroundColor: '#FCE4EC' }]}>
                  <MaterialIcons name="location-on" size={nz(18)} color="#C62828" />
                </View>
                <Text style={{ fontSize: nz(14), fontWeight: '700', color: '#1A1A1A' }}>Venue</Text>
              </View>
              <Text style={{ fontSize: nz(13), color: '#444', lineHeight: nz(19) }}>{venue?.address}</Text>
            </View>

            {/* Movie Status */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              backgroundColor: movieInfo.status === 'PLAYING' ? '#E8F5E9' : movieInfo.status === 'INTERVAL' ? '#FFF3E0' : '#F5F5F5',
              paddingVertical: rs(10), borderRadius: rs(10), marginBottom: rs(8),
            }}>
              <View style={{
                width: rs(8), height: rs(8), borderRadius: rs(4), marginRight: rs(6),
                backgroundColor: movieInfo.status === 'PLAYING' ? '#4CAF50' : movieInfo.status === 'INTERVAL' ? '#FF9800' : '#999',
              }} />
              <Text style={{
                fontSize: nz(13), fontWeight: '600',
                color: movieInfo.status === 'PLAYING' ? '#2E7D32' : movieInfo.status === 'INTERVAL' ? '#E65100' : '#666',
              }}>
                {movieInfo.status}
              </Text>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[movieS.closeButton, { backgroundColor: GREEN, borderRadius: rs(25), paddingVertical: rs(14), marginTop: rs(14) }]}
            onPress={onClose}
          >
            <Text style={{ fontSize: nz(14), color: '#fff', fontWeight: '600' }}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const movieS = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    width: '92%',
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    fontWeight: '700',
    color: '#1A1A1A',
  },
  subtitle: {
    color: '#888',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  section: {
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    color: '#888',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  closeButton: {
    alignItems: 'center',
  },
});

const commissionS = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    width: '92%',
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    fontWeight: '700',
    color: '#1A1A1A',
  },
  subtitle: {
    color: '#888',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowLabel: {
    color: '#1A1A1A',
    fontWeight: '500',
  },
  rowSub: {
    color: '#888',
    marginTop: 2,
  },
  rowValue: {
    color: '#1A1A1A',
    marginLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: '#1A1A1A',
  },
  totalSub: {
    marginTop: 2,
  },
  totalValue: {},
  closeButton: {
    alignItems: 'center',
  },
  closeButtonText: {
    fontWeight: '600',
  },
});

// ─── History Order Card ───────────────────────────────────────────────────────
const HistoryOrderCard = React.memo(({ item, rs, nz, cardW, userProfile }) => {
  const [itemsModalVisible, setItemsModalVisible] = useState(false);
  const [commissionModalVisible, setCommissionModalVisible] = useState(false);
  const [movieModalVisible, setMovieModalVisible] = useState(false);

  const statusColor = item.isDelivered ? '#4CAF50' : item.isCancelled ? '#F44336' : '#FF9800';
  const statusText = item.isDelivered ? 'Delivered' : item.isCancelled ? 'Cancelled' : 'Completed';

  const firstItem = item.items[0];
  const remainingCount = item.items.length - 1;
  const hasMultipleItems = item.items.length > 1;

  // Check if user is OWNER and has commission data
  const isOwner = userProfile?.RestaurantType === 'OWNER';
  const hasCommissionData = userProfile?.sharedCommissionWithCinema !== 0;

  return (
    <>
      <View style={{
        width: cardW,
        backgroundColor: '#fff', borderRadius: rs(16),
        marginBottom: rs(20),
        borderWidth: 1, borderColor: '#E8E8E8',
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      }}>

        {/* ── SEAT NUMBER & ORDER NUMBER - Full Width Banner at Top ── */}
        {item.seat ? (
          <View style={{
            backgroundColor: GREEN,
            paddingHorizontal: rs(14),
            paddingVertical: rs(12),
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Feather name="map-pin" size={nz(16)} color="#FFFFFF" style={{ marginRight: rs(8) }} />
              <Text style={{
                fontSize: nz(14),
                fontWeight: '800',
                color: '#FFFFFF',
                letterSpacing: 0.5,
              }} numberOfLines={1}>
                {item.seat}
                {item.seatCode ? ` / ${item.seatCode}` : ''}
              </Text>
            </View>
            {/* Order Number Badge */}
            {item.orderSerialNumber && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.2)',
                paddingHorizontal: rs(10),
                paddingVertical: rs(4),
                borderRadius: rs(6),
                marginLeft: rs(8),
              }}>
                <MaterialIcons name="receipt" size={nz(12)} color="#fff" style={{ marginRight: rs(4) }} />
                <Text style={{
                  fontSize: nz(11),
                  fontWeight: '600',
                  color: 'rgba(255,255,255,0.9)',
                }}>
                  Order No :
                </Text>
                <Text style={{
                  fontSize: nz(13),
                  fontWeight: '800',
                  color: '#fff',
                  marginLeft: rs(4),
                }}>
                  {item.orderSerialNumber}
                </Text>
              </View>
            )}
          </View>
        ) : (
          /* If no seat, show Order Number in a separate banner */
          item.orderSerialNumber && (
            <View style={{
              backgroundColor: GREEN,
              paddingHorizontal: rs(14),
              paddingVertical: rs(10),
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <MaterialIcons name="receipt" size={nz(14)} color="#fff" style={{ marginRight: rs(6) }} />
              <Text style={{
                fontSize: nz(12),
                fontWeight: '600',
                color: 'rgba(255,255,255,0.9)',
              }}>
                Order No :
              </Text>
              <Text style={{
                fontSize: nz(14),
                fontWeight: '800',
                color: '#fff',
                marginLeft: rs(5),
              }}>
                {item.orderSerialNumber}
              </Text>
            </View>
          )
        )}

        {/* ── Card Content ── */}
        <View style={{ padding: rs(14) }}>
          {/* ── Top row ── */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{
              width: rs(46), height: rs(46), borderRadius: rs(23),
              backgroundColor: '#F0F0F0', justifyContent: 'center',
              alignItems: 'center', marginRight: rs(10), flexShrink: 0,
            }}>
              <Text style={{ fontSize: nz(15), fontWeight: '700', color: '#555' }}>{item.initials}</Text>
            </View>

            <View style={{ flex: 1, flexShrink: 1, marginRight: rs(6) }}>
              <Text style={{ fontSize: nz(16), fontWeight: '700', color: '#1A1A1A', marginBottom: rs(4) }} numberOfLines={2}>
                {item.customerName}
              </Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: rs(2) }}>
                <Feather name="calendar" size={nz(12)} color="#999" />
                <Text style={{ fontSize: nz(13), color: '#666', flexShrink: 1, marginLeft: rs(4) }} numberOfLines={1}> {item.date}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Feather name="clock" size={nz(12)} color="#999" />
                <Text style={{ fontSize: nz(13), color: '#666', flexShrink: 1, marginLeft: rs(4) }} numberOfLines={1}> {item.receivedAt}</Text>
              </View>
            </View>

            <View style={{
              flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: rs(8), paddingVertical: rs(4),
              borderRadius: rs(12), flexShrink: 0,
              backgroundColor: `${statusColor}15`,
            }}>
              <View style={{ width: rs(6), height: rs(6), borderRadius: rs(3), marginRight: rs(3), backgroundColor: statusColor }} />
              <Text style={{ fontSize: nz(12), fontWeight: '600', color: statusColor }}>{statusText}</Text>
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: '#F2F2F2', marginVertical: rs(12) }} />

          {/* ── Items ── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: rs(8) }}>
            <View style={{ width: rs(14), height: rs(14), borderRadius: rs(3), backgroundColor: GREEN, marginRight: rs(6) }} />
            <Text style={{ fontSize: nz(14), fontWeight: '700', color: '#1A1A1A' }}>Ordered Items :</Text>
          </View>

          <View style={{ paddingBottom: rs(12) }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={{ fontSize: nz(13), color: '#444', flex: 1, paddingRight: rs(4) }} numberOfLines={2}>
                {firstItem?.name}
              </Text>
              <Text style={{ fontSize: nz(13), color: '#1A1A1A', fontWeight: '600' }}>{firstItem?.price}/-</Text>
            </View>
            {firstItem?.customization?.length > 0 && (
              <View style={{ marginTop: rs(4), paddingLeft: rs(14), backgroundColor: '#F7F7F7', borderRadius: rs(6), paddingVertical: rs(4), paddingRight: rs(8) }}>
                {firstItem.customization.map((c, j) => (
                  <View key={j} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: rs(2) }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: nz(9), color: GREEN, marginRight: rs(4) }}>{'•'}</Text>
                      <Text style={{ fontSize: nz(10), color: '#555', fontWeight: '500' }}>{c.name}</Text>
                    </View>
                    <Text style={{ fontSize: nz(10), color: '#555', fontWeight: '600' }}>+{c.price}/-</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {hasMultipleItems ? (
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: `${GREEN}10`,
                borderRadius: rs(20),
                marginBottom: rs(10),
                borderWidth: 1,
                borderColor: `${GREEN}30`,
                paddingVertical: rs(6),
              }}
              onPress={() => setItemsModalVisible(true)}
              activeOpacity={0.8}
            >
              <Feather name="list" size={nz(12)} color={GREEN} style={{ marginRight: rs(4) }} />
              <Text style={{ fontSize: nz(12), fontWeight: '600', color: GREEN }}>
                Show All ({remainingCount} more item{remainingCount > 1 ? 's' : ''})
              </Text>
            </TouchableOpacity>
          ) : (
            ''
          )}

          <View style={{ borderBottomWidth: 1, borderStyle: 'dashed', borderColor: '#CCCCCC', marginBottom: rs(10) }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(8) }}>
            <Text style={{ fontSize: nz(14), fontWeight: '700', color: '#1A1A1A' }}>Total Bill</Text>
            <Text style={{ fontSize: nz(14), fontWeight: '800', color: '#1A1A1A' }}>{item.total}/-</Text>
          </View>

          <View style={{ height: 1, backgroundColor: '#F2F2F2', marginVertical: rs(12) }} />
          <Text style={{ fontSize: nz(13), color: '#AAAAAA', marginBottom: rs(8) }}>Order ID: {item.orderId}</Text>

          {/* ── View Details Button (OWNER only) ── */}
          {isOwner && hasCommissionData && (
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: GREEN,
                borderRadius: rs(10),
                paddingVertical: rs(10),
                marginTop: rs(8),
                marginBottom: rs(4),
              }}
              onPress={() => setCommissionModalVisible(true)}
              activeOpacity={0.8}
            >
              <Feather name="eye" size={nz(14)} color="#fff" style={{ marginRight: rs(6) }} />
              <Text style={{ fontSize: nz(13), fontWeight: '600', color: '#fff' }}>
                View Commission Details
              </Text>
            </TouchableOpacity>
          )}

          {/* ── Movie Info Row ── */}
          {item.movieInfo && (
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: `${GREEN}08`,
                borderRadius: rs(10),
                paddingVertical: rs(10),
                paddingHorizontal: rs(12),
                marginTop: rs(8),
                borderWidth: 1,
                borderColor: `${GREEN}25`,
              }}
              onPress={() => setMovieModalVisible(true)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{
                  width: rs(32), height: rs(32), borderRadius: rs(8),
                  backgroundColor: `${GREEN}15`, justifyContent: 'center', alignItems: 'center',
                  marginRight: rs(10),
                }}>
                  <MaterialIcons name="movie" size={nz(16)} color={GREEN} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: nz(12), fontWeight: '700', color: '#1A1A1A' }} numberOfLines={1}>
                    {item.movieInfo.movie?.movieName}
                  </Text>
                  <Text style={{ fontSize: nz(11), color: '#888', marginTop: rs(1) }} numberOfLines={1}>
                    {item.movieInfo.show?.showTime} • {item.movieInfo.show?.screen}
                  </Text>
                </View>
              </View>
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: rs(8), paddingVertical: rs(4),
                borderRadius: rs(6), backgroundColor: `${GREEN}12`,
              }}>
                <Text style={{ fontSize: nz(11), fontWeight: '600', color: GREEN, marginRight: rs(3) }}>Details</Text>
                <Feather name="chevron-right" size={nz(12)} color={GREEN} />
              </View>
            </TouchableOpacity>
          )}

          {item.foodnote && (
            <View style={{
              flexDirection: 'column',
              alignItems: 'flex-start',
              borderRadius: rs(10),
              padding: rs(12),
              gap: rs(8),
              backgroundColor: '#FFF8E1',
              borderWidth: 1,
              borderColor: '#FFD54F',
              marginTop: rs(8),
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <MaterialIcons
                  name="restaurant-menu"
                  size={nz(16)}
                  color="#F57F17"
                  style={{ marginRight: rs(6), marginTop: rs(1) }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: nz(11),
                    fontWeight: '700',
                    color: '#F57F17',
                    marginBottom: rs(4),
                  }}>
                    Special Instructions
                  </Text>
                  <Text style={{
                    fontSize: nz(12),
                    color: '#4E342E',
                    lineHeight: nz(18),
                    fontWeight: '500',
                  }}>
                    {item.foodnote}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {item.note && (
            <View style={{
              flexDirection: 'row', backgroundColor: '#fff5e6a9',
              borderRadius: rs(10), padding: rs(10), gap: rs(6),
              alignItems: 'flex-start', borderWidth: 1, borderColor: '#ffdd0343',
              marginTop: rs(8)
            }}>
              <Feather name="info" size={nz(15)} color="#666" />
              <Text style={{ flex: 1, fontSize: nz(13), color: '#885500', lineHeight: nz(19) }}>{item.note}</Text>
            </View>
          )}
        </View>
      </View>

      <ItemsModal
        visible={itemsModalVisible}
        items={item.items}
        total={item.total}
        onClose={() => setItemsModalVisible(false)}
        rs={rs}
        nz={nz}
      />

      <CommissionBreakdownModal
        visible={commissionModalVisible}
        order={item}
        onClose={() => setCommissionModalVisible(false)}
        rs={rs}
        nz={nz}
      />

      <MovieDetailsModal
        visible={movieModalVisible}
        movieInfo={item.movieInfo}
        onClose={() => setMovieModalVisible(false)}
        rs={rs}
        nz={nz}
      />
    </>
  );
}, (prev, next) => prev.item.id === next.item.id && prev.cardW === next.cardW && prev.userProfile?.Id === next.userProfile?.Id);

// ─── Tab Scene ────────────────────────────────────────────────────────────────
const makeTabState = () => ({ data: [], page: 1, totalDocs: 0, exhausted: false, fetching: false });

const TabScene = React.memo(({
  tabKey, loading, list, refreshing, onRefresh,
  isLoadingMore, isExhausted, onEndReached,
  isCustom, hasCustomRange, customStart, customEnd,
  onOpenDatePicker, cols, cardW, gap, rs, nz, userProfile,
}) => {
  const rowKeyExtractor = useCallback((_, i) => String(i), []);
  const renderCard = useCallback(({ item }) => (
    <HistoryOrderCard item={item} rs={rs} nz={nz} cardW={cardW} userProfile={userProfile} />
  ), [rs, nz, cardW, userProfile]);

  const listContent = { paddingTop: rs(6), paddingBottom: rs(24) };

  const footer = isLoadingMore
    ? (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: rs(16), gap: rs(8) }}>
        <ActivityIndicator size="small" color={GREEN} />
        <Text style={{ fontSize: nz(12), color: '#AAAAAA' }}>Loading more...</Text>
      </View>
    )
    : isExhausted && list.length > 0
      ? <Text style={{ textAlign: 'center', color: '#CCCCCC', fontSize: nz(11), paddingVertical: rs(16) }}>— All orders loaded —</Text>
      : null;

  if (isCustom && !hasCustomRange) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: rs(40), gap: rs(8), paddingTop: rs(10) }}>
        <LottieView source={require('../../assets/Calendar.json')} autoPlay loop style={{ width: rs(260), height: rs(260) }} />
        <Text style={{ fontSize: nz(18), fontWeight: '700', color: '#1A1A1A', textAlign: 'center' }}>No Date Range Selected</Text>
        <Text style={{ fontSize: nz(13), color: '#888', textAlign: 'center', lineHeight: nz(20) }}>
          Tap the button below to choose a start and end date.
        </Text>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: GREEN, borderRadius: rs(30), paddingVertical: rs(14), paddingHorizontal: rs(28), marginTop: rs(8), elevation: 4, shadowColor: GREEN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
          onPress={onOpenDatePicker}
          activeOpacity={0.85}
        >
          <Feather name="calendar" size={nz(16)} color="#fff" style={{ marginRight: rs(8) }} />
          <Text style={{ fontSize: nz(14), fontWeight: '700', color: '#fff' }}>Select Date Range</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isCustom && hasCustomRange) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          marginHorizontal: rs(14), marginTop: rs(10), marginBottom: rs(4),
          backgroundColor: `${GREEN}0D`, borderRadius: rs(10),
          paddingHorizontal: rs(14), paddingVertical: rs(10),
          borderWidth: 1, borderColor: `${GREEN}30`,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Feather name="calendar" size={nz(12)} color={GREEN} style={{ marginRight: rs(6) }} />
            <Text style={{ fontSize: nz(12), fontWeight: '600', color: '#1A1A1A' }}>
              {`${fmtShort(customStart)} – ${fmtShort(customEnd)}`}
            </Text>
          </View>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: rs(10), paddingVertical: rs(5), borderRadius: rs(20), borderWidth: 1, borderColor: GREEN }}
            onPress={onOpenDatePicker}
            activeOpacity={0.8}
          >
            <Feather name="sliders" size={nz(12)} color={GREEN} style={{ marginRight: rs(4) }} />
            <Text style={{ fontSize: nz(11), fontWeight: '600', color: GREEN }}>Change Range</Text>
          </TouchableOpacity>
        </View>

        {loading
          ? (
            <FlatList
              data={Array(cols * 2).fill(null)}
              keyExtractor={rowKeyExtractor}
              numColumns={cols}
              key={`skel-${cols}`}
              columnWrapperStyle={cols > 1 ? { gap, paddingHorizontal: rs(14) } : undefined}
              contentContainerStyle={{ ...listContent, paddingHorizontal: cols === 1 ? rs(14) : 0 }}
              renderItem={() => <SkeletonCard rs={rs} nz={nz} cardW={cardW} />}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
            />
          )
          : (
            <FlatList
              data={list}
              keyExtractor={(o) => o.id}
              renderItem={renderCard}
              numColumns={cols}
              key={`list-${cols}`}
              columnWrapperStyle={cols > 1 ? { gap, paddingHorizontal: rs(14), alignItems: 'flex-start' } : undefined}
              contentContainerStyle={{ ...listContent, paddingHorizontal: cols === 1 ? rs(14) : 0 }}
              removeClippedSubviews={Platform.OS === 'android'}
              initialNumToRender={cols * 4}
              maxToRenderPerBatch={cols * 3}
              windowSize={5}
              showsVerticalScrollIndicator={false}
              onEndReached={onEndReached}
              onEndReachedThreshold={0.4}
              ListFooterComponent={footer}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GREEN]} tintColor={GREEN} />}
              ListEmptyComponent={!loading && (
                <EmptyLottie source={require('../../assets/Calendar.json')} title="No Orders Found" sub="No orders found for the selected date range." rs={rs} nz={nz} />
              )}
            />
          )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {loading
        ? (
          <FlatList
            data={Array(cols * 2).fill(null)}
            keyExtractor={rowKeyExtractor}
            numColumns={cols}
            key={`skel-${cols}`}
            columnWrapperStyle={cols > 1 ? { gap, paddingHorizontal: rs(14) } : undefined}
            contentContainerStyle={{ ...listContent, paddingHorizontal: cols === 1 ? rs(14) : 0 }}
            renderItem={() => <SkeletonCard rs={rs} nz={nz} cardW={cardW} />}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
          />
        )
        : (
          <FlatList
            data={list}
            keyExtractor={(o) => o.id}
            renderItem={renderCard}
            numColumns={cols}
            key={`list-${cols}`}
            columnWrapperStyle={cols > 1 ? { gap, paddingHorizontal: rs(14), alignItems: 'flex-start' } : undefined}
            contentContainerStyle={{ ...listContent, paddingHorizontal: cols === 1 ? rs(14) : 0 }}
            removeClippedSubviews={Platform.OS === 'android'}
            initialNumToRender={cols * 4}
            maxToRenderPerBatch={cols * 3}
            windowSize={5}
            showsVerticalScrollIndicator={false}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.4}
            ListFooterComponent={footer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GREEN]} tintColor={GREEN} />}
            ListEmptyComponent={!loading && (
              tabKey === 'today'
                ? <EmptyLottie source={require('../../assets/empty.json')} title="No Orders Today" sub="No orders have been received today yet." rs={rs} nz={nz} />
                : <EmptyLottie source={require('../../assets/yesterday.json')} title="No Orders Yesterday" sub="No orders were received yesterday." rs={rs} nz={nz} />
            )}
          />
        )}
    </View>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function OrderHistoryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, profile } = useStore();

  const { SW, nz, rs, isTablet } = useResponsive();

  const COLS = isTablet ? 2 : 1;
  const H_PAD = rs(14);
  const GAP = isTablet ? rs(12) : 0;
  const CARD_W = (SW - H_PAD * 2 - GAP * (COLS - 1)) / COLS;

  const [tabIndex, setTabIndex] = useState(0);
  const [triggerDatePicker, setTriggerDatePicker] = useState(false);
  const [customStart, setCustomStart] = useState(null);
  const [customEnd, setCustomEnd] = useState(null);

  const tabsRef = useRef({ today: makeTabState(), yesterday: makeTabState(), custom: makeTabState() });
  const [todayList, setTodayList] = useState([]);
  const [yesterdayList, setYesterdayList] = useState([]);
  const [customList, setCustomList] = useState([]);

  const setListMap = useRef({ today: setTodayList, yesterday: setYesterdayList, custom: setCustomList }).current;

  const [loadingMap, setLoadingMap] = useState({ today: true, yesterday: false, custom: false });
  const [loadingMoreMap, setLoadingMoreMap] = useState({ today: false, yesterday: false, custom: false });
  const [exhaustedMap, setExhaustedMap] = useState({ today: false, yesterday: false, custom: false });
  const [refreshing, setRefreshing] = useState(false);

  const flushTab = useCallback((tab) => { setListMap[tab]([...tabsRef.current[tab].data]); }, [setListMap]);
  const exhaustTab = useCallback((tab) => {
    tabsRef.current[tab].exhausted = true;
    setExhaustedMap((p) => ({ ...p, [tab]: true }));
  }, []);

  const loadTab = useCallback(async (tab, page = 1, isRefresh = false, overrideStart, overrideEnd) => {
    const t = tabsRef.current[tab];
    if (!isRefresh && page > 1 && (t.exhausted || t.fetching)) return;
    t.fetching = true;

    let start, end;
    if (tab === 'today') { ({ start, end } = makeToday()); }
    else if (tab === 'yesterday') { ({ start, end } = makeYesterday()); }
    else { start = overrideStart ?? customStart; end = overrideEnd ?? customEnd; }
    if (!start || !end) { t.fetching = false; return; }

    const s = new Date(start); s.setHours(0, 0, 0, 0);
    const e = new Date(end); e.setHours(23, 59, 59, 999);
    const dateParams = { startDate: s.toISOString(), endDate: e.toISOString() };
    const id = user?.restaurantId ?? '';

    try {
      const res = await ordersAPI.getHistoryOrders({ page, limit: LIMIT }, id, dateParams);
      const meta = res?.data?.data?.orderData;
      const raw = Array.isArray(meta?.data) ? meta.data : [];
      const totalDocs = meta?.totalDocuments ?? 0;
      const normalised = raw.map(normaliseOrder);

      if (isRefresh || page === 1) {
        t.data = normalised;
        t.page = 1;
        t.totalDocs = totalDocs;
        t.exhausted = normalised.length === 0 || normalised.length >= totalDocs;
      } else {
        const ids = new Set(t.data.map((o) => o.id));
        const fresh = normalised.filter((o) => !ids.has(o.id));
        t.data = [...t.data, ...fresh];
        t.page = page;
        t.totalDocs = totalDocs;
        t.exhausted = fresh.length === 0 || page * LIMIT >= totalDocs;
      }
      flushTab(tab);
      setExhaustedMap((p) => ({ ...p, [tab]: t.exhausted }));
    } catch {
      if (isRefresh || page === 1) { t.data = []; flushTab(tab); }
      exhaustTab(tab);
    } finally {
      t.fetching = false;
      if (page > 1) setLoadingMoreMap((p) => ({ ...p, [tab]: false }));
    }
  }, [user?.restaurantId, customStart, customEnd, flushTab, exhaustTab]);

  useEffect(() => {
    (async () => {
      setLoadingMap({ today: true, yesterday: true, custom: false });
      await Promise.all([loadTab('today', 1, true), loadTab('yesterday', 1, true)]);
      setLoadingMap((p) => ({ ...p, today: false, yesterday: false }));
    })();
  }, []);

  const onRefresh = useCallback(async () => {
    const key = ROUTES[tabIndex].key;
    if (key === 'custom' && (!customStart || !customEnd)) return;
    setRefreshing(true);
    tabsRef.current[key] = makeTabState();
    setExhaustedMap((p) => ({ ...p, [key]: false }));
    await loadTab(key, 1, true);
    setRefreshing(false);
  }, [tabIndex, customStart, customEnd, loadTab]);

  const makeEndReached = useCallback((key) => () => {
    const t = tabsRef.current[key];
    if (t.exhausted || t.fetching) return;
    setLoadingMoreMap((p) => ({ ...p, [key]: true }));
    loadTab(key, t.page + 1, false);
  }, [loadTab]);

  const handleCustomApply = useCallback(async (start, end) => {
    setCustomStart(start);
    setCustomEnd(end);
    tabsRef.current.custom = makeTabState();
    setCustomList([]);
    setExhaustedMap((p) => ({ ...p, custom: false }));
    setLoadingMap((p) => ({ ...p, custom: true }));
    await loadTab('custom', 1, true, start, end);
    setLoadingMap((p) => ({ ...p, custom: false }));
  }, [loadTab]);

  const customLabel = customStart && customEnd
    ? `${fmtShort(customStart)}–${fmtShort(customEnd)}`
    : 'Custom';

  const renderScene = useCallback(({ route }) => {
    const key = route.key;
    const list = key === 'today' ? todayList : key === 'yesterday' ? yesterdayList : customList;
    return (
      <TabScene
        tabKey={key}
        loading={loadingMap[key]}
        list={list}
        refreshing={refreshing}
        onRefresh={onRefresh}
        isLoadingMore={loadingMoreMap[key]}
        isExhausted={exhaustedMap[key]}
        onEndReached={makeEndReached(key)}
        isCustom={key === 'custom'}
        hasCustomRange={!!(customStart && customEnd)}
        customStart={customStart}
        customEnd={customEnd}
        onOpenDatePicker={() => setTriggerDatePicker(true)}
        cols={COLS}
        cardW={CARD_W}
        gap={GAP}
        rs={rs}
        nz={nz}
        userProfile={profile}
      />
    );
  }, [
    todayList, yesterdayList, customList, loadingMap,
    refreshing, loadingMoreMap, exhaustedMap, onRefresh,
    makeEndReached, customStart, customEnd, COLS, CARD_W, GAP, rs, nz, profile,
  ]);

  const renderTabBar = useCallback((props) => (
    <View style={{ backgroundColor: '#fff', paddingTop: rs(12), paddingBottom: rs(6) }}>
      <CustomTabBar {...props} customLabel={customLabel} SW={SW} rs={rs} nz={nz} />
    </View>
  ), [customLabel, SW, rs, nz]);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" translucent={false} />

      <View style={[s.header, { paddingHorizontal: rs(16), paddingVertical: rs(12) }]}>
        <HapticTouchable onPress={() => navigation.goBack()} style={{ padding: rs(4) }}>
          <Feather name="arrow-left" size={nz(20)} color="#1A1A1A" />
        </HapticTouchable>
        <Text style={{ fontSize: nz(18), fontWeight: '700', color: '#1A1A1A' }}>Order History</Text>
        <View style={{ width: rs(28) }} />
      </View>

      <TabView
        navigationState={{ index: tabIndex, routes: ROUTES }}
        renderScene={renderScene}
        renderTabBar={renderTabBar}
        onIndexChange={setTabIndex}
        initialLayout={{ width: SW }}
        lazy
        lazyPreloadDistance={1}
        swipeEnabled
        style={{ flex: 1 }}
      />

      <DateFilterBar
        activeChip="custom"
        startDate={customStart ?? undefined}
        endDate={customEnd ?? undefined}
        onChipSelect={() => { }}
        onCustomApply={handleCustomApply}
        hideChips
        triggerOpen={triggerDatePicker}
        onTriggerConsumed={() => setTriggerDatePicker(false)}
        style={{
          position: 'absolute',
          top: 0,
          left: 0, right: 0,
          zIndex: 1000,
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
});