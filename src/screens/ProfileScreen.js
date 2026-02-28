import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import useStore from '../store/useStore';
import LogoutButton from '../components/LogoutButton';

const ProfileScreen = () => {
  const user = useStore((state) => state.user);

  const stats = [
    { label: 'Total Orders', value: '156' },
    { label: 'Rating', value: '4.8' },
    { label: 'Earnings', value: '$2,450' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.profileImageContainer}>
          {user?.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.profileImage} />
          ) : (
            <View style={styles.profileImagePlaceholder}>
              <Text style={styles.profileImageText}>
                {user?.name?.charAt(0) || 'U'}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.userName}>{user?.name || 'Partner Name'}</Text>
        <Text style={styles.userPhone}>{user?.phone || '+1234567890'}</Text>
        <Text style={styles.userEmail}>{user?.email || 'partner@alfennzo.com'}</Text>
      </View>

      <View style={styles.statsContainer}>
        {stats.map((stat, index) => (
          <View key={index} style={styles.statItem}>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personal Information</Text>
        
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Full Name</Text>
            <Text style={styles.infoValue}>{user?.name || 'John Doe'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone Number</Text>
            <Text style={styles.infoValue}>{user?.phone || '+1234567890'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email || 'john@example.com'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Member Since</Text>
            <Text style={styles.infoValue}>January 2024</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Vehicle Information</Text>
        
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Vehicle Type</Text>
            <Text style={styles.infoValue}>Motorcycle</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>License Plate</Text>
            <Text style={styles.infoValue}>ABC-1234</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Insurance Valid</Text>
            <Text style={styles.infoValue}>Yes</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        
        <View style={styles.infoCard}>
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuItemText}>Notification Settings</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuItemText}>Payment Methods</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuItemText}>Privacy Policy</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuItemText}>Terms & Conditions</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuItemText}>Help & Support</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.logoutContainer}>
        <LogoutButton variant="full" />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    paddingVertical: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...SHADOWS.medium,
  },
  profileImageContainer: {
    marginBottom: 15,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: COLORS.white,
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.primaryDark,
  },
  profileImageText: {
    fontSize: 40,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: SIZES.large,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 5,
  },
  userPhone: {
    fontSize: SIZES.font,
    color: COLORS.white,
    opacity: 0.9,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: SIZES.font,
    color: COLORS.white,
    opacity: 0.9,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.white,
    marginHorizontal: 20,
    marginTop: -20,
    borderRadius: 15,
    paddingVertical: 15,
    ...SHADOWS.medium,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: SIZES.large,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: SIZES.small,
    color: COLORS.textLight,
    marginTop: 5,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: SIZES.medium,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 10,
  },
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
    padding: 15,
    ...SHADOWS.light,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  infoLabel: {
    fontSize: SIZES.font,
    color: COLORS.textLight,
  },
  infoValue: {
    fontSize: SIZES.font,
    color: COLORS.text,
    fontWeight: '500',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  menuItemText: {
    fontSize: SIZES.font,
    color: COLORS.text,
  },
  menuItemArrow: {
    fontSize: SIZES.large,
    color: COLORS.primary,
  },
  logoutContainer: {
    paddingHorizontal: 20,
    marginVertical: 30,
  },
});

export default ProfileScreen;