import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export const useNotificationListener = () => {
  const navigation = useNavigation();
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    // Listener for foreground notifications
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Foreground notification:', notification);
      
      const { title, body, data } = notification.request.content;
      
      // Show in-app alert for important notifications
      if (data?.type === 'new_order') {
        Alert.alert(
          title || 'New Order!',
          body || 'You have a new order to accept',
          [
            {
              text: 'View Order',
              onPress: () => navigation.navigate('OrderDetails', { orderId: data.orderId })
            },
            { text: 'Dismiss', style: 'cancel' }
          ]
        );
      }
    });

    // Listener for when user taps notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);
      
      const { data } = response.notification.request.content;
      
      // Navigate based on notification data
      if (data?.type === 'new_order' || data?.type === 'order_update') {
        navigation.navigate('OrderDetails', { orderId: data.orderId });
      } else if (data?.type === 'chat') {
        navigation.navigate('Chat');
      } else if (data?.type === 'payment') {
        navigation.navigate('Earnings');
      }
    });

    // Check for initial notification that launched app
    checkInitialNotification();

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, [navigation]);

  const checkInitialNotification = async () => {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (response) {
      console.log('App launched from notification:', response);
      const { data } = response.notification.request.content;
      
      // Handle initial navigation
      setTimeout(() => {
        if (data?.type === 'new_order') {
          navigation.navigate('OrderDetails', { orderId: data.orderId });
        }
      }, 1000);
    }
  };
};