import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  StatusBar,
  Image,
  ActivityIndicator,
  Platform,
  Animated,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { TabView } from 'react-native-tab-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { HapticTouchable } from '../components/GlobalHaptic';
import { nz, rs } from '../utils/constant';
import useStore from '../store/useStore';
import { ordersAPI } from '../utils/api';
import { DateFilterBar } from '../components/DateFilter';

const GREEN = '#03954E';
const LIMIT  = 30;
const { width: SW } = Dimensions.get('window');

const ROUTES = [
  { key: 'today',     title: 'Today',     icon: 'sun'      },
  { key: 'yesterday', title: 'Yesterday', icon: 'clock'    },
  { key: 'custom',    title: 'Custom',    icon: 'calendar' },
];

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
const fmtShort = (d) =>
  d?.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) ?? '';

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
  base:        { backgroundColor: '#E8E8E8', borderRadius: rs(6) },
  card:        { backgroundColor: '#fff', borderRadius: rs(16), padding: rs(16), marginBottom: rs(14), borderWidth: 1, borderColor: '#F0F0F0' },
  topRow:      { flexDirection: 'row', alignItems: 'flex-start' },
  avatar:      { width: rs(42), height: rs(42), borderRadius: rs(21), marginRight: rs(10) },
  nameBlock:   { flex: 1, gap: rs(7) },
  line1:       { height: rs(14), width: '72%' },
  line2:       { height: rs(11), width: '52%' },
  line3:       { height: rs(11), width: '40%' },
  badge:       { width: rs(72), height: rs(62), borderRadius: rs(10), marginLeft: rs(8) },
  divider:     { height: rs(1), marginVertical: rs(12) },
  itemLine:    { height: rs(12), width: '80%' },
  btnSkeleton: { height: rs(50), borderRadius: rs(26), marginTop: rs(16) },
});

const TAB_BAR_INNER_W = SW - rs(40) - rs(8);
const TAB_W           = TAB_BAR_INNER_W / 3;
const PILL_POSITIONS  = [0, TAB_W, TAB_W * 2];

const CustomTabBar = React.memo(({ position, jumpTo, customLabel }) => {
  const pillX = position.interpolate({
    inputRange:  [0, 1, 2],
    outputRange: PILL_POSITIONS,
    extrapolate: 'clamp',
  });

  const activeOpacities = ROUTES.map((_, i) =>
    position.interpolate({
      inputRange:  [i - 1, i, i + 1],
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
        const activeOp   = activeOpacities[i];
        const inactiveOp = activeOp.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
        const label      = route.key === 'custom' && customLabel ? customLabel : route.title;

        return (
          <HapticTouchable
            key={route.key}
            onPress={() => jumpTo(route.key)}
            activeOpacity={1}
            style={tb.tab}
          >
            <Animated.View style={tb.inner}>
              <Animated.View style={[tb.row, { opacity: inactiveOp }]}>
                <Feather name={route.icon} size={nz(11)} color="#1A1A1A" style={tb.icon} />
                <Text style={[tb.label, tb.labelInactive]} numberOfLines={1}>{label}</Text>
              </Animated.View>
              <Animated.View style={[tb.row, tb.rowAbsolute, { opacity: activeOp }]}>
                <Feather name={route.icon} size={nz(11)} color="#fff" style={tb.icon} />
                <Text style={[tb.label, tb.labelActive]} numberOfLines={1}>{label}</Text>
              </Animated.View>
            </Animated.View>
          </HapticTouchable>
        );
      })}
    </View>
  );
});

