import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Switch,
  Animated, Dimensions, PixelRatio,
  StatusBar, Platform, Linking, AppState,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import HapticTouchable from '../components/GlobalHaptic';
import { getFCMToken } from '../utils/fcmToken';
import useStore from '../store/useStore';
import api from '../utils/api';

const { width: SW } = Dimensions.get('window');
const sc = SW / 390;
const rs = (n) => Math.round(n * Math.min(sc, 1.35));
const nz = (n) => Math.round(PixelRatio.roundToNearestPixel(n * Math.min(sc, 1.35)));

const G1 = '#03954E';
const G2 = '#027A40';
const G3 = '#E8F7EF';
const BG = '#F6F7F9';
const WH = '#FFFFFF';
const TX = '#111827';
const SB = '#6B7280';
const SlideIn = ({ delay = 0, children }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1, delay,
      useNativeDriver: true,
      damping: 18, stiffness: 160, mass: 0.6,
    }).start();
  }, []);
  return (
    <Animated.View style={{
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
    }}>
      {children}
    </Animated.View>
  );
};

export default function NotificationScreen() {
  const insets       = useSafeAreaInsets();
  const navigation   = useNavigation();
  const restaurantId     = useStore((s) => s.user?.restaurantId ?? '');
  const storedFcmToken          = useStore((s) => s.fcmToken);
  const storedFingerprint       = useStore((s) => s.deviceFingerprint);
  const setNotificationsEnabled = useStore((s) => s.setNotificationsEnabled);
  const storeFcmToken           = useStore((s) => s.setFcmToken);

  const [isEnabled, setIsEnabled] = useState(false);
  const [syncing,   setSyncing]   = useState(true);

  const switchAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(switchAnim, {
      toValue: isEnabled ? 1 : 0, duration: 260, useNativeDriver: false,
    }).start();
  }, [isEnabled]);
  const updateFcmToken = useCallback(async (token) => {
    try {
      const payload = {
        fcmToken:          token,
        deviceFingerprint: storedFingerprint ?? '',  
        Id:                restaurantId,
      };

      await api.post('/restaurant/updateFcmToken', payload);
    } catch (err) {
    }
  }, [restaurantId, storedFingerprint]);

  const syncPermission = useCallback(async () => {
    if (!useStore.getState().isAuthenticated) return;

    setSyncing(true);
    try {
      const { status } = await Notifications.getPermissionsAsync();
      const granted = status === 'granted';
      setIsEnabled(granted);
      await setNotificationsEnabled(granted); 

      if (granted) {
        const token = storedFcmToken ?? useStore.getState().fcmToken ?? await getFCMToken();
        if (token) {
          await updateFcmToken(token);
        } else {
        }
      } else {
        await storeFcmToken('');        
        await updateFcmToken('');        
      }
    } catch (e) {
    } finally {
      setSyncing(false);
    }
  }, [storedFcmToken, updateFcmToken, setNotificationsEnabled, storeFcmToken]);

  useEffect(() => { syncPermission(); }, [syncPermission]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncPermission();
    });
    return () => sub.remove();
  }, [syncPermission]);

  const handleToggle = useCallback(() => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  }, []);

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={G2} translucent={false} />
      <LinearGradient
        colors={[G2, G1]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={[s.header, { paddingTop: insets.top + rs(8) }]}
      >
        <HapticTouchable onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.8}>
          <Feather name="arrow-left" size={nz(22)} color={WH} />
        </HapticTouchable>
        <Text style={s.headerTitle}>Manage Notifications</Text>
        <View style={{ width: rs(40) }} />
      </LinearGradient>

      <View style={[s.body, { paddingBottom: rs(40) + insets.bottom }]}>
        <SlideIn delay={60}>
          <LinearGradient
            colors={isEnabled ? [G2, G1] : ['#9CA3AF', '#6B7280']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.masterCard}
          >
            <View style={s.masterLeft}>
              <View style={s.masterIconWrap}>
                <Feather
                  name={isEnabled ? 'bell' : 'bell-off'}
                  size={nz(28)}
                  color={WH}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.masterTitle}>
                  {syncing ? 'Syncing…' : isEnabled ? 'Notifications On' : 'Notifications Off'}
                </Text>
                <Text style={s.masterSub}>
                  {syncing
                    ? 'Checking device settings'
                    : isEnabled
                    ? 'You\'re all set to receive order alerts'
                    : 'Turn on to get notified about new orders'}
                </Text>
              </View>
            </View>
            <Switch
              value={isEnabled}
              onValueChange={handleToggle}
              disabled={syncing}
              trackColor={{ false: 'rgba(255,255,255,0.28)', true: 'rgba(255,255,255,0.36)' }}
              thumbColor={WH}
              ios_backgroundColor="rgba(255,255,255,0.25)"
            />
          </LinearGradient>
        </SlideIn>

        <SlideIn delay={140}>
          <View style={s.infoCard}>

            <View style={s.infoHeader}>
              <Feather name="info" size={nz(14)} color={G1} style={{ marginRight: rs(6) }} />
              <Text style={s.infoHeaderText}>
                {isEnabled ? 'You will receive' : 'Enable to receive'}
              </Text>
            </View>

            {[
              { icon: 'shopping-bag', text: 'New order alerts instantly' },
              { icon: 'check-circle', text: 'Order confirmation updates' },
            ].map((item) => (
              <View key={item.icon} style={s.infoRow}>
                <View style={[s.infoIconWrap, { backgroundColor: isEnabled ? G3 : '#F3F4F6' }]}>
                  <Feather name={item.icon} size={nz(14)} color={isEnabled ? G1 : SB} />
                </View>
                <Text style={[s.infoRowText, !isEnabled && s.infoRowTextDim]}>
                  {item.text}
                </Text>
                {isEnabled && (
                  <Feather name="check" size={nz(14)} color={G1} />
                )}
              </View>
            ))}
          </View>
        </SlideIn>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: rs(12), paddingBottom: rs(14) },
  backBtn:     { width: rs(40), height: rs(40), borderRadius: rs(20), alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: nz(17), fontWeight: '700', color: WH, letterSpacing: -0.2 },
  body: { flex: 1, paddingHorizontal: rs(16), paddingTop: rs(20), gap: rs(14) },
  masterCard:    { borderRadius: rs(20), padding: rs(18), flexDirection: 'row', alignItems: 'center', gap: rs(12), shadowColor: G2, shadowOffset: { width: 0, height: rs(4) }, shadowOpacity: 0.25, shadowRadius: rs(12), elevation: 6 },
  masterLeft:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: rs(14) },
  masterIconWrap:{ width: rs(52), height: rs(52), borderRadius: rs(16), backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  masterTitle:   { fontSize: nz(16), fontWeight: '800', color: WH, marginBottom: rs(3) },
  masterSub:     { fontSize: nz(12), color: 'rgba(255,255,255,0.82)', lineHeight: nz(17) },
  infoCard: { backgroundColor: WH, borderRadius: rs(18), padding: rs(16), shadowColor: '#000', shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.06, shadowRadius: rs(8), elevation: 3 },
  infoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: rs(14) },
  infoHeaderText: { fontSize: nz(13), fontWeight: '700', color: TX },
  infoRow:    { flexDirection: 'row', alignItems: 'center', gap: rs(10), paddingVertical: rs(10), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F3F4F6' },
  infoIconWrap: { width: rs(30), height: rs(30), borderRadius: rs(8), alignItems: 'center', justifyContent: 'center' },
  infoRowText:  { flex: 1, fontSize: nz(13), fontWeight: '500', color: TX },
  infoRowTextDim: { color: SB },
  tokenStrip: { flexDirection: 'row', alignItems: 'center', backgroundColor: G3, borderRadius: rs(12), paddingHorizontal: rs(14), paddingVertical: rs(10) },
  tokenDot:   { width: rs(7), height: rs(7), borderRadius: rs(4), backgroundColor: G1, marginRight: rs(8) },
  tokenText:  { flex: 1, fontSize: nz(11), fontWeight: '600', color: G2 },
  settingsHint:     { flexDirection: 'row', alignItems: 'center', backgroundColor: WH, borderRadius: rs(14), paddingHorizontal: rs(14), paddingVertical: rs(13), shadowColor: '#000', shadowOffset: { width: 0, height: rs(1) }, shadowOpacity: 0.04, shadowRadius: rs(4), elevation: 1 },
  settingsHintText: { flex: 1, fontSize: nz(13), color: SB, fontWeight: '500' },
});