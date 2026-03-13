import React, { useEffect, useRef, useCallback } from 'react';
import {
  Animated, Text, View, StyleSheet,
  useColorScheme, Platform, Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HapticTouchable from '../components/GlobalHaptic';

// ─── Duration & spring constants ─────────────────────────────────────────────
const SHOW_DURATION = 5000;   // ms before auto-dismiss
const SLIDE_IN = { damping: 22, stiffness: 300, mass: 0.6 };

// ─── Theme tokens ─────────────────────────────────────────────────────────────
// iOS light  → white card, green accent, subtle shadow  (matches iOS notification look)
// iOS dark   → elevated dark card (#1C1C1E), green accent
// Android light → white card, slight shadow, Material-ish
// Android dark  → dark elevated card (#1E1E1E)

const getTheme = (isDark) => {
  if (Platform.OS === 'ios') {
    return isDark ? {
      // iOS dark
      cardBg:       '#1C1C1EEE',  // translucent dark
      cardBorder:   'rgba(255,255,255,0.10)',
      appNameColor: 'rgba(255,255,255,0.45)',
      titleColor:   '#FFFFFF',
      bodyColor:    'rgba(255,255,255,0.7)',
      iconBg:       '#03954E',
      timeColor:    'rgba(255,255,255,0.35)',
      shadowColor:  '#000',
      dividerColor: 'rgba(255,255,255,0.08)',
      progressBg:   'rgba(255,255,255,0.08)',
      progressFill: '#03954E',
    } : {
      // iOS light
      cardBg:       'rgba(255,255,255,0.97)',
      cardBorder:   'rgba(0,0,0,0.06)',
      appNameColor: '#666666',
      titleColor:   '#000000',
      bodyColor:    '#3C3C3C',
      iconBg:       '#03954E',
      timeColor:    '#AAAAAA',
      shadowColor:  '#00000030',
      dividerColor: 'rgba(0,0,0,0.06)',
      progressBg:   'rgba(0,0,0,0.05)',
      progressFill: '#03954E',
    };
  }

  // Android
  return isDark ? {
    cardBg:       '#1E1E1E',
    cardBorder:   'rgba(255,255,255,0.08)',
    appNameColor: 'rgba(255,255,255,0.5)',
    titleColor:   '#FFFFFF',
    bodyColor:    'rgba(255,255,255,0.72)',
    iconBg:       '#03954E',
    timeColor:    'rgba(255,255,255,0.38)',
    shadowColor:  '#000',
    dividerColor: 'rgba(255,255,255,0.07)',
    progressBg:   'rgba(255,255,255,0.07)',
    progressFill: '#03954E',
  } : {
    cardBg:       '#FFFFFF',
    cardBorder:   'rgba(0,0,0,0.07)',
    appNameColor: '#757575',
    titleColor:   '#212121',
    bodyColor:    '#424242',
    iconBg:       '#03954E',
    timeColor:    '#9E9E9E',
    shadowColor:  '#00000028',
    dividerColor: 'rgba(0,0,0,0.05)',
    progressBg:   'rgba(0,0,0,0.04)',
    progressFill: '#03954E',
  };
};

// ─── Progress bar that runs down over SHOW_DURATION ──────────────────────────
const ProgressBar = React.memo(({ progressFill, progressBg }) => {
  const width = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue:         0,
      duration:        SHOW_DURATION,
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <View style={[pb.wrap, { backgroundColor: progressBg }]}>
      <Animated.View style={[pb.bar, {
        backgroundColor: progressFill,
        width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
      }]} />
    </View>
  );
});

const pb = StyleSheet.create({
  wrap: { height: 3, width: '100%' },
  bar:  { height: 3 },
});