const tb = StyleSheet.create({
  wrapper:       { flexDirection: 'row', backgroundColor: '#EBEBEB', borderRadius: rs(50), padding: rs(4), marginHorizontal: rs(20), position: 'relative', alignItems: 'center' },
  pill:          { position: 'absolute', top: rs(4), bottom: rs(4), left: rs(4), borderRadius: rs(50), backgroundColor: GREEN, elevation: 6, shadowColor: GREEN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8 },
  tab:           { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: rs(10), zIndex: 1 },
  inner:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  row:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  rowAbsolute:   { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  icon:          { marginRight: rs(4) },
  label:         { fontSize: nz(12), fontWeight: '700' },
  labelActive:   { color: '#fff' },
  labelInactive: { color: '#1A1A1A' },
});

const HistoryOrderCard = React.memo(({ item }) => {
  const statusColor = item.isDelivered ? '#4CAF50' : item.isCancelled ? '#F44336' : '#FF9800';
  const statusText  = item.isDelivered ? 'Delivered' : item.isCancelled ? 'Cancelled' : 'Completed';

  return (
    <View style={hc.card}>
      <View style={hc.topRow}>
        <View style={hc.avatar}><Text style={hc.initials}>{item.initials}</Text></View>
        <View style={hc.nameBlock}>
          <Text style={hc.name}>{item.customerName}</Text>
          <View style={hc.metaRow}><Feather name="calendar" size={nz(11)} color="#999" /><Text style={hc.meta}> {item.date}</Text></View>
          <View style={hc.metaRow}><Feather name="clock"    size={nz(11)} color="#999" /><Text style={hc.meta}> {item.receivedAt}</Text></View>
        </View>
        <View style={[hc.statusBadge, { backgroundColor: `${statusColor}15` }]}>
          <View style={[hc.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[hc.statusText, { color: statusColor }]}>{statusText}</Text>
        </View>
      </View>
      <View style={hc.divider} />
      <View style={hc.itemsHeader}>
        <View style={hc.greenSquare} />
        <Text style={hc.itemsTitle}>Ordered Items :</Text>
      </View>
      {item.items.map((it, i) => (
        <View key={i} style={hc.itemRow}>
          <Text style={hc.itemName}>{it.name}</Text>
          <Text style={hc.itemPrice}>{it.price}/-</Text>
        </View>
      ))}
      <View style={hc.dashed} />
      <View style={hc.itemRow}>
        <Text style={hc.totalLabel}>Total Bill</Text>
        <Text style={hc.totalPrice}>{item.total}/-</Text>
      </View>
      <View style={hc.divider} />
      <Text style={hc.orderId}>Order ID: {item.orderId}</Text>
      {item.note && (
        <View style={hc.noteBox}>
          <Feather name="info" size={nz(16)} color="#666" />
          <Text style={hc.noteText}>{item.note}</Text>
        </View>
      )}
    </View>
  );
}, (prev, next) => prev.item.id === next.item.id);

const hc = StyleSheet.create({
  card:        { backgroundColor: '#01690509', borderRadius: rs(16), marginBottom: rs(14), padding: rs(16), borderWidth: 1, borderColor: '#14131336' },
  topRow:      { flexDirection: 'row', alignItems: 'flex-start' },
  avatar:      { width: rs(42), height: rs(42), borderRadius: rs(21), backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', marginRight: rs(10) },
  initials:    { fontSize: nz(14), fontWeight: '700', color: '#555' },
  nameBlock:   { flex: 1 },
  name:        { fontSize: nz(15), fontWeight: '700', color: '#1A1A1A', marginBottom: rs(4) },
  metaRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: rs(3) },
  meta:        { fontSize: nz(12), color: '#666' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: rs(10), paddingVertical: rs(5), borderRadius: rs(12), marginLeft: rs(8) },
  statusDot:   { width: rs(6), height: rs(6), borderRadius: rs(3), marginRight: rs(4) },
  statusText:  { fontSize: nz(11), fontWeight: '600' },
  divider:     { height: 1, backgroundColor: '#F2F2F2', marginVertical: rs(12) },
  dashed:      { borderBottomWidth: 1, borderStyle: 'dashed', borderColor: '#CCCCCC', marginBottom: rs(10) },
  itemsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: rs(10) },
  greenSquare: { width: rs(14), height: rs(14), borderRadius: rs(3), backgroundColor: GREEN, marginRight: rs(8) },
  itemsTitle:  { fontSize: nz(14), fontWeight: '700', color: '#1A1A1A' },
  itemRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(8) },
  itemName:    { fontSize: nz(13), color: '#444', flex: 1 },
  itemPrice:   { fontSize: nz(13), color: '#1A1A1A', fontWeight: '600' },
  totalLabel:  { fontSize: nz(14), fontWeight: '700', color: '#1A1A1A' },
  totalPrice:  { fontSize: nz(14), fontWeight: '800', color: '#1A1A1A' },
  orderId:     { fontSize: nz(12), color: '#AAAAAA', marginBottom: rs(10) },
  noteBox:     { flexDirection: 'row', backgroundColor: '#fff5e6a9', borderRadius: rs(10), padding: rs(12), gap: rs(8), alignItems: 'flex-start', borderWidth: rs(1), borderColor: '#ffdd0343' },
  noteText:    { flex: 1, fontSize: nz(12.5), color: '#885500', lineHeight: nz(19) },
});

