import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import {Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export const useNotificationListener = () => {
  const navigation = useNavigation();
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      const { title, body, data } = notification.request.content;
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

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const { data } = response.notification.request.content;
      if (data?.type === 'new_order' || data?.type === 'order_update') {
        navigation.navigate('OrderDetails', { orderId: data.orderId });
      } else if (data?.type === 'chat') {
        navigation.navigate('Chat');
      } else if (data?.type === 'payment') {
        navigation.navigate('Earnings');
      }
    });

    checkInitialNotification();

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, [navigation]);

  const checkInitialNotification = async () => {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (response) {
      const { data } = response.notification.request.content;
      setTimeout(() => {
        if (data?.type === 'new_order') {
          navigation.navigate('OrderDetails', { orderId: data.orderId });
        }
      }, 1000);
    }
  };
};