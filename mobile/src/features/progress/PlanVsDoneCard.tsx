import React from 'react';
import { View } from 'react-native';

import { usePlanVsDone } from '@/api/hooks';
import { PlanVsDone } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

const pct = (v: number) => `${Math.round(v * 100)}%`;

// What the "increase" calibration means, in the user's terms. Below the sample
// size adherence.py needs, it says so instead of a number that means nothing yet.
function increaseLine(c: PlanVsDone['calibration'][string] | undefined): string {
  if (!c) return 'No weight increases tried yet.';
  if (c.verdict === 'collecting') return `Weight increases: ${c.hit} of ${c.n} fully completed so far. A read on whether Toci pushes too hard needs about 20.`;
  const read = { 'pushing too hard': 'Toci may be pushing too hard', 'too cautious': 'Toci may be too cautious', 'well calibrated': 'about right' }[c.verdict];
  return `Weight increases: ${pct(c.rate)} fully completed (${c.n} tries) — ${read}.`;
}

export function PlanVsDoneView({ data }: { data: PlanVsDone }) {
  const { colors } = useTheme();
  const s = data.summary;
  const top = data.strength.slice(0, 3);
  return (
    <Card style={{ gap: SPACING.sm }}>
      <Text variant="caption" tone="tertiary">
        PLAN VS DONE · LAST 4 WEEKS
      </Text>
      {s.adherence == null ? (
        <Text variant="body" tone="secondary">
          No plans to measure yet: open Today on a training day and Toci keeps its plan to compare.
        </Text>
      ) : (
        <>
          <Text variant="heroMetricSmall">{pct(s.adherence)}</Text>
          <Text variant="body" tone="secondary">
            {s.trained} of {s.planned_training_days} planned training days trained
            {s.as_prescribed != null ? ` · ${pct(s.as_prescribed)} of lift days done as prescribed` : ''}.
          </Text>
          <ProgressBar progress={s.adherence} color={colors.sage} />
        </>
      )}
      <Text variant="caption" tone="secondary">
        {increaseLine(data.calibration.increase)}
      </Text>
      {top.length > 0 && (
        <View style={{ gap: SPACING.xs }}>
          {top.map((t) => (
            <View key={t.exercise_id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="caption" tone="secondary">
                {t.name ?? 'Exercise'}
              </Text>
              <Text variant="caption" tone="tertiary">
                est. 1RM {t.change_pct >= 0 ? '+' : ''}
                {(t.change_pct * 100).toFixed(1)}% · {t.sessions} sessions
              </Text>
            </View>
          ))}
        </View>
      )}
      {s.scheduled_without_a_plan > 0 && (
        <Text variant="caption" tone="tertiary">
          {s.scheduled_without_a_plan} scheduled training day{s.scheduled_without_a_plan === 1 ? '' : 's'} without opening Toci (
          {s.trained_without_a_plan} trained anyway) aren't counted above: there was no plan to follow.
        </Text>
      )}
    </Card>
  );
}

export function PlanVsDoneCard() {
  const { data } = usePlanVsDone();
  if (!data) return <Skeleton height={140} radius={20} />;
  return <PlanVsDoneView data={data} />;
}
