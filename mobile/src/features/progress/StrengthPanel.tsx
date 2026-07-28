import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { useExercises, useSettings, useStrengthProgress } from '@/api/hooks';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Sparkline } from '@/components/ui/Sparkline';
import { Text } from '@/components/ui/Text';
import { formatWeight } from '@/lib/units';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

export function StrengthPanel() {
  const { colors } = useTheme();
  const { data: exercises } = useExercises();
  const { data: settings } = useSettings();
  const units = settings?.units ?? 'imperial';
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const exerciseId = selectedId ?? exercises?.[0]?.id ?? null;

  const { data: progress } = useStrengthProgress(exerciseId);

  return (
    <View style={{ gap: SPACING.base }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm }}>
        {exercises?.map((ex) => (
          <Chip key={ex.id} label={ex.name} selected={ex.id === exerciseId} onPress={() => setSelectedId(ex.id)} />
        ))}
      </ScrollView>

      {!progress || progress.points.length === 0 ? (
        <EmptyState title="No sets logged yet" detail="Complete a workout with this exercise to see a trend." />
      ) : (
        <Card style={{ gap: SPACING.sm }}>
          <Text variant="heroMetricSmall">{formatWeight(progress.best_lift_kg, units, 1)}</Text>
          <Text variant="caption" tone="tertiary">
            ESTIMATED 1RM BEST
          </Text>
          <Sparkline
            values={progress.points.map((p) => p.est_1rm_kg)}
            color={colors.accent}
            width={300}
            height={80}
          />
          <Text variant="body" tone="secondary">
            {progress.trend === 'up'
              ? `Trending up ${progress.pct_change_28d}% over the last 28 days.`
              : progress.trend === 'down'
                ? `Down ${Math.abs(progress.pct_change_28d ?? 0)}% over the last 28 days.`
                : 'Holding steady over the last 28 days.'}
          </Text>
        </Card>
      )}
    </View>
  );
}
