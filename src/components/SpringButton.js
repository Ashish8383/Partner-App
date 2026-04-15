import React, { useRef, useCallback } from 'react';
import { TouchableWithoutFeedback, Animated } from 'react-native';
import { triggerHaptic } from './GlobalHaptic';

const SpringButton = ({ onPress, style, disabled = false, children }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    triggerHaptic();
    Animated.spring(scale, {
      toValue:         0.9,
      useNativeDriver: false, // changed from true — avoids driver mixing with any screen using useNativeDriver:false
      speed:           60,
      bounciness:      25,
    }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue:         1,
      useNativeDriver: false,
      speed:           22,
      bounciness:      25,
    }).start();
  }, [scale]);

  return (
    <TouchableWithoutFeedback
      onPress={disabled ? undefined : onPress}
      onPressIn={disabled ? undefined : handlePressIn}
      onPressOut={disabled ? undefined : handlePressOut}
    >
      <Animated.View
        style={[
          style,
          disabled && { opacity: 0.55 },
          { transform: [{ scale }] },
        ]}
      >
        {children}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

export default SpringButton;