import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  PixelRatio,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useStore from '../store/useStore';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { getDeviceInfo, determineLoginType } from '../utils/deviceInfo';
import { getFCMToken } from '../utils/fcmToken';
import { authAPI } from '../utils/api';

// ─── Responsive Helpers ───────────────────────────────────────────────────────
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Tablet detection: iPad / Android tablet (width >= 768)
const IS_TABLET = SCREEN_WIDTH >= 768;

// Scale relative to standard 375px phone design
const BASE_WIDTH = 375;
const scale = SCREEN_WIDTH / BASE_WIDTH;

/**
 * normalize(size) — scales font sizes with a tablet cap so text
 * never grows disproportionately large on big screens.
 */
const normalize = (size) => {
  if (IS_TABLET) {
    return Math.round(PixelRatio.roundToNearestPixel(size * 1.22));
  }
  const newSize = size * Math.min(scale, 1.4);
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

const rs = (size) => {
  if (IS_TABLET) return Math.round(size * 1.28);
  return Math.round(size * Math.min(scale, 1.3));
};

const CONTENT_MAX_WIDTH = IS_TABLET ? 500 : SCREEN_WIDTH;

const LOGO_URL = 'https://cdn.alfennzo.com/PartnerConsole/public/logo.png';

const LoginScreen = ({ navigation }) => {
  const [identifier, setIdentifier]           = useState('');
  const [password, setPassword]               = useState('');
  const [loading, setLoading]                 = useState(false);
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [rememberMe, setRememberMe]           = useState(false);
  const [deviceInfo, setDeviceInfo]           = useState(null);
  const [fcmToken, setFcmToken]               = useState(null);
  const [logoError, setLogoError]             = useState(false);

  const insets = useSafeAreaInsets();
  const login  = useStore((state) => state.login);

  useEffect(() => {
    const loadDeviceData = async () => {
      const info  = await getDeviceInfo();
      setDeviceInfo(info);
      const token = await getFCMToken();
      setFcmToken(token);
      console.log('📱 FCM Token in LoginScreen:', token);
    };

    loadDeviceData();

    const tokenRefreshInterval = setInterval(async () => {
      const freshToken = await getFCMToken();
      setFcmToken(freshToken);
      console.log('FCM token refreshed:', freshToken);
    }, 60 * 60 * 1000);

    return () => clearInterval(tokenRefreshInterval);
  }, []);

  const handleLogin = async () => {
    if (!identifier || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      const freshToken    = await getFCMToken();
      const finalFcmToken = freshToken || fcmToken;
      const loginType     = determineLoginType(identifier);

      const loginPayload = {
        [loginType]: identifier,
        password:    password,
        type:        'App',
        fcmToken:    finalFcmToken,
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

      console.log('Login Payload:', JSON.stringify(loginPayload, null, 2));

      const response = await authAPI.login(loginPayload);
      console.log('Login Response:', response);

      if (response && response.status === true) {
        const { data } = response;
        if (data) {
          const userData = {
            id:           data.decryptedId || data.Id,
            restaurantId: data.decryptedId,
            encryptedId:  data.Id,
            phone:        identifier,
          };
          await login(userData, data.accessToken, data.refreshToken);
          Alert.alert('Success', response.message || 'Login successful!');
        } else {
          Alert.alert('Login Failed', 'Invalid response structure');
        }
      } else {
        Alert.alert('Login Failed', response.message || 'Invalid credentials');
      }
    } catch (error) {
      console.error('Login error details:', error);
      let errorMessage = 'Login failed. Please try again.';
      if (error.response) {
        errorMessage =
          error.response.data?.message ||
          error.response.data?.error ||
          `Server error: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = 'No response from server. Check your internet connection.';
      } else {
        errorMessage = error.message || 'An unexpected error occurred';
      }
      Alert.alert('Login Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
        translucent={false}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop:    insets.top + rs(20),
              paddingBottom: insets.bottom + rs(32),
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.card}>

            <View style={styles.logoSection}>
              {!logoError ? (
                <Image
                  source={{ uri: LOGO_URL }}
                  style={styles.logoImage}
                  resizeMode="contain"
                  onError={() => {
                    console.warn('Logo failed to load from CDN');
                    setLogoError(true);
                  }}
                />
              ) : (
                <View style={styles.logoImage} />
              )}
            </View>

            <View style={styles.formSection}>

              <Text style={styles.loginTitle} allowFontScaling={false}>
                Log In
              </Text>

              <View style={styles.inputWrapper}>
                <MaterialIcons
                  name="person-outline"
                  size={normalize(22)}
                  color="#AAAAAA"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Username or Phone"
                  placeholderTextColor="#BBBBBB"
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
                <Feather
                  name="lock"
                  size={normalize(20)}
                  color="#AAAAAA"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#BBBBBB"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={secureTextEntry}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  editable={!loading}
                  allowFontScaling={false}
                  textContentType="password"
                />
                <TouchableOpacity
                  onPress={() => setSecureTextEntry(!secureTextEntry)}
                  style={styles.eyeButton}
                  disabled={loading}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Feather
                    name={secureTextEntry ? 'eye-off' : 'eye'}
                    size={normalize(20)}
                    color="#AAAAAA"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.rowBetween}>
                <TouchableOpacity
                  style={styles.rememberRow}
                  onPress={() => setRememberMe(!rememberMe)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe && (
                      <MaterialIcons
                        name="check"
                        size={normalize(11)}
                        color="#FFFFFF"
                      />
                    )}
                  </View>
                  <Text style={styles.rememberText} allowFontScaling={false}>
                    Remember me
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => Alert.alert('Info', 'Contact your administrator')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.forgotText} allowFontScaling={false}>
                    Forgot password?
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.loginButtonText} allowFontScaling={false}>
                    Log In
                  </Text>
                )}
              </TouchableOpacity>

              <Text style={styles.termsText} allowFontScaling={false}>
                By continuing, I accept the{' '}
                <Text
                  style={styles.termsLink}
                  onPress={() => Alert.alert('Terms', 'Terms & Conditions')}
                >
                  Terms &amp; Conditions
                </Text>
                {' '}and{' '}
                <Text
                  style={styles.termsLink}
                  onPress={() => Alert.alert('Privacy', 'Privacy Policy')}
                >
                  Privacy Policy
                </Text>
              </Text>

            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
};

const styles = StyleSheet.create({

  flex: {
    flex:            1,
    backgroundColor: '#FFFFFF',
  },

  scrollContent: {
    flexGrow:          1,
    alignItems:        'center',
    paddingHorizontal: rs(24),
  },

  card: {
    width:    '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    ...(IS_TABLET && {
      backgroundColor:   '#FFFFFF',
      borderRadius:      rs(24),
      paddingHorizontal: rs(40),
      paddingVertical:   rs(40),
      shadowColor:       '#000000',
      shadowOffset:      { width: 0, height: 6 },
      shadowOpacity:     0.08,
      shadowRadius:      20,
      elevation:         8,
      marginVertical:    rs(20),
    }),
  },

  // ── Logo ─────────────────────────────────────────────────────────────────
  logoSection: {
    alignItems:   'center',
    marginBottom: rs(36),
    marginTop:    rs(8),
  },

  logoImage: {
    width:  rs(200),
    height: rs(90),
    // No tint — display the CDN image as-is
  },

  // ── Form ─────────────────────────────────────────────────────────────────
  formSection: {
    width: '100%',
  },

  loginTitle: {
    fontSize:     normalize(28),
    fontWeight:   '700',
    color:        '#1A1A1A',
    marginBottom: rs(22),
  },

  // Input
  inputWrapper: {
    flexDirection:     'row',
    alignItems:        'center',
    borderWidth:       1.5,
    borderColor:       '#E0E0E0',
    borderRadius:      rs(14),
    height:            rs(54),
    backgroundColor:   '#FFFFFF',
    marginBottom:      rs(14),
    paddingHorizontal: rs(4),
  },
  inputIcon: {
    paddingHorizontal: rs(12),
  },
  input: {
    flex:               1,
    fontSize:           normalize(15),
    color:              '#1A1A1A',
    height:             '100%',
    paddingVertical:    0,
    includeFontPadding: false,
  },
  eyeButton: {
    paddingHorizontal: rs(14),
    justifyContent:    'center',
    alignItems:        'center',
    height:            '100%',
  },

  // Remember me row
  rowBetween: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   rs(28),
    marginTop:      rs(4),
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  checkbox: {
    width:           rs(18),
    height:          rs(18),
    borderWidth:     1.5,
    borderColor:     '#AAAAAA',
    borderRadius:    rs(4),
    marginRight:     rs(8),
    justifyContent:  'center',
    alignItems:      'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#2E8B2E',
    borderColor:     '#2E8B2E',
  },
  rememberText: {
    fontSize: normalize(14),
    color:    '#555555',
  },
  forgotText: {
    fontSize:   normalize(14),
    color:      '#555555',
    fontWeight: '500',
  },

  // Login button
  loginButton: {
    backgroundColor: '#2E8B2E',
    height:          rs(54),
    borderRadius:    rs(14),
    justifyContent:  'center',
    alignItems:      'center',
    marginBottom:    rs(20),
    shadowColor:     '#2E8B2E',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.30,
    shadowRadius:    8,
    elevation:       6,
  },
  loginButtonDisabled: {
    opacity: 0.65,
  },
  loginButtonText: {
    color:         '#FFFFFF',
    fontSize:      normalize(17),
    fontWeight:    '700',
    letterSpacing: 0.3,
  },

  // Terms
  termsText: {
    fontSize:   normalize(13),
    color:      '#555555',
    textAlign:  'left',
    lineHeight: normalize(21),
  },
  termsLink: {
    color:      '#1A9EDE',
    fontWeight: '500',
  },
});

export default LoginScreen;