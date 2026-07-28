import React from 'react';
import { View } from 'react-native';

import { useDeleteFoodLogEntry, useNutritionRecommendation, useNutritionToday, useSettings } from '@/api/hooks';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { InsightCard } from '@/components/ui/InsightCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { titleCase } from '@/lib/format';
import { useTheme } from '@/theme/ThemeContext';
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

export function TodayPanel() {
  const { colors } = useTheme();
  const { data: settings } = useSettings();
  const { data: nutrition, isLoading } = useNutritionToday();
  const { data: recommendation } = useNutritionRecommendation();
  const deleteEntry = useDeleteFoodLogEntry();

  if (isLoading || !nutrition) return <Skeleton height={220} radius={20} />;

  const targets = macroTargets(settings?.daily_calorie_goal_kcal ?? null);

  return (
    <View style={{ gap: SPACING.base }}>
      <Card style={{ gap: SPACING.base }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Text variant="heroMetric">{Math.round(nutrition.totals.calories)}</Text>
            <Text variant="microLabel" tone="tertiary">
              {targets ? `OF ${Math.round(targets.calories)} KCAL` : 'CALORIES LOGGED'}
            </Text>
          </View>
          <Text variant="caption" tone="tertiary">
            {nutrition.entries.length} item{nutrition.entries.length === 1 ? '' : 's'} logged
          </Text>
        </View>
        {targets && <ProgressBar progress={nutrition.totals.calories / targets.calories} />}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.sm }}>
          <MacroStat label="Protein" value={nutrition.totals.protein_g} target={targets?.protein_g} color={colors.sage} />
          <MacroStat label="Carbs" value={nutrition.totals.carbs_g} target={targets?.carbs_g} color={colors.recoveryBlue} />
          <MacroStat label="Fat" value={nutrition.totals.fat_g} target={targets?.fat_g} color={colors.warmAmber} />
        </View>
      </Card>

      {/* One AI suggestion per design-system.md §16 -- prefer the recommendation
          endpoint's headline (it already folds in the same calorie/protein
          coaching), falling back to the day's first coaching message only
          when no recommendation is configured yet. */}
      {recommendation?.headline ? (
        <InsightCard
          tone="accent"
          icon={recommendation.recommendation?.icon_emoji ?? '🍽️'}
          text={[recommendation.headline, recommendation.detail, recommendation.recommendation ? `Try: ${recommendation.recommendation.name}` : null]
            .filter(Boolean)
            .join(' ')}
        />
      ) : (
        nutrition.coaching?.[0] && <InsightCard tone="recoveryBlue" icon="💬" text={nutrition.coaching[0]} />
      )}

      <View style={{ gap: SPACING.sm }}>
        <Text variant="sectionTitle">Today&rsquo;s log</Text>
        {nutrition.entries.length === 0 ? (
          <EmptyState title="Nothing logged yet" detail="Log a meal to start today's nutrition coaching." />
        ) : (
          nutrition.entries.map((entry) => (
            <Card key={entry.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{entry.name}</Text>
                <Text variant="caption" tone="tertiary">
                  {titleCase(entry.meal_slot)} · {Math.round(entry.calories)} kcal
                </Text>
              </View>
              <IconButton name="trash-outline" size={18} onPress={() => deleteEntry.mutate(entry.id)} />
            </Card>
          ))
        )}
      </View>
    </View>
  );
}

function MacroStat({ label, value, target, color }: { label: string; value: number; target?: number; color: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 4, flex: 1 }}>
      <Text variant="bodyStrong">{Math.round(value)}g</Text>
      <Text variant="microLabel" tone="tertiary">
        {label.toUpperCase()}
      </Text>
      {target != null && <ProgressBar progress={value / target} color={color} height={4} />}
    </View>
  );
}
