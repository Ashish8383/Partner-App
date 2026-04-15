/**
 * YourListingScreen.jsx
 *
 * Responsive grid layout:
 * - Mobile portrait: 2 columns
 * - Mobile landscape: 3 columns
 * - Tablet portrait: 3 columns
 * - Tablet landscape: 4 columns
 */

import React, {
  useRef, useState, useCallback, useEffect, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView, Modal,
  Animated, StatusBar,
  Image, ActivityIndicator, TextInput, Keyboard,
  Dimensions, RefreshControl,
} from 'react-native';
import { TabView }            from 'react-native-tab-view';
import { useSafeAreaInsets }  from 'react-native-safe-area-context';
import { Feather }            from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import LottieView             from 'lottie-react-native';
import HapticTouchable        from '../components/GlobalHaptic';
import useStore               from '../store/useStore';
import api                    from '../utils/api';
import { useResponsive }      from '../utils/useResponsive';

const GREEN = '#03954E';
const CREAM = '#FAFAF5';

// ─── Fixed pill bar height — never grows on tablets ───────────────────────────
// Pill content is 36px emoji wrap + 8px vertical padding = 44px.
// Container adds 8px top + 8px bottom = 60px total. We hard-cap at 64.
const PILL_ROW_H   = 58;   // px — the ScrollView row exact height
const EMOJI_SZ     = 34;   // dp — emoji circle diameter, uncapped by rs()
const PILL_FONT    = 12.5; // dp — pill label font size, uncapped

const ROUTES = [
  { key: 'active',   title: 'Active Listings'  },
  { key: 'disabled', title: 'Disable Listings' },
];
const COMBO_CAT_ID = '__combo__';

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

// ─── APIs ─────────────────────────────────────────────────────────────────────
const menuAPI = {
  getAllMenu:   (Id)   => api.get('/menu/getAllMenu', { params: { Id } }),
  liveStatus:  (data) => api.post('/menu/liveStatus', data),
  getAllCombo:  (Id)   => api.get('/menu/GetAllCombo', { params: { page: 1, limit: 100, filter: '{}', Id } }),
  comboToggle: (data) => api.post('/menu/ComboOff', data),
};

// ─── Normalise ────────────────────────────────────────────────────────────────
const normaliseMenu = (menuCategories = []) => {
  const categories = [
    { id: '__all__',    label: 'All',   emoji: '🍽️' },
    { id: COMBO_CAT_ID, label: 'Combo', emoji: '🍱' },
  ];
  const products = [];
  menuCategories.forEach((cat) => {
    if (!cat.foodItems?.length) return;
    categories.push({ id: cat._id, label: cat.categoryName, emoji: getEmoji(cat.categoryName), categoryId: cat.categoryId, image: cat.categoryImage });
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
        isCombo: false,
      });
    });
  });
  return { categories, products };
};

const normaliseCombo = (raw = []) =>
  raw.map((c) => {
    const discountPct = c.discountinPercentageByRestraurant ?? 0;
    const discountedPrice =
      c.isDiscountedByRestraurant && discountPct > 0
        ? Math.round((c.comboprice ?? 0) * (1 - discountPct / 100))
        : null;
    return {
      id: c._id, mongoId: c._id, restaurantId: c.Id,
      name: (c.combofoodName ?? '').trim(),
      price: c.comboprice, discountedPrice, discountPct,
      image: c.image || null, isVeg: c.isVeg,
      on: c.isLive, isLive: c.isLive,
      comboOnly: false, isCombo: true,
      comboItems: c.ComboItems ?? [],
      catRowId: COMBO_CAT_ID,
    };
  });

// ─── Skeleton pulse ───────────────────────────────────────────────────────────
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
  return <Animated.View style={[{ backgroundColor: '#E8E8E8', borderRadius: 8 }, style, { opacity: anim }]} />;
};

// 3:4 portrait aspect ratio for product images (width × 4/3).
// Capped at 180 for landscape to keep cards compact
const IMAGE_RATIO = 4 / 3;
const IMAGE_MAX_H = {
  portrait: 180,
  landscape: 160,
};

