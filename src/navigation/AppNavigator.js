import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import * as SplashScreen from 'expo-splash-screen';

import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import OrderHistoryScreen from '../screens/OrderHistoryScreen';
import BottomTabs from '../components/BottomTabs';
import LogoutButton from '../components/LogoutButton';
import useStore from '../store/useStore';
import { COLORS } from '../constants/theme';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Keep native splash visible — hide it only after auth state is known
SplashScreen.preventAutoHideAsync();

// ─── Main Tabs ────────────────────────────────────────────────────────────────
const MainTabs = () => (
  <Tab.Navigator
    tabBar={(props) => <BottomTabs {...props} />}
    screenOptions={{
      headerStyle:      { backgroundColor: COLORS.primary },
      headerTintColor:  COLORS.white,
      headerTitleStyle: { fontWeight: 'bold' },
    }}
  >
    <Tab.Screen
      name="Home"
      component={HomeScreen}
      options={{
        title:       'Live Orders',
        headerRight: () => <LogoutButton variant="header" />,
      }}
    />
    <Tab.Screen
      name="History"
      component={OrderHistoryScreen}
      options={{
        title:       'Order History',
        headerRight: () => <LogoutButton variant="header" />,
      }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileScreen}
      options={{
        title:       'My Profile',
        headerRight: () => <LogoutButton variant="header" />,
      }}
    />
  </Tab.Navigator>
);

// ─── Root Navigator ───────────────────────────────────────────────────────────
const AppNavigator = () => {
  const isAuthenticated    = useStore((state) => state.isAuthenticated);
  const loadPersistedState = useStore((state) => state.loadPersistedState);

  // appReady = true only after loadPersistedState() has fully resolved.
  // Until then: splash stays visible, NavigationContainer does NOT mount.
  const [appReady, setAppReady] = useState(false);

  // ── Step 1: Call your existing loadPersistedState on mount ───────────────
  useEffect(() => {
    const bootstrap = async () => {
      try {
        // This reads user + token from your custom storage and calls set()
        // so isAuthenticated is correct BEFORE we render anything.
        await loadPersistedState();
      } catch (e) {
        // Never block the app on a storage error
        console.warn('Failed to load persisted auth state:', e);
      } finally {
        // Auth state is now known — allow render
        setAppReady(true);
      }
    };

    bootstrap();
  }, []);

  // ── Step 2: Hide splash only after the correct screen has painted ────────
  // onLayout fires once the NavigationContainer has measured and painted.
  // At this point the user sees the right screen (Login or Main) instantly
  // as the splash disappears — zero flash, zero white screen.
  const onRootLayout = useCallback(async () => {
    if (appReady) {
      await SplashScreen.hideAsync();
    }
  }, [appReady]);

  // While loadPersistedState() is running → keep splash visible, render nothing
  if (!appReady) return null;

  return (
    <View style={styles.root} onLayout={onRootLayout}>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown:      false,
            // No animation on first render — avoids any slide/fade glitch
            animationEnabled: false,
          }}
        >
          {!isAuthenticated
            ? <Stack.Screen name="Login" component={LoginScreen} />
            : <Stack.Screen name="Main"  component={MainTabs}   />
          }
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default AppNavigator;