const makeTabState = () => ({ data: [], page: 1, totalDocs: 0, exhausted: false, fetching: false });
const TabScene = React.memo(({
  tabKey, loading, list, refreshing, onRefresh,
  isLoadingMore, isExhausted, onEndReached,
  isCustom, hasCustomRange, customStart, customEnd,
  onOpenDatePicker,
}) => {
  const renderItem = useCallback(({ item }) => <HistoryOrderCard item={item} />, []);

  if (isCustom && !hasCustomRange) {
    return (
      <View style={s.customPrompt}>
        <View style={s.promptIconWrap}>
          <Feather name="calendar" size={nz(40)} color={GREEN} />
        </View>
        <Text style={s.customPromptTitle}>No Date Range Selected</Text>
        <Text style={s.customPromptSub}>
          Tap the button below to choose a start and end date and view your order history.
        </Text>
        <TouchableOpacity style={s.dateRangeBtn} onPress={onOpenDatePicker} activeOpacity={0.85}>
          <Feather name="calendar" size={nz(16)} color="#fff" style={{ marginRight: rs(8) }} />
          <Text style={s.dateRangeBtnText}>Select Date Range</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isCustom && hasCustomRange) {
    return (
      <View style={{ flex: 1 }}>
        <View style={s.changeRangeStrip}>
          <View style={s.rangeInfo}>
            <Feather name="calendar" size={nz(13)} color={GREEN} style={{ marginRight: rs(6) }} />
            <Text style={s.rangeInfoText}>{`${fmtShort(customStart)} – ${fmtShort(customEnd)}`}</Text>
          </View>
          <TouchableOpacity style={s.changeRangeBtn} onPress={onOpenDatePicker} activeOpacity={0.8}>
            <Feather name="sliders" size={nz(13)} color={GREEN} style={{ marginRight: rs(4) }} />
            <Text style={s.changeRangeBtnText}>Change Range</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <FlatList data={[1,2,3]} keyExtractor={(i)=>String(i)} renderItem={()=><SkeletonCard/>} contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false} scrollEnabled={false} />
        ) : (
          <FlatList
            data={list} keyExtractor={(o)=>o.id} renderItem={renderItem}
            removeClippedSubviews={Platform.OS==='android'} initialNumToRender={6} maxToRenderPerBatch={4} windowSize={5}
            contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}
            onEndReached={onEndReached} onEndReachedThreshold={0.4}
            ListFooterComponent={isLoadingMore?(<View style={s.loadingMore}><ActivityIndicator size="small" color={GREEN}/><Text style={s.loadingMoreText}>Loading more...</Text></View>):isExhausted&&list.length>0?(<Text style={s.noMoreText}>— All orders loaded —</Text>):null}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GREEN]} tintColor={GREEN}/>}
            ListEmptyComponent={!loading&&(<View style={s.empty}><Image source={require('../../assets/history.png')} style={s.emptyImage} resizeMode="contain"/><Text style={s.emptyTitle}>No Orders Found</Text><Text style={s.emptySub}>No orders found for the selected date range.</Text></View>)}
          />
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {loading ? (
        <FlatList data={[1,2,3]} keyExtractor={(i)=>String(i)} renderItem={()=><SkeletonCard/>} contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false} scrollEnabled={false}/>
      ) : (
        <FlatList
          data={list} keyExtractor={(o)=>o.id} renderItem={renderItem}
          removeClippedSubviews={Platform.OS==='android'} initialNumToRender={6} maxToRenderPerBatch={4} windowSize={5}
          contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}
          onEndReached={onEndReached} onEndReachedThreshold={0.4}
          ListFooterComponent={isLoadingMore?(<View style={s.loadingMore}><ActivityIndicator size="small" color={GREEN}/><Text style={s.loadingMoreText}>Loading more...</Text></View>):isExhausted&&list.length>0?(<Text style={s.noMoreText}>— All orders loaded —</Text>):null}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GREEN]} tintColor={GREEN}/>}
          ListEmptyComponent={!loading&&(<View style={s.empty}><Image source={require('../../assets/history.png')} style={s.emptyImage} resizeMode="contain"/><Text style={s.emptyTitle}>No Orders Found</Text><Text style={s.emptySub}>No orders found for the selected date range.</Text></View>)}
        />
      )}
    </View>
  );
});

