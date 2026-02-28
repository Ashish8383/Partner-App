import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';

const BottomTabs = ({ state, descriptors, navigation }) => {
  const icons = {
    Home: '🏠',
    Profile: '👤',
    History: '📋',
  };

  return (
    <View style={styles.container}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={index}
            onPress={onPress}
            style={styles.tabButton}
            activeOpacity={0.7}
          >
            <View style={[styles.tabContent, isFocused && styles.tabContentFocused]}>
              <Text style={styles.tabIcon}>{icons[route.name] || '📱'}</Text>
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelFocused]}>
                {label}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    ...SHADOWS.medium,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 25,
  },
  tabContentFocused: {
    backgroundColor: COLORS.primaryLight + '20', // 20% opacity
  },
  tabIcon: {
    fontSize: SIZES.large,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: SIZES.small,
    color: COLORS.textLight,
  },
  tabLabelFocused: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});

export default BottomTabs;