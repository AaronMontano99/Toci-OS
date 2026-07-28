import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, View } from 'react-native';

import { useLogHydration } from '@/api/hooks';
import { Card } from '@/components/ui/Card';
import { RingGauge } from '@/components/ui/RingGauge';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

interface DailyRingsRowProps {
  calorieProgress: number | null;
  hydrationOz: number | null;
  hydrationGoalOz: number | null;
}

export function DailyRingsRow({ calorieProgress, hydrationOz, hydrationGoalOz }: DailyRingsRowProps) {
  const { colors } = useTheme();
  const logHydration = useLogHydration();
  const hydrationProgress = hydrationOz != null && hydrationGoalOz ? hydrationOz / hydrationGoalOz : null;

  const onQuickAddWater = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    logHydration.mutate(8);
  };

  return (
    <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
      <Card style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <RingGauge size={44} strokeWidth={5} progress={calorieProgress ?? 0} color={colors.accent} trackColor={colors.border} />
        <View style={{ flex: 1 }}>
          <Text variant="caption" tone="tertiary">
            Daily Progress
          </Text>
          <Text variant="bodyStrong">{calorieProgress != null ? `${Math.round(calorieProgress * 100)}%` : '—'}</Text>
          <Text variant="microLabel" tone="tertiary">
            of calorie goal
          </Text>
        </View>
      </Card>

      <Pressable style={{ flex: 1 }} onPress={onQuickAddWater} hitSlop={4}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
          <RingGauge size={44} strokeWidth={5} progress={hydrationProgress ?? 0} color={colors.recoveryBlue} trackColor={colors.border}>
            <Ionicons name="water" size={16} color={colors.recoveryBlue} />
          </RingGauge>
          <View style={{ flex: 1 }}>
            <Text variant="caption" tone="tertiary">
              Hydration · tap +8oz
            </Text>
            <Text variant="bodyStrong">{hydrationOz != null ? `${Math.round(hydrationOz)} oz` : '—'}</Text>
            <Text variant="microLabel" tone="tertiary">
              of {hydrationGoalOz != null ? Math.round(hydrationGoalOz) : '—'} oz goal
            </Text>
          </View>
        </Card>
      </Pressable>
    </View>
  );
}
