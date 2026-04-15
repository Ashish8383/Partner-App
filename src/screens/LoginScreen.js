import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  Platform, UIManager, ActivityIndicator,
  StatusBar, Linking, Keyboard,
  Animated, Easing, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useStore from '../store/useStore';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { getDeviceInfo, determineLoginType } from '../utils/deviceInfo';
import { getFCMToken } from '../utils/fcmToken';
import { authAPI, getLogedinDevices } from '../utils/api';
import { decryptData } from '../utils/decrypt';
import SpringButton from '../components/SpringButton';
import ToastMessage from '../components/ToastMessage';
import DeviceSessionsModal from '../components/DeviceSessionsModal ';
import { useResponsive } from '../utils/useResponsive';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const KB_EASING = Easing.bezier(0.25, 0.1, 0.25, 1);

const LoginScreen = () => {
  const { nz, rs, SW, SH, isTablet, isLandscape } = useResponsive();
  const insets = useSafeAreaInsets();

  // usableH: screen height minus system bars
  const usableH    = SH - insets.top - insets.bottom;
  // padBot: safe area + breathing room at the bottom
  const padBot     = insets.bottom + rs(16);

  // ── Sizes ──────────────────────────────────────────────────────────────────
  const logoH = isLandscape
    ? Math.min(SH * 0.32, 130)
    : isTablet ? Math.min(SW * 0.32, 260) : Math.min(SW * 0.50, 280);

  const logoW = isLandscape
    ? Math.min(SW * 0.70, 400)
    : isTablet ? Math.min(SW * 0.95, 580) : SW * 1.0;

  const logoTopM    = rs(isLandscape ? 8  : isTablet ? 40 : 24);
  const logoBottomM = rs(isLandscape ? 4  : 8);
  const formTopM    = rs(12);

  const INPUT_H    = rs(54);
  const INPUT_GAP  = rs(14);
  const PASS_GAP   = rs(20);
  const BUTTON_H   = rs(54);
  const BUTTON_GAP = rs(16);
  const TERMS_H    = rs(44);

  // Total height the form occupies (including its top margin)
  const formAreaH =
    formTopM   +
    INPUT_H    + INPUT_GAP  +
    INPUT_H    + PASS_GAP   +
    BUTTON_H   + BUTTON_GAP +
    TERMS_H;
  const topSectionH  = usableH - padBot - formAreaH;
  const logoAreaH    = isLandscape ? 0 : logoTopM + logoH + logoBottomM; // No logo area in landscape
  const lottieBoost  = Platform.OS === 'ios' ? rs(100) : rs(20);
  const lottieNormal = Math.max(topSectionH - logoAreaH - rs(4) + lottieBoost, isLandscape ? rs(80) : rs(130));

  const calcLottieKeyboard = (kbH) => Math.max(usableH - kbH - formAreaH - rs(8) + (Platform.OS === 'ios' ? rs(60) : 0), isLandscape ? rs(80) : rs(130));

  // ── Animated values ────────────────────────────────────────────────────────
  const slideAnim      = useRef(new Animated.Value(0)).current;
  const logoHeightAnim = useRef(new Animated.Value(logoH)).current;
  const logoMarginAnim = useRef(new Animated.Value(logoBottomM)).current;
  const logoOpacAnim   = useRef(new Animated.Value(1)).current;

  const animateLogo = (show, dur) =>
    Animated.parallel([
      Animated.timing(logoHeightAnim, { toValue: show ? logoH       : 0,          duration: dur,       easing: KB_EASING, useNativeDriver: false }),
      Animated.timing(logoMarginAnim, { toValue: show ? logoBottomM : 0,          duration: dur,       easing: KB_EASING, useNativeDriver: false }),
      Animated.timing(logoOpacAnim,   { toValue: show ? 1           : 0,          duration: dur * 0.8, easing: KB_EASING, useNativeDriver: false }),
    ]).start();

  // ── State ──────────────────────────────────────────────────────────────────
  const [kbVisible,          setKbVisible]          = useState(false);
  const [lottieSize,         setLottieSize]         = useState(lottieNormal);
  const [identifier,         setIdentifier]         = useState('');
  const [password,           setPassword]           = useState('');
  const [loading,            setLoading]            = useState(false);
  const [secureTextEntry,    setSecureTextEntry]    = useState(true);
  const [deviceInfo,         setDeviceInfo]         = useState(null);
  const [showDevicesModal,   setShowDevicesModal]   = useState(false);
  const [devicesData,        setDevicesData]        = useState([]);
  const [pendingCredentials, setPendingCredentials] = useState(null);

  const toastRef       = useRef(null);
  const identifierRef  = useRef(null);
  const passwordRef    = useRef(null);
  const activeInputRef = useRef(null);
  const isFocusing     = useRef(false);
  const hideTimer      = useRef(null);

  // ── Keyboard listeners ─────────────────────────────────────────────────────
  useEffect(() => {
    const onShow = (e) => {
      if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }

      const kbH = e.endCoordinates.height;
      const dur = Platform.OS === 'ios' ? (e.duration || 250) : 280;

      // Update lottie size before the slide so it's already correct when visible
      setLottieSize(calcLottieKeyboard(kbH));
      setKbVisible(true);

      Animated.timing(slideAnim, {
        toValue: -kbH, duration: dur, easing: KB_EASING, useNativeDriver: true,
      }).start();

      // Only animate logo if not in landscape (logo is hidden in landscape anyway)
      if (!isLandscape) {
        animateLogo(false, dur);
      }
    };

    const onHide = (e) => {
      const dur = Platform.OS === 'ios' ? (e.duration || 250) : 280;
      hideTimer.current = setTimeout(() => {
        hideTimer.current = null;
        setKbVisible(false);
        setLottieSize(lottieNormal);

        Animated.timing(slideAnim, {
          toValue: 0, duration: dur, easing: KB_EASING, useNativeDriver: true,
        }).start();

        // Only animate logo if not in landscape
        if (!isLandscape) {
          animateLogo(true, dur);
        }
      }, 120);
    };

    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s1 = Keyboard.addListener(showEvt, onShow);
    const s2 = Keyboard.addListener(hideEvt, onHide);
    return () => {
      s1.remove(); s2.remove();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [lottieNormal, isLandscape]);

  // ── Store ──────────────────────────────────────────────────────────────────
  const login                = useStore((s) => s.login);
  const setProfile           = useStore((s) => s.setProfile);
  const setFcmToken          = useStore((s) => s.setFcmToken);
  const setDeviceFingerprint = useStore((s) => s.setDeviceFingerprint);
  const pendingToast         = useStore((s) => s.pendingToast);
  const clearPendingToast    = useStore((s) => s.clearPendingToast);

  const showToast = (msg, type = 'info', duration = 3500) =>
    toastRef.current?.show({ message: msg, type, duration });

  useEffect(() => {
    if (pendingToast) {
      setTimeout(() => {
        showToast(pendingToast.message, pendingToast.type ?? 'success');
        clearPendingToast();
      }, 300);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      const info  = await getDeviceInfo();
      setDeviceInfo(info);
      const token = await getFCMToken();
      if (token) await setFcmToken(token);
      if (info?.deviceFingerprint) await setDeviceFingerprint(info.deviceFingerprint);
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  const handleDeviceLogoutSuccess = async () => {
    if (pendingCredentials) {
      setShowDevicesModal(false);
      setTimeout(() => performLogin(pendingCredentials), 500);
    }
  };

  const performLogin = async (credentials) => {
    const { identifier: credId, password: credPw } = credentials;
    setLoading(true);
    try {
      const storedToken = useStore.getState().fcmToken;
      const fcmToken    = storedToken ?? (await getFCMToken());
      if (fcmToken && !storedToken) await setFcmToken(fcmToken);

      const response = await authAPI.login({
        [determineLoginType(credId)]: credId,
        password: credPw, type: 'App', fcmToken: fcmToken ?? '',
        deviceFingerprint: deviceInfo?.deviceFingerprint || 'unknown-' + Date.now(),
        deviceInfo: {
          platform:    deviceInfo?.deviceInfo?.platform    || Platform.OS,
          deviceName:  deviceInfo?.deviceInfo?.deviceName  || 'Unknown Device',
          deviceModel: deviceInfo?.deviceInfo?.deviceModel || 'Unknown Model',
          osVersion:   deviceInfo?.deviceInfo?.osVersion   || Platform.Version,
          appVersion:  deviceInfo?.deviceInfo?.appVersion  || '1.0.0',
          userAgent:   deviceInfo?.deviceInfo?.userAgent   || 'Alfennzo Partner App',
        },
      });

      if (response.status === 200) {
        const { data } = response.data;
        if (data) {
          const userData = { id: data.Id, restaurantId: data.decryptedId, encryptedId: data.Id, phone: credId };
          await login(userData, data.accessToken, data.refreshToken);
          try {
            const profileRes = await authAPI.getProfile(userData.id);
            const enc = profileRes?.data?.data;
            if (enc) await setProfile(decryptData(enc));
          } catch {}
          showToast(response.message || 'Login successful!', 'success');
          setPendingCredentials(null);
        } else { showToast('Invalid response structure', 'error'); }
      } else { showToast(response.message || 'Invalid credentials', 'error'); }
    } catch (error) {
      let msg = 'Login failed. Please try again.';
      if (error.response?.data?.message === 'Maximum device login limit reached') {
        try {
          const res = await getLogedinDevices({ identifier: credentials.phone || credentials.username || credId, password: credPw });
          if (res?.data?.sessions) { setDevicesData(res.data.sessions); setPendingCredentials(credentials); setShowDevicesModal(true); return; }
        } catch { msg = 'Failed to fetch device sessions'; }
      } else if (error.response) {
        msg = error.response.data?.message || error.response.data?.error || `Server error: ${error.response.status}`;
      } else if (error.request) { msg = 'No response from server. Check your internet connection.';
      } else { msg = error.message || 'An unexpected error occurred'; }
      showToast(msg, 'error');
    } finally { setLoading(false); }
  };

  const handleLogin = async () => {
    if (!identifier || !password) { showToast('Please fill in all fields', 'warning'); return; }
    await performLogin({ identifier, password });
  };

  const openTerms   = () => Linking.openURL('https://www.alfennzo.com/terms-and-conditions');
  const openPrivacy = () => Linking.openURL('https://www.alfennzo.com/privacy-policy');

  // Show logo only when NOT in landscape mode
  const shouldShowLogo = !isLandscape;

  // Lottie hides on keyboard open only in landscape mode
  const shouldShowLottie = !(isLandscape && kbVisible);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />

      {/* slideAnim: UI-thread native translateY — zero bounce, matches keyboard speed */}
      <Animated.View style={[s.flex, { transform: [{ translateY: slideAnim }] }]}>
        <View
          style={[s.container, { paddingBottom: padBot }]}
          onStartShouldSetResponder={() => true}
          onResponderRelease={() => {
            if (isFocusing.current) return;
            activeInputRef.current?.blur();
          }}
        >

          {/* ── TOP SECTION ─────────────────────────────────────────────────
              flex:1 fills space above form.
              justifyContent:'flex-end' pins logo+lottie to the BOTTOM of this
              section — directly above form. After translateY(-kbH), lottie
              is still directly above form, so it stays on screen as long as
              form stays on screen.                                          */}
          <View style={s.topSection}>

            {/* Logo — Only shown when NOT in landscape mode */}
            {shouldShowLogo && (
              <Animated.View style={{
                width:        '100%',
                height:       logoHeightAnim,
                marginTop:    logoTopM,
                marginBottom: logoMarginAnim,
                opacity:      logoOpacAnim,
                overflow:     'hidden',
                alignItems:   'center',
                justifyContent: 'center',
              }}>
                <Image
                  source={require('../../assets/logo.png')}
                  style={{ width: logoW, height: logoH }}
                  resizeMode="contain"
                />
              </Animated.View>
            )}

            {/* Lottie — Hidden on landscape when keyboard opens */}
            {shouldShowLottie && (
              <View style={{ width: lottieSize, height: lottieSize }}>
                <LottieView
                  source={require('../../assets/login.json')}
                  autoPlay loop
                  style={StyleSheet.absoluteFill}
                  resizeMode="contain"
                />
              </View>
            )}

          </View>

          {/* ── FORM ──────────────────────────────────────────────────────── */}
          <View style={[
            s.formWrap,
            {
              marginTop: formTopM,
              width:     isTablet ? Math.min(SW, 520) : '100%',
              alignSelf: isTablet ? 'center' : 'stretch',
            },
          ]}>

            {/* Username */}
            <View style={[s.inputRow, { height: INPUT_H, borderRadius: rs(14), marginBottom: INPUT_GAP }]}>
              <MaterialIcons name="person-outline" size={nz(22)} color="#4a4848" style={{ paddingHorizontal: rs(12) }} />
              <TextInput
                ref={identifierRef}
                style={[s.input, { fontSize: nz(15) }]}
                placeholder="Username or Phone number"
                placeholderTextColor="#7c7c7cbf"
                value={identifier}
                onChangeText={setIdentifier}
                keyboardType="default"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                editable={!loading}
                allowFontScaling={false}
                textContentType="username"
                onFocus={() => {
                  isFocusing.current = true;
                  activeInputRef.current = identifierRef.current;
                  setTimeout(() => { isFocusing.current = false; }, 50);
                }}
                onBlur={() => { activeInputRef.current = null; }}
              />
            </View>

            {/* Password */}
            <View style={[s.inputRow, { height: INPUT_H, borderRadius: rs(14), marginBottom: PASS_GAP }]}>
              <Feather name="lock" size={nz(20)} color="#4a4848" style={{ paddingHorizontal: rs(12) }} />
              <TextInput
                ref={passwordRef}
                style={[s.input, { fontSize: nz(15) }]}
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
                onFocus={() => {
                  isFocusing.current = true;
                  activeInputRef.current = passwordRef.current;
                  setTimeout(() => { isFocusing.current = false; }, 50);
                }}
                onBlur={() => { activeInputRef.current = null; }}
              />
              <SpringButton
                onPress={() => setSecureTextEntry(v => !v)}
                style={{ paddingHorizontal: rs(14), justifyContent: 'center', alignItems: 'center', height: INPUT_H }}
                disabled={loading}
              >
                <Feather name={secureTextEntry ? 'eye-off' : 'eye'} size={nz(20)} color="#7c7c7c" />
              </SpringButton>
            </View>

            {/* Continue */}
            <SpringButton
              onPress={handleLogin}
              disabled={loading}
              style={[s.loginBtn, {
                height:       BUTTON_H,
                borderRadius: rs(13),
                marginBottom: kbVisible ? 0 : BUTTON_GAP,
              }]}
            >
              {loading
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <Text style={{ color: '#FFFFFF', fontSize: nz(17), fontWeight: '700', letterSpacing: 0.3 }} allowFontScaling={false}>
                    Continue
                  </Text>
              }
            </SpringButton>

            {/* Terms — hidden when keyboard visible */}
            {!kbVisible && (
              <Text style={[s.terms, { fontSize: nz(13) }]} allowFontScaling={false}>
                By clicking on continue, I accept the{' '}
                <Text style={s.termsLink} onPress={openTerms}>Terms &amp; Conditions</Text>
                {' '}&amp;{' '}
                <Text style={s.termsLink} onPress={openPrivacy}>Privacy Policy</Text>
              </Text>
            )}

          </View>
        </View>
      </Animated.View>

      {/* DeviceSessionsModal and ToastMessage sit OUTSIDE the Animated.View
          so translateY never affects their position on screen */}
      <DeviceSessionsModal
        visible={showDevicesModal}
        onClose={() => { setShowDevicesModal(false); setPendingCredentials(null); }}
        devices={devicesData}
        identifier={pendingCredentials?.identifier}
        password={pendingCredentials?.password}
        onDeviceLoggedOut={handleDeviceLogoutSuccess}
        toastRef={toastRef}
      />

      <ToastMessage ref={toastRef} />
    </View>
  );
};

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#FFFFFF' },
  flex:       { flex: 1 },
  container:  { flex: 1, alignItems: 'center', paddingHorizontal: 24 },
  // topSection: fills all space above the form.
  // justifyContent:'flex-end' keeps logo+lottie glued to the BOTTOM of this
  // section (= top of form) so translateY never pushes lottie off screen.
  topSection: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', width: '100%' },
  formWrap:   { width: '100%' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#7c7c7c',
    backgroundColor: '#FFFFFF', paddingHorizontal: 4,
  },
  input: {
    flex: 1, color: '#151313', height: '100%',
    paddingVertical: 0, includeFontPadding: false,
  },
  loginBtn: {
    backgroundColor: '#03954E', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#03954E', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  terms:     { color: '#555555', textAlign: 'left', lineHeight: 22, width: '100%', paddingBottom: 8 },
  termsLink: { color: '#1A9EDE', fontWeight: '500' },
});

export default LoginScreen;