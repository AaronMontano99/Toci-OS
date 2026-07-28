import React from 'react';
import { View } from 'react-native';

import { useNutritionToday, useProgram, useSettings, useToday } from '@/api/hooks';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { InsightCard } from '@/components/ui/InsightCard';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { HeroWorkoutCard } from '@/features/today/HeroWorkoutCard';
import { ReadinessCard } from '@/features/today/ReadinessCard';
import { WeekStrip } from '@/features/today/WeekStrip';
import { formatTodayHeading, greeting } from '@/lib/format';
import { SPACING } from '@/theme/tokens';

export default function TodayScreen() {
  const { data, isLoading, isError, error, refetch, isRefetching } = useToday();
  const { data: settings } = useSettings();
  const { data: nutrition } = useNutritionToday();
  const { data: program } = useProgram();

  if (isLoading) {
    return (
      <ScreenContainer>
        <Skeleton height={28} width="60%" />
        <Skeleton height={140} radius={20} />
        <Skeleton height={220} radius={24} />
      </ScreenContainer>
    );
  }

  if (isError || !data) {
    return (
      <ScreenContainer onRefresh={refetch} refreshing={isRefetching}>
        <EmptyState
          title="Can't load today's plan"
          detail={(error as Error)?.message ?? 'Pull down to try again.'}
        />
      </ScreenContainer>
    );
  }

  const firstName = settings?.name?.split(' ')[0];
  const remainingCalories =
    nutrition && settings?.daily_calorie_goal_kcal
      ? Math.round(settings.daily_calorie_goal_kcal - nutrition.totals.calories)
      : null;
  const coachObservation = program?.coach_observations?.[0];

  return (
    <ScreenContainer onRefresh={refetch} refreshing={isRefetching}>
      <View>
        <Text variant="body" tone="secondary">
          {greeting()}{firstName ? `, ${firstName}` : ''}
        </Text>
        <Text variant="screenTitle">{formatTodayHeading(data.date)}</Text>
      </View>

      <ReadinessCard
        score={data.readiness.score}
        band={data.readiness.band}
        sleepMin={data.recovery.sleep_duration_min}
        hrvMs={data.recovery.hrv_ms}
        checkedIn={data.checked_in}
      />

      <HeroWorkoutCard
        sessionType={data.recommendation.session_type}
        prescription={data.recommendation.prescription}
        workoutStatus={data.workout_status}
        reasoning={data.recommendation.reasoning}
      />

      {remainingCalories != null && (
        <InsightCard
          tone="recoveryBlue"
          icon="🍽️"
          text={
            remainingCalories >= 0
              ? `${remainingCalories} calories remaining today.`
              : `You've gone ${Math.abs(remainingCalories)} calories over today's target.`
          }
        />
      )}

      {coachObservation && <InsightCard tone="accent" icon="💡" text={coachObservation} />}

      <Card style={{ gap: SPACING.base }}>
        <Text variant="sectionTitle">This week</Text>
        <WeekStrip week={data.week} />
      </Card>
    </ScreenContainer>
  );
}
