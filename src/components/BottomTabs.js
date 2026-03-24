import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  PixelRatio,
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
  { name: 'Home',     label: 'Home',     iconLib: 'material', icon: 'home'         },
  { name: 'List',     label: 'List',     iconLib: 'feather',  icon: 'check-circle' },
  { name: 'Settings', label: 'Settings', iconLib: 'feather',  icon: 'settings'     },
];

const BottomTabs = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();

  const pillX = useRef(new Animated.Value(0)).current;

  const anims = useRef(
    TABS.reduce((acc, t, i) => {
      const isFirst = i === 0;
      acc[t.name] = {
        scale:   new Animated.Value(isFirst ? 1 : 0.9),
        opacity: new Animated.Value(isFirst ? 1 : 0.6),
      };
      return acc;
    }, {})
  ).current;

  const [layouts, setLayouts] = useState({});

  const onTabLayout = useCallback((name, e) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => ({ ...prev, [name]: { x, width } }));
  }, []);

  useEffect(() => {
    const focusedName = TABS[state.index]?.name;
    const lay = layouts[focusedName];
    if (!lay) return;

    Animated.spring(pillX, {
      toValue:         lay.x,
      useNativeDriver: true,
      speed:           30,
      bounciness:      6,
    }).start();

    TABS.forEach((t) => {
      const active = t.name === focusedName;
      Animated.parallel([
        Animated.spring(anims[t.name].scale, {
          toValue:         active ? 1 : 0.9,
          useNativeDriver: true,
          speed:           25,
          bounciness:      4,
        }),
        Animated.timing(anims[t.name].opacity, {
          toValue:         active ? 1 : 0.6,
          duration:        180,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [state.index, layouts]);

  const focusedName = TABS[state.index]?.name;
  const pillWidth   = layouts[focusedName]?.width ?? rs(110);

  return (
    <View style={[s.outer, { paddingBottom: insets.bottom > 0 ? insets.bottom : rs(8) }]}>
      <View style={s.container}>

        <Animated.View
          pointerEvents="none"
          style={[s.pill, { width: pillWidth, transform: [{ translateX: pillX }] }]}
        />

        <View style={s.row}>
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;
            const tab       = TABS[index] ?? TABS[0];

            const onPress = () => {
              Animated.sequence([
                Animated.timing(anims[tab.name].scale, { toValue: 0.92, duration: 70, useNativeDriver: true }),
                Animated.spring(anims[tab.name].scale, { toValue: 1, useNativeDriver: true }),
              ]).start();

              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
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
                  {tab.iconLib === 'material' ? (
                    <MaterialIcons
                      name={tab.icon}
                      size={isFocused ? nz(24) : nz(20)}
                      color={isFocused ? '#FFF' : '#000'}
                    />
                  ) : (
                    <Feather
                      name={tab.icon}
                      size={isFocused ? nz(22) : nz(20)}
                      color={isFocused ? '#FFF' : '#000'}
                    />
                  )}

                  {isFocused && (
                    <Animated.Text style={s.label}>{tab.label}</Animated.Text>
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
    paddingHorizontal: rs(10),
    paddingTop:        rs(6),
    backgroundColor:   '#fff',
    // ✅ No hardcoded paddingBottom — handled dynamically via insets
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius:    rs(50),
    borderWidth:     rs(1),
    borderColor:     '#e7e7e7',
    position:        'relative',
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 10 },
    shadowOpacity:   0.1,
    shadowRadius:    20,
    elevation:       20,
  },
  pill: {
    position:        'absolute',
    top:             rs(6),
    bottom:          rs(6),
    left:            0,
    borderRadius:    rs(30),
    backgroundColor: GREEN,
    shadowColor:     GREEN,
    shadowOffset:    { width: 0, height: 6 },
    shadowOpacity:   0.35,
    shadowRadius:    12,
    elevation:       8,
  },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-around',
    paddingHorizontal: rs(12),
    height:            rs(66),
    zIndex:            1,
  },
  btn: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    height:         rs(54),
  },
  inner: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               rs(6),
    paddingHorizontal: rs(6),
  },
  label: {
    color:      '#FFFFFF',
    fontSize:   nz(14),
    fontWeight: '700',
    marginLeft: rs(2),
  },
});

export default BottomTabs;