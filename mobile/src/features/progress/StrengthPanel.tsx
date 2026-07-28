import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useExercises, useSettings, useStrengthProgress } from '@/api/hooks';
import { Card } from '@/components/ui/Card';
import { Dropdown } from '@/components/ui/Dropdown';
import { EmptyState } from '@/components/ui/EmptyState';
import { Sparkline } from '@/components/ui/Sparkline';
import { StatPill, StatPillRow } from '@/components/ui/StatPill';
import { Text } from '@/components/ui/Text';
import { formatWeight } from '@/lib/units';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

const TIMEFRAMES = [
  { key: '1m', label: '1M', days: 30 },
  { key: '3m', label: '3M', days: 90 },
  { key: '6m', label: '6M', days: 180 },
  { key: '1y', label: '1Y', days: 365 },
];

export function StrengthPanel() {
  const { colors } = useTheme();
  const { data: exercises } = useExercises();
  const { data: settings } = useSettings();
  const units = settings?.units ?? 'imperial';
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const exerciseId = selectedId ?? exercises?.[0]?.id ?? null;
  const [timeframe, setTimeframe] = useState('3m');

  const { data: progress } = useStrengthProgress(exerciseId);

  // Captured once per mount rather than read live during render -- the
  // filter only needs to be roughly "now", not resynced every render.
  const [nowMs] = useState(() => Date.now());
  const windowDays = TIMEFRAMES.find((t) => t.key === timeframe)?.days ?? 90;
  const visiblePoints = useMemo(() => {
    if (!progress) return [];
    const cutoff = nowMs - windowDays * 86400000;
    const filtered = progress.points.filter((p) => new Date(p.date).getTime() >= cutoff);
    return filtered.length >= 2 ? filtered : progress.points;
  }, [progress, windowDays, nowMs]);

  return (
    <View style={{ gap: SPACING.base }}>
      <Dropdown
        options={(exercises ?? []).map((ex) => ({ key: String(ex.id), label: ex.name }))}
        selected={String(exerciseId)}
        onChange={(key) => setSelectedId(Number(key))}
      />

      {!progress || progress.points.length === 0 ? (
        <EmptyState title="No sets logged yet" detail="Complete a workout with this exercise to see a trend." />
      ) : (
        <Card style={{ gap: SPACING.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text variant="microLabel" tone="accent">
                1RM ESTIMATE
              </Text>
              <Text variant="heroMetric">{formatWeight(progress.best_lift_kg, units, 0)}</Text>
              {progress.pct_change_28d != null && (
                <Text
                  variant="caption"
                  style={{
                    fontWeight: '700',
                    color: progress.trend === 'up' ? colors.sage : progress.trend === 'down' ? colors.mutedTerracotta : colors.textTertiary,
                  }}
                >
                  {progress.trend === 'up' ? '↑' : progress.trend === 'down' ? '↓' : '·'} {Math.abs(progress.pct_change_28d)}% vs last 4 weeks
                </Text>
              )}
            </View>
            <Dropdown compact options={TIMEFRAMES} selected={timeframe} onChange={setTimeframe} />
          </View>

          <Sparkline values={visiblePoints.map((p) => p.est_1rm_kg)} color={colors.accent} width={300} height={110} strokeWidth={3} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="microLabel" tone="tertiary">
              {visiblePoints[0]?.date}
            </Text>
            <Text variant="microLabel" tone="tertiary">
              {visiblePoints[visiblePoints.length - 1]?.date}
            </Text>
          </View>

          <StatPillRow>
            <StatPill label="Consistency" value={`${progress.consistency_pct}%`} />
            <StatPill label="Best Lift" value={formatWeight(progress.best_lift_kg, units, 0)} />
            <StatPill label="Trend" value={progress.trend === 'up' ? 'Up' : progress.trend === 'down' ? 'Down' : 'Flat'} />
          </StatPillRow>
        </Card>
      )}
    </View>
  );
}
