import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING } from '@/theme/tokens';

export function StreakPill({ days }: { days: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 6,
        borderRadius: RADIUS.input,
        backgroundColor: colors.accentWash,
      }}
    >
      <Text style={{ fontSize: 14 }}>🔥</Text>
      <View>
        <Text variant="bodyStrong" style={{ color: colors.accentInk, lineHeight: 16 }}>
          {days}
        </Text>
        <Text variant="microLabel" style={{ color: colors.accentInk, opacity: 0.8 }}>
          DAY STREAK
        </Text>
      </View>
    </View>
  );
}
