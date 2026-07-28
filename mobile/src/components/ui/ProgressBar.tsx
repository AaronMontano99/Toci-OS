import React from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { RADIUS } from '@/theme/tokens';

interface ProgressBarProps {
  progress: number; // 0-1
  height?: number;
  color?: string;
  trackColor?: string;
}

export function ProgressBar({ progress, height = 8, color, trackColor }: ProgressBarProps) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View
      style={{
        height,
        borderRadius: RADIUS.pill,
        backgroundColor: trackColor ?? colors.backgroundSecondary,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${pct * 100}%`,
          height: '100%',
          borderRadius: RADIUS.pill,
          backgroundColor: color ?? colors.accent,
        }}
      />
    </View>
  );
}
