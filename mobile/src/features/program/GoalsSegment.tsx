import React, { useState } from 'react';
import { View } from 'react-native';

import { useCreateGoal, useSettings } from '@/api/hooks';
import { Goal } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { kgToDisplay, weightUnitLabel, Units } from '@/lib/units';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

const STATUS_COPY: Record<Goal['status'], string> = {
  improving: 'Trending in the right direction',
  stable: 'Holding steady',
  declining: 'Slipping — worth a look',
};

// Goal values are stored in the same canonical unit their `unit` field names
// (kg for strength goals) -- convert to the user's preferred display unit the
// same way every other weight in the app does.
function displayGoalValue(value: number, unit: string, units: Units): { value: string; unit: string } {
  if (unit === 'kg') {
    return { value: kgToDisplay(value, units).toFixed(1), unit: weightUnitLabel(units) };
  }
  return { value: `${value}`, unit };
}

function GoalCard({ goal, units }: { goal: Goal; units: Units }) {
  const { colors } = useTheme();
  return (
    <Card style={{ gap: SPACING.sm }}>
      <Text variant="cardTitle">{goal.title}</Text>
      {goal.start_value != null && goal.target_value != null ? (
        <>
          <ProgressBar progress={(goal.progress_pct ?? 0) / 100} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {[
              ['Start', goal.start_value],
              ['Current', goal.current_value],
              ['Target', goal.target_value],
            ].map(([label, value]) => {
              const display = value != null ? displayGoalValue(value as number, goal.unit, units) : null;
              return (
                <Text key={label as string} variant="caption" tone="tertiary">
                  {label} {display ? `${display.value}${display.unit}` : '—'}
                </Text>
              );
            })}
          </View>
        </>
      ) : null}
      <Text variant="caption" style={{ color: colors.textSecondary }}>
        {STATUS_COPY[goal.status]}
      </Text>
    </Card>
  );
}

export function GoalsSegment({ goals }: { goals: Goal[] }) {
  const { data: settings } = useSettings();
  const units = settings?.units ?? 'imperial';
  const createGoal = useCreateGoal();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');

  const primary = goals.filter((g) => !g.is_secondary);
  const secondary = goals.filter((g) => g.is_secondary);

  return (
    <View style={{ gap: SPACING.lg }}>
      {goals.length === 0 && <EmptyState title="No goals yet" detail="Add a goal to start tracking progress toward it." />}

      {primary.length > 0 && (
        <View style={{ gap: SPACING.sm }}>
          <Text variant="sectionTitle">Primary</Text>
          {primary.map((g) => (
            <GoalCard key={g.id} goal={g} units={units} />
          ))}
        </View>
      )}

      {secondary.length > 0 && (
        <View style={{ gap: SPACING.sm }}>
          <Text variant="sectionTitle">Secondary</Text>
          {secondary.map((g) => (
            <GoalCard key={g.id} goal={g} units={units} />
          ))}
        </View>
      )}

      {adding ? (
        <Card style={{ gap: SPACING.sm }}>
          <TextField placeholder="e.g. Run 3 miles continuously" value={title} onChangeText={setTitle} />
          <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
            <Button
              label="Save"
              size="compact"
              fullWidth={false}
              style={{ flex: 1 }}
              loading={createGoal.isPending}
              onPress={async () => {
                if (!title.trim()) return;
                await createGoal.mutateAsync({ title: title.trim(), kind: 'custom', is_secondary: true });
                setTitle('');
                setAdding(false);
              }}
            />
            <Button label="Cancel" variant="tertiary" size="compact" fullWidth={false} style={{ flex: 1 }} onPress={() => setAdding(false)} />
          </View>
        </Card>
      ) : (
        <Button label="Add Goal" variant="secondary" onPress={() => setAdding(true)} />
      )}
    </View>
  );
}
