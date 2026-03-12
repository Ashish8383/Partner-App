import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { storage } from '../utils/storage';

const lightTheme = {
  background: '#FFFFFF',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#666666',
  textMuted: '#999999',
  border: '#F2F2F2',
  borderLight: '#E8E8E8',
  primary: '#4CAF50',
  primaryLight: '#E6F5EE',
  accent: '#FFC107',
  accentLight: '#FFF8E0',
  cardBackground: '#FFFFFF',
  inputBackground: '#F5F5F5',
  placeholder: '#AAAAAA',
  headerBackground: '#FFFFFF',
  tabBarBackground: '#FFFFFF',
  statusBarStyle: 'dark-content',
  statusBarBg: '#FFFFFF',
  toggleBg: '#EBEBEB',
  toggleInactive: '#777777',
  noteBg: '#FFFBE6',
  noteText: '#7A6000',
  timeBadgeBg: '#FFFFFF',
  seatBadgeBg: '#FFF8E0',
  seatText: '#B8860B',
  emptyCardBg: '#4CAF50',
  shadowColor: '#000000',
};

const darkTheme = {
  background: '#121212',
  card: '#1E1E1E',
  text: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textMuted: '#808080',
  border: '#2C2C2C',
  borderLight: '#3C3C3C',
  primary: '#2E7D32',
  primaryLight: '#1E3A2A',
  accent: '#FFA000',
  accentLight: '#3A2E1E',
  cardBackground: '#1E1E1E',
  inputBackground: '#2C2C2C',
  placeholder: '#666666',
  headerBackground: '#1E1E1E',
  tabBarBackground: '#1E1E1E',
  statusBarStyle: 'light-content',
  statusBarBg: '#121212',
  toggleBg: '#2C2C2C',
  toggleInactive: '#808080',
  noteBg: '#3A2E1E',
  noteText: '#FFD700',
  timeBadgeBg: '#2C2C2C',
  seatBadgeBg: '#3A2E1E',
  seatText: '#FFD700',
  emptyCardBg: '#2E7D32',
  shadowColor: '#FFFFFF',
};

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState('system');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await storage.getItem('themeMode');
      if (savedTheme) {
        setThemeMode(savedTheme);
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  const setTheme = async (mode) => {
    setThemeMode(mode);
    try {
      await storage.setItem('themeMode', mode);
    } catch (error) {
    }
  };

  const getActualTheme = () => {
    if (themeMode === 'system') {
      return systemColorScheme === 'dark' ? 'dark' : 'light';
    }
    return themeMode;
  };

  const actualTheme = getActualTheme();
  const colors = actualTheme === 'dark' ? darkTheme : lightTheme;
  const isDark = actualTheme === 'dark';

  const value = {
    themeMode,
    colors,
    isDark,
    setTheme,
    isLoading,
    actualTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
  }
  return context;
};