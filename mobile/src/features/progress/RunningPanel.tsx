import React from 'react';
import { View } from 'react-native';

import { useLogHistory, useSettings } from '@/api/hooks';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Sparkline } from '@/components/ui/Sparkline';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

function paceToSeconds(pace?: string | null): number | null {
  if (!pace) return null;
  const [m, s] = pace.split(':').map(Number);
  return m * 60 + s;
}

export function RunningPanel() {
  const { colors } = useTheme();
  const { data: history } = useLogHistory(60);
  const { data: settings } = useSettings();
  const isImperial = (settings?.units ?? 'imperial') === 'imperial';

  const runs = (history?.sessions ?? []).filter((s) => s.type === 'run').slice().reverse();

  if (runs.length === 0) {
    return <EmptyState title="No runs logged yet" detail="Log a run from the Workout tab to see your pace trend." />;
  }

  const paces = runs.map((r) => paceToSeconds(r.pace_per_km)).filter((v): v is number => v != null);
  const last = runs[runs.length - 1];
  const distanceDisplay = last.distance_km != null ? (isImperial ? last.distance_km * 0.621371 : last.distance_km) : null;

  return (
    <View style={{ gap: SPACING.base }}>
      <Card style={{ gap: SPACING.sm }}>
        <Text variant="heroMetricSmall">{last.pace_per_km ?? '—'}</Text>
        <Text variant="caption" tone="tertiary">
          MOST RECENT PACE (MIN/KM)
        </Text>
        {paces.length >= 2 && (
          <Sparkline values={paces.map((p) => -p)} color={colors.accent} width={300} height={70} />
        )}
        <Text variant="body" tone="secondary">
          Last run: {distanceDisplay?.toFixed(2) ?? '—'} {isImperial ? 'mi' : 'km'} in {last.duration_min} min.
        </Text>
      </Card>
    </View>
  );
}