const SkeletonCard = ({ cardW, rs, imageMaxH }) => (
  <View style={{
    width: cardW, backgroundColor: CREAM, borderRadius: rs(12),
    padding: rs(10), marginBottom: rs(12), borderWidth: 1, borderColor: '#EBEBDF',
  }}>
    <SkeletonBox style={{ width: '100%', height: Math.min((cardW - rs(20)) * IMAGE_RATIO, imageMaxH), borderRadius: rs(8), marginBottom: rs(8) }} />
    <SkeletonBox style={{ height: 13, width: '80%', marginBottom: rs(7), borderRadius: 4 }} />
    <SkeletonBox style={{ height: 11, width: '50%', marginBottom: rs(10), borderRadius: 4 }} />
    <SkeletonBox style={{ height: 34, borderRadius: 17 }} />
  </View>
);

// ─── Category Pill ────────────────────────────────────────────────────────────
const CategoryPill = React.memo(({ item, isActive, onPress }) => (
  <HapticTouchable
    onPress={onPress}
    activeOpacity={0.78}
    style={[cpS.pill, isActive && cpS.pillActive]}
  >
    <View style={[cpS.emojiWrap, isActive && cpS.emojiWrapActive]}>
      <Text style={cpS.emoji}>{item.emoji}</Text>
    </View>
    <Text style={[cpS.label, isActive && cpS.labelActive]} numberOfLines={1}>
      {item.label}
    </Text>
  </HapticTouchable>
));

const cpS = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F0F0F0', borderRadius: 30,
    paddingLeft: 4, paddingRight: 14, paddingVertical: 4,
    marginRight: 10,
  },
  pillActive: { backgroundColor: '#D6EDD6', borderWidth: 1.5, borderColor: GREEN },
  emojiWrap: {
    width: EMOJI_SZ, height: EMOJI_SZ, borderRadius: EMOJI_SZ / 2,
    backgroundColor: '#E4E4E4',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 6,
  },
  emojiWrapActive: { backgroundColor: '#C5E0C5' },
  emoji: { fontSize: 17 },
  label: { fontSize: PILL_FONT, fontWeight: '600', color: '#555555', maxWidth: 80 },
  labelActive: { color: GREEN, fontWeight: '700' },
});

// ─── Toggle Switch ────────────────────────────────────────────────────────────
const TOGGLE_TRACK_W = 54;
const TOGGLE_TRACK_H = 30;
const TOGGLE_THUMB   = 24;

const ToggleBtn = React.memo(({ isOn, loading, onToggle, rs, nz }) => {
  const THUMB_OFF = 3;
  const THUMB_ON  = TOGGLE_TRACK_W - TOGGLE_THUMB - 3;

  const anim = useRef(new Animated.Value(isOn ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: isOn ? 1 : 0, useNativeDriver: false, damping: 14, stiffness: 280, mass: 0.6 }).start();
  }, [isOn]);

  const trackBg = anim.interpolate({ inputRange: [0, 1], outputRange: ['#C8C8CA', GREEN] });
  const thumbX  = anim.interpolate({ inputRange: [0, 1], outputRange: [THUMB_OFF, THUMB_ON] });
  const thumbSX = anim.interpolate({ inputRange: [0, 0.3, 0.7, 1], outputRange: [1, 1.15, 1.15, 1] });
  const thumbSY = anim.interpolate({ inputRange: [0, 0.3, 0.7, 1], outputRange: [1, 0.85, 0.85, 1] });

  return (
    <HapticTouchable
      onPress={onToggle} activeOpacity={0.9} disabled={loading}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: rs(8), gap: 8 }}
    >
      <Text style={{ fontSize: nz(11), fontWeight: '700', color: '#E53935', width: 26, textAlign: 'center', opacity: isOn ? 0.3 : 1 }}>Off</Text>
      <Animated.View style={{
        width: TOGGLE_TRACK_W, height: TOGGLE_TRACK_H,
        borderRadius: TOGGLE_TRACK_H / 2,
        backgroundColor: trackBg,
        justifyContent: 'center', overflow: 'hidden',
        opacity: loading ? 0.55 : 1,
      }}>
        {loading
          ? <ActivityIndicator size="small" color="#fff" style={{ position: 'absolute', alignSelf: 'center' }} />
          : <Animated.View style={{
              position: 'absolute',
              width: TOGGLE_THUMB, height: TOGGLE_THUMB,
              borderRadius: TOGGLE_THUMB / 2,
              backgroundColor: '#FFFFFF', left: 0,
              elevation: 6,
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.22, shadowRadius: 4,
              transform: [{ translateX: thumbX }, { scaleX: thumbSX }, { scaleY: thumbSY }],
            }}
          />}
      </Animated.View>
      <Text style={{ fontSize: nz(11), fontWeight: '700', color: GREEN, width: 26, textAlign: 'center', opacity: !isOn ? 0.3 : 1 }}>Live</Text>
    </HapticTouchable>
  );
});

