// components/ui/IconSymbol.tsx
import { Ionicons } from '@expo/vector-icons';
import React from 'react';

type Props = {
  name: React.ComponentProps<typeof Ionicons>['name'];
  size?: number;
  color?: string;
  style?: any;
  weight?: string;
};

export function IconSymbol({ name, size = 24, color = '#000', style, weight }: Props) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}
