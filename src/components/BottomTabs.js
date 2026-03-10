import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  PixelRatio,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import HapticTouchable from './GlobalHaptic';

const { width: SW } = Dimensions.get('window');
const sc = SW / 375;
const nz = (s) => Math.round(PixelRatio.roundToNearestPixel(s * Math.min(sc, 1.35)));
const rs = (s) => Math.round(s * Math.min(sc, 1.25));

const GREEN = '#03954E';

const TABS = [
  { name: 'Home',     label: 'Home',     iconLib: 'material', icon: 'home'          },
  { name: 'List',     label: 'List',     iconLib: 'feather',  icon: 'check-circle'  },
  { name: 'Settings', label: 'Settings', iconLib: 'feather',  icon: 'settings'      },
];

// ─── Animated Bottom Tab Bar (same sliding-pill mechanic as HomeScreen) ────────
const BottomTabs = ({ state, navigation }) => {
  const insets      = useSafeAreaInsets();
  const gestureBarH = insets.bottom;

  // ── shared pill translateX (mirrors AnimatedTabBar.pillX) ──────────────────
  const pillX = useRef(new Animated.Value(0)).current;

  // Per-tab scale + opacity refs (same shape as AnimatedTabBar.anims)
  const anims = useRef(
    TABS.reduce((acc, t, i) => {
      const isFirst = i === 0;
      acc[t.name] = {
        scale:   new Animated.Value(isFirst ? 1 : 0.88),
        opacity: new Animated.Value(isFirst ? 1 : 0.5),
      };
      return acc;
    }, {})
  ).current;

  // Store measured tab layouts (x, width) – same pattern as AnimatedTabBar
  const [layouts, setLayouts] = useState({});

  const onTabLayout = useCallback((name, e) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => ({ ...prev, [name]: { x, width } }));
  }, []);

  // Drive pill + scale/opacity whenever focused index OR layouts change
  useEffect(() => {
    const focusedName = TABS[state.index]?.name;
    const lay = layouts[focusedName];
    if (!lay) return;

    // pill slides to the focused tab's x (offset by inner padding rs(4) like HomeScreen)
    Animated.spring(pillX, {
      toValue:       lay.x,
      useNativeDriver: true,
      speed:         28,
      bounciness:    5,
    }).start();

    TABS.forEach((t) => {
      const active = t.name === focusedName;
      Animated.parallel([
        Animated.spring(anims[t.name].scale, {
          toValue:         active ? 1 : 0.88,
          useNativeDriver: true,
          speed:           24,
          bounciness:      3,
        }),
        Animated.timing(anims[t.name].opacity, {
          toValue:         active ? 1 : 0.5,
          duration:        160,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [state.index, layouts]);

  // Dynamic pill width — matches the focused tab's measured width
  const focusedName = TABS[state.index]?.name;
  const pillWidth   = layouts[focusedName]?.width ?? rs(110);

  return (
    <View style={[s.outer, { paddingBottom: rs(12) + gestureBarH }]}>
      <View style={s.container}>
        {/* ── Sliding pill (position: absolute, pointer-events: none) ── */}
        <Animated.View
          pointerEvents="none"
          style={[
            s.pill,
            {
              width:     pillWidth,
              transform: [{ translateX: pillX }],
            },
          ]}
        />

        {/* ── Tab buttons ── */}
        <View style={s.row}>
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;
            const tab       = TABS[index] ?? TABS[0];

            const onPress = () => {
              const event = navigation.emit({
                type:              'tabPress',
                target:            route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const onLongPress = () =>
              navigation.emit({ type: 'tabLongPress', target: route.key });

            return (
              <HapticTouchable
                key={route.key}
                onPress={onPress}
                onLongPress={onLongPress}
                activeOpacity={1}
                style={s.btn}
                accessibilityRole="button"
                accessibilityState={{ selected: isFocused }}
                onLayout={(e) => onTabLayout(tab.name, e)}
              >
                <Animated.View
                  style={[
                    s.inner,
                    {
                      transform: [{ scale: anims[tab.name].scale }],
                      opacity:   anims[tab.name].opacity,
                    },
                  ]}
                >
                  {tab.iconLib === 'material'
                    ? <MaterialIcons
                        name={tab.icon}
                        size={nz(22)}
                        color={isFocused ? '#FFFFFF' : 'rgb(0,0,0)'}
                      />
                    : <Feather
                        name={tab.icon}
                        size={isFocused ? nz(20) : nz(22)}
                        color={isFocused ? '#FFFFFF' : 'rgb(0,0,0)'}
                      />
                  }
                  {isFocused && (
                    <Text style={s.label}>{tab.label}</Text>
                  )}
                </Animated.View>
              </HapticTouchable>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  outer: {
    paddingHorizontal: rs(8),
    backgroundColor:   '#fff',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius:    rs(50),
    borderWidth:     rs(1),
    borderColor:     '#d2d0d0',
    position:        'relative',
    overflow:        'hidden',        // clip the sliding pill
    ...Platform.select({
      android: { elevation: 20 },
      ios: {
        shadowColor:   '#000',
        shadowOffset:  { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius:  16,
      },
    }),
  },

  // ── Sliding green pill (absolute, behind all buttons) ──────────────────────
  pill: {
    position:        'absolute',
    top:             rs(8),
    bottom:          rs(8),
    left:            0,
    borderRadius:    rs(26),
    backgroundColor: GREEN,
    zIndex:          0,
    ...Platform.select({
      android: { elevation: 4 },
      ios: {
        shadowColor:   GREEN,
        shadowOffset:  { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius:  8,
      },
    }),
  },

  row: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-around',
    paddingHorizontal: rs(12),
    height:          rs(64),
    zIndex:          1,
  },
  btn: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    height:          rs(52),
    zIndex:          1,
  },
  inner: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             rs(6),
    paddingHorizontal: rs(4),
  },
  label: {
    color:      '#FFFFFF',
    fontSize:   nz(14),
    fontWeight: '700',
  },
});

export default BottomTabs;