// ─── Veg Dot ──────────────────────────────────────────────────────────────────
const VegDot = ({ isVeg }) => (
  <View style={{
    width: 13, height: 13, borderRadius: 2,
    borderWidth: 1.5, borderColor: isVeg ? GREEN : '#E53935',
    alignItems: 'center', justifyContent: 'center', marginRight: 4,
  }}>
    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isVeg ? GREEN : '#E53935' }} />
  </View>
);

// ─── Combo Bottom-Sheet ───────────────────────────────────────────────────────
const ComboItemsModal = React.memo(({ visible, combo, onClose, bottomInset, SW, rs, nz }) => {
  const slideY    = useRef(new Animated.Value(400)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY,    { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 260, mass: 0.5 }),
        Animated.timing(bgOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY,    { toValue: 400, duration: 240, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 0,   duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!combo) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 10, opacity: bgOpacity }]}>
        <HapticTouchable style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>
      <Animated.View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#fff',
        borderTopLeftRadius: rs(22), borderTopRightRadius: rs(22),
        zIndex: 20, maxHeight: '78%',
        transform: [{ translateY: slideY }],
      }}>
        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDDDDD', alignSelf: 'center', marginTop: rs(12), marginBottom: rs(4) }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: rs(20), paddingVertical: rs(12) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs(10), flex: 1 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: GREEN }} />
            <View>
              <Text style={{ fontSize: nz(15), fontWeight: '800', color: '#1A1A1A', maxWidth: SW * 0.55 }} numberOfLines={1}>{combo.name}</Text>
              <Text style={{ fontSize: nz(11), color: '#888', marginTop: 2, fontWeight: '500' }}>{combo.comboItems?.length ?? 0} items · ₹{combo.price}</Text>
            </View>
          </View>
          <HapticTouchable onPress={onClose} activeOpacity={0.7}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F3F3', alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="x" size={nz(18)} color="#666" />
          </HapticTouchable>
        </View>
        <View style={{ height: 1, backgroundColor: '#F0F0F0', marginHorizontal: rs(20) }} />
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: rs(20), paddingTop: rs(8), paddingBottom: rs(4) }} showsVerticalScrollIndicator={false} bounces={false}>
          {(combo.comboItems ?? []).map((ci, i) => (
            <View key={i} style={[
              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: rs(12) },
              i < (combo.comboItems.length - 1) && { borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
            ]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs(10), flex: 1 }}>
                <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: '#EAF5EE', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: nz(11), fontWeight: '800', color: GREEN }}>{ci.quantity}×</Text>
                </View>
                <View>
                  <Text style={{ fontSize: nz(13), fontWeight: '600', color: '#1A1A1A', maxWidth: SW * 0.5 }}>{ci.foodName}</Text>
                  <Text style={{ fontSize: nz(11), color: '#AAAAAA', marginTop: 2 }}>{ci.categoryName}</Text>
                </View>
              </View>
              <Text style={{ fontSize: nz(13), fontWeight: '700', color: '#333' }}>₹{ci.price * ci.quantity}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          marginHorizontal: rs(20), marginTop: rs(12),
          marginBottom: rs(12) + (bottomInset ?? 0),
          backgroundColor: '#F5FAF5', borderRadius: rs(14),
          paddingHorizontal: rs(16), paddingVertical: rs(14),
          borderWidth: 1, borderColor: '#D4EBDA',
        }}>
          <View>
            <Text style={{ fontSize: nz(13), fontWeight: '700', color: '#555' }}>Combo Price</Text>
            {combo.discountedPrice
              ? <View style={{ backgroundColor: '#E53935', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 3 }}>
                  <Text style={{ fontSize: nz(9), fontWeight: '800', color: '#fff', letterSpacing: 0.3 }}>{combo.discountPct}% OFF</Text>
                </View>
              : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            {combo.discountedPrice
              ? <>
                  <Text style={{ fontSize: nz(12), color: '#BBBBBB', textDecorationLine: 'line-through' }}>₹{combo.price}</Text>
                  <Text style={{ fontSize: nz(18), fontWeight: '900', color: GREEN }}>₹{combo.discountedPrice}</Text>
                </>
              : <Text style={{ fontSize: nz(18), fontWeight: '900', color: GREEN }}>₹{combo.price}</Text>}
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
});

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = React.memo(({ tabKey, rs, nz }) => {
  if (tabKey === 'disabled') {
    return (
      <View style={{ alignItems: 'center', paddingTop: rs(40) }}>
        <LottieView source={require('../../assets/disabled.json')} autoPlay loop style={{ width: rs(200), height: rs(200) }} />
        <Text style={{ fontSize: nz(17), fontWeight: '700', color: '#1A1A1A', marginTop: rs(8) }}>No disabled items</Text>
        <Text style={{ fontSize: nz(13), color: '#AAAAAA', marginTop: rs(4) }}>All your items are currently live</Text>
      </View>
    );
  }
  return (
    <View style={{ alignItems: 'center', paddingTop: rs(60), gap: rs(8) }}>
      <Text style={{ fontSize: 48 }}>📭</Text>
      <Text style={{ fontSize: nz(17), fontWeight: '700', color: '#1A1A1A' }}>No items here</Text>
      <Text style={{ fontSize: nz(13), color: '#AAAAAA' }}>Try a different category or search</Text>
    </View>
  );
});

// ─── Product Card ─────────────────────────────────────────────────────────────
const ProductCard = React.memo(({
  item, restaurantId, onToggle, onToast,
  bottomInset, tabKey, cardW, rs, nz, SW, isLandscape,
}) => {
  const [toggling,  setToggling]  = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleToggle = useCallback(async () => {
    setToggling(true);
    try {
      if (item.isCombo) {
        await menuAPI.comboToggle({ _id: item.mongoId, Id: item.restaurantId, isLive: !item.on });
      } else {
        await menuAPI.liveStatus({ Id: restaurantId, menuItemId: item.id, isLive: !item.on });
      }
      onToggle(item.id, item.isCombo);
      onToast(!item.on ? `✅ "${item.name}" is now Live` : `🔴 "${item.name}" turned Off`);
    } catch {
      onToast('❌ Failed to update. Try again.');
    } finally {
      setToggling(false);
    }
  }, [item, restaurantId, onToggle, onToast]);

  const isDisabled = !item.on;
  const imageMaxH = isLandscape ? IMAGE_MAX_H.landscape : IMAGE_MAX_H.portrait;
  const imgH = Math.min((cardW - rs(20)) * IMAGE_RATIO, imageMaxH);

  return (
    <>
      <View style={[
        pcS.wrap,
        { width: cardW, borderRadius: rs(12), padding: rs(9), marginBottom: rs(12) },
        isDisabled && pcS.wrapDisabled,
      ]}>
        <View style={[pcS.imageWrap, { height: imgH, borderRadius: rs(9), marginBottom: rs(8) }]}>
          {item.image
            ? <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : <View style={pcS.imageFallback}>
                <Text style={{ fontSize: Math.min(nz(30), 36) }}>{item.isCombo ? '🍱' : '🍽️'}</Text>
              </View>}

          {item.discountedPrice
            ? <View style={pcS.discountBadge}>
                <Text style={{ fontSize: nz(8), fontWeight: '800', color: '#fff' }}>{item.discountPct}% OFF</Text>
              </View>
            : null}
          {item.isCombo
            ? <View style={pcS.comboBadge}>
                <Text style={{ fontSize: nz(8), fontWeight: '700', color: '#fff' }}>Combo</Text>
              </View>
            : null}
        </View>

        <View style={[pcS.nameRow, { marginBottom: 3 }]}>
          <VegDot isVeg={item.isVeg} />
          <Text
            style={[{ fontSize: nz(11.5), fontWeight: '700', color: '#1A1A1A', textAlign: 'center', flex: 1 }, isDisabled && pcS.nameDisabled]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
        </View>

        <View style={[pcS.priceRow, { gap: 4, marginBottom: rs(6) }]}>
          {item.discountedPrice
            ? <>
                <Text style={{ fontSize: nz(10), color: '#AAAAAA', textDecorationLine: 'line-through' }}>₹{item.price}</Text>
                <Text style={{ fontSize: nz(11.5), fontWeight: '700', color: GREEN }}>₹{item.discountedPrice}</Text>
              </>
            : <Text style={[{ fontSize: nz(11.5), fontWeight: '600', color: '#333' }, isDisabled && { color: '#BBBBBB' }]}>₹{item.price}</Text>}
        </View>

        {item.isCombo && item.comboItems?.length > 0 && (
          <HapticTouchable
            onPress={() => setShowModal(true)} activeOpacity={0.75}
            style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: '#EAF5EE', borderRadius: rs(7),
              paddingHorizontal: rs(7), paddingVertical: 4,
              marginBottom: rs(6), alignSelf: 'center',
              borderWidth: 1, borderColor: '#C5E0C5',
            }}
          >
            <Feather name="list" size={nz(11)} color={GREEN} style={{ marginRight: 3 }} />
            <Text style={{ fontSize: nz(10.5), fontWeight: '700', color: GREEN }}>Items ({item.comboItems.length})</Text>
          </HapticTouchable>
        )}

        <ToggleBtn isOn={item.on} loading={toggling} onToggle={handleToggle} rs={rs} nz={nz} />
      </View>

      {item.isCombo && (
        <ComboItemsModal
          visible={showModal}
          combo={item}
          onClose={() => setShowModal(false)}
          bottomInset={bottomInset}
          SW={SW} rs={rs} nz={nz}
        />
      )}
    </>
  );
}, (prev, next) =>
  prev.item.id      === next.item.id      &&
  prev.item.on      === next.item.on      &&
  prev.onToast      === next.onToast      &&
  prev.cardW        === next.cardW        &&
  prev.bottomInset  === next.bottomInset  &&
  prev.tabKey       === next.tabKey       &&
  prev.restaurantId === next.restaurantId &&
  prev.isLandscape  === next.isLandscape
);

