import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/themeContext';
import { rs, nz } from '../utils/constant';

export const ThemeToggle = () => {
  const { themeMode, setTheme, colors, isDark } = useTheme();

  const toggleTheme = () => {
    if (themeMode === 'system') {
      setTheme(isDark ? 'light' : 'dark');
    } else {
      setTheme('system');
    }
  };

  const getIconName = () => {
    if (themeMode === 'system') return 'brightness-auto';
    return isDark ? 'dark-mode' : 'light-mode';
  };

  return (
    <TouchableOpacity
      onPress={toggleTheme}
      style={[styles.container, { backgroundColor: colors.inputBackground }]}
      activeOpacity={0.8}>
      <MaterialIcons
        name={getIconName()}
        size={nz(20)}
        color={colors.textSecondary}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: rs(36),
    height: rs(36),
    borderRadius: rs(18),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: rs(8),
  },
});