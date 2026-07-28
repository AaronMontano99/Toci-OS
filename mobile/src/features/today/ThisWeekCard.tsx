import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';

import { WeekDay } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { WeekStrip } from '@/features/today/WeekStrip';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

export function ThisWeekCard({ week }: { week: WeekDay[] }) {
  const { colors } = useTheme();
  const planned = week.filter((d) => d.day_type !== 'rest');
  const completed = planned.filter((d) => d.is_completed);
  const ratio = planned.length ? completed.length / planned.length : 1;
  const caption = ratio >= 0.8 ? 'Great consistency' : ratio >= 0.5 ? 'Good progress' : 'Let’s build momentum';

  return (
    <Pressable onPress={() => router.push('/program')} style={{ flex: 1 }}>
      <Card style={{ gap: SPACING.sm, flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="microLabel" tone="accent">
            THIS WEEK
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
        </View>
        <WeekStrip week={week} />
        <Text variant="bodyStrong">
          {completed.length} of {planned.length} days
        </Text>
        <Text variant="caption" tone="tertiary">
          {caption}
        </Text>
      </Card>
    </Pressable>
  );
}
