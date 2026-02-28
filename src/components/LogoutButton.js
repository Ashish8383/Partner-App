import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  View,
} from 'react-native';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import useStore from '../store/useStore';

const LogoutButton = ({ variant = 'header' }) => {
  const logout = useStore((state) => state.logout);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          onPress: async () => {
            await logout();
          },
          style: 'destructive',
        },
      ],
      { cancelable: true }
    );
  };

  if (variant === 'header') {
    return (
      <TouchableOpacity onPress={handleLogout} style={styles.headerButton}>
        <Text style={styles.headerButtonText}>Logout</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={handleLogout} style={styles.button}>
      <Text style={styles.buttonText}>Logout</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  headerButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: COLORS.error,
    borderRadius: 8,
    ...SHADOWS.light,
  },
  headerButtonText: {
    color: COLORS.white,
    fontSize: SIZES.font,
    fontWeight: '600',
  },
  button: {
    backgroundColor: COLORS.error,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
    ...SHADOWS.medium,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: SIZES.medium,
    fontWeight: 'bold',
  },
});

export default LogoutButton;