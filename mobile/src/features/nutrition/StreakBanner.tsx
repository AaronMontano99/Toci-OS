import React from 'react';
import { View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

export function StreakBanner({ days }: { days: number }) {
  const { colors } = useTheme();
  if (days < 1) return null;

  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: colors.accentWash, borderColor: colors.accentBorder }}>
      <Text style={{ fontSize: 18 }}>🔥</Text>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" style={{ color: colors.accentInk }}>
          {days} Day Streak
        </Text>
        <Text variant="caption" style={{ color: colors.accentInk, opacity: 0.85 }}>
          Keep it going! You&rsquo;re building great habits.
        </Text>
      </View>
    </Card>
  );
}
