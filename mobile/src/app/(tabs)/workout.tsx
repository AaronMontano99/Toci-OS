import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { useLiftDays, useLogSummary, useStartWorkout, useToday } from '@/api/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { formatDuration, weekdayFull } from '@/lib/format';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

export default function WorkoutTabScreen() {
  const { colors } = useTheme();
  const { data: today, isLoading, refetch, isRefetching } = useToday();
  const { data: liftDays } = useLiftDays();
  const { data: logSummary } = useLogSummary('this_week');
  const startWorkout = useStartWorkout();

  if (isLoading) {
    return (
      <ScreenContainer>
        <Skeleton height={160} radius={24} />
        <Skeleton height={200} radius={20} />
      </ScreenContainer>
    );
  }

  const status = today?.workout_status;
  const sessionType = today?.recommendation.session_type;

  return (
    <ScreenContainer onRefresh={refetch} refreshing={isRefetching}>
      <Text variant="screenTitle">Workout</Text>

      {status?.state === 'active' && status.session_id && (
        <Card style={{ gap: SPACING.sm, backgroundColor: colors.accentWash, borderColor: colors.accentBorder }}>
          <Text variant="cardTitle">Session in progress</Text>
          <Text variant="body" tone="secondary">
            {status.completed_exercise_count ?? 0} of {status.total_exercise_count ?? '—'} exercises logged
            {status.elapsed_min != null ? ` · ${formatDuration(status.elapsed_min)} elapsed` : ''}
          </Text>
          <Button label="Resume Workout" onPress={() => router.push(`/workout/${status.session_id}`)} />
        </Card>
      )}

      {status?.state !== 'active' && sessionType && sessionType !== 'rest' && (
        <Card style={{ gap: SPACING.sm }}>
          <Text variant="cardTitle">Today&rsquo;s recommended session</Text>
          <Button
            label={sessionType === 'run' ? 'Log Run' : 'Start Workout'}
            loading={startWorkout.isPending}
            onPress={async () => {
              if (sessionType === 'run') {
                router.push('/workout/log-run');
                return;
              }
              const result = await startWorkout.mutateAsync(undefined);
              router.push(`/workout/${result.id}`);
            }}
          />
        </Card>
      )}

      <Card style={{ gap: SPACING.sm }}>
        <Text variant="cardTitle">This week so far</Text>
        {logSummary ? (
          <>
            <Text variant="body" tone="secondary">
              {logSummary.week.lift_sessions}/{logSummary.week.lift_goal} lifts · {logSummary.week.runs}/
              {logSummary.week.run_goal} runs
            </Text>
            <Text variant="caption" tone="tertiary">
              {logSummary.encouragement}
            </Text>
          </>
        ) : (
          <Skeleton height={16} width="70%" />
        )}
      </Card>

      <View style={{ gap: SPACING.sm }}>
        <Text variant="sectionTitle">Choose a saved workout</Text>
        {!liftDays?.length ? (
          <EmptyState title="No lift days this week" detail="Your program has no scheduled lift sessions." />
        ) : (
          liftDays.map((day) => (
            <Card key={day.weekday} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text variant="cardTitle">{day.label}</Text>
                <Text variant="caption" tone="tertiary">
                  {weekdayFull(day.weekday)} · {day.exercise_count} exercises
                </Text>
              </View>
              <Button
                label={day.is_today ? 'Today' : 'Start'}
                variant="secondary"
                size="compact"
                fullWidth={false}
                onPress={() => router.push(`/workout/from-day/${day.weekday}`)}
              />
            </Card>
          ))
        )}
      </View>
    </ScreenContainer>
  );
}
