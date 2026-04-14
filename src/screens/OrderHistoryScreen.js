
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  StatusBar, Animated, TouchableOpacity, ActivityIndicator, Platform,
  Modal, ScrollView, Dimensions,
} from 'react-native';
import { TabView }           from 'react-native-tab-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather }           from '@expo/vector-icons';
import { useNavigation }     from '@react-navigation/native';
import LottieView            from 'lottie-react-native';
import { HapticTouchable }   from '../components/GlobalHaptic';
import { useResponsive }     from '../utils/useResponsive';
import useStore              from '../store/useStore';
import { ordersAPI }         from '../utils/api';
import { DateFilterBar }     from '../components/DateFilter';

const GREEN = '#03954E';
const LIMIT  = 30;

const ROUTES = [
  { key: 'today',     title: 'Today',     icon: 'sun'      },
  { key: 'yesterday', title: 'Yesterday', icon: 'clock'    },
  { key: 'custom',    title: 'Custom',    icon: 'calendar' },
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

// cardW: width of the card — matches the real card so skeletons are accurate.
const SkeletonCard = ({ rs, nz, cardW }) => (
  <View style={{
    width: cardW,
    backgroundColor: '#fff', borderRadius: rs(16),
    padding: rs(16), marginBottom: rs(14),
    borderWidth: 1, borderColor: '#F0F0F0',
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
    <SkeletonPulse style={{ height: rs(44), borderRadius: rs(22), marginTop: rs(14) }} />
  </View>
);

// ─── Custom Tab Bar ───────────────────────────────────────────────────────────
const CustomTabBar = React.memo(({ position, jumpTo, customLabel, SW, rs, nz }) => {
  const TAB_BAR_W = SW - rs(40) - rs(8);
  const TAB_W     = TAB_BAR_W / 3;
  const PILL_POS  = [0, TAB_W, TAB_W * 2];
  const pillX     = position.interpolate({ inputRange: [0, 1, 2], outputRange: PILL_POS, extrapolate: 'clamp' });
  const activeOps = ROUTES.map((_, i) =>
    position.interpolate({ inputRange: [i - 1, i, i + 1], outputRange: [0, 1, 0], extrapolate: 'clamp' })
  );

  return (
    <View style={[tbS.wrapper, { borderRadius: rs(50), padding: rs(4), marginHorizontal: rs(20) }]}>
      <Animated.View pointerEvents="none"
        style={[tbS.pill, { width: TAB_W, borderRadius: rs(50), transform: [{ translateX: pillX }] }]} />
      {ROUTES.map((route, i) => {
        const activeOp   = activeOps[i];
        const inactiveOp = activeOp.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
        const label      = route.key === 'custom' && customLabel ? customLabel : route.title;
        return (
          <HapticTouchable
            key={route.key}
            onPress={() => jumpTo(route.key)}
            activeOpacity={1}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: rs(10), zIndex: 1 }}
          >
            <Animated.View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              {/* Inactive */}
              <Animated.View style={[{ flexDirection: 'row', alignItems: 'center' }, { opacity: inactiveOp }]}>
                <Feather name={route.icon} size={nz(11)} color="#1A1A1A" style={{ marginRight: rs(4) }} />
                <Text style={{ fontSize: nz(12), fontWeight: '700', color: '#1A1A1A' }} numberOfLines={1}>{label}</Text>
              </Animated.View>
              {/* Active */}
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
  pill:    { position: 'absolute', top: 4, bottom: 4, left: 4, backgroundColor: GREEN, elevation: 0, shadowColor: GREEN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8 },
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
            <View key={idx} style={[modalS.itemRow, { paddingVertical: rs(12) }]}>
              <Text style={[modalS.itemName, { fontSize: nz(14) }]} numberOfLines={2}>{item.name}</Text>
              <Text style={[modalS.itemPrice, { fontSize: nz(14), fontWeight: '600' }]}>₹{item.price}</Text>
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

// ─── History Order Card ───────────────────────────────────────────────────────
const HistoryOrderCard = React.memo(({ item, rs, nz, cardW }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const statusColor = item.isDelivered ? '#4CAF50' : item.isCancelled ? '#F44336' : '#FF9800';
  const statusText  = item.isDelivered ? 'Delivered' : item.isCancelled ? 'Cancelled' : 'Completed';
  
  // Show only first item, plus count of remaining items
  const firstItem = item.items[0];
  const remainingCount = item.items.length - 1;
  const hasMultipleItems = item.items.length > 1;

  // Seat badge width proportional to card — keeps layout from overflowing on narrow tablet columns
  const SEAT_W = Math.min(90, Math.max(64, cardW * 0.22));

  return (
    <>
      <View style={{
        width: cardW,
        backgroundColor: '#01690509', borderRadius: rs(16),
        marginBottom: rs(14), padding: rs(14),
        borderWidth: 1, borderColor: '#14131336',
      }}>
        {/* ── Top row ── */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          {/* Avatar */}
          <View style={{
            width: rs(40), height: rs(40), borderRadius: rs(20),
            backgroundColor: '#F0F0F0', justifyContent: 'center',
            alignItems: 'center', marginRight: rs(8), flexShrink: 0,
          }}>
            <Text style={{ fontSize: nz(13), fontWeight: '700', color: '#555' }}>{item.initials}</Text>
          </View>

          {/* Name + date + time */}
          <View style={{ flex: 1, flexShrink: 1, marginRight: rs(6) }}>
            <Text style={{ fontSize: nz(13), fontWeight: '700', color: '#1A1A1A', marginBottom: rs(3) }} numberOfLines={2}>
              {item.customerName}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: rs(2) }}>
              <Feather name="calendar" size={nz(10)} color="#999" />
              <Text style={{ fontSize: nz(11), color: '#666', flexShrink: 1 }} numberOfLines={1}> {item.date}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Feather name="clock" size={nz(10)} color="#999" />
              <Text style={{ fontSize: nz(11), color: '#666', flexShrink: 1 }} numberOfLines={1}> {item.receivedAt}</Text>
            </View>
          </View>

          {/* Status badge */}
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: rs(8), paddingVertical: rs(4),
            borderRadius: rs(12), flexShrink: 0,
            backgroundColor: `${statusColor}15`,
          }}>
            <View style={{ width: rs(6), height: rs(6), borderRadius: rs(3), marginRight: rs(3), backgroundColor: statusColor }} />
            <Text style={{ fontSize: nz(10), fontWeight: '600', color: statusColor }}>{statusText}</Text>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: '#F2F2F2', marginVertical: rs(10) }} />

        {/* ── Items - Show only first item with "Show All" button if multiple ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: rs(8) }}>
          <View style={{ width: rs(12), height: rs(12), borderRadius: rs(3), backgroundColor: GREEN, marginRight: rs(6) }} />
          <Text style={{ fontSize: nz(12), fontWeight: '700', color: '#1A1A1A' }}>Ordered Items :</Text>
        </View>
        
        {/* First item */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: rs(6) }}>
          <Text style={{ fontSize: nz(11), color: '#444', flex: 1, paddingRight: rs(4) }} numberOfLines={2}>
            {firstItem?.name}
          </Text>
          <Text style={{ fontSize: nz(11), color: '#1A1A1A', fontWeight: '600' }}>{firstItem?.price}/-</Text>
        </View>
        
        {/* Show All button if multiple items */}
        {hasMultipleItems?(
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: `${GREEN}10`,
              borderRadius: rs(20),
              paddingVertical: rs(6),
              marginTop: rs(4),
              marginBottom: rs(8),
              borderWidth: 1,
              borderColor: `${GREEN}30`,
            }}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
          >
            <Feather name="list" size={nz(10)} color={GREEN} style={{ marginRight: rs(4) }} />
            <Text style={{ fontSize: nz(10), fontWeight: '600', color: GREEN }}>
              Show All ({remainingCount} more item{remainingCount > 1 ? 's' : ''})
            </Text>
          </TouchableOpacity>
        ):(
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: rs(20),
              paddingVertical: rs(6),
              marginTop: rs(4),
              marginBottom: rs(8),
            }}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: nz(10), fontWeight: '600', color: GREEN }}>
             
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ borderBottomWidth: 1, borderStyle: 'dashed', borderColor: '#CCCCCC', marginBottom: rs(8) }} />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(6) }}>
          <Text style={{ fontSize: nz(12), fontWeight: '700', color: '#1A1A1A' }}>Total Bill</Text>
          <Text style={{ fontSize: nz(12), fontWeight: '800', color: '#1A1A1A' }}>{item.total}/-</Text>
        </View>

        <View style={{ height: 1, backgroundColor: '#F2F2F2', marginVertical: rs(10) }} />
        <Text style={{ fontSize: nz(10.5), color: '#AAAAAA', marginBottom: rs(8) }}>Order ID: {item.orderId}</Text>

        {item.note && (
          <View style={{
            flexDirection: 'row', backgroundColor: '#fff5e6a9',
            borderRadius: rs(10), padding: rs(10), gap: rs(6),
            alignItems: 'flex-start', borderWidth: 1, borderColor: '#ffdd0343',
          }}>
            <Feather name="info" size={nz(13)} color="#666" />
            <Text style={{ flex: 1, fontSize: nz(11), color: '#885500', lineHeight: nz(17) }}>{item.note}</Text>
          </View>
        )}
      </View>

      {/* Items Modal */}
      <ItemsModal
        visible={modalVisible}
        items={item.items}
        total={item.total}
        onClose={() => setModalVisible(false)}
        rs={rs}
        nz={nz}
      />
    </>
  );
}, (prev, next) => prev.item.id === next.item.id && prev.cardW === next.cardW);

