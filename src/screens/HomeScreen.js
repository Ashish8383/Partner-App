import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';
import useStore from '../store/useStore';
import { ordersAPI } from '../utils/api';

const HomeScreen = ({ navigation }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const liveOrders = useStore((state) => state.liveOrders);
  const setLiveOrders = useStore((state) => state.setLiveOrders);
  const updateOrderStatus = useStore((state) => state.updateOrderStatus);

  const fetchLiveOrders = async () => {
    try {
      // Mock data for demonstration
      const mockOrders = [
        {
          id: '1',
          customerName: 'John Smith',
          address: '123 Main St, City',
          items: ['Pizza', 'Coke'],
          total: '$25.50',
          status: 'pending',
          time: '5 min ago',
        },
        {
          id: '2',
          customerName: 'Sarah Johnson',
          address: '456 Oak Ave, Town',
          items: ['Burger', 'Fries'],
          total: '$18.75',
          status: 'accepted',
          time: '12 min ago',
        },
        {
          id: '3',
          customerName: 'Mike Wilson',
          address: '789 Pine Rd, Village',
          items: ['Sushi', 'Miso Soup'],
          total: '$32.00',
          status: 'ready',
          time: '20 min ago',
        },
      ];
      
      setLiveOrders(mockOrders);
    } catch (error) {
      console.error('Error fetching live orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLiveOrders();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchLiveOrders();
    
    // Simulate real-time updates
    const interval = setInterval(() => {
      // In real app, you'd fetch new orders here
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleAcceptOrder = (orderId) => {
    updateOrderStatus(orderId, 'accepted');
    // In real app, you'd call API here
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return COLORS.warning;
      case 'accepted':
        return COLORS.success;
      case 'ready':
        return COLORS.primary;
      default:
        return COLORS.gray;
    }
  };

  const renderOrderCard = ({ item }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>{item.customerName}</Text>
          <Text style={styles.orderTime}>{item.time}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.orderDetails}>
        <Text style={styles.addressLabel}>Delivery Address:</Text>
        <Text style={styles.address}>{item.address}</Text>
        
        <Text style={styles.itemsLabel}>Items:</Text>
        <Text style={styles.items}>{item.items.join(', ')}</Text>
        
        <View style={styles.orderFooter}>
          <Text style={styles.totalLabel}>Total:</Text>
          <Text style={styles.totalAmount}>{item.total}</Text>
        </View>
      </View>

      {item.status === 'pending' && (
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => handleAcceptOrder(item.id)}
        >
          <Text style={styles.acceptButtonText}>Accept Order</Text>
        </TouchableOpacity>
      )}

      {item.status === 'accepted' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.pickedButton}>
            <Text style={styles.pickedButtonText}>Mark as Picked Up</Text>
          </TouchableOpacity>
        </View>
      )}

      {item.status === 'ready' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.deliveredButton}>
            <Text style={styles.deliveredButtonText}>Mark as Delivered</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live Orders</Text>
        <Text style={styles.orderCount}>{liveOrders.length} Active</Text>
      </View>

      <FlatList
        data={liveOrders}
        renderItem={renderOrderCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No live orders at the moment</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: COLORS.white,
    ...SHADOWS.light,
  },
  headerTitle: {
    fontSize: SIZES.large,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  orderCount: {
    fontSize: SIZES.medium,
    color: COLORS.primary,
    fontWeight: '600',
  },
  listContainer: {
    padding: 15,
  },
  orderCard: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    ...SHADOWS.medium,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: SIZES.medium,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  orderTime: {
    fontSize: SIZES.small,
    color: COLORS.textLight,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: {
    color: COLORS.white,
    fontSize: SIZES.small,
    fontWeight: 'bold',
  },
  orderDetails: {
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    paddingTop: 10,
  },
  addressLabel: {
    fontSize: SIZES.small,
    color: COLORS.textLight,
    marginBottom: 2,
  },
  address: {
    fontSize: SIZES.font,
    color: COLORS.text,
    marginBottom: 8,
  },
  itemsLabel: {
    fontSize: SIZES.small,
    color: COLORS.textLight,
    marginBottom: 2,
  },
  items: {
    fontSize: SIZES.font,
    color: COLORS.text,
    marginBottom: 8,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
  },
  totalLabel: {
    fontSize: SIZES.medium,
    fontWeight: '600',
    color: COLORS.text,
  },
  totalAmount: {
    fontSize: SIZES.large,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  acceptButton: {
    backgroundColor: COLORS.success,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 15,
  },
  acceptButtonText: {
    color: COLORS.white,
    fontSize: SIZES.medium,
    fontWeight: 'bold',
  },
  actionButtons: {
    marginTop: 15,
  },
  pickedButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  pickedButtonText: {
    color: COLORS.white,
    fontSize: SIZES.medium,
    fontWeight: 'bold',
  },
  deliveredButton: {
    backgroundColor: COLORS.success,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  deliveredButtonText: {
    color: COLORS.white,
    fontSize: SIZES.medium,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: SIZES.medium,
    color: COLORS.textLight,
  },
});

export default HomeScreen;