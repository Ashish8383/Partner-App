// components/DeviceSessionsModal.js
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Dimensions,
  Platform,
  PixelRatio,
} from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import ToastMessage from './ToastMessage';
import { logoutfromdevice } from '../utils/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_TABLET = SCREEN_WIDTH >= 768;
const BASE_WIDTH = 375;
const scale = SCREEN_WIDTH / BASE_WIDTH;

const normalize = (size) => {
  if (IS_TABLET) return Math.round(PixelRatio.roundToNearestPixel(size * 1.22));
  return Math.round(PixelRatio.roundToNearestPixel(size * Math.min(scale, 1.4)));
};

const rs = (size) => {
  if (IS_TABLET) return Math.round(size * 1.28);
  return Math.round(size * Math.min(scale, 1.3));
};

const DeviceSessionsModal = ({
  visible,
  onClose,
  devices,
  identifier,
  password,
  onDeviceLoggedOut,
  toastRef,
}) => {
  const [loadingDevices, setLoadingDevices] = useState({});
  const [localToastRef, setLocalToastRef] = useState(null);

  const showToast = (message, type = 'info') => {
    const toast = toastRef?.current || localToastRef;
    toast?.show({ message, type, duration: 3000 });
  };

  const handleLogoutDevice = async (deviceFingerprint) => {
    setLoadingDevices(prev => ({ ...prev, [deviceFingerprint]: true }));
    console.log(deviceFingerprint,"sadhsad")
    try {
      const response = await logoutfromdevice({
        targetDeviceFingerprint: deviceFingerprint,
        identifier,
        password
      });

      if (response?.statusCode === 200) {
        showToast(response?.message || 'Device logged out successfully', 'success');
        setLoadingDevices(prev => ({ ...prev, [deviceFingerprint]: false }));
        if (onDeviceLoggedOut) {
          onDeviceLoggedOut();
        }
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to logout device';
      showToast(errorMessage, 'error');
      setLoadingDevices(prev => ({ ...prev, [deviceFingerprint]: false }));
    }
  };

  const getDeviceIcon = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'android':
        return 'android';
      case 'ios':
        return 'apple';
      case 'web':
      case 'windows':
      case 'webwindows':
        return 'laptop';
      case 'macos':
      case 'webmacos':
        return 'monitor';
      default:
        return 'devices';
    }
  };

  const formatLastActive = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const renderDeviceItem = ({ item }) => {
    const deviceInfo = item.deviceInfo || {};
    const isLoading = loadingDevices[item.deviceFingerprint];
    const isCurrentDevice = item.isCurrentDevice; 

    return (
      <View style={styles.deviceCard}>
        <View style={styles.deviceHeader}>
          <View style={styles.deviceIconContainer}>
            <MaterialIcons 
              name={getDeviceIcon(deviceInfo.platform)} 
              size={normalize(24)} 
              color="#03954E" 
            />
          </View>
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceName} numberOfLines={1}>
              {deviceInfo.deviceName || deviceInfo.model || 'Unknown Device'}
              {isCurrentDevice && <Text style={styles.currentDeviceBadge}> (Current)</Text>}
            </Text>
            <Text style={styles.deviceDetails}>
              {[deviceInfo.platform, deviceInfo.model]
                .filter(Boolean)
                .join(' • ') || 'Unknown Device'}
            </Text>
            <Text style={styles.lastActive}>
              Last active: {formatLastActive(item.lastActive || item.updatedAt)}
            </Text>
          </View>
        </View>

        <View style={styles.deviceFooter}>
          <Text style={styles.fingerprintText}>
            ID: {item.deviceFingerprint?.substring(0, 8)}...
          </Text>
          
          {!isCurrentDevice && (
            <TouchableOpacity
              style={[styles.logoutButton, isLoading && styles.logoutButtonDisabled]}
              onPress={() => handleLogoutDevice(item.deviceFingerprint)}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FF3B30" />
              ) : (
                <>
                  <Feather name="log-out" size={normalize(16)} color="#FF3B30" />
                  <Text style={styles.logoutButtonText}>Logout</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Active Sessions</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={normalize(24)} color="#666" />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalSubtitle}>
            Maximum device limit reached. You're logged in on these devices:
          </Text>

          {devices && devices.length > 0 ? (
            <>
              <FlatList
                data={devices}
                renderItem={renderDeviceItem}
                keyExtractor={(item) => item.deviceFingerprint || Math.random().toString()}
                contentContainerStyle={styles.devicesList}
                showsVerticalScrollIndicator={false}
              />
              
              <View style={styles.modalFooter}>
                <Text style={styles.footerText}>
                  Logout from a device to continue with this one
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color="#03954E" />
              <Text style={styles.loadingText}>Loading devices...</Text>
            </View>
          )}
        </View>
      </View>
      <ToastMessage ref={setLocalToastRef} />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: IS_TABLET ? SCREEN_WIDTH * 0.6 : SCREEN_WIDTH * 0.9,
    maxWidth: 500,
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: rs(20),
    padding: rs(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: rs(12),
    paddingBottom: rs(12),
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  modalTitle: {
    fontSize: normalize(20),
    fontWeight: '700',
    color: '#03954E',
  },
  closeButton: {
    padding: rs(4),
  },
  modalSubtitle: {
    fontSize: normalize(14),
    color: '#666',
    marginBottom: rs(16),
    lineHeight: normalize(20),
  },
  devicesList: {
    paddingBottom: rs(8),
  },
  deviceCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: rs(12),
    padding: rs(12),
    marginBottom: rs(10),
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  deviceHeader: {
    flexDirection: 'row',
    marginBottom: rs(10),
  },
  deviceIconContainer: {
    width: rs(44),
    height: rs(44),
    borderRadius: rs(22),
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: rs(12),
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: normalize(15),
    fontWeight: '600',
    color: '#333',
    marginBottom: rs(2),
  },
  currentDeviceBadge: {
    fontSize: normalize(12),
    color: '#03954E',
    fontWeight: '500',
  },
  deviceDetails: {
    fontSize: normalize(12),
    color: '#666',
    marginBottom: rs(4),
  },
  lastActive: {
    fontSize: normalize(11),
    color: '#999',
  },
  deviceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: rs(8),
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  fingerprintText: {
    fontSize: normalize(10),
    color: '#999',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingVertical: rs(6),
    paddingHorizontal: rs(12),
    borderRadius: rs(16),
    gap: rs(4),
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutButtonText: {
    fontSize: normalize(12),
    color: '#FF3B30',
    fontWeight: '500',
  },
  logoutAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEE',
    paddingVertical: rs(12),
    borderRadius: rs(10),
    marginTop: rs(8),
    gap: rs(8),
  },
  logoutAllText: {
    fontSize: normalize(14),
    color: '#FF3B30',
    fontWeight: '600',
  },
  modalFooter: {
    marginTop: rs(12),
    paddingTop: rs(12),
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  footerText: {
    fontSize: normalize(12),
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  emptyState: {
    padding: rs(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: normalize(14),
    color: '#666',
    marginTop: rs(12),
  },
});

export default DeviceSessionsModal;