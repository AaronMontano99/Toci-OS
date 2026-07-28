import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';

import { useSettings, useStartWorkout, useToday } from '@/api/hooks';
import { Goal, ProgramResponse } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CoachNoteCard } from '@/components/ui/CoachNoteCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { ProgressPhotosCard } from '@/features/program/ProgressPhotosCard';
import { WeekStrip } from '@/features/today/WeekStrip';
import { formatWeight } from '@/lib/units';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING } from '@/theme/tokens';

const GOAL_ICON: Record<Goal['kind'], keyof typeof Ionicons.glyphMap> = {
  strength: 'barbell-outline',
  endurance: 'walk-outline',
  consistency: 'trending-up-outline',
  custom: 'flag-outline',
};

function GoalProgressCard({ goal, units }: { goal: Goal; units: 'imperial' | 'metric' }) {
  const { colors } = useTheme();
  const isWeight = goal.unit === 'kg';
  const displayCurrent = goal.current_value != null ? (isWeight ? formatWeight(goal.current_value, units, 1) : `${goal.current_value}${goal.unit}`) : '—';
  const displayTarget = goal.target_value != null ? (isWeight ? formatWeight(goal.target_value, units, 1) : `${goal.target_value}${goal.unit}`) : '—';

  return (
    <Card style={{ width: 150, gap: SPACING.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name={GOAL_ICON[goal.kind]} size={13} color={colors.accentInk} />
        <Text variant="microLabel" tone="tertiary" numberOfLines={1} style={{ flex: 1 }}>
          {goal.title}
        </Text>
      </View>
      <Text variant="bodyStrong">{displayCurrent}</Text>
      <ProgressBar progress={(goal.progress_pct ?? 0) / 100} />
      <Text variant="caption" tone="tertiary">
        Target {displayTarget}
      </Text>
    </Card>
  );
}

export function OverviewSegment({ program, onOpenCoach }: { program: ProgramResponse; onOpenCoach: () => void }) {
  const { colors } = useTheme();
  const { data: settings } = useSettings();
  const { data: todayData } = useToday();
  const startWorkout = useStartWorkout();
  const units = settings?.units ?? 'imperial';
  const today = program.week.find((d) => d.is_today);
  const status = todayData?.workout_status;

  const onStartOrResume = async () => {
    if (status?.state === 'active' && status.session_id) {
      router.push(`/workout/${status.session_id}`);
      return;
    }
    if (status?.state === 'completed' && status.session_id) {
      router.push(`/workout/${status.session_id}/complete`);
      return;
    }
    if (program.today.session_type === 'run') {
      router.push('/workout/log-run');
      return;
    }
    const result = await startWorkout.mutateAsync(undefined);
    router.push(`/workout/${result.id}`);
  };

  const primaryLabel =
    status?.state === 'active' ? 'Resume' : status?.state === 'completed' ? 'View Summary' : 'Start Workout';

  return (
    <View style={{ gap: SPACING.lg }}>
      <Card style={{ gap: SPACING.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="microLabel" tone="accent">
            TODAY&rsquo;S WORKOUT
          </Text>
          {today?.is_completed && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${colors.sage}22`, paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.pill }}>
              <Ionicons name="checkmark-circle" size={13} color={colors.sage} />
              <Text variant="caption" style={{ color: colors.sage, fontWeight: '700' }}>
                On Track
              </Text>
            </View>
          )}
        </View>
        <Text variant="cardTitle">{today?.label ?? program.today.session_type}</Text>
        {today && today.day_type === 'lift' && (
          <Text variant="caption" tone="tertiary">
            Est. {today.exercises.length * 8 + 10} min · {today.exercises.length} exercises
          </Text>
        )}
        {today && today.exercises.length > 0 && (
          <Text variant="body" tone="secondary" numberOfLines={1}>
            {today.exercises.map((e) => e.name).join(' · ')}
          </Text>
        )}
        <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
          <Button label="View Workout" variant="secondary" size="compact" fullWidth={false} style={{ flex: 1 }} onPress={() => router.push('/log')} />
          <Button
            label={primaryLabel}
            size="compact"
            fullWidth={false}
            style={{ flex: 1 }}
            loading={startWorkout.isPending}
            onPress={onStartOrResume}
          />
        </View>
      </Card>

      <Card style={{ gap: SPACING.sm }}>
        <Text variant="microLabel" tone="accent">
          THIS WEEK
        </Text>
        <WeekStrip week={program.week} />
      </Card>

      {program.goals.length > 0 && (
        <View style={{ gap: SPACING.sm }}>
          <Text variant="sectionTitle">Goal Progress</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm }}>
            {program.goals.map((goal) => (
              <GoalProgressCard key={goal.id} goal={goal} units={units} />
            ))}
          </ScrollView>
        </View>
      )}

      <ProgressPhotosCard />

      {program.coach_observations[0] && (
        <CoachNoteCard
          title="Keep pushing your progress."
          message={program.coach_observations[0]}
          actionLabel="New Message"
          onAction={onOpenCoach}
        />
      )}
    </View>
  );
}
