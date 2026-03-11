import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Image, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Dimensions, StatusBar, PixelRatio,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useStore from '../store/useStore';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { getDeviceInfo, determineLoginType } from '../utils/deviceInfo';
import { getFCMToken } from '../utils/fcmToken';
import { authAPI } from '../utils/api';
import { decryptData } from '../utils/decrypt';
import SpringButton from '../components/SpringButton';
import ToastMessage from '../components/ToastMessage';

// ─── Responsive ───────────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_TABLET  = SCREEN_WIDTH >= 768;
const BASE_WIDTH = 375;
const scale      = SCREEN_WIDTH / BASE_WIDTH;

const normalize = (size) => {
  if (IS_TABLET) return Math.round(PixelRatio.roundToNearestPixel(size * 1.22));
  return Math.round(PixelRatio.roundToNearestPixel(size * Math.min(scale, 1.4)));
};
const rs = (size) => {
  if (IS_TABLET) return Math.round(size * 1.28);
  return Math.round(size * Math.min(scale, 1.3));
};

const CONTENT_MAX_WIDTH = IS_TABLET ? 500 : SCREEN_WIDTH;
const HERO_WIDTH        = SCREEN_WIDTH;
const HERO_HEIGHT       = Math.round(HERO_WIDTH / (370 / 380));

