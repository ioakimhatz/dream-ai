import React from 'react';
import { TouchableOpacity, TouchableOpacityProps } from 'react-native';
import * as Haptics from 'expo-haptics';

interface HapticTabProps extends TouchableOpacityProps {
  children: React.ReactNode;
}

export function HapticTab({ children, onPress, ...props }: HapticTabProps) {
  const handlePress = (event: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (onPress) {
      onPress(event);
    }
  };

  return (
    <TouchableOpacity onPress={handlePress} {...props}>
      {children}
    </TouchableOpacity>
  );
}

export default HapticTab;