// ─── Main Component ───────────────────────────────────────────────────────────
const InAppNotification = React.memo(({ title, body, onPress, onDismiss, appName }) => {
  const insets      = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark      = colorScheme === 'dark';
  const theme       = getTheme(isDark);

  // Animations
  const translateY = useRef(new Animated.Value(-200)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const scale      = useRef(new Animated.Value(0.95)).current;
  const timerRef   = useRef(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(translateY, { toValue: -200, duration: 280, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 0,    duration: 240, useNativeDriver: true }),
      Animated.timing(scale,      { toValue: 0.95, duration: 240, useNativeDriver: true }),
    ]).start(() => onDismiss?.());
  }, [translateY, opacity, scale, onDismiss]);

  useEffect(() => {
    // Slide in + fade + scale up
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, ...SLIDE_IN }),
      Animated.timing(opacity,    { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(scale,      { toValue: 1, useNativeDriver: true, ...SLIDE_IN }),
    ]).start();

    timerRef.current = setTimeout(dismiss, SHOW_DURATION);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // Current time string (like real notifications)
  const timeNow = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  // Border radius: iOS = 20 (pill-ish), Android = 12
  const borderRadius = Platform.OS === 'ios' ? 20 : 12;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top:             insets.top + (Platform.OS === 'ios' ? 10 : 8),
          transform:       [{ translateY }, { scale }],
          opacity,
          backgroundColor: theme.cardBg,
          borderColor:     theme.cardBorder,
          borderRadius,
          shadowColor:     theme.shadowColor,
          // iOS blur card look — use overflow: hidden for border radius to clip
        },
      ]}
    >
      {/* ── Progress bar at very top ── */}
      <ProgressBar progressFill={theme.progressFill} progressBg={theme.progressBg} />

      {/* ── App meta row: icon + app name + time + close ── */}
      <View style={styles.metaRow}>
        <View style={[styles.appIconWrap, { backgroundColor: theme.iconBg }]}>
          <MaterialIcons name="restaurant" size={12} color="#fff" />
        </View>
        <Text style={[styles.appName, { color: theme.appNameColor }]}>
          {appName ?? 'Alfennzo Partner'}
        </Text>
        <Text style={[styles.timeText, { color: theme.timeColor }]}>{timeNow}</Text>
        <HapticTouchable onPress={dismiss} style={styles.closeBtn} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="close" size={14} color={theme.timeColor} />
        </HapticTouchable>
      </View>

      {/* ── Divider ── */}
      <View style={[styles.divider, { backgroundColor: theme.dividerColor }]} />

      {/* ── Main content: food icon + title + body ── */}
      <HapticTouchable
        style={styles.contentRow}
        onPress={() => { dismiss(); onPress?.(); }}
        activeOpacity={0.88}
      >
        {/* Left icon */}
        <View style={[styles.iconWrap, { backgroundColor: theme.iconBg }]}>
          <MaterialIcons name="delivery-dining" size={22} color="#fff" />
        </View>

        {/* Text */}
        <View style={styles.textWrap}>
          <Text style={[styles.title, { color: theme.titleColor }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.body, { color: theme.bodyColor }]} numberOfLines={2}>
            {body}
          </Text>
        </View>

        {/* Chevron hint */}
        <MaterialIcons name="chevron-right" size={18} color={theme.timeColor} />
      </HapticTouchable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position:    'absolute',
    left:        12,
    right:       12,
    zIndex:      9999,
    elevation:   9999,
    borderWidth: 1,
    overflow:    'hidden',
    // Shadow
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius:  16,
  },

  // ── App meta row ──
  metaRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: 12,
    paddingTop:     10,
    paddingBottom:  6,
    gap:            6,
  },
  appIconWrap: {
    width:        18,
    height:       18,
    borderRadius: 4,
    alignItems:   'center',
    justifyContent: 'center',
  },
  appName: {
    flex:       1,
    fontSize:   11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  timeText: {
    fontSize:   11,
    fontWeight: '400',
  },
  closeBtn: {
    width:          22,
    height:         22,
    borderRadius:   11,
    alignItems:     'center',
    justifyContent: 'center',
  },

  divider: { height: 1, marginHorizontal: 0 },

  // ── Content ──
  contentRow: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingHorizontal: 12,
    paddingVertical:   12,
    gap:           10,
  },
  iconWrap: {
    width:          44,
    height:         44,
    borderRadius:   Platform.OS === 'ios' ? 12 : 8,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  textWrap: {
    flex: 1,
    gap:   3,
  },
  title: {
    fontSize:   14,
    fontWeight: Platform.OS === 'ios' ? '700' : '600',
    lineHeight: 18,
  },
  body: {
    fontSize:   13,
    lineHeight: 17,
  },
});

export default InAppNotification;