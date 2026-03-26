/**
 * LoginScreen.jsx — Responsive for phones, iPad portrait & landscape.
 *
 * Key changes:
 *  • useResponsive() replaces static Dimensions.get().
 *  • On tablets, form is centred with a max width of 520 dp.
 *  • Hero image height is derived from live SW so it never overflows in landscape.
 *  • KeyboardAvoidingView offset aware of orientation.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Image, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, StatusBar, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useStore from '../store/useStore';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { getDeviceInfo, determineLoginType } from '../utils/deviceInfo';
import { getFCMToken } from '../utils/fcmToken';
import { authAPI, getLogedinDevices } from '../utils/api';
import { decryptData } from '../utils/decrypt';
import SpringButton from '../components/SpringButton';
import ToastMessage from '../components/ToastMessage';
import DeviceSessionsModal from '../components/DeviceSessionsModal ';
import { useResponsive } from '../utils/useResponsive';

const LoginScreen = () => {
  const { SW, SH, nz, rs, isTablet, isLandscape } = useResponsive();

  // Hero image: full width but capped in landscape so the form stays visible
  const HERO_W  = SW;
  const HERO_H  = isLandscape
    ? Math.round(SH * 0.38)                     // landscape: only 38% of height
    : Math.round(SW / (370 / 380));              // portrait: original aspect ratio
  const FORM_MAX_W = isTablet ? 520 : SW;

  const [identifier,        setIdentifier]        = useState('');
  const [password,          setPassword]          = useState('');
  const [loading,           setLoading]           = useState(false);
  const [secureTextEntry,   setSecureTextEntry]   = useState(true);
  const [deviceInfo,        setDeviceInfo]        = useState(null);
  const [showDevicesModal,  setShowDevicesModal]  = useState(false);
  const [devicesData,       setDevicesData]       = useState([]);
  const [pendingCredentials,setPendingCredentials]= useState(null);
  const toastRef = useRef(null);
  const insets   = useSafeAreaInsets();
  const login                = useStore((s) => s.login);
  const setProfile           = useStore((s) => s.setProfile);
  const setFcmToken          = useStore((s) => s.setFcmToken);
  const setDeviceFingerprint = useStore((s) => s.setDeviceFingerprint);
  const pendingToast         = useStore((s) => s.pendingToast);
  const clearPendingToast    = useStore((s) => s.clearPendingToast);

  const showToast = (message, type = 'info', duration = 3500) => {
    toastRef.current?.show({ message, type, duration });
  };

  useEffect(() => {
    if (pendingToast) {
      setTimeout(() => {
        showToast(pendingToast.message, pendingToast.type ?? 'success');
        clearPendingToast();
      }, 300);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const info  = await getDeviceInfo();
      setDeviceInfo(info);
      const token = await getFCMToken();
      if (token) await setFcmToken(token);
      if (info?.deviceFingerprint) await setDeviceFingerprint(info.deviceFingerprint);
    }, 2000);
    return () => clearTimeout(timer);
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

      const loginType    = determineLoginType(credId);
      const loginPayload = {
        [loginType]: credId,
        password: credPw,
        type: 'App',
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
          const userData = { id: data.Id, restaurantId: data.decryptedId, encryptedId: data.Id, phone: credId };
          await login(userData, data.accessToken, data.refreshToken);
          try {
            const profileRes = await authAPI.getProfile(userData.id);
            const enc = profileRes?.data?.data;
            if (enc) await setProfile(decryptData(enc));
          } catch {}
          showToast(response.message || 'Login successful!', 'success');
          setPendingCredentials(null);
        } else {
          showToast('Invalid response structure', 'error');
        }
      } else {
        showToast(response.message || 'Invalid credentials', 'error');
      }
    } catch (error) {
      let msg = 'Login failed. Please try again.';
      if (error.response?.data?.message === 'Maximum device login limit reached') {
        try {
          const res = await getLogedinDevices({ identifier: credentials.phone || credentials.username || credId, password: credPw });
          if (res?.data?.sessions) {
            setDevicesData(res.data.sessions);
            setPendingCredentials(credentials);
            setShowDevicesModal(true);
            return;
          }
        } catch { msg = 'Failed to fetch device sessions'; }
      } else if (error.response) {
        msg = error.response.data?.message || error.response.data?.error || `Server error: ${error.response.status}`;
      } else if (error.request) {
        msg = 'No response from server. Check your internet connection.';
      } else {
        msg = error.message || 'An unexpected error occurred';
      }
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!identifier || !password) { showToast('Please fill in all fields', 'warning'); return; }
    await performLogin({ identifier, password });
  };

  const openTerms   = () => Linking.openURL('https://www.alfennzo.com/terms-and-conditions');
  const openPrivacy = () => Linking.openURL('https://www.alfennzo.com/privacy-policy');

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#03954E" translucent={false} />

      {Platform.OS === 'ios' && (
        <View style={[s.iosBar, { height: insets.top, backgroundColor: '#03954E' }]} />
      )}

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={s.flex}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Hero */}
          {!isLandscape&&<Image
            source={require('../../assets/login.webp')}
            style={{ width: HERO_W, height: HERO_H, alignSelf: 'stretch' }}
            resizeMode="contain"
          />}
          {isLandscape&&<View style={{ height: rs(150) }} />}

          {/* Form — centred & width-capped on tablet */}
          <View style={[s.formCard, {
            paddingHorizontal: rs(24), paddingTop: rs(28),
            alignSelf: isTablet ? 'center' : 'stretch',
            width: isTablet ? Math.min(SW, FORM_MAX_W) : undefined,
          }]}>
            {/* Username field */}
            <View style={[s.inputWrap, { borderRadius: rs(14), height: rs(54), marginBottom: rs(14), paddingHorizontal: rs(4) }]}>
              <MaterialIcons name="person-outline" size={nz(22)} color="#4a4848" style={{ paddingHorizontal: rs(12) }} />
              <TextInput
                style={[s.input, { fontSize: nz(15) }]}
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

            {/* Password field */}
            <View style={[s.inputWrap, { borderRadius: rs(14), height: rs(54), marginBottom: rs(14), paddingHorizontal: rs(4) }]}>
              <Feather name="lock" size={nz(20)} color="#4a4848" style={{ paddingHorizontal: rs(12) }} />
              <TextInput
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
              />
              <SpringButton onPress={() => setSecureTextEntry(!secureTextEntry)} style={{ paddingHorizontal: rs(14), justifyContent: 'center', alignItems: 'center', height: rs(44) }} disabled={loading}>
                <Feather name={secureTextEntry ? 'eye-off' : 'eye'} size={nz(20)} color="#7c7c7c" />
              </SpringButton>
            </View>

            {/* CTA */}
            <SpringButton onPress={handleLogin} disabled={loading} style={[s.loginBtn, { height: rs(54), borderRadius: rs(13), marginBottom: rs(20) }]}>
              {loading
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <Text style={{ color: '#FFFFFF', fontSize: nz(17), fontWeight: '700', letterSpacing: 0.3 }} allowFontScaling={false}>Continue</Text>}
            </SpringButton>

            <Text style={[s.terms, { fontSize: nz(13), paddingBottom: insets.bottom + rs(16) }]} allowFontScaling={false}>
              By clicking on continue, I accept the{' '}
              <Text style={s.termsLink} onPress={openTerms}>Terms &amp; Conditions</Text>
              {' '}&amp;{'\n'}
              <Text style={s.termsLink} onPress={openPrivacy}>Privacy Policy</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
  root:      { flex: 1, backgroundColor: '#FFFFFF' },
  flex:      { flex: 1 },
  scroll:    { flexGrow: 1 },
  iosBar:    { width: '100%' },
  formCard:  { flex: 1, backgroundColor: '#FFFFFF' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#7c7c7c', backgroundColor: '#FFFFFF' },
  input:     { flex: 1, color: '#151313', height: '100%', paddingVertical: 0, includeFontPadding: false },
  loginBtn:  { backgroundColor: '#03954E', justifyContent: 'center', alignItems: 'center', shadowColor: '#03954E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  terms:     { color: '#555555', textAlign: 'left', lineHeight: 22 },
  termsLink: { color: '#1A9EDE', fontWeight: '500' },
});

export default LoginScreen;