// ─── Tab Scene ────────────────────────────────────────────────────────────────
const makeTabState = () => ({ data: [], page: 1, totalDocs: 0, exhausted: false, fetching: false });

const TabScene = React.memo(({
  tabKey, loading, list, refreshing, onRefresh,
  isLoadingMore, isExhausted, onEndReached,
  isCustom, hasCustomRange, customStart, customEnd,
  onOpenDatePicker, cols, cardW, gap, rs, nz,
}) => {
  const rowKeyExtractor = useCallback((_, i) => String(i), []);
  const renderCard      = useCallback(({ item }) => (
    <HistoryOrderCard item={item} rs={rs} nz={nz} cardW={cardW} />
  ), [rs, nz, cardW]);

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

  // ── Custom tab — no range selected yet ──────────────────────────────────
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

  // ── Custom tab — range selected ──────────────────────────────────────────
  if (isCustom && hasCustomRange) {
    return (
      <View style={{ flex: 1 }}>
        {/* Range strip */}
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

  // ── Today / Yesterday tabs ───────────────────────────────────────────────
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
                ? <EmptyLottie source={require('../../assets/empty.json')}     title="No Orders Today"     sub="No orders have been received today yet." rs={rs} nz={nz} />
                : <EmptyLottie source={require('../../assets/yesterday.json')} title="No Orders Yesterday" sub="No orders were received yesterday."      rs={rs} nz={nz} />
            )}
          />
        )}
    </View>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function OrderHistoryScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user }   = useStore();

  const { SW, nz, rs, isTablet } = useResponsive();

  // ── Responsive grid ────────────────────────────────────────────────────────
  const COLS   = isTablet ? 2 : 1;
  const H_PAD  = rs(14);
  const GAP    = isTablet ? rs(12) : 0;
  const CARD_W = (SW - H_PAD * 2 - GAP * (COLS - 1)) / COLS;

  const [tabIndex,          setTabIndex]          = useState(0);
  const [triggerDatePicker, setTriggerDatePicker] = useState(false);
  const [customStart,       setCustomStart]       = useState(null);
  const [customEnd,         setCustomEnd]         = useState(null);

  const tabsRef = useRef({ today: makeTabState(), yesterday: makeTabState(), custom: makeTabState() });
  const [todayList,     setTodayList]     = useState([]);
  const [yesterdayList, setYesterdayList] = useState([]);
  const [customList,    setCustomList]    = useState([]);

  const setListMap = useRef({ today: setTodayList, yesterday: setYesterdayList, custom: setCustomList }).current;

  const [loadingMap,     setLoadingMap]     = useState({ today: true,  yesterday: false, custom: false });
  const [loadingMoreMap, setLoadingMoreMap] = useState({ today: false, yesterday: false, custom: false });
  const [exhaustedMap,   setExhaustedMap]   = useState({ today: false, yesterday: false, custom: false });
  const [refreshing,     setRefreshing]     = useState(false);

  const flushTab   = useCallback((tab) => { setListMap[tab]([...tabsRef.current[tab].data]); }, [setListMap]);
  const exhaustTab = useCallback((tab) => {
    tabsRef.current[tab].exhausted = true;
    setExhaustedMap((p) => ({ ...p, [tab]: true }));
  }, []);

  const loadTab = useCallback(async (tab, page = 1, isRefresh = false, overrideStart, overrideEnd) => {
    const t = tabsRef.current[tab];
    if (!isRefresh && page > 1 && (t.exhausted || t.fetching)) return;
    t.fetching = true;

    let start, end;
    if (tab === 'today')          { ({ start, end } = makeToday()); }
    else if (tab === 'yesterday') { ({ start, end } = makeYesterday()); }
    else                          { start = overrideStart ?? customStart; end = overrideEnd ?? customEnd; }
    if (!start || !end) { t.fetching = false; return; }

    const s = new Date(start); s.setHours(0, 0, 0, 0);
    const e = new Date(end);   e.setHours(23, 59, 59, 999);
    const dateParams = { startDate: s.toISOString(), endDate: e.toISOString() };
    const id = user?.restaurantId ?? '';

    try {
      const res        = await ordersAPI.getHistoryOrders({ page, limit: LIMIT }, id, dateParams);
      const meta       = res?.data?.data?.orderData;
      const raw        = Array.isArray(meta?.data) ? meta.data : [];
      const totalDocs  = meta?.totalDocuments ?? 0;
      const normalised = raw.map(normaliseOrder);

      if (isRefresh || page === 1) {
        t.data      = normalised;
        t.page      = 1;
        t.totalDocs = totalDocs;
        t.exhausted = normalised.length === 0 || normalised.length >= totalDocs;
      } else {
        const ids   = new Set(t.data.map((o) => o.id));
        const fresh = normalised.filter((o) => !ids.has(o.id));
        t.data      = [...t.data, ...fresh];
        t.page      = page;
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
    const key  = route.key;
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
      />
    );
  }, [
    todayList, yesterdayList, customList, loadingMap,
    refreshing, loadingMoreMap, exhaustedMap, onRefresh,
    makeEndReached, customStart, customEnd, COLS, CARD_W, GAP, rs, nz,
  ]);

  // renderTabBar: NO DateFilterBar here — moved to root level (see below)
  const renderTabBar = useCallback((props) => (
    <View style={{ backgroundColor: '#fff', paddingTop: rs(12), paddingBottom: rs(6) }}>
      <CustomTabBar {...props} customLabel={customLabel} SW={SW} rs={rs} nz={nz} />
    </View>
  ), [customLabel, SW, rs, nz]);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" translucent={false} />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={[s.header, { paddingHorizontal: rs(16), paddingVertical: rs(12) }]}>
        <HapticTouchable onPress={() => navigation.goBack()} style={{ padding: rs(4) }}>
          <Feather name="arrow-left" size={nz(20)} color="#1A1A1A" />
        </HapticTouchable>
        <Text style={{ fontSize: nz(18), fontWeight: '700', color: '#1A1A1A' }}>Order History</Text>
        <View style={{ width: rs(28) }} />
      </View>

      {/* ── Tab view ────────────────────────────────────────────────────── */}
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

      {/* DateFilterBar - Fixed visibility in landscape */}
      <DateFilterBar
        activeChip="custom"
        startDate={customStart ?? undefined}
        endDate={customEnd ?? undefined}
        onChipSelect={() => {}}
        onCustomApply={handleCustomApply}
        hideChips
        triggerOpen={triggerDatePicker}
        onTriggerConsumed={() => setTriggerDatePicker(false)}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,          right: 0,
          zIndex: 1000,
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
});