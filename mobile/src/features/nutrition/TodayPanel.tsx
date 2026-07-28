import React from 'react';
import { View } from 'react-native';

import { useDeleteFoodLogEntry, useHydrationToday, useNutritionRecommendation, useNutritionToday } from '@/api/hooks';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { titleCase } from '@/lib/format';
import { DailyRingsRow } from '@/features/nutrition/DailyRingsRow';
import { LogFoodCard } from '@/features/nutrition/LogFoodCard';
import { MacroCardGrid } from '@/features/nutrition/MacroCardGrid';
import { RecentMealsRow } from '@/features/nutrition/RecentMealsRow';
import { SmartPlanCard } from '@/features/nutrition/SmartPlanCard';
import { StreakBanner } from '@/features/nutrition/StreakBanner';
import { SPACING } from '@/theme/tokens';

function macroTargets(kcal: number | null) {
  if (!kcal) return null;
  return {
    calories: kcal,
    protein_g: (kcal * 0.3) / 4,
    carbs_g: (kcal * 0.4) / 4,
    fat_g: (kcal * 0.3) / 9,
  };
}

export function TodayPanel({ dailyCalorieGoal, onAddFood }: { dailyCalorieGoal: number | null; onAddFood: () => void }) {
  const { data: nutrition, isLoading } = useNutritionToday();
  const { data: recommendation } = useNutritionRecommendation();
  const { data: hydration } = useHydrationToday();
  const deleteEntry = useDeleteFoodLogEntry();

  if (isLoading || !nutrition) return <Skeleton height={220} radius={20} />;

  const targets = macroTargets(dailyCalorieGoal);

  return (
    <View style={{ gap: SPACING.base }}>
      <MacroCardGrid
        items={[
          {
            icon: '🔥',
            label: 'Calories',
            value: `${Math.round(nutrition.totals.calories)}`,
            target: targets ? `${Math.round(targets.calories)} kcal` : undefined,
            progress: targets ? nutrition.totals.calories / targets.calories : undefined,
          },
          {
            icon: '💪',
            label: 'Protein',
            value: `${Math.round(nutrition.totals.protein_g)}g`,
            target: targets ? `${Math.round(targets.protein_g)}g` : undefined,
            progress: targets ? nutrition.totals.protein_g / targets.protein_g : undefined,
          },
          {
            icon: '🌾',
            label: 'Carbs',
            value: `${Math.round(nutrition.totals.carbs_g)}g`,
            target: targets ? `${Math.round(targets.carbs_g)}g` : undefined,
            progress: targets ? nutrition.totals.carbs_g / targets.carbs_g : undefined,
          },
          {
            icon: '💧',
            label: 'Fat',
            value: `${Math.round(nutrition.totals.fat_g)}g`,
            target: targets ? `${Math.round(targets.fat_g)}g` : undefined,
            progress: targets ? nutrition.totals.fat_g / targets.fat_g : undefined,
          },
        ]}
      />

      <LogFoodCard totals={nutrition.totals} onAddFood={onAddFood} />

      {nutrition.entries.length === 0 ? (
        <EmptyState title="Nothing logged yet" detail="Log a meal to start today's nutrition coaching." />
      ) : (
        <>
          <RecentMealsRow entries={nutrition.entries} />
          <View style={{ gap: SPACING.sm }}>
            <Text variant="sectionTitle">Today&rsquo;s log</Text>
            {nutrition.entries.map((entry) => (
              <Card key={entry.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{entry.name}</Text>
                  <Text variant="caption" tone="tertiary">
                    {titleCase(entry.meal_slot)} · {Math.round(entry.calories)} kcal
                  </Text>
                </View>
                <IconButton name="trash-outline" size={18} onPress={() => deleteEntry.mutate(entry.id)} />
              </Card>
            ))}
          </View>
        </>
      )}

      {recommendation && <SmartPlanCard recommendation={recommendation} />}

      <DailyRingsRow
        calorieProgress={targets ? nutrition.totals.calories / targets.calories : null}
        hydrationOz={hydration?.ounces ?? null}
        hydrationGoalOz={hydration?.goal_oz ?? null}
      />

      <StreakBanner days={nutrition.logging_streak} />

      {nutrition.coaching?.length > 0 && (
        <View style={{ gap: SPACING.sm }}>
          {nutrition.coaching.map((msg, i) => (
            <Text key={i} variant="caption" tone="tertiary">
              {msg}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
