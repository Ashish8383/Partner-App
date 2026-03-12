import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Linking,
  Animated,
  Dimensions,
  PixelRatio,
  StatusBar,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import useStore from '../store/useStore';
import HapticTouchable from '../components/GlobalHaptic';
import { useNavigation } from '@react-navigation/native';
const { width: SW } = Dimensions.get('window');
const BASE = 390;
const sc   = SW / BASE;
const rs   = (n) => Math.round(n * Math.min(sc, 1.35));
const nz   = (n) => Math.round(PixelRatio.roundToNearestPixel(n * Math.min(sc, 1.35)));
const G1 = '#03954E';
const G2 = '#027A40';
const G3 = '#E8F7EF';
const BG = '#F6F7F9';
const WH = '#FFFFFF';
const TX = '#111827';
const SB = '#6B7280';
const BD = '#E5E7EB';
const RD = '#EF4444';

const FadeRow = ({ delay = 0, children }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 420, delay,
      useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View style={{
      opacity: anim,
      transform: [{
        translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
      }],
    }}>
      {children}
    </Animated.View>
  );
};

const Card = ({ children, style }) => (
  <View style={[c.card, style]}>{children}</View>
);

const RowItem = ({
  icon, iconBg, label, sublabel,
  right, onPress, noBorder, danger,
}) => (
  <HapticTouchable
    onPress={onPress}
    activeOpacity={onPress ? 0.7 : 1}
    style={[c.row, noBorder && c.rowNoBorder]}
    disabled={!onPress}
  >
    <View style={[c.rowIconWrap, { backgroundColor: iconBg || G3 }]}>
      {icon}
    </View>
    <View style={c.rowMid}>
      <Text style={[c.rowLabel, danger && { color: RD }]}>{label}</Text>
      {sublabel ? <Text style={c.rowSub}>{sublabel}</Text> : null}
    </View>
    <View style={c.rowRight}>{right}</View>
  </HapticTouchable>
);
const CustomLogoutButton = () => {
  const [isLoading, setIsLoading] = useState(false);
  const logout = useStore((s) => s.logout);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await logout();
            } catch (error) {
              Alert.alert('Error', 'Failed to logout. Please try again.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, [logout]);

  return (
    <HapticTouchable
      onPress={handleLogout}
      disabled={isLoading}
      style={st.logoutButton}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={['#FEE2E2', '#FECACA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={st.logoutGradient}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={RD} />
        ) : (
          <>
            <View style={st.logoutIconContainer}>
              <Feather name="log-out" size={nz(18)} color={RD} />
            </View>
            <Text style={st.logoutText}>Logout</Text>
          </>
        )}
      </LinearGradient>
    </HapticTouchable>
  );
};

export default function ProfileScreen() {
  const insets        = useSafeAreaInsets();
  const navigation    = useNavigation();
  const user          = useStore((s) => s.user);
  const restaurantName = useStore((s) => s.restaurantName);
  const restaurantLogo = useStore((s) => s.restaurantLogo);

  const [logoError, setLogoError] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.00, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const openPrivacyPolicy  = () => Linking.openURL('https://www.alfennzo.com/privacy-policy');
  const openTerms          = () => Linking.openURL('https://www.alfennzo.com/terms-and-conditions');
  const openSupport        = () => Linking.openURL('tel:9319702754');

  const initials = (name = '') =>
    name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'U';

  const displayName = restaurantName || user?.name || 'Partner';
  const logoUri     = restaurantLogo  || user?.avatar || null;

  return (
    <View style={st.screen}>
      <StatusBar barStyle="light-content" backgroundColor={G2} translucent={false} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.scroll}
        bounces={Platform.OS === 'ios'}
      >
        <LinearGradient
          colors={[G2, G1, '#05B85F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[st.hero, { paddingTop: insets.top + rs(32) }]}
        >
          <View style={st.deco1} />
          <View style={st.deco2} />

          <Animated.View style={[st.pulseRing, { transform: [{ scale: pulse }] }]} />
          <View style={st.avatarWrap}>
            {logoUri && !logoError ? (
              <Image
                source={{ uri: logoUri }}
                style={st.avatar}
                resizeMode="cover"
                onError={() => setLogoError(true)}
              />
            ) : (
              <LinearGradient colors={[WH, '#E8F7EF']} style={st.avatarPlaceholder}>
                <Text style={st.avatarInitials}>{initials(displayName)}</Text>
              </LinearGradient>
            )}
            <View style={st.onlineDot} />
          </View>

          <Text style={st.heroName}>{displayName}</Text>
          {user?.phone ? (
            <View style={st.heroBadge}>
              <Feather name="phone" size={nz(11)} color={WH} style={{ marginRight: rs(4) }} />
              <Text style={st.heroBadgeText}>{user.phone}</Text>
            </View>
          ) : null}
          {user?.email ? (
            <View style={[st.heroBadge, { marginTop: rs(4) }]}>
              <Feather name="mail" size={nz(11)} color={WH} style={{ marginRight: rs(4) }} />
              <Text style={st.heroBadgeText}>{user.email}</Text>
            </View>
          ) : null}
        </LinearGradient>

        <View style={st.body}>
          {(restaurantName || restaurantLogo) ? (
            <FadeRow delay={120}>
              <Text style={st.sectionTitle}>Restaurant</Text>
              <Card>
                <View style={c.restaurantRow}>
                  {restaurantLogo && !logoError ? (
                    <Image
                      source={{ uri: restaurantLogo }}
                      style={c.restaurantLogo}
                      resizeMode="contain"
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    <View style={c.restaurantLogoPlaceholder}>
                      <Feather name="home" size={nz(22)} color={G1} />
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: rs(12) }}>
                    <Text style={c.restaurantName}>{restaurantName || 'Your Restaurant'}</Text>
                    <View style={c.restaurantBadge}>
                      <View style={c.activeDot} />
                      <Text style={c.restaurantBadgeText}>Active Partner</Text>
                    </View>
                  </View>
                </View>
              </Card>
            </FadeRow>
          ) : null}
          <FadeRow delay={180}>
            <Text style={st.sectionTitle}>Preferences</Text>
            <Card>
              <RowItem
                icon={<Feather name="clock" size={nz(16)} color={G1} />}
                iconBg={G3}
                label="Order History"
                sublabel="View all past orders"
                onPress={() => navigation.navigate('OrderHistory')}
                right={<Feather name="chevron-right" size={nz(16)} color={SB} />}
              />
              <RowItem
                icon={<Feather name="bell" size={nz(16)} color={G1} />}
                iconBg={G3}
                label="Manage Notifications"
                sublabel="Order alerts, promotions & more"
                noBorder
                onPress={() => navigation.navigate('NotificationSettings')}
                right={<Feather name="chevron-right" size={nz(16)} color={SB} />}
              />
            </Card>
          </FadeRow>
          <FadeRow delay={240}>
            <Text style={st.sectionTitle}>Support & Legal</Text>
            <Card>
              <RowItem
                icon={<Feather name="headphones" size={nz(16)} color="#8B5CF6" />}
                iconBg="#F3EFFB"
                label="Help & Support"
                onPress={openSupport}
                right={<Feather name="chevron-right" size={nz(16)} color={SB} />}
              />
              <RowItem
                icon={<Feather name="shield" size={nz(16)} color="#0EA5E9" />}
                iconBg="#EFF8FE"
                label="Privacy Policy"
                onPress={openPrivacyPolicy}
                right={<Feather name="external-link" size={nz(14)} color={SB} />}
              />
              <RowItem
                icon={<MaterialCommunityIcons name="file-document-outline" size={nz(16)} color="#F59E0B" />}
                iconBg="#FFFBEB"
                label="Terms & Conditions"
                onPress={openTerms}
                noBorder
                right={<Feather name="external-link" size={nz(14)} color={SB} />}
              />
            </Card>
          </FadeRow>
          <FadeRow delay={300}>
            <View style={st.logoutSection}>
              <Text style={st.sectionTitle}>Account</Text>
              <Card>
                <CustomLogoutButton />
              </Card>
            </View>
          </FadeRow>

          <FadeRow delay={360}>
            <Text style={st.versionText}>Version 1.0.0</Text>
          </FadeRow>

          <View style={{ height: rs(32) + insets.bottom }} />
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: BG },
  scroll:  { paddingBottom: rs(12) },
  hero: {
    alignItems: 'center',
    paddingBottom: rs(28),
    borderBottomLeftRadius: rs(32),
    borderBottomRightRadius: rs(32),
    overflow: 'hidden',
    minHeight: rs(240),
  },
  deco1: {
    position: 'absolute', width: rs(200), height: rs(200),
    borderRadius: rs(100), backgroundColor: 'rgba(255,255,255,0.06)',
    top: -rs(60), left: -rs(60),
  },
  deco2: {
    position: 'absolute', width: rs(160), height: rs(160),
    borderRadius: rs(80), backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: rs(60), right: -rs(40),
  },
  pulseRing: {
    position: 'absolute',
    width: rs(114), height: rs(114), borderRadius: rs(57),
    backgroundColor: 'rgba(255,255,255,0.15)',
    top: rs(24),
    shadowColor: 'transparent',
    elevation: 0,
  },
  avatarWrap:   { position: 'relative', marginBottom: rs(14) },
  avatar:       { width: rs(96), height: rs(96), borderRadius: rs(48), borderWidth: rs(3), borderColor: WH },
  avatarPlaceholder: {
    width: rs(96), height: rs(96), borderRadius: rs(48),
    alignItems: 'center', justifyContent: 'center',
    borderWidth: rs(3), borderColor: WH,
  },
  avatarInitials: { fontSize: nz(34), fontWeight: '800', color: G1 },
  onlineDot: {
    position: 'absolute', bottom: rs(4), right: rs(4),
    width: rs(16), height: rs(16), borderRadius: rs(8),
    backgroundColor: '#4ADE80', borderWidth: rs(2), borderColor: WH,
  },
  heroName:  { fontSize: nz(22), fontWeight: '800', color: WH, letterSpacing: -0.3, marginBottom: rs(6) },
  heroBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: rs(20), paddingHorizontal: rs(12), paddingVertical: rs(4) },
  heroBadgeText: { fontSize: nz(12), color: WH, fontWeight: '500' },
  body:          { paddingHorizontal: rs(16), paddingTop: rs(22) },
  sectionTitle:  { fontSize: nz(12), fontWeight: '700', color: SB, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: rs(8), marginLeft: rs(4) },
  logoutSection: { marginTop: rs(8), marginBottom: rs(4) },
  logoutButton: { width: '100%' },
  logoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: rs(14),
    paddingHorizontal: rs(16),
    borderRadius: rs(12),
  },
  logoutIconContainer: {
    width: rs(36),
    height: rs(36),
    borderRadius: rs(10),
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: rs(12),
  },
  logoutText: {
    fontSize: nz(16),
    fontWeight: '600',
    color: RD,
    marginRight: rs(8),
  },
  versionText: {
    fontSize: nz(11),
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: rs(16),
    marginBottom: rs(8),
  },
});

