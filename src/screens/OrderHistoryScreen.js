import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  Animated,
  Dimensions,
  PixelRatio,
  StatusBar,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Feather, Ionicons } from '@expo/vector-icons';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import HapticTouchable from '../components/GlobalHaptic';

// ─── Responsive helpers ───────────────────────────────────────────────────────
const { width: SW } = Dimensions.get('window');
const scale = SW / 390;
const nz = (s) => Math.round(PixelRatio.roundToNearestPixel(s * Math.min(scale, 1.35)));
const rs = (s) => Math.round(s * Math.min(scale, 1.3));

// ─── Constants ────────────────────────────────────────────────────────────────
const GREEN      = '#1E7A1E';
const CREAM      = '#FAFAF5';
const TABS       = ['Active Listings', 'Disable Listings'];

const CATEGORIES = [
  { id: '1', label: 'Pizzas',     emoji: '🍕' },
  { id: '2', label: 'Beverages',  emoji: '🧋' },
  { id: '3', label: 'Burgers',    emoji: '🍔' },
  { id: '4', label: 'Pasta',      emoji: '🍝' },
  { id: '5', label: 'Desserts',   emoji: '🍰' },
  { id: '6', label: 'Snacks',     emoji: '🍟' },
];

// ─── Mock products ────────────────────────────────────────────────────────────
const MOCK_ACTIVE = [
  { id: '1', name: 'Margherita Pizza',   price: '249/-', status: 'live',     on: true  },
  { id: '2', name: 'Deluxe Veggie',      price: '199/-', status: 'live',     on: true  },
  { id: '3', name: 'Chicken Dominator',  price: '299/-', status: 'live',     on: true  },
  { id: '4', name: 'Chicken Delight',    price: '289/-', status: 'disabled', on: false },
  { id: '5', name: 'Paneer Tikka',       price: '219/-', status: 'live',     on: true  },
  { id: '6', name: 'Veg Supreme',        price: '179/-', status: 'live',     on: true  },
];
const MOCK_DISABLED = MOCK_ACTIVE.filter((p) => !p.on);

// ─── Category Pill ────────────────────────────────────────────────────────────
const CategoryPill = React.memo(({ item, isActive, onPress }) => (
  <HapticTouchable
    onPress={onPress}
    activeOpacity={0.78}
    style={[cp.pill, isActive && cp.pillActive]}
  >
    <View style={[cp.emojiWrap, isActive && cp.emojiWrapActive]}>
      <Text style={cp.emoji}>{item.emoji}</Text>
    </View>
    <Text style={[cp.label, isActive && cp.labelActive]}>{item.label}</Text>
  </HapticTouchable>
));

const cp = StyleSheet.create({
  pill: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: '#F0F0F0',
    borderRadius:    rs(30),
    paddingRight:    rs(14),
    paddingLeft:     rs(4),
    paddingVertical: rs(4),
    marginRight:     rs(10),
  },
  pillActive: {
    backgroundColor: '#D6EDD6',
    borderWidth:     rs(1.5),
    borderColor:     GREEN,
  },
  emojiWrap: {
    width:           rs(36),
    height:          rs(36),
    borderRadius:    rs(18),
    backgroundColor: '#E4E4E4',
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     rs(6),
  },
  emojiWrapActive: {
    backgroundColor: '#C5E0C5',
  },
  emoji: { fontSize: nz(18) },
  label: {
    fontSize:   nz(13),
    fontWeight: '600',
    color:      '#555555',
  },
  labelActive: { color: GREEN, fontWeight: '700' },
});

// ─── Toggle Button (On / Off) ─────────────────────────────────────────────────
const ToggleBtn = React.memo(({ isOn, onToggle }) => {
  const anim = useRef(new Animated.Value(isOn ? 1 : 0)).current;

  const toggle = useCallback(() => {
    Animated.timing(anim, {
      toValue:         isOn ? 0 : 1,
      duration:        200,
      useNativeDriver: false,
    }).start();
    onToggle();
  }, [isOn]);

  const bg = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['#E53935', GREEN],
  });

  return (
    <HapticTouchable onPress={toggle} activeOpacity={0.85}>
      <Animated.View style={[tb2.btn, { backgroundColor: bg }]}>
        <Text style={tb2.label}>{isOn ? 'On' : 'Off'}</Text>
      </Animated.View>
    </HapticTouchable>
  );
});

const tb2 = StyleSheet.create({
  btn: {
    borderRadius:    rs(24),
    paddingVertical: rs(10),
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       rs(10),
  },
  label: {
    fontSize:   nz(14),
    fontWeight: '700',
    color:      '#FFFFFF',
    letterSpacing: 0.3,
  },
});

// ─── Product Card ─────────────────────────────────────────────────────────────
const ProductCard = React.memo(({ item, onToggle }) => {
  const isLive     = item.status === 'live';
  const isDisabled = !item.on;

  return (
    <View style={[pc.wrap, isDisabled && pc.wrapDisabled]}>
      {/* Image area */}
      <View style={pc.imageWrap}>
        {/* placeholder — replace with <Image source={...} style={pc.image} /> */}
        <View style={pc.imagePlaceholder} />
        <View style={pc.addBadge}>
          <MaterialIcons name="add" size={nz(13)} color={GREEN} />
        </View>
      </View>

      {/* Info */}
      <Text style={[pc.name, isDisabled && pc.nameDisabled]} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={[pc.price, isDisabled && pc.priceDisabled]}>{item.price}</Text>

      {/* Status row */}
      <View style={pc.statusRow}>
        <View style={[pc.statusDot, { backgroundColor: isLive && !isDisabled ? GREEN : '#E53935' }]} />
        <Text style={[pc.statusText, { color: isLive && !isDisabled ? GREEN : '#E53935' }]}>
          {isDisabled ? 'Disabled' : 'Live'}
        </Text>
      </View>

      {/* More Details chip */}
      <HapticTouchable activeOpacity={0.7} style={pc.detailChip}>
        <Text style={pc.detailText}>More Details</Text>
      </HapticTouchable>

      {/* On/Off toggle */}
      <ToggleBtn isOn={item.on} onToggle={() => onToggle(item.id)} />
    </View>
  );
});

const CARD_W = (SW - rs(16) * 2 - rs(12)) / 2;

const pc = StyleSheet.create({
  wrap: {
    width:           CARD_W,
    backgroundColor: CREAM,
    borderRadius:    rs(14),
    padding:         rs(10),
    marginBottom:    rs(14),
    borderWidth:     rs(1),
    borderColor:     '#EBEBDF',
  },
  wrapDisabled: {
    opacity: 0.82,
  },
  imageWrap: {
    width:           '100%',
    aspectRatio:     1,
    borderRadius:    rs(10),
    backgroundColor: '#E8E8E8',
    marginBottom:    rs(8),
    overflow:        'hidden',
    position:        'relative',
  },
  imagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E0E0E0',
  },
  image: {
    width:  '100%',
    height: '100%',
  },
  addBadge: {
    position:        'absolute',
    bottom:          rs(6),
    left:            rs(6),
    width:           rs(22),
    height:          rs(22),
    borderRadius:    rs(6),
    backgroundColor: '#FFFFFF',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     rs(1.5),
    borderColor:     GREEN,
  },
  name: {
    fontSize:     nz(13),
    fontWeight:   '700',
    color:        '#1A1A1A',
    marginBottom: rs(2),
  },
  nameDisabled: { color: '#AAAAAA' },
  price: {
    fontSize:     nz(12),
    fontWeight:   '600',
    color:        '#333333',
    marginBottom: rs(4),
  },
  priceDisabled: { color: '#BBBBBB' },
  statusRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           rs(4),
    marginBottom:  rs(4),
  },
  statusDot: {
    width:        rs(6),
    height:       rs(6),
    borderRadius: rs(3),
  },
  statusText: {
    fontSize:   nz(11),
    fontWeight: '600',
  },
  detailChip: {
    alignSelf:         'flex-start',
    backgroundColor:   '#EEEEEE',
    borderRadius:      rs(4),
    paddingHorizontal: rs(7),
    paddingVertical:   rs(3),
  },
  detailText: {
    fontSize:   nz(10),
    color:      '#666666',
    fontWeight: '500',
  },
});

// ─── Tab Toggle (Active / Disable) ────────────────────────────────────────────
const TabToggle = React.memo(({ activeTab, onChange }) => {
  const pillX = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(SW - rs(32));
  const pillW = width / 2;

  // Animate pill whenever activeTab changes — covers both tap AND swipe
  useEffect(() => {
    Animated.spring(pillX, {
      toValue:         activeTab * pillW,
      useNativeDriver: true,
      damping:         22,
      stiffness:       220,
      mass:            0.5,
    }).start();
  }, [activeTab, pillW]);

  return (
    <View
      style={tog.wrapper}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View
        pointerEvents="none"
        style={[tog.pill, { width: pillW, transform: [{ translateX: pillX }] }]}
      />
      {TABS.map((t, i) => (
        <HapticTouchable
          key={t}
          onPress={() => onChange(i)}
          style={tog.tab}
          activeOpacity={0.85}
        >
          <Text style={[tog.label, activeTab === i && tog.labelActive]}>
            {t}
          </Text>
        </HapticTouchable>
      ))}
    </View>
  );
});

const tog = StyleSheet.create({
  wrapper: {
    flexDirection:   'row',
    backgroundColor: '#EFEFEF',
    borderRadius:    rs(30),
    marginHorizontal:rs(16),
    padding:         rs(4),
    position:        'relative',
    alignItems:      'center',
  },
  pill: {
    position:        'absolute',
    top:             rs(4),
    bottom:          rs(4),
    left:            rs(4),
    borderRadius:    rs(26),
    backgroundColor: GREEN,
    elevation:       3,
    shadowColor:     GREEN,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.35,
    shadowRadius:    6,
  },
  tab: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: rs(10),
    zIndex:          1,
  },
  label: {
    fontSize:   nz(13),
    fontWeight: '600',
    color:      '#888888',
  },
  labelActive: {
    color:      '#FFFFFF',
    fontWeight: '700',
  },
});

// ─── Bottom Tab Bar ───────────────────────────────────────────────────────────
const BottomBar = React.memo(({ insets }) => (
  <View style={[bb.bar, { paddingBottom: insets.bottom + rs(8) }]}>
    <HapticTouchable style={bb.iconBtn} activeOpacity={0.7}>
      <Ionicons name="home-outline" size={nz(24)} color="#AAAAAA" />
    </HapticTouchable>
    <HapticTouchable style={bb.activeBtn} activeOpacity={0.85}>
      <MaterialIcons name="check-circle-outline" size={nz(20)} color="#FFFFFF" />
      <Text style={bb.activeLabel}>Listing</Text>
    </HapticTouchable>
    <HapticTouchable style={bb.iconBtn} activeOpacity={0.7}>
      <Ionicons name="settings-outline" size={nz(24)} color="#AAAAAA" />
    </HapticTouchable>
  </View>
));

const bb = StyleSheet.create({
  bar: {
    flexDirection:     'row',
    backgroundColor:   '#FFFFFF',
    paddingTop:        rs(12),
    paddingHorizontal: rs(30),
    alignItems:        'center',
    justifyContent:    'space-between',
    borderTopWidth:    rs(1),
    borderTopColor:    '#F0F0F0',
  },
  iconBtn: {
    padding: rs(6),
  },
  activeBtn: {
    flexDirection:     'row',
    backgroundColor:   GREEN,
    borderRadius:      rs(30),
    paddingHorizontal: rs(28),
    paddingVertical:   rs(12),
    alignItems:        'center',
    gap:               rs(8),
    elevation:         4,
    shadowColor:       GREEN,
    shadowOffset:      { width: 0, height: 3 },
    shadowOpacity:     0.4,
    shadowRadius:      8,
  },
  activeLabel: {
    fontSize:   nz(15),
    fontWeight: '700',
    color:      '#FFFFFF',
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function YourListingScreen() {
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab]     = useState(0);
  const [activeCategory, setCategory] = useState('1');
  const [products, setProducts]       = useState(MOCK_ACTIVE);

  // Ref keeps gesture closure always in sync with latest tab — no stale closure
  const activeTabRef = useRef(0);
  const switchTab = useCallback((idx) => {
    activeTabRef.current = idx;
    setActiveTab(idx);
  }, []);

  const list = activeTab === 0 ? products : products.filter((p) => !p.on);

  const handleToggle = useCallback((id) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, on: !p.on, status: p.on ? 'disabled' : 'live' }
          : p
      )
    );
  }, []);

  // ── Swipe gesture to switch Active ↔ Disable tabs ─────────────────────────
  // Uses activeTabRef so the onEnd closure never reads a stale value
  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-18, 18])
    .failOffsetY([-12, 12])
    .runOnJS(true)
    .onEnd((e) => {
      if (Math.abs(e.velocityX) < 200 && Math.abs(e.translationX) < 50) return;
      if (e.translationX < 0 && activeTabRef.current === 0) switchTab(1);
      if (e.translationX > 0 && activeTabRef.current === 1) switchTab(0);
    });

  // Two-column grid render
  const renderItem = useCallback(({ item }) => (
    <ProductCard item={item} onToggle={handleToggle} />
  ), [handleToggle]);

  // Pair items into rows of 2
  const rows = [];
  for (let i = 0; i < list.length; i += 2) {
    rows.push([list[i], list[i + 1] || null]);
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" translucent={false} />
      <View style={[s.root, { paddingTop: insets.top }]}>

        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Your Listing</Text>
          <View style={s.headerIcons}>
            <HapticTouchable style={s.iconBtn} activeOpacity={0.7}>
              <Feather name="search" size={nz(22)} color="#1A1A1A" />
            </HapticTouchable>
            <HapticTouchable style={s.iconBtn} activeOpacity={0.7}>
              <Feather name="filter" size={nz(22)} color="#1A1A1A" />
            </HapticTouchable>
          </View>
        </View>

        {/* ── Tab Toggle ── */}
        <View style={s.tabSection}>
          <TabToggle activeTab={activeTab} onChange={switchTab} />
        </View>

        {/* ── Category Pills ── */}
        <View style={s.categorySection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.categoryScroll}
          >
            {CATEGORIES.map((cat) => (
              <CategoryPill
                key={cat.id}
                item={cat}
                isActive={activeCategory === cat.id}
                onPress={() => setCategory(cat.id)}
              />
            ))}
          </ScrollView>
        </View>

        {/* ── Product Grid (swipeable) ── */}
        <GestureDetector gesture={swipeGesture}>
          <View style={{ flex: 1 }}>
            <FlatList
              data={rows}
              keyExtractor={(_, i) => String(i)}
              renderItem={({ item: row }) => (
                <View style={s.row}>
                  <ProductCard item={row[0]} onToggle={handleToggle} />
                  {row[1] ? (
                    <ProductCard item={row[1]} onToggle={handleToggle} />
                  ) : (
                    <View style={{ width: CARD_W }} />
                  )}
                </View>
              )}
              contentContainerStyle={s.listContent}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={true}
              maxToRenderPerBatch={6}
              windowSize={7}
              ListEmptyComponent={
                <View style={s.empty}>
                  <Feather name="package" size={nz(52)} color="#CCCCCC" />
                  <Text style={s.emptyTitle}>No listings here</Text>
                  <Text style={s.emptySub}>Switch tab or add new items</Text>
                </View>
              }
            />
          </View>
        </GestureDetector>
      </View>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: rs(18),
    paddingTop:        rs(10),
    paddingBottom:     rs(14),
    backgroundColor:   '#FFFFFF',
  },
  headerTitle: {
    fontSize:      nz(28),
    fontWeight:    '800',
    color:         '#1A1A1A',
    letterSpacing: -0.4,
  },
  headerIcons: {
    flexDirection: 'row',
    gap:           rs(4),
  },
  iconBtn: {
    padding: rs(6),
  },
  tabSection: {
    backgroundColor: '#FFFFFF',
    paddingBottom:   rs(14),
  },
  categorySection: {
    backgroundColor: '#FFFFFF',
    paddingBottom:   rs(12),
  },
  categoryScroll: {
    paddingHorizontal: rs(16),
  },
  row: {
    flexDirection:  'row',
    justifyContent: 'space-between',
  },
  listContent: {
    paddingHorizontal: rs(16),
    paddingTop:        rs(6),
    paddingBottom:     rs(20),
    backgroundColor:   '#FFFFFF',
  },
  empty: {
    alignItems:     'center',
    paddingTop:     rs(80),
    gap:            rs(12),
  },
  emptyTitle: {
    fontSize:   nz(17),
    fontWeight: '700',
    color:      '#1A1A1A',
  },
  emptySub: {
    fontSize: nz(13),
    color:    '#AAAAAA',
  },
});