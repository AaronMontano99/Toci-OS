import React from 'react';
import { View } from 'react-native';

import { ProgramResponse } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { InsightCard } from '@/components/ui/InsightCard';
import { Text } from '@/components/ui/Text';
import { sessionTypeLabel } from '@/lib/format';
import { SPACING } from '@/theme/tokens';

export function OverviewSegment({ program }: { program: ProgramResponse }) {
  const topGoals = program.goals.filter((g) => !g.is_secondary).slice(0, 3);

  return (
    <View style={{ gap: SPACING.lg }}>
      <Card style={{ gap: SPACING.xs }}>
        <Text variant="microLabel" tone="tertiary">
          TODAY
        </Text>
        <Text variant="cardTitle">{sessionTypeLabel(program.today.session_type)}</Text>
        {program.today.reasoning[0] && (
          <Text variant="body" tone="secondary">
            {program.today.reasoning[0]}
          </Text>
        )}
      </Card>

      {topGoals.length > 0 && (
        <View style={{ gap: SPACING.sm }}>
          <Text variant="sectionTitle">Top goals</Text>
          {topGoals.map((goal) => (
            <Card key={goal.id} style={{ gap: SPACING.xs }}>
              <Text variant="cardTitle">{goal.title}</Text>
              {goal.progress_pct != null ? (
                <Text variant="caption" tone="secondary">
                  {goal.progress_pct}% to target
                </Text>
              ) : (
                <Text variant="caption" tone="secondary">
                  {goal.status}
                </Text>
              )}
            </Card>
          ))}
        </View>
      )}

      {program.coach_observations[0] && (
        <InsightCard tone="accent" icon="💡" text={program.coach_observations[0]} />
      )}

      <InsightCard
        tone="recoveryBlue"
        icon="🗓️"
        text={`Next reassessment in ${program.identity.days_to_reassessment} day${program.identity.days_to_reassessment === 1 ? '' : 's'}.`}
      />
    </View>
  );
}