const c = StyleSheet.create({
  card: {
    backgroundColor: WH, borderRadius: rs(18),
    marginBottom: rs(16),
    shadowColor: 'transparent', shadowOpacity: 0, elevation: 0,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: rs(13), paddingHorizontal: rs(14),
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BD,
  },
  rowNoBorder:   { borderBottomWidth: 0 },
  rowIconWrap:   { width: rs(36), height: rs(36), borderRadius: rs(10), alignItems: 'center', justifyContent: 'center', marginRight: rs(12) },
  rowMid:        { flex: 1 },
  rowLabel:      { fontSize: nz(14), fontWeight: '600', color: TX },
  rowSub:        { fontSize: nz(11), color: SB, marginTop: rs(2), fontWeight: '400' },
  rowRight:      { marginLeft: rs(8), alignItems: 'center', justifyContent: 'center' },
  restaurantRow: { flexDirection: 'row', alignItems: 'center', padding: rs(14) },
  restaurantLogo: { width: rs(52), height: rs(52), borderRadius: rs(12), backgroundColor: G3 },
  restaurantLogoPlaceholder: { width: rs(52), height: rs(52), borderRadius: rs(12), backgroundColor: G3, alignItems: 'center', justifyContent: 'center' },
  restaurantName: { fontSize: nz(15), fontWeight: '700', color: TX, marginBottom: rs(4) },
  restaurantBadge: { flexDirection: 'row', alignItems: 'center' },
  activeDot:      { width: rs(7), height: rs(7), borderRadius: rs(4), backgroundColor: '#4ADE80', marginRight: rs(5) },
  restaurantBadgeText: { fontSize: nz(12), color: G1, fontWeight: '600' },
});