// ─── Screen ───────────────────────────────────────────────────────────────────
const LoginScreen = () => {
  const [identifier,      setIdentifier]      = useState('');
  const [password,        setPassword]        = useState('');
  const [loading,         setLoading]         = useState(false);
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [rememberMe,      setRememberMe]      = useState(false);
  const [deviceInfo,      setDeviceInfo]      = useState(null);

  const toastRef   = useRef(null);
  const insets     = useSafeAreaInsets();
  const login      = useStore((s) => s.login);
  const setProfile = useStore((s) => s.setProfile);
  const setFcmToken          = useStore((s) => s.setFcmToken);
  const setDeviceFingerprint = useStore((s) => s.setDeviceFingerprint);
  const pendingToast         = useStore((s) => s.pendingToast);
  const clearPendingToast    = useStore((s) => s.clearPendingToast);

  const showToast = (message, type = 'info', duration = 3500) => {
    toastRef.current?.show({ message, type, duration });
  };

  // ── Show any pending toast from previous screen (e.g. logout success) ──────
  useEffect(() => {
    if (pendingToast) {
      // Small delay so ToastMessage ref is ready
      setTimeout(() => {
        showToast(pendingToast.message, pendingToast.type ?? 'success');
        clearPendingToast();
      }, 300);
    }
  }, []);

  // ── Load device info + FCM token ONCE on mount, store in zustand ──────────
  useEffect(() => {
    const init = async () => {
      const info  = await getDeviceInfo();
      setDeviceInfo(info);

      const token = await getFCMToken();
      if (token) await setFcmToken(token);
      if (info?.deviceFingerprint) await setDeviceFingerprint(info.deviceFingerprint);
    };
    init();

    // Refresh FCM token every hour in background (still stored in zustand)
    const interval = setInterval(async () => {
      const fresh = await getFCMToken();
      if (fresh) await setFcmToken(fresh);
    }, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const handleLogin = async () => {
    if (!identifier || !password) {
      showToast('Please fill in all fields', 'warning');
      return;
    }

    setLoading(true);
    try {
      // ── Use token from store — no re-generation on every login press ───────
      const storedToken = useStore.getState().fcmToken;
      const fcmToken    = storedToken ?? (await getFCMToken());
      if (fcmToken && !storedToken) await setFcmToken(fcmToken); // store if first time

      const loginType    = determineLoginType(identifier);
      const loginPayload = {
        [loginType]: identifier,
        password,
        type:     'App',
        fcmToken: fcmToken ?? '',
        deviceFingerprint: deviceInfo?.deviceFingerprint || 'unknown-' + Date.now(),
        deviceInfo: {
          platform:    deviceInfo?.deviceInfo?.platform    || Platform.OS,
          deviceName:  deviceInfo?.deviceInfo?.deviceName  || 'Unknown Device',
          deviceModel: deviceInfo?.deviceInfo?.deviceModel || 'Unknown Model',
          osVersion:   deviceInfo?.deviceInfo?.osVersion   || Platform.Version,
          appVersion:  deviceInfo?.deviceInfo?.appVersion  || '1.0.0',
          userAgent:   deviceInfo?.deviceInfo?.userAgent   || 'Alfennzo Partner App',
        },
      };

      const response = await authAPI.login(loginPayload);

      if (response.status === 200) {
        const { data } = response.data;
        if (data) {
          const userData = {
            id:           data.Id,
            restaurantId: data.decryptedId,
            encryptedId:  data.Id,
            phone:        identifier,
          };

          await login(userData, data.accessToken, data.refreshToken);

          try {
            const profileRes       = await authAPI.getProfile(userData.id);
            const encryptedPayload = profileRes?.data?.data;
            if (encryptedPayload) {
              const profileData = decryptData(encryptedPayload);
              await setProfile(profileData);
            }
          } catch (profileErr) {
            console.warn('getProfile / decrypt failed:', profileErr?.message);
          }

          showToast(response.message || 'Login successful!', 'success');
        } else {
          showToast('Invalid response structure', 'error');
        }
      } else {
        showToast(response.message || 'Invalid credentials', 'error');
      }
    } catch (error) {
      let errorMessage = 'Login failed. Please try again.';
      if (error.response) {
        errorMessage = error.response.data?.message || error.response.data?.error || `Server error: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = 'No response from server. Check your internet connection.';
      } else {
        errorMessage = error.message || 'An unexpected error occurred';
      }
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#03954E" translucent={false} />

      {Platform.OS === 'ios' && (
        <View style={[styles.iosStatusBar, { height: insets.top }]} />
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.heroContainer}>
            <Image
              source={require('../../assets/login.webp')}
              style={styles.heroImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.formCard}>

            <View style={styles.inputWrapper}>
              <MaterialIcons name="person-outline" size={normalize(22)} color="#4a4848" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Username or Phone number"
                placeholderTextColor="#7c7c7cbf"
                value={identifier}
                onChangeText={setIdentifier}
                keyboardType="default"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                editable={!loading}
                allowFontScaling={false}
                textContentType="username"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Feather name="lock" size={normalize(20)} color="#4a4848" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#7c7c7cbf"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={secureTextEntry}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                editable={!loading}
                allowFontScaling={false}
                textContentType="password"
              />
              <SpringButton onPress={() => setSecureTextEntry(!secureTextEntry)} style={styles.eyeButton} disabled={loading}>
                <Feather name={secureTextEntry ? 'eye-off' : 'eye'} size={normalize(20)} color="#7c7c7c" />
              </SpringButton>
            </View>

            <View style={styles.rowBetween}>
              <SpringButton onPress={() => setRememberMe(!rememberMe)} style={styles.rememberRow}>
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <MaterialIcons name="check" size={normalize(11)} color="#FFFFFF" />}
                </View>
                <Text style={styles.rememberText} allowFontScaling={false}>Remember me</Text>
              </SpringButton>

              <SpringButton onPress={() => showToast('Contact your administrator to reset your password', 'info')}>
                <Text style={styles.forgotText} allowFontScaling={false}>Forgot Password?</Text>
              </SpringButton>
            </View>

            <SpringButton onPress={handleLogin} disabled={loading} style={styles.loginButton}>
              {loading
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <Text style={styles.loginButtonText} allowFontScaling={false}>Continue</Text>}
            </SpringButton>

            <Text style={[styles.termsText, { paddingBottom: insets.bottom + rs(16) }]} allowFontScaling={false}>
              By clicking on continue, I accept the{' '}
              <Text style={styles.termsLink} onPress={() => showToast('Terms & Conditions apply', 'info')}>Terms &amp; Conditions</Text>
              {' '}&amp;{'\n'}
              <Text style={styles.termsLink} onPress={() => showToast('Privacy Policy applies', 'info')}>Privacy Policy</Text>
            </Text>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ToastMessage ref={toastRef} />
    </View>
  );
};

const styles = StyleSheet.create({
  root:            { flex: 1, backgroundColor: '#FFFFFF' },
  flex:            { flex: 1 },
  scrollContent:   { flexGrow: 1, paddingHorizontal: 0 },
  iosStatusBar:    { backgroundColor: '#03954E', width: '100%' },
  heroContainer:   { width: HERO_WIDTH, height: HERO_HEIGHT, alignSelf: 'stretch', marginHorizontal: 0 },
  heroImage:       { width: SCREEN_WIDTH, height: '100%', marginLeft: 0, marginRight: 0 },
  formCard: {
    flex: 1, backgroundColor: '#FFFFFF',
    paddingHorizontal: rs(24), paddingTop: rs(28),
    ...(IS_TABLET && {
      alignSelf: 'center', width: CONTENT_MAX_WIDTH, borderRadius: rs(24),
      shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.06, shadowRadius: 12, elevation: 6,
    }),
  },
  inputWrapper:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#7c7c7c', borderRadius: rs(14), height: rs(54), backgroundColor: '#FFFFFF', marginBottom: rs(14), paddingHorizontal: rs(4) },
  inputIcon:       { paddingHorizontal: rs(12) },
  input:           { flex: 1, fontSize: normalize(15), color: '#151313', height: '100%', paddingVertical: 0, includeFontPadding: false },
  eyeButton:       { paddingHorizontal: rs(14), justifyContent: 'center', alignItems: 'center', height: rs(44) },
  rowBetween:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(28), marginTop: rs(2) },
  rememberRow:     { flexDirection: 'row', alignItems: 'center' },
  checkbox:        { width: rs(18), height: rs(18), borderWidth: 1.5, borderColor: '#AAAAAA', borderRadius: rs(4), marginRight: rs(8), justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  checkboxChecked: { backgroundColor: '#03954E', borderColor: '#03954E' },
  rememberText:    { fontSize: normalize(14), color: '#555555' },
  forgotText:      { fontSize: normalize(14), color: '#03954E', fontWeight: '500' },
  loginButton:     { backgroundColor: '#03954E', height: rs(54), borderRadius: rs(13), justifyContent: 'center', alignItems: 'center', marginBottom: rs(20), shadowColor: '#03954E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  loginButtonText: { color: '#FFFFFF', fontSize: normalize(17), fontWeight: '700', letterSpacing: 0.3 },
  termsText:       { fontSize: normalize(13), color: '#555555', textAlign: 'left', lineHeight: normalize(22) },
  termsLink:       { color: '#1A9EDE', fontWeight: '500' },
});

export default LoginScreen;