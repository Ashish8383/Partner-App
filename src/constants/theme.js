export const COLORS = {
  primary: '#FF6B00', // Orange theme
  primaryLight: '#FFA500',
  primaryDark: '#CC5500',
  secondary: '#FFFFFF',
  text: '#333333',
  textLight: '#666666',
  background: '#F5F5F5',
  white: '#FFFFFF',
  black: '#000000',
  gray: '#808080',
  lightGray: '#E0E0E0',
  error: '#FF0000',
  success: '#4CAF50',
  warning: '#FFC107',
};

export const SIZES = {
  base: 8,
  small: 12,
  font: 14,
  medium: 16,
  large: 18,
  extraLarge: 24,
  xxl: 32,
};

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
};

export const SHADOWS = {
  light: {
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 2,
  },
  medium: {
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 5.46,
    elevation: 4,
  },
};