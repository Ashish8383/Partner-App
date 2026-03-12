import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import * as SplashScreen from 'expo-splash-screen';
import LoginScreen          from '../screens/LoginScreen';
import HomeScreen           from '../screens/HomeScreen';
import ProductScreen        from '../screens/ProductScreen';
import ProfileScreen        from '../screens/ProfileScreen';
import BottomTabs           from '../components/BottomTabs';
import useStore             from '../store/useStore';
import NotificationScreen from '../screens/Notification';
import OrderHistoryScreen from '../screens/OrderHistoryScreen';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

SplashScreen.preventAutoHideAsync();

const MainTabs = () => (
  <Tab.Navigator
    tabBar={(props) => <BottomTabs {...props} />}
    screenOptions={{ headerShown: false }}
  >
    <Tab.Screen name="Home"     component={HomeScreen}    />
    <Tab.Screen name="List"     component={ProductScreen} />
    <Tab.Screen name="Settings" component={ProfileScreen} />
  </Tab.Navigator>
);

const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Main"                 component={MainTabs}          />
    <Stack.Screen
      name="NotificationSettings"
      component={NotificationScreen}
      options={{ animation: 'slide_from_right' }}   
    />
    <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
  </Stack.Navigator>
);

const AppNavigator = ({ onStateChange }) => {
  const isAuthenticated    = useStore((state) => state.isAuthenticated);
  const loadPersistedState = useStore((state) => state.loadPersistedState);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await loadPersistedState();
      } catch (e) {
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
      <NavigationContainer onStateChange={onStateChange}>
        <Stack.Navigator screenOptions={{ headerShown: false, animationEnabled: false }}>
          {!isAuthenticated
            ? <Stack.Screen name="Login" component={LoginScreen} />
            : <Stack.Screen name="Auth"  component={AuthStack}   />
          }
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
};

const styles = StyleSheet.create({ root: { flex: 1 } });

export default AppNavigator;