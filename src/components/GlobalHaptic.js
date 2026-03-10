
import React, { useCallback } from 'react';
import { TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';

export const triggerHaptic = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

export const HapticTouchable = ({ onPress, onPressIn, children, ...rest }) => {
  const handlePressIn = useCallback((e) => {
    triggerHaptic();
    onPressIn?.(e);
  }, [onPressIn]);

  return (
    <TouchableOpacity
      onPressIn={handlePressIn}
      onPress={onPress}
      {...rest}
    >
      {children}
    </TouchableOpacity>
  );
};

export default HapticTouchable;