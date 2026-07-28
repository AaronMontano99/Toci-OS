import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

interface IconButtonProps {
  name: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  size?: number;
  color?: string;
  background?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

export function IconButton({ name, onPress, size = 20, color, background = true, accessibilityLabel, testID }: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID ?? `icon-button-${name}`}
      accessibilityLabel={accessibilityLabel ?? name}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: background ? colors.backgroundSecondary : 'transparent',
        opacity: pressed ? 0.7 : 1,
      })}
      hitSlop={8}
    >
      <Ionicons name={name} size={size} color={color ?? colors.textPrimary} />
    </Pressable>
  );
}
