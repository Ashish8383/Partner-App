import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import * as SplashScreen from 'expo-splash-screen';

import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import OrderHistoryScreen from '../screens/OrderHistoryScreen';
import BottomTabs from '../components/BottomTabs';
import useStore from '../store/useStore';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

SplashScreen.preventAutoHideAsync();

// ── 2-tab navigator: Home + List ─────────────────────────────────────────────
const MainTabs = () => (
  <Tab.Navigator
    tabBar={(props) => <BottomTabs {...props} />}
    screenOptions={{ headerShown: false }}
  >
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="List" component={OrderHistoryScreen} />
    <Tab.Screen name="Settings" component={OrderHistoryScreen} />
  </Tab.Navigator>
);

// ── Root navigator ────────────────────────────────────────────────────────────
const AppNavigator = () => {
  const isAuthenticated    = useStore((state) => state.isAuthenticated);
  const loadPersistedState = useStore((state) => state.loadPersistedState);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await loadPersistedState();
      } catch (e) {
        console.warn('Failed to load persisted auth state:', e);
      } finally {
        setAppReady(true);
      }
    };
    bootstrap();
  }, []);

  const onRootLayout = useCallback(async () => {
    if (appReady) await SplashScreen.hideAsync();
  }, [appReady]);

  if (!appReady) return null;

  return (
    <View style={styles.root} onLayout={onRootLayout}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, animationEnabled: false }}>
          {!isAuthenticated
            ? <Stack.Screen name="Login" component={LoginScreen} />
            : <Stack.Screen name="Main"  component={MainTabs}   />
          }
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
};

const styles = StyleSheet.create({ root: { flex: 1 } });

export default AppNavigator;