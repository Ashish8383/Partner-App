import React, {
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import {
  Animated,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
  PixelRatio,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_TABLET = SCREEN_WIDTH >= 768;
const scaleW    = SCREEN_WIDTH / 375;

const normalize = (size) => {
  if (IS_TABLET) return Math.round(PixelRatio.roundToNearestPixel(size * 1.22));
  return Math.round(PixelRatio.roundToNearestPixel(size * Math.min(scaleW, 1.4)));
};
const rs = (size) => {
  if (IS_TABLET) return Math.round(size * 1.28);
  return Math.round(size * Math.min(scaleW, 1.3));
};

// ─── Toast config ─────────────────────────────────────────────────────────────
const TOAST_CONFIG = {
  success: { bg: '#03954E', icon: 'check-circle', iconColor: '#FFFFFF' },
  error:   { bg: '#E53935', icon: 'error',        iconColor: '#FFFFFF' },
  info:    { bg: '#1A9EDE', icon: 'info',         iconColor: '#FFFFFF' },
  warning: { bg: '#F59E0B', icon: 'warning',      iconColor: '#FFFFFF' },
};

// ─── Component ────────────────────────────────────────────────────────────────
const ToastMessage = forwardRef((_, ref) => {
  const insets = useSafeAreaInsets();

  const slideY  = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const [toast, setToast]     = useState({ message: '', type: 'info' });
  const [visible, setVisible] = useState(false);
  const hideTimer             = useRef(null);

  const getTopOffset = () => {
    if (Platform.OS === 'android') {
      return (StatusBar.currentHeight ?? 24) + rs(10);
    }
    return insets.top + rs(10);
  };

  const hide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    Animated.parallel([
      Animated.timing(slideY, {
        toValue:         -100,
        duration:        200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue:         0,
        duration:        180,
        useNativeDriver: true,
      }),
    ]).start(() => setVisible(false));
  }, [slideY, opacity]);

  const show = useCallback(({ message, type = 'info', duration = 3200 }) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);

    setToast({ message, type });
    setVisible(true);

    slideY.setValue(-100);
    opacity.setValue(0);

    Animated.parallel([
      Animated.spring(slideY, {
        toValue:         0,
        useNativeDriver: true,
        speed:           16,
        bounciness:      5,
      }),
      Animated.timing(opacity, {
        toValue:         1,
        duration:        140,
        useNativeDriver: true,
      }),
    ]).start();

    hideTimer.current = setTimeout(hide, duration);
  }, [slideY, opacity, hide]);

  useImperativeHandle(ref, () => ({ show, hide }), [show, hide]);

  if (!visible) return null;

  const config    = TOAST_CONFIG[toast.type] || TOAST_CONFIG.info;
  const topOffset = getTopOffset();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: config.bg,
          top:             topOffset,
          opacity,
          transform:       [{ translateY: slideY }],
        },
      ]}
      pointerEvents="box-none"
    >
      <MaterialIcons
        name={config.icon}
        size={normalize(20)}
        color={config.iconColor}
        style={styles.icon}
      />
      <Text style={styles.message} allowFontScaling={false} numberOfLines={3}>
        {toast.message}
      </Text>
    </Animated.View>
  );
});

ToastMessage.displayName = 'ToastMessage';
export default ToastMessage;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    position:          'absolute',
    left:              rs(16),
    right:             rs(16),
    zIndex:            9999,
    elevation:         12,
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   rs(13),
    paddingHorizontal: rs(16),
    borderRadius:      rs(12),
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 4 },
    shadowOpacity:     0.18,
    shadowRadius:      10,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.20)',
  },
  icon: {
    marginRight: rs(10),
  },
  message: {
    flex:       1,
    color:      '#FFFFFF',
    fontSize:   normalize(14),
    fontWeight: '600',
    lineHeight: normalize(20),
  },
});