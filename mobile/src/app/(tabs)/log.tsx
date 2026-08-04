import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useLiftDays, useLogSummary, useStartWorkout, useToday } from '@/api/hooks';
import { RecentSession } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { InsightCard } from '@/components/ui/InsightCard';
import { MacroStatRow } from '@/components/ui/MacroStatRow';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { formatDuration, weekdayFull } from '@/lib/format';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING } from '@/theme/tokens';

export default function LogTabScreen() {
  const { data: today, isLoading, refetch, isRefetching } = useToday();
  const { data: liftDays } = useLiftDays();
  const { data: logSummary } = useLogSummary('this_week');
  const startWorkout = useStartWorkout();

  if (isLoading) {
    return (
      <ScreenContainer>
        <Skeleton height={28} width="70%" />
        <Skeleton height={160} radius={24} />
      </ScreenContainer>
    );
  }

  const status = today?.workout_status;
  const sessionType = today?.recommendation.session_type;
  const liftIsActive = status?.state === 'active' && status.session_id;
  const liftIsDone = status?.state === 'completed' && status.session_id;

  const onLogLift = async () => {
    if (liftIsActive) {
      router.push(`/workout/${status!.session_id}`);
      return;
    }
    if (liftIsDone) {
      router.push(`/workout/${status!.session_id}/complete`);
      return;
    }
    const result = await startWorkout.mutateAsync(undefined);
    router.push(`/workout/${result.id}`);
  };

  const liftCardLabel = liftIsActive ? 'Resume' : liftIsDone ? 'Completed' : 'Start';

  return (
    <ScreenContainer onRefresh={refetch} refreshing={isRefetching}>
      <View>
        <Text variant="displayLarge">What are you doing today?</Text>
        <Text variant="body" tone="secondary">
          Track your training and keep building.
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
        <ActionCard
          icon="barbell"
          title="Log Lift Session"
          detail="Strength training, bodybuilding, HIIT"
          actionLabel={liftCardLabel}
          onPress={onLogLift}
          loading={startWorkout.isPending}
        />
        <ActionCard
          icon="walk"
          title="Log a Run"
          detail="Outdoor or treadmill runs"
          actionLabel={sessionType === 'run' && status?.state === 'completed' ? 'Completed' : 'Log'}
          onPress={() => router.push('/workout/log-run')}
        />
      </View>

      {logSummary && logSummary.recent_sessions.length > 0 && (
        <View style={{ gap: SPACING.sm }}>
          <Text variant="sectionTitle">Recent Sessions</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm }}>
            {logSummary.recent_sessions.map((session) => (
              <RecentSessionCard key={`${session.type}-${session.id}`} session={session} />
            ))}
          </ScrollView>
        </View>
      )}

      {logSummary && (
        <View style={{ gap: SPACING.sm }}>
          <Text variant="sectionTitle">Weekly Snapshot</Text>
          <MacroStatRow
            items={[
              {
                icon: 'barbell-outline',
                label: 'Lift Sessions',
                value: `${logSummary.week.lift_sessions}`,
                target: `${logSummary.week.lift_goal}`,
                progress: logSummary.week.lift_goal ? logSummary.week.lift_sessions / logSummary.week.lift_goal : undefined,
              },
              {
                icon: 'walk-outline',
                label: 'Runs',
                value: `${logSummary.week.runs}`,
                target: `${logSummary.week.run_goal}`,
                progress: logSummary.week.run_goal ? logSummary.week.runs / logSummary.week.run_goal : undefined,
              },
              {
                icon: 'time-outline',
                label: 'Total Time',
                value: formatDuration(logSummary.week.total_time_min),
                target: formatDuration(logSummary.week.time_goal_min),
                progress: logSummary.week.time_goal_min ? logSummary.week.total_time_min / logSummary.week.time_goal_min : undefined,
              },
              {
                icon: 'flame-outline',
                label: 'Est. Calories',
                value: `${logSummary.week.est_calories}`,
                target: `${logSummary.week.calorie_goal}`,
                progress: logSummary.week.calorie_goal ? logSummary.week.est_calories / logSummary.week.calorie_goal : undefined,
              },
            ]}
          />
          <InsightCard tone="accent" icon="✨" text={logSummary.encouragement} />
        </View>
      )}

      <View style={{ gap: SPACING.sm }}>
        <Text variant="sectionTitle">This week&rsquo;s plan</Text>
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

function ActionCard({
  icon,
  title,
  detail,
  actionLabel,
  onPress,
  loading,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  actionLabel: string;
  onPress: () => void;
  loading?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Card style={{ flex: 1, gap: SPACING.sm, backgroundColor: colors.accentWash, borderColor: colors.accentBorder }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.card,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={19} color={colors.accentInk} />
      </View>
      <Text variant="cardTitle" style={{ color: colors.accentInk }}>
        {title}
      </Text>
      <Text variant="caption" style={{ color: colors.accentInk, opacity: 0.85 }}>
        {detail}
      </Text>
      <Button label={actionLabel} size="compact" onPress={onPress} loading={loading} icon={<Ionicons name="arrow-forward" size={16} color={colors.onAccent} />} />
    </Card>
  );
}

function RecentSessionCard({ session }: { session: RecentSession }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => router.push(session.type === 'lift' ? `/workout/${session.id}/detail` : `/workout/run/${session.id}`)}
    >
      <Card style={{ width: 140, gap: 4 }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: RADIUS.small,
            backgroundColor: colors.accentWash,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={session.type === 'lift' ? 'barbell' : 'walk'} size={15} color={colors.accentInk} />
        </View>
        <Text variant="bodyStrong" numberOfLines={1}>
          {session.title}
        </Text>
        <Text variant="caption" tone="tertiary">
          {session.date}
        </Text>
        <Text
          variant="microLabel"
          style={{ color: colors.accentInk, backgroundColor: colors.accentWash, alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}
        >
          {session.type.toUpperCase()}
        </Text>
      </Card>
    </Pressable>
  );
}
