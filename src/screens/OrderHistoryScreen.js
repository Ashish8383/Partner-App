import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import useStore from '../store/useStore';

const OrderHistoryScreen = () => {
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, completed, cancelled
  const orderHistory = useStore((state) => state.orderHistory);
  const setOrderHistory = useStore((state) => state.setOrderHistory);

  useEffect(() => {
    fetchOrderHistory();
  }, []);

  const fetchOrderHistory = async () => {
    try {
      // Mock data for demonstration
      const mockHistory = [
        {
          id: '101',
          customerName: 'Alice Brown',
          date: '2024-01-15',
          total: '$32.50',
          status: 'completed',
          items: 3,
        },
        {
          id: '102',
          customerName: 'Bob Miller',
          date: '2024-01-14',
          total: '$21.00',
          status: 'completed',
          items: 2,
        },
        {
          id: '103',
          customerName: 'Carol Davis',
          date: '2024-01-14',
          total: '$45.75',
          status: 'cancelled',
          items: 4,
        },
        {
          id: '104',
          customerName: 'David Wilson',
          date: '2024-01-13',
          total: '$18.25',
          status: 'completed',
          items: 2,
        },
        {
          id: '105',
          customerName: 'Eva Martinez',
          date: '2024-01-12',
          total: '$27.90',
          status: 'completed',
          items: 3,
        },
      ];
      
      setOrderHistory(mockHistory);
    } catch (error) {
      console.error('Error fetching order history:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orderHistory.filter(order => {
    if (filter === 'all') return true;
    return order.status === filter;
  });

  const getStatusColor = (status) => {
    return status === 'completed' ? COLORS.success : COLORS.error;
  };

  const renderOrderItem = ({ item }) => (
    <TouchableOpacity style={styles.orderItem}>
      <View style={styles.orderHeader}>
        <Text style={styles.customerName}>{item.customerName}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      
      <View style={styles.orderDetails}>
        <Text style={styles.orderDate}>{item.date}</Text>
        <Text style={styles.itemsCount}>{item.items} items</Text>
      </View>
      
      <View style={styles.orderFooter}>
        <Text style={styles.totalLabel}>Total Amount:</Text>
        <Text style={styles.totalAmount}>{item.total}</Text>
      </View>
    </TouchableOpacity>
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
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'completed' && styles.filterButtonActive]}
          onPress={() => setFilter('completed')}
        >
          <Text style={[styles.filterText, filter === 'completed' && styles.filterTextActive]}>
            Completed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'cancelled' && styles.filterButtonActive]}
          onPress={() => setFilter('cancelled')}
        >
          <Text style={[styles.filterText, filter === 'cancelled' && styles.filterTextActive]}>
            Cancelled
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredOrders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No orders found</Text>
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
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    ...SHADOWS.light,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.lightGray,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    color: COLORS.text,
    fontSize: SIZES.font,
  },
  filterTextActive: {
    color: COLORS.white,
    fontWeight: '600',
  },
  listContainer: {
    padding: 15,
  },
  orderItem: {
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
  customerName: {
    fontSize: SIZES.medium,
    fontWeight: 'bold',
    color: COLORS.text,
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
    textTransform: 'capitalize',
  },
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  orderDate: {
    fontSize: SIZES.small,
    color: COLORS.textLight,
  },
  itemsCount: {
    fontSize: SIZES.small,
    color: COLORS.textLight,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    paddingTop: 10,
  },
  totalLabel: {
    fontSize: SIZES.font,
    color: COLORS.textLight,
  },
  totalAmount: {
    fontSize: SIZES.medium,
    fontWeight: 'bold',
    color: COLORS.primary,
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

export default OrderHistoryScreen;