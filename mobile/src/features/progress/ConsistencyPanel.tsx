import React from 'react';
import { View } from 'react-native';

import { useWeeklySummary } from '@/api/hooks';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

interface WeeklySummary {
  consistency: {
    score: number;
    band: string;
    workout_adherence: number;
    nutrition_adherence: number;
    checkin_adherence: number;
  };
  matched_days: number;
  planned_days: number;
}

export function ConsistencyPanel() {
  const { colors } = useTheme();
  const { data } = useWeeklySummary() as { data: WeeklySummary | undefined };

  if (!data) return <Skeleton height={160} radius={20} />;

  const bandColor = data.consistency.band === 'Excellent' ? colors.sage : data.consistency.band === 'Good' ? colors.warmAmber : colors.mutedTerracotta;

  return (
    <View style={{ gap: SPACING.base }}>
      <Card style={{ gap: SPACING.sm }}>
        <Text variant="heroMetricSmall">{data.consistency.score}</Text>
        <Text variant="caption" tone="tertiary">
          CONSISTENCY SCORE · {data.consistency.band.toUpperCase()}
        </Text>
        <ProgressBar progress={data.consistency.score / 100} color={bandColor} />
        <Text variant="body" tone="secondary">
          {data.matched_days} of {data.planned_days} planned sessions completed this week.
        </Text>
      </Card>

      <Card style={{ gap: SPACING.base }}>
        <Row label="Workouts" value={data.consistency.workout_adherence} colors={colors} />
        <Row label="Nutrition logging" value={data.consistency.nutrition_adherence} colors={colors} />
        <Row label="Daily check-ins" value={data.consistency.checkin_adherence} colors={colors} />
      </Card>
    </View>
  );
}

function Row({ label, value, colors }: { label: string; value: number; colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <View style={{ gap: SPACING.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" tone="secondary">
          {label}
        </Text>
        <Text variant="caption" tone="tertiary">
          {Math.round(value * 100)}%
        </Text>
      </View>
      <ProgressBar progress={value} />
    </View>
  );
}