const pcS = StyleSheet.create({
  wrap:         { backgroundColor: CREAM, borderWidth: 1, borderColor: '#EBEBDF' },
  wrapDisabled: { opacity: 0.72 },
  imageWrap:    { width: '100%', backgroundColor: '#EEEEEE', overflow: 'hidden' },
  imageFallback:{ flex: 1, alignItems: 'center', justifyContent: 'center' },
  discountBadge:{ position: 'absolute', top: 5, right: 5, backgroundColor: '#E53935', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  comboBadge:   { position: 'absolute', bottom: 5, left: 5, backgroundColor: '#1A1A1A', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  nameRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  nameDisabled: { color: '#AAAAAA' },
  priceRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});

// ─── Custom Tab Bar ───────────────────────────────────────────────────────────
const CustomTabBar = React.memo(({ position, jumpTo, tabBarW, rs, nz }) => {
  const PILL_W = tabBarW / 2;
  const pillX  = position.interpolate({ inputRange: [0, 1], outputRange: [0, PILL_W], extrapolate: 'clamp' });
  const ops    = ROUTES.map((_, i) =>
    position.interpolate({ inputRange: [i - 1, i, i + 1], outputRange: [0, 1, 0], extrapolate: 'clamp' })
  );
  return (
    <View style={[tabS.wrapper, { borderRadius: rs(28), marginHorizontal: rs(16), padding: rs(4) }]}>
      <Animated.View pointerEvents="none" style={[tabS.pill, { width: PILL_W, borderRadius: rs(24), transform: [{ translateX: pillX }] }]} />
      {ROUTES.map((route, i) => {
        const activeOp   = ops[i];
        const inactiveOp = activeOp.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
        return (
          <HapticTouchable key={route.key} onPress={() => jumpTo(route.key)} style={tabS.tab} activeOpacity={1}>
            <Animated.View style={tabS.inner}>
              <Animated.Text style={[tabS.label, tabS.labelInactive, { fontSize: nz(13), opacity: inactiveOp }]}>{route.title}</Animated.Text>
              <Animated.Text style={[tabS.label, tabS.labelActive, tabS.labelAbsolute, { fontSize: nz(13), opacity: activeOp }]}>{route.title}</Animated.Text>
            </Animated.View>
          </HapticTouchable>
        );
      })}
    </View>
  );
});
const tabS = StyleSheet.create({
  wrapper:       { flexDirection: 'row', backgroundColor: '#EFEFEF', position: 'relative', alignItems: 'center' },
  pill:          { position: 'absolute', top: 4, bottom: 4, left: 4, backgroundColor: GREEN, elevation: 0, shadowColor: GREEN, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 6 },
  tab:           { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, zIndex: 1 },
  inner:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  label:         { fontWeight: '700' },
  labelInactive: { color: '#888888' },
  labelActive:   { color: '#FFFFFF' },
  labelAbsolute: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, textAlign: 'center' },
});

// ─── Tab Scene ────────────────────────────────────────────────────────────────
const TabScene = React.memo(({
  list, loading, restaurantId, onToggle, onToast,
  bottomInset, tabKey, cols, cardW, rs, nz, SW, isLandscape,
  onRefresh, refreshing,
}) => {
  const keyExtractor = useCallback((_, i) => String(i), []);
  const imageMaxH = isLandscape ? IMAGE_MAX_H.landscape : IMAGE_MAX_H.portrait;

  if (loading) {
    return (
      <FlatList
        data={Array(cols * 2).fill(null)}
        keyExtractor={keyExtractor}
        numColumns={cols}
        key={`skel-${cols}`}
        columnWrapperStyle={cols > 1 ? { gap: rs(10), paddingHorizontal: rs(14) } : undefined}
        contentContainerStyle={{ paddingTop: rs(6), paddingBottom: rs(20), paddingHorizontal: cols === 1 ? rs(14) : 0 }}
        renderItem={() => <SkeletonCard cardW={cardW} rs={rs} imageMaxH={imageMaxH} />}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      />
    );
  }

  return (
    <FlatList
      data={list}
      keyExtractor={(item) => item.id}
      numColumns={cols}
      key={`list-${cols}`}
      columnWrapperStyle={cols > 1 ? { gap: rs(10), paddingHorizontal: rs(14) } : undefined}
      contentContainerStyle={{
        paddingTop: rs(6), paddingBottom: rs(24), backgroundColor: '#FFFFFF',
        paddingHorizontal: cols === 1 ? rs(14) : 0,
      }}
      renderItem={({ item }) => (
        <ProductCard
          item={item}
          restaurantId={restaurantId}
          onToggle={onToggle}
          onToast={onToast}
          bottomInset={bottomInset}
          tabKey={tabKey}
          cardW={cardW}
          rs={rs} nz={nz} SW={SW}
          isLandscape={isLandscape}
        />
      )}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
      initialNumToRender={cols * 4}
      maxToRenderPerBatch={cols * 3}
      windowSize={7}
      updateCellsBatchingPeriod={50}
      ListEmptyComponent={<EmptyState tabKey={tabKey} rs={rs} nz={nz} />}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={GREEN}
          colors={[GREEN]}
          progressBackgroundColor="#FFFFFF"
        />
      }
    />
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function YourListingScreen() {
  const insets       = useSafeAreaInsets();
  const { user }     = useStore();
  const restaurantId = user?.restaurantId ?? '';
  const searchRef    = useRef(null);

  const { SW, nz, rs, isTablet } = useResponsive();
  
  // Get orientation
  const [isLandscape, setIsLandscape] = useState(
    Dimensions.get('window').width > Dimensions.get('window').height
  );

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setIsLandscape(window.width > window.height);
    });
    return () => subscription?.remove();
  }, []);

  // Responsive column count based on device and orientation
  const getColumns = useCallback(() => {
    if (isTablet) {
      // iPad / Tablet
      return isLandscape ? 4 : 3;
    } else {
      // Mobile
      return isLandscape ? 3 : 2;
    }
  }, [isTablet, isLandscape]);

  const cols = getColumns();
  
  // Derived layout — reactive to rotation
  const H_PAD     = rs(14);
  const COL_GAP   = rs(10);
  const CARD_W    = (SW - H_PAD * 2 - COL_GAP * (cols - 1)) / cols;
  const TAB_BAR_W = SW - rs(32) - rs(8);
  const SEARCH_H  = 46;

  const [tabIndex,     setTabIndex]     = useState(0);
  const [activeCatId,  setActiveCatId]  = useState('__all__');
  const [categories,   setCategories]   = useState([
    { id: '__all__',    label: 'All',   emoji: '🍽️' },
    { id: COMBO_CAT_ID, label: 'Combo', emoji: '🍱' },
  ]);
  const [products,     setProducts]     = useState([]);
  const [combos,       setCombos]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [comboLoading, setComboLoading] = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [error,        setError]        = useState(null);
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [searchQuery,  setSearchQuery]  = useState('');
  const searchAnim = useRef(new Animated.Value(0)).current;

  const [toastMsg,   setToastMsg]   = useState('');
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastScale   = useRef(new Animated.Value(0.88)).current;
  const toastTimer   = useRef(null);

  const showToast = useCallback((text) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(text);
    toastOpacity.setValue(0); toastScale.setValue(0.88);
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
    Animated.spring(searchAnim, { toValue: 1, useNativeDriver: false, damping: 18, stiffness: 220, mass: 0.5 })
      .start(() => searchRef.current?.focus());
  }, []);

  const closeSearch = useCallback(() => {
    Keyboard.dismiss();
    setSearchQuery('');
    Animated.spring(searchAnim, { toValue: 0, useNativeDriver: false, damping: 18, stiffness: 220, mass: 0.5 })
      .start(() => setSearchOpen(false));
  }, []);

  const searchBarH    = searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, SEARCH_H + rs(8)] });
  const searchOpacity = searchAnim;

  const fetchMenu = useCallback(async () => {
    if (!restaurantId) return;
    setError(null);
    try {
      const res  = await menuAPI.getAllMenu(restaurantId);
      const menu = res?.data?.data?.menu ?? [];
      const { categories: cats, products: prods } = normaliseMenu(menu);
      setCategories(cats);
      setProducts(prods);
    } catch {
      setError('Failed to load menu. Tap to retry.');
    }
  }, [restaurantId]);

  const fetchCombos = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const res = await menuAPI.getAllCombo(restaurantId);
      const raw = res?.data?.data?.data ?? [];
      setCombos(normaliseCombo(raw));
    } catch { /* silent */ }
  }, [restaurantId]);

  const loadAllData = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
      setComboLoading(true);
    }
    await Promise.all([fetchMenu(), fetchCombos()]);
    if (showLoading) {
      setLoading(false);
      setComboLoading(false);
    }
  }, [fetchMenu, fetchCombos]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAllData(false);
    setRefreshing(false);
    showToast('🔄 Listings refreshed');
  }, [loadAllData, showToast]);

  useEffect(() => { 
    loadAllData(true); 
  }, [loadAllData]);

  const handleToggle = useCallback((id, isCombo) => {
    if (isCombo) {
      setCombos((prev) => prev.map((c) => c.id === id ? { ...c, on: !c.on, isLive: !c.on } : c));
    } else {
      setProducts((prev) => prev.map((p) => p.id === id ? { ...p, on: !p.on, isLive: !p.on } : p));
    }
  }, []);

  const q             = searchQuery.trim().toLowerCase();
  const isComboFilter = activeCatId === COMBO_CAT_ID;
  const baseList      = isComboFilter
    ? combos
    : products.filter((p) => activeCatId === '__all__' || p.catRowId === activeCatId);
  const filteredList  = baseList.filter((p) => !p.comboOnly && (!q || p.name.toLowerCase().includes(q)));
  const isLoading     = isComboFilter ? comboLoading : loading;
  const activeLists   = {
    active:   filteredList.filter((p) =>  p.on),
    disabled: filteredList.filter((p) => !p.on),
  };

  const sceneProps = useMemo(() => ({
    restaurantId, onToggle: handleToggle, onToast: showToast,
    bottomInset: insets.bottom, cols, cardW: CARD_W,
    rs, nz, SW, isLoading, isLandscape, onRefresh: handleRefresh, refreshing,
  }), [restaurantId, handleToggle, showToast, insets.bottom, cols, CARD_W, rs, nz, SW, isLoading, isLandscape, handleRefresh, refreshing]);

  const renderScene = useCallback(({ route }) => (
    <TabScene
      list={activeLists[route.key]}
      loading={sceneProps.isLoading}
      restaurantId={sceneProps.restaurantId}
      onToggle={sceneProps.onToggle}
      onToast={sceneProps.onToast}
      bottomInset={sceneProps.bottomInset}
      tabKey={route.key}
      cols={sceneProps.cols}
      cardW={sceneProps.cardW}
      rs={sceneProps.rs}
      nz={sceneProps.nz}
      SW={sceneProps.SW}
      isLandscape={sceneProps.isLandscape}
      onRefresh={sceneProps.onRefresh}
      refreshing={sceneProps.refreshing}
    />
  ), [activeLists, sceneProps]);

  const renderTabBar = useCallback((props) => (
    <View style={{ backgroundColor: '#FFFFFF', paddingBottom: rs(12), paddingTop: rs(4) }}>
      <CustomTabBar {...props} tabBarW={TAB_BAR_W} rs={rs} nz={nz} />
    </View>
  ), [TAB_BAR_W, rs, nz]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" translucent={false} />
      <View style={[s.root, { paddingTop: insets.top }]}>

        <View style={[s.headerRow, { paddingHorizontal: rs(18), paddingTop: rs(10), paddingBottom: rs(8) }]}>
          {!searchOpen && (
            <Text style={{ fontSize: nz(24), fontWeight: '800', color: '#1A1A1A', letterSpacing: -0.4 }}>
              Your Listing
            </Text>
          )}
          <View style={{ flex: 1 }} />
          <HapticTouchable style={{ padding: rs(6) }} activeOpacity={0.7} onPress={searchOpen ? closeSearch : openSearch}>
            <Feather name={searchOpen ? 'x' : 'search'} size={nz(21)} color="#1A1A1A" />
          </HapticTouchable>
        </View>

        <Animated.View style={{ overflow: 'hidden', paddingHorizontal: rs(14), height: searchBarH, opacity: searchOpacity }}>
          <View style={[s.searchBox, { borderRadius: rs(12), paddingHorizontal: rs(12), height: SEARCH_H }]}>
            <Feather name="search" size={nz(15)} color="#AAAAAA" style={{ marginRight: rs(8) }} />
            <TextInput
              ref={searchRef}
              style={{ flex: 1, fontSize: nz(14), color: '#1A1A1A', paddingVertical: 0 }}
              placeholder="Search items..."
              placeholderTextColor="#BBBBBB"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              onSubmitEditing={Keyboard.dismiss}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <HapticTouchable onPress={() => setSearchQuery('')} style={{ paddingLeft: rs(8) }}>
                <Feather name="x-circle" size={nz(15)} color="#BBBBBB" />
              </HapticTouchable>
            )}
          </View>
        </Animated.View>

        {error && (
          <HapticTouchable
            onPress={() => loadAllData(true)}
            style={[s.errorBanner, { marginHorizontal: rs(14), marginTop: rs(6), marginBottom: rs(4), borderRadius: rs(10), paddingHorizontal: rs(12), paddingVertical: rs(10) }]}
            activeOpacity={0.8}
          >
            <Feather name="alert-circle" size={nz(13)} color="#E53935" />
            <Text style={{ flex: 1, fontSize: nz(12), color: '#C62828', fontWeight: '500', marginLeft: 6 }}>{error}</Text>
            <Feather name="refresh-cw" size={nz(13)} color="#E53935" />
          </HapticTouchable>
        )}

        <View style={{ height: PILL_ROW_H, backgroundColor: '#FFFFFF' }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: rs(14), alignItems: 'center', height: PILL_ROW_H }}
            alwaysBounceHorizontal={false}
          >
            {categories.map((cat) => (
              <CategoryPill
                key={cat.id}
                item={cat}
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
            style={[s.toast, {
              bottom: rs(32), left: rs(24), right: rs(24),
              borderRadius: rs(14), paddingHorizontal: rs(18), paddingVertical: rs(12),
              opacity: toastOpacity, transform: [{ scale: toastScale }],
            }]}
          >
            <Text style={{ fontSize: nz(13), fontWeight: '700', color: '#FFFFFF', textAlign: 'center', lineHeight: nz(19) }}>
              {toastMsg}
            </Text>
          </Animated.View>
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#FFFFFF' },
  headerRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF' },
  searchBox:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F4F4', borderWidth: 1, borderColor: '#EBEBEB' },
  errorBanner:{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3F3', borderWidth: 1, borderColor: '#FFCDD2' },
  toast:      { position: 'absolute', backgroundColor: 'rgba(15,15,15,0.92)', alignItems: 'center', zIndex: 9999, elevation: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.32, shadowRadius: 12 },
});