export default function OrderHistoryScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user }   = useStore();
  const [tabIndex, setTabIndex] = useState(0);
  const [triggerDatePicker, setTriggerDatePicker] = useState(false);
  const [customStart, setCustomStart] = useState(null);
  const [customEnd,   setCustomEnd]   = useState(null);
  const tabsRef = useRef({ today: makeTabState(), yesterday: makeTabState(), custom: makeTabState() });
  const [todayList,     setTodayList]     = useState([]);
  const [yesterdayList, setYesterdayList] = useState([]);
  const [customList,    setCustomList]    = useState([]);
  const setListMap = { today: setTodayList, yesterday: setYesterdayList, custom: setCustomList };
  const [loadingMap,     setLoadingMap]     = useState({ today: true,  yesterday: false, custom: false });
  const [loadingMoreMap, setLoadingMoreMap] = useState({ today: false, yesterday: false, custom: false });
  const [exhaustedMap,   setExhaustedMap]   = useState({ today: false, yesterday: false, custom: false });
  const [refreshing,     setRefreshing]     = useState(false);
  const flushTab = useCallback((tab) => { setListMap[tab]([...tabsRef.current[tab].data]); }, []);
  const exhaustTab = useCallback((tab) => { tabsRef.current[tab].exhausted = true; setExhaustedMap((p) => ({ ...p, [tab]: true })); }, []);

  const loadTab = useCallback(async (tab, page = 1, isRefresh = false, overrideStart, overrideEnd) => {
    const t = tabsRef.current[tab];
    if (!isRefresh && page > 1 && (t.exhausted || t.fetching)) return;
    t.fetching = true;

    let start, end;
    if (tab === 'today')          { ({ start, end } = makeToday()); }
    else if (tab === 'yesterday') { ({ start, end } = makeYesterday()); }
    else { start = overrideStart ?? customStart; end = overrideEnd ?? customEnd; }
    if (!start || !end) { t.fetching = false; return; }

    const s = new Date(start); s.setHours(0,0,0,0);
    const e = new Date(end);   e.setHours(23,59,59,999);
    const dateParams = { startDate: s.toISOString(), endDate: e.toISOString() };
    const id = user?.restaurantId ?? '';

    try {
      const res       = await ordersAPI.getHistoryOrders({ page, limit: LIMIT }, id, dateParams);
      const meta      = res?.data?.data?.orderData;
      const raw       = Array.isArray(meta?.data) ? meta.data : [];
      const totalDocs = meta?.totalDocuments ?? 0;
      const normalised = raw.map(normaliseOrder);

      if (isRefresh || page === 1) {
        t.data = normalised; t.page = 1; t.totalDocs = totalDocs;
        t.exhausted = normalised.length === 0 || normalised.length >= totalDocs;
      } else {
        const ids = new Set(t.data.map((o) => o.id));
        const fresh = normalised.filter((o) => !ids.has(o.id));
        t.data = [...t.data, ...fresh]; t.page = page; t.totalDocs = totalDocs;
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
        tabKey={key} loading={loadingMap[key]} list={list}
        refreshing={refreshing} onRefresh={onRefresh}
        isLoadingMore={loadingMoreMap[key]} isExhausted={exhaustedMap[key]}
        onEndReached={makeEndReached(key)}
        isCustom={key === 'custom'} hasCustomRange={!!(customStart && customEnd)}
        customStart={customStart} customEnd={customEnd}
        onOpenDatePicker={() => setTriggerDatePicker(true)}
      />
    );
  }, [
    todayList, yesterdayList, customList,
    loadingMap, refreshing, loadingMoreMap, exhaustedMap,
    onRefresh, makeEndReached, customStart, customEnd,
  ]);

  const renderTabBar = useCallback((props) => (
    <View style={s.tabSection}>
      <CustomTabBar {...props} customLabel={customLabel} />

      <View style={{ height: 0, overflow: 'hidden' }}>
        <DateFilterBar
          activeChip="custom"
          startDate={customStart ?? undefined}
          endDate={customEnd ?? undefined}
          onChipSelect={() => {}}
          onCustomApply={handleCustomApply}
          hideChips
          triggerOpen={triggerDatePicker}
          onTriggerConsumed={() => setTriggerDatePicker(false)}
        />
      </View>
    </View>
  ), [customLabel, customStart, customEnd, handleCustomApply, triggerDatePicker]);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" translucent={false} />

      <View style={s.header}>
        <HapticTouchable onPress={() => navigation.goBack()} style={s.backButton}>
          <Feather name="arrow-left" size={nz(20)} color="#1A1A1A" />
        </HapticTouchable>
        <Text style={s.headerTitle}>Order History</Text>
        <View style={s.placeholder} />
      </View>

      <TabView
        navigationState={{ index: tabIndex, routes: ROUTES }}
        renderScene={renderScene}
        renderTabBar={renderTabBar}
        onIndexChange={setTabIndex}
        initialLayout={{ width: SW }}
        lazy lazyPreloadDistance={1} swipeEnabled
        style={{ flex: 1 }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#fff' },
  header:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: rs(16), paddingVertical: rs(12),
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  backButton:   { padding: rs(4) },
  headerTitle:  { fontSize: nz(18), fontWeight: '700', color: '#1A1A1A' },
  placeholder:  { width: rs(28) },
  tabSection:   { backgroundColor: '#fff', paddingTop: rs(12), paddingBottom: rs(4) },
  listContent:  { paddingHorizontal: rs(14), paddingTop: rs(6), paddingBottom: rs(24) },
  loadingMore:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: rs(16), gap: rs(8) },
  loadingMoreText: { fontSize: nz(13), color: '#AAAAAA' },
  noMoreText:   { textAlign: 'center', color: '#CCCCCC', fontSize: nz(12), paddingVertical: rs(16) },
  empty:        { alignItems: 'center', paddingTop: rs(50), gap: rs(4) },
  emptyImage:   { width: rs(180), height: rs(180), marginBottom: rs(8) },
  emptyTitle:   { fontSize: nz(18), fontWeight: '700', color: '#1A1A1A' },
  emptySub:     { fontSize: nz(13), color: '#888', textAlign: 'center', paddingHorizontal: rs(30), marginTop: rs(4) },
  customPrompt:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: rs(40), gap: rs(16) },
  promptIconWrap:    { width: rs(80), height: rs(80), borderRadius: rs(40), backgroundColor: `${GREEN}15`, alignItems: 'center', justifyContent: 'center' },
  customPromptTitle: { fontSize: nz(18), fontWeight: '700', color: '#1A1A1A', textAlign: 'center' },
  customPromptSub:   { fontSize: nz(13), color: '#888', textAlign: 'center', lineHeight: nz(20) },
  dateRangeBtn:      {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: GREEN, borderRadius: rs(30),
    paddingVertical: rs(14), paddingHorizontal: rs(28), marginTop: rs(8),
    elevation: 4, shadowColor: GREEN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  dateRangeBtnText: { fontSize: nz(14), fontWeight: '700', color: '#fff' },
  changeRangeStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: rs(14), marginTop: rs(10), marginBottom: rs(4),
    backgroundColor: `${GREEN}0D`, borderRadius: rs(10),
    paddingHorizontal: rs(14), paddingVertical: rs(10),
    borderWidth: 1, borderColor: `${GREEN}30`,
  },
  rangeInfo:          { flexDirection: 'row', alignItems: 'center' },
  rangeInfoText:      { fontSize: nz(13), fontWeight: '600', color: '#1A1A1A' },
  changeRangeBtn:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: rs(10), paddingVertical: rs(5), borderRadius: rs(20), borderWidth: 1, borderColor: GREEN },
  changeRangeBtnText: { fontSize: nz(12), fontWeight: '600', color: GREEN },
});