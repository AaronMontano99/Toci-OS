import React from 'react';
import { View } from 'react-native';

import { useNutritionToday, useSettings, useToday } from '@/api/hooks';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { MacroStatRow } from '@/components/ui/MacroStatRow';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { StreakPill } from '@/components/ui/StreakPill';
import { Text } from '@/components/ui/Text';
import { HeroWorkoutCard } from '@/features/today/HeroWorkoutCard';
import { ReadinessCard } from '@/features/today/ReadinessCard';
import { ThisWeekCard } from '@/features/today/ThisWeekCard';
import { WeightTrendCard } from '@/features/today/WeightTrendCard';
import { greeting } from '@/lib/format';
import { router } from 'expo-router';
import { SPACING } from '@/theme/tokens';

export default function TodayScreen() {
  const { data, isLoading, isError, error, refetch, isRefetching } = useToday();
  const { data: settings } = useSettings();
  const { data: nutrition } = useNutritionToday();

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
        <EmptyState title="Can't load today's plan" detail={(error as Error)?.message ?? 'Pull down to try again.'} />
      </ScreenContainer>
    );
  }

  const firstName = settings?.name?.split(' ')[0];
  const targets =
    settings?.daily_calorie_goal_kcal != null
      ? {
          calories: settings.daily_calorie_goal_kcal,
          protein_g: (settings.daily_calorie_goal_kcal * 0.3) / 4,
          carbs_g: (settings.daily_calorie_goal_kcal * 0.4) / 4,
          fat_g: (settings.daily_calorie_goal_kcal * 0.3) / 9,
        }
      : null;

  return (
    <ScreenContainer onRefresh={refetch} refreshing={isRefetching}>
      <ScreenHeader
        wordmark
        rightIcon="notifications-outline"
        showDot={!data.checked_in}
        onRightPress={() => router.push('/checkin')}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <Avatar name={settings?.name ?? 'T'} />
        <View style={{ flex: 1 }}>
          <Text variant="body" tone="secondary">
            {greeting()}
            {firstName ? `, ${firstName}` : ''}
          </Text>
          <Text variant="cardTitle">
            {new Date(`${data.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
        </View>
        <StreakPill days={data.streak} />
      </View>

      <ReadinessCard score={data.readiness.score} band={data.readiness.band} checkedIn={data.checked_in} />

      <HeroWorkoutCard
        sessionType={data.recommendation.session_type}
        prescription={data.recommendation.prescription}
        workoutStatus={data.workout_status}
      />

      {nutrition && (
        <MacroStatRow
          onPress={() => router.push('/nutrition')}
          items={[
            {
              icon: 'flame-outline',
              label: 'Calories',
              value: `${Math.round(nutrition.totals.calories)}`,
              target: targets ? `${Math.round(targets.calories)} kcal` : undefined,
              progress: targets ? nutrition.totals.calories / targets.calories : undefined,
            },
            {
              icon: 'fish-outline',
              label: 'Protein',
              value: `${Math.round(nutrition.totals.protein_g)}g`,
              target: targets ? `${Math.round(targets.protein_g)}g` : undefined,
              progress: targets ? nutrition.totals.protein_g / targets.protein_g : undefined,
            },
            {
              icon: 'cafe-outline',
              label: 'Carbs',
              value: `${Math.round(nutrition.totals.carbs_g)}g`,
              target: targets ? `${Math.round(targets.carbs_g)}g` : undefined,
              progress: targets ? nutrition.totals.carbs_g / targets.carbs_g : undefined,
            },
            {
              icon: 'water-outline',
              label: 'Fat',
              value: `${Math.round(nutrition.totals.fat_g)}g`,
              target: targets ? `${Math.round(targets.fat_g)}g` : undefined,
              progress: targets ? nutrition.totals.fat_g / targets.fat_g : undefined,
            },
          ]}
        />
      )}

      <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
        <WeightTrendCard />
        <ThisWeekCard week={data.week} />
      </View>
    </ScreenContainer>
  );
}
