// src/components/InAppNotification.js
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Text,
  TouchableOpacity,
  StyleSheet,
  View,
  useColorScheme,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const InAppNotification = ({ title, body, onPress, onDismiss }) => {
  const translateY = useRef(new Animated.Value(-150)).current;
  const colorScheme = useColorScheme(); // ← detects dark/light mode
  const isDark = colorScheme === 'dark';

  const theme = {
    background: isDark ? '#1E1E1E' : '#FF8C42',
    titleColor: '#FFFFFF',
    bodyColor: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.9)',
    iconBackground: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.2)',
    shadowColor: isDark ? '#000' : '#FF8C42',
    borderColor: isDark ? '#FF8C42' : 'transparent',
  };

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
    }).start();

    const timer = setTimeout(() => dismiss(), 5000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.timing(translateY, {
      toValue: -150,
      duration: 300,
      useNativeDriver: true,
    }).start(() => onDismiss?.());
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          backgroundColor: theme.background,
          shadowColor: theme.shadowColor,
          borderWidth: isDark ? 1 : 0,
          borderColor: theme.borderColor,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={() => { dismiss(); onPress?.(); }}
        activeOpacity={0.9}
      >
        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: theme.iconBackground }]}>
          <MaterialIcons name="delivery-dining" size={28} color="#fff" />
        </View>

        {/* Text */}
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: theme.titleColor }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.body, { color: theme.bodyColor }]} numberOfLines={2}>
            {body}
          </Text>
        </View>

        {/* Close button */}
        <TouchableOpacity onPress={dismiss} style={styles.closeButton}>
          <MaterialIcons name="close" size={18} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Progress bar — auto dismiss indicator */}
      <ProgressBar isDark={isDark} />
    </Animated.View>
  );
};

// ✅ Progress bar shows how long before auto dismiss
const ProgressBar = ({ isDark }) => {
  const width = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: 0,
      duration: 5000,
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <View style={styles.progressContainer}>
      <Animated.View
        style={[
          styles.progressBar,
          {
            width: width.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
            }),
            backgroundColor: isDark ? '#FF8C42' : 'rgba(255,255,255,0.5)',
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 9999,
    borderRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 15,
    marginBottom: 2,
  },
  body: {
    fontSize: 13,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
  progressContainer: {
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  progressBar: {
    height: 3,
  },
});

export default InAppNotification;