
import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView,
  Animated, Dimensions, PixelRatio, StatusBar,
  Image, ActivityIndicator, TextInput, Keyboard,
} from 'react-native';
import { TabView } from 'react-native-tab-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import HapticTouchable from '../components/GlobalHaptic';
import useStore from '../store/useStore';
import api from '../utils/api';

const { width: SW } = Dimensions.get('window');
const scale = SW / 390;
const nz = (s) => Math.round(PixelRatio.roundToNearestPixel(s * Math.min(scale, 1.35)));
const rs = (s) => Math.round(s * Math.min(scale, 1.3));
const GREEN = '#03954E';
const CREAM = '#FAFAF5';

const ROUTES = [
  { key: 'active',   title: 'Active Listings'  },
  { key: 'disabled', title: 'Disable Listings' },
];

const TAB_BAR_INNER_W = SW - rs(32) - rs(8);
const PILL_W          = TAB_BAR_INNER_W / 2;
const PILL_POSITIONS  = [0, PILL_W];
const CARD_W          = (SW - rs(16) * 2 - rs(12)) / 2;
const SEARCH_H        = rs(48);

const EMOJI_MAP = {
  'pizza': '🍕', 'beverages': '🧋', 'hot beverages': '☕',
  'burgers': '🍔', 'pasta': '🍝', 'desserts': '🍰',
  'snacks': '🍟', 'fries': '🍟', 'popcorn': '🍿',
  'corn': '🌽', 'nachos': '🫔', 'sandwichs': '🥪',
  'sandwiches': '🥪', 'street food': '🌮', 'ice cream': '🍦',
  'north indian': '🍛', 'south indian': '🍜', 'dairy products': '🥛',
  'alcoholic beer': '🍺', 'himachali food': '🏔️',
  'american cuisine': '🌭', 'unknown': '❓',
};
const getEmoji = (name = '') => EMOJI_MAP[name.toLowerCase()] ?? '🍽️';

const menuAPI = {
  getAllMenu:  (Id)   => api.get('/menu/getAllMenu', { params: { Id } }),
  liveStatus: (data) => api.post('/menu/liveStatus', data),
};

const normaliseMenu = (menuCategories = []) => {
  const categories = [{ id: '__all__', label: 'All', emoji: '🍽️', categoryId: null }];
  const products   = [];

  menuCategories.forEach((cat) => {
    if (!cat.foodItems?.length) return;
    categories.push({
      id: cat._id, label: cat.categoryName,
      emoji: getEmoji(cat.categoryName),
      categoryId: cat.categoryId, image: cat.categoryImage,
    });
    cat.foodItems.forEach((item) => {
      const discountedPrice =
        item.isDiscountedByRestraurant && item.discountinPercentageByRestraurant > 0
          ? Math.round(item.price.full * (1 - item.discountinPercentageByRestraurant / 100))
          : null;
      products.push({
        id: item._id, name: item.itemName,
        price: item.price.full, discountedPrice,
        discountPct: item.discountinPercentageByRestraurant,
        image: item.image || null, isVeg: item.isVeg,
        isLive: item.isLive, comboOnly: item.comboOnly,
        categoryName: item.categoryName, categoryId: item.categoryId,
        catRowId: cat._id, on: item.isLive,
        description: item.description, rating: item.rating,
      });
    });
  });
  return { categories, products };
};

const SkeletonBox = ({ style }) => {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1,   duration: 700, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[skl.base, style, { opacity: anim }]} />;
};
const skl = StyleSheet.create({ base: { backgroundColor: '#E8E8E8', borderRadius: rs(8) } });

const SkeletonCard = () => (
  <View style={[{ width: CARD_W }, sk.card]}>
    <SkeletonBox style={sk.image} />
    <SkeletonBox style={sk.name} />
    <SkeletonBox style={sk.price} />
    <SkeletonBox style={sk.btn} />
  </View>
);
const sk = StyleSheet.create({
  card:  { backgroundColor: CREAM, borderRadius: rs(14), padding: rs(10), marginBottom: rs(14), borderWidth: rs(1), borderColor: '#EBEBDF' },
  image: { width: '100%', aspectRatio: 1, borderRadius: rs(10), marginBottom: rs(8) },
  name:  { height: rs(14), width: '80%', marginBottom: rs(8) },
  price: { height: rs(12), width: '50%', marginBottom: rs(12) },
  btn:   { height: rs(36), borderRadius: rs(18) },
});

const CategoryPill = React.memo(({ item, isActive, onPress }) => (
  <HapticTouchable onPress={onPress} activeOpacity={0.78} style={[cp.pill, isActive && cp.pillActive]}>
    <View style={[cp.emojiWrap, isActive && cp.emojiWrapActive]}>
      <Text style={cp.emoji}>{item.emoji}</Text>
    </View>
    <Text style={[cp.label, isActive && cp.labelActive]} numberOfLines={1}>{item.label}</Text>
  </HapticTouchable>
));
const cp = StyleSheet.create({
  pill:            { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: rs(30), paddingRight: rs(14), paddingLeft: rs(4), paddingVertical: rs(4), marginRight: rs(10) },
  pillActive:      { backgroundColor: '#D6EDD6', borderWidth: rs(1.5), borderColor: GREEN },
  emojiWrap:       { width: rs(36), height: rs(36), borderRadius: rs(18), backgroundColor: '#E4E4E4', alignItems: 'center', justifyContent: 'center', marginRight: rs(6) },
  emojiWrapActive: { backgroundColor: '#C5E0C5' },
  emoji:           { fontSize: nz(18) },
  label:           { fontSize: nz(13), fontWeight: '600', color: '#555555', maxWidth: rs(80) },
  labelActive:     { color: GREEN, fontWeight: '700' },
});

const ToggleBtn = React.memo(({ isOn, loading, onToggle }) => {
  const anim = useRef(new Animated.Value(isOn ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: isOn ? 1 : 0, duration: 220, useNativeDriver: false }).start();
  }, [isOn]);
  const bg = anim.interpolate({ inputRange: [0, 1], outputRange: ['#E53935', GREEN] });
  return (
    <HapticTouchable onPress={onToggle} activeOpacity={0.85} disabled={loading}>
      <Animated.View style={[tb2.btn, { backgroundColor: bg, opacity: loading ? 0.6 : 1 }]}>
        {loading
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={tb2.label}>{isOn ? 'On' : 'Off'}</Text>}
      </Animated.View>
    </HapticTouchable>
  );
});
const tb2 = StyleSheet.create({
  btn:   { borderRadius: rs(24), paddingVertical: rs(10), paddingHorizontal: rs(8), alignItems: 'center', justifyContent: 'center', marginTop: rs(10), minHeight: rs(36) },
  label: { fontSize: nz(13), fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 },
});

const VegDot = ({ isVeg }) => (
  <View style={[pd.vegBox, { borderColor: isVeg ? GREEN : '#E53935' }]}>
    <View style={[pd.vegDot, { backgroundColor: isVeg ? GREEN : '#E53935' }]} />
  </View>
);
const pd = StyleSheet.create({
  vegBox: { width: rs(14), height: rs(14), borderRadius: rs(2), borderWidth: rs(1.5), alignItems: 'center', justifyContent: 'center', marginRight: rs(4) },
  vegDot: { width: rs(7), height: rs(7), borderRadius: rs(4) },
});

const ProductCard = React.memo(({ item, restaurantId, onToggle, onToast }) => {
  const [toggling, setToggling] = useState(false);

  const handleToggle = useCallback(async () => {
    setToggling(true);
    try {
      await menuAPI.liveStatus({ Id: restaurantId, menuItemId: item.id, isLive: !item.on });
      onToggle(item.id);
      onToast(!item.on
        ? `✅ "${item.name}" is now Live`
        : `🔴 "${item.name}" turned Off`
      );
    } catch {
      onToast('❌ Failed to update. Try again.');
    } finally {
      setToggling(false);
    }
  }, [item.id, item.on, item.name, restaurantId, onToggle, onToast]);

  const isDisabled = !item.on;
  return (
    <View style={[pc.wrap, isDisabled && pc.wrapDisabled]}>
      <View style={pc.imageWrap}>
        {item.image
          ? <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <View style={pc.imageFallback}><Text style={pc.fallbackEmoji}>🍽️</Text></View>}
        {item.discountedPrice ? (
          <View style={pc.discountBadge}><Text style={pc.discountTxt}>{item.discountPct}% OFF</Text></View>
        ) : null}
        {item.comboOnly ? (
          <View style={pc.comboBadge}><Text style={pc.comboTxt}>Combo</Text></View>
        ) : null}
      </View>

      <View style={pc.nameRow}>
        <VegDot isVeg={item.isVeg} />
        <Text style={[pc.name, isDisabled && pc.nameDisabled]} numberOfLines={1}>{item.name}</Text>
      </View>

      <View style={pc.priceRow}>
        {item.discountedPrice ? (
          <>
            <Text style={pc.priceFull}>₹{item.price}</Text>
            <Text style={pc.priceDiscounted}>₹{item.discountedPrice}</Text>
          </>
        ) : (
          <Text style={[pc.price, isDisabled && pc.priceDisabled]}>₹{item.price}</Text>
        )}
      </View>

      <View style={pc.statusRow}>
        <View style={[pc.statusDot, { backgroundColor: item.on ? GREEN : '#E53935' }]} />
        <Text style={[pc.statusText, { color: item.on ? GREEN : '#E53935' }]}>
          {item.on ? 'Live' : 'Disabled'}
        </Text>
      </View>

      <ToggleBtn isOn={item.on} loading={toggling} onToggle={handleToggle} />
    </View>
  );
}, (prev, next) =>
  prev.item.id   === next.item.id   &&
  prev.item.on   === next.item.on   &&
  prev.onToast   === next.onToast   &&
  prev.restaurantId === next.restaurantId
);

const pc = StyleSheet.create({
  wrap:            { width: CARD_W, backgroundColor: CREAM, borderRadius: rs(14), padding: rs(10), marginBottom: rs(14), borderWidth: rs(1), borderColor: '#EBEBDF' },
  wrapDisabled:    { opacity: 0.75 },
  imageWrap:       { width: '100%', aspectRatio: 1, borderRadius: rs(10), backgroundColor: '#EEEEEE', marginBottom: rs(8), overflow: 'hidden' },
  imageFallback:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fallbackEmoji:   { fontSize: nz(34) },
  discountBadge:   { position: 'absolute', top: rs(5), right: rs(5), backgroundColor: '#E53935', borderRadius: rs(6), paddingHorizontal: rs(5), paddingVertical: rs(2) },
  discountTxt:     { fontSize: nz(9), fontWeight: '800', color: '#fff' },
  comboBadge:      { position: 'absolute', bottom: rs(5), left: rs(5), backgroundColor: '#1A1A1A', borderRadius: rs(6), paddingHorizontal: rs(6), paddingVertical: rs(2) },
  comboTxt:        { fontSize: nz(9), fontWeight: '700', color: '#fff' },
  nameRow:         { flexDirection: 'row', alignItems: 'center', marginBottom: rs(3) },
  name:            { flex: 1, fontSize: nz(12), fontWeight: '700', color: '#1A1A1A' },
  nameDisabled:    { color: '#AAAAAA' },
  priceRow:        { flexDirection: 'row', alignItems: 'center', gap: rs(4), marginBottom: rs(4) },
  price:           { fontSize: nz(12), fontWeight: '600', color: '#333' },
  priceFull:       { fontSize: nz(11), color: '#AAAAAA', textDecorationLine: 'line-through' },
  priceDiscounted: { fontSize: nz(12), fontWeight: '700', color: GREEN },
  priceDisabled:   { color: '#BBBBBB' },
  statusRow:       { flexDirection: 'row', alignItems: 'center', gap: rs(4) },
  statusDot:       { width: rs(6), height: rs(6), borderRadius: rs(3) },
  statusText:      { fontSize: nz(11), fontWeight: '600' },
});

const CustomTabBar = React.memo(({ position, jumpTo }) => {
  const pillX = position.interpolate({ inputRange: [0, 1], outputRange: PILL_POSITIONS, extrapolate: 'clamp' });
  const opacities = ROUTES.map((_, i) =>
    position.interpolate({ inputRange: [i - 1, i, i + 1], outputRange: [0, 1, 0], extrapolate: 'clamp' })
  );
  return (
    <View style={tog.wrapper}>
      <Animated.View pointerEvents="none" style={[tog.pill, { width: PILL_W, transform: [{ translateX: pillX }] }]} />
      {ROUTES.map((route, i) => {
        const activeOp   = opacities[i];
        const inactiveOp = activeOp.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
        return (
          <HapticTouchable key={route.key} onPress={() => jumpTo(route.key)} style={tog.tab} activeOpacity={1}>
            <Animated.View style={tog.inner}>
              <Animated.Text style={[tog.label, tog.labelInactive, { opacity: inactiveOp }]}>{route.title}</Animated.Text>
              <Animated.Text style={[tog.label, tog.labelActive, tog.labelAbsolute, { opacity: activeOp }]}>{route.title}</Animated.Text>
            </Animated.View>
          </HapticTouchable>
        );
      })}
    </View>
  );
});
const tog = StyleSheet.create({
  wrapper:       { flexDirection: 'row', backgroundColor: '#EFEFEF', borderRadius: rs(30), marginHorizontal: rs(16), padding: rs(4), position: 'relative', alignItems: 'center' },
  pill:          { position: 'absolute', top: rs(4), bottom: rs(4), left: rs(4), borderRadius: rs(26), backgroundColor: GREEN, elevation: 3, shadowColor: GREEN, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 6 },
  tab:           { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: rs(10), zIndex: 1 },
  inner:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  label:         { fontSize: nz(13), fontWeight: '700' },
  labelInactive: { color: '#888888' },
  labelActive:   { color: '#FFFFFF' },
  labelAbsolute: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, textAlign: 'center' },
});

const TabScene = React.memo(({ list, loading, restaurantId, onToggle, onToast }) => {
  if (loading) {
    return (
      <FlatList
        data={[1, 2, 3]}
        keyExtractor={(i) => String(i)}
        renderItem={() => (
          <View style={s.row}><SkeletonCard /><SkeletonCard /></View>
        )}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      />
    );
  }

  const rows = [];
  for (let i = 0; i < list.length; i += 2) rows.push([list[i], list[i + 1] || null]);

  return (
    <FlatList
      data={rows}
      keyExtractor={(_, i) => String(i)}
      renderItem={({ item: row }) => (
        <View style={s.row}>
          <ProductCard item={row[0]} restaurantId={restaurantId} onToggle={onToggle} onToast={onToast} />
          {row[1]
            ? <ProductCard item={row[1]} restaurantId={restaurantId} onToggle={onToggle} onToast={onToast} />
            : <View style={{ width: CARD_W }} />}
        </View>
      )}
      contentContainerStyle={s.listContent}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
      initialNumToRender={8}
      maxToRenderPerBatch={6}
      windowSize={7}
      updateCellsBatchingPeriod={50}
      ListEmptyComponent={
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>📭</Text>
          <Text style={s.emptyTitle}>No items here</Text>
          <Text style={s.emptySub}>Try a different category or search</Text>
        </View>
      }
    />
  );
});

export default function YourListingScreen() {
  const insets       = useSafeAreaInsets();
  const { user }     = useStore();
  const restaurantId = user?.restaurantId ?? '';
  const searchRef    = useRef(null);

  const [tabIndex,       setTabIndex]   = useState(0);
  const [activeCatId,    setActiveCatId]= useState('__all__');
  const [categories,     setCategories] = useState([{ id: '__all__', label: 'All', emoji: '🍽️' }]);
  const [products,       setProducts]   = useState([]);
  const [loading,        setLoading]    = useState(true);
  const [error,          setError]      = useState(null);

  const [searchOpen,  setSearchOpen]  = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchAnim = useRef(new Animated.Value(0)).current; 
  const [toastMsg,    setToastMsg]   = useState('');
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastScale   = useRef(new Animated.Value(0.88)).current;
  const toastTimer   = useRef(null);

  const showToast = useCallback((text) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(text);
    toastOpacity.setValue(0);
    toastScale.setValue(0.88);
    Animated.parallel([
      Animated.spring(toastOpacity, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 220, mass: 0.4 }),
      Animated.spring(toastScale,   { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 220, mass: 0.4 }),
    ]).start();
    toastTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastOpacity, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(toastScale,   { toValue: 0.88, duration: 280, useNativeDriver: true }),
      ]).start(() => setToastMsg(''));
    }, 2200);
  }, []);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    Animated.spring(searchAnim, { toValue: 1, useNativeDriver: false, damping: 18, stiffness: 220, mass: 0.5 }).start(() => {
      searchRef.current?.focus();
    });
  }, []);

  const closeSearch = useCallback(() => {
    Keyboard.dismiss();
    setSearchQuery('');
    Animated.spring(searchAnim, { toValue: 0, useNativeDriver: false, damping: 18, stiffness: 220, mass: 0.5 }).start(() => {
      setSearchOpen(false);
    });
  }, []);

  const searchBarH = searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, SEARCH_H + rs(10)] });
  const searchOpacity = searchAnim;

  const fetchMenu = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const res  = await menuAPI.getAllMenu(restaurantId);
      const menu = res?.data?.data?.menu ?? [];
      const { categories: cats, products: prods } = normaliseMenu(menu);
      setCategories(cats);
      setProducts(prods);
    } catch {
      setError('Failed to load menu. Tap to retry.');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  const handleToggle = useCallback((id) => {
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, on: !p.on, isLive: !p.on } : p));
  }, []);

  const q = searchQuery.trim().toLowerCase();

  const filteredProducts = products
    .filter((p) => activeCatId === '__all__' || p.catRowId === activeCatId)
    .filter((p) => !q || p.name.toLowerCase().includes(q));

  const activeLists = {
    active:   filteredProducts.filter((p) =>  p.on),
    disabled: filteredProducts.filter((p) => !p.on),
  };

  const renderScene = useCallback(({ route }) => (
    <TabScene
      list={activeLists[route.key]}
      loading={loading}
      restaurantId={restaurantId}
      onToggle={handleToggle}
      onToast={showToast}
    />
  ), [products, loading, activeCatId, searchQuery, restaurantId, handleToggle, showToast]);

  const renderTabBar = useCallback((props) => (
    <View style={s.tabSection}><CustomTabBar {...props} /></View>
  ), []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" translucent={false} />
      <View style={[s.root, { paddingTop: insets.top }]}>

        <View style={s.header}>
          <Animated.View style={[s.headerLeft, { flex: searchOpen ? 1 : 0 }]}>
            {searchOpen ? null : <Text style={s.headerTitle}>Your Listing</Text>}
          </Animated.View>

          <View style={s.headerIcons}>
            <HapticTouchable
              style={s.iconBtn}
              activeOpacity={0.7}
              onPress={searchOpen ? closeSearch : openSearch}
            >
              <Feather name={searchOpen ? 'x' : 'search'} size={nz(22)} color="#1A1A1A" />
            </HapticTouchable>

            {!searchOpen && (
              <HapticTouchable style={s.iconBtn} activeOpacity={0.7} onPress={fetchMenu}>
                <Feather name="refresh-cw" size={nz(20)} color="#1A1A1A" />
              </HapticTouchable>
            )}
          </View>
        </View>

        <Animated.View style={[s.searchWrap, { height: searchBarH, opacity: searchOpacity }]}>
          <View style={s.searchBox}>
            <Feather name="search" size={nz(16)} color="#AAAAAA" style={s.searchIcon} />
            <TextInput
              ref={searchRef}
              style={s.searchInput}
              placeholder="Search food items..."
              placeholderTextColor="#BBBBBB"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              onSubmitEditing={Keyboard.dismiss}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <HapticTouchable onPress={() => setSearchQuery('')} style={s.searchClear}>
                <Feather name="x-circle" size={nz(16)} color="#BBBBBB" />
              </HapticTouchable>
            )}
          </View>
        </Animated.View>
        {error && (
          <HapticTouchable onPress={fetchMenu} style={s.errorBanner} activeOpacity={0.8}>
            <Feather name="alert-circle" size={nz(14)} color="#E53935" />
            <Text style={s.errorText}>{error}</Text>
          </HapticTouchable>
        )}

        <View style={s.categorySection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryScroll}>
            {categories.map((cat) => (
              <CategoryPill
                key={cat.id} item={cat}
                isActive={activeCatId === cat.id}
                onPress={() => setActiveCatId(cat.id)}
              />
            ))}
          </ScrollView>
        </View>

        <TabView
          navigationState={{ index: tabIndex, routes: ROUTES }}
          renderScene={renderScene}
          renderTabBar={renderTabBar}
          onIndexChange={setTabIndex}
          initialLayout={{ width: SW }}
          lazy
          lazyPreloadDistance={0}
          style={{ flex: 1 }}
        />

        {toastMsg !== '' && (
          <Animated.View
            pointerEvents="none"
            style={[s.toast, { opacity: toastOpacity, transform: [{ scale: toastScale }] }]}
          >
            <Text style={s.toastText}>{toastMsg}</Text>
          </Animated.View>
        )}

      </View>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: '#FFFFFF' },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: rs(18), paddingTop: rs(10), paddingBottom: rs(10), backgroundColor: '#FFFFFF' },
  headerLeft:      { justifyContent: 'center' },
  headerTitle:     { fontSize: nz(26), fontWeight: '800', color: '#1A1A1A', letterSpacing: -0.4 },
  headerIcons:     { flexDirection: 'row', gap: rs(4), alignItems: 'center' },
  iconBtn:         { padding: rs(6) },
  searchWrap:      { overflow: 'hidden', paddingHorizontal: rs(16) },
  searchBox:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F4F4', borderRadius: rs(14), paddingHorizontal: rs(12), height: SEARCH_H, borderWidth: rs(1), borderColor: '#EBEBEB' },
  searchIcon:      { marginRight: rs(8) },
  searchInput:     { flex: 1, fontSize: nz(14), color: '#1A1A1A', paddingVertical: 0 },
  searchClear:     { paddingLeft: rs(8) },
  errorBanner:     { flexDirection: 'row', alignItems: 'center', gap: rs(6), marginHorizontal: rs(16), marginTop: rs(6), marginBottom: rs(4), backgroundColor: '#FFF3F3', borderRadius: rs(10), paddingHorizontal: rs(12), paddingVertical: rs(10), borderWidth: 1, borderColor: '#FFCDD2' },
  errorText:       { flex: 1, fontSize: nz(12), color: '#C62828', fontWeight: '500' },
  tabSection:      { backgroundColor: '#FFFFFF', paddingBottom: rs(14), paddingTop: rs(4) },
  categorySection: { backgroundColor: '#FFFFFF', paddingBottom: rs(12), paddingTop: rs(8) },
  categoryScroll:  { paddingHorizontal: rs(16) },
  row:             { flexDirection: 'row', justifyContent: 'space-between' },
  listContent:     { paddingHorizontal: rs(16), paddingTop: rs(6), paddingBottom: rs(20), backgroundColor: '#FFFFFF' },
  empty:           { alignItems: 'center', paddingTop: rs(80), gap: rs(8) },
  emptyEmoji:      { fontSize: nz(52) },
  emptyTitle:      { fontSize: nz(17), fontWeight: '700', color: '#1A1A1A' },
  emptySub:        { fontSize: nz(13), color: '#AAAAAA' },
  toast: {
    position:          'absolute',
    bottom:            rs(36),
    left:              rs(28),
    right:             rs(28),
    backgroundColor:   'rgba(15,15,15,0.92)',
    borderRadius:      rs(16),
    paddingHorizontal: rs(20),
    paddingVertical:   rs(14),
    alignItems:        'center',
    zIndex:            9999,
    elevation:         25,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 6 },
    shadowOpacity:     0.32,
    shadowRadius:      12,
  },
  toastText: { fontSize: nz(14), fontWeight: '700', color: '#FFFFFF', textAlign: 'center', lineHeight: nz(20) },
});