import { useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { View } from 'react-native';

import { api } from '@/api/client';
import { NutritionRecommendation } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

function inferMealSlot(): string {
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

export function SmartPlanCard({ recommendation }: { recommendation: NutritionRecommendation }) {
  const { colors } = useTheme();

  if (!recommendation.configured || !recommendation.headline) return null;

  return (
    <Card style={{ gap: SPACING.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accentWash, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 14 }}>✨</Text>
        </View>
        <Text variant="cardTitle" style={{ flex: 1 }}>
          Smart Nutrition Plan
        </Text>
        <Text variant="microLabel" tone="accent">
          AI COACH
        </Text>
      </View>
      <Text variant="body" tone="secondary">
        {recommendation.headline} {recommendation.detail}
      </Text>

      {recommendation.recommendation && <RecipeChip recipe={recommendation.recommendation} />}
    </Card>
  );
}

function RecipeChip({ recipe }: { recipe: NonNullable<NutritionRecommendation['recommendation']> }) {
  const { colors } = useTheme();
  const qc = useQueryClient();
  // Reuses the existing /api/recipes/{id}/log endpoint -- same action as the
  // Recipes tab's "Log this recipe" button.
  const logRecipe = useMutation({
    mutationFn: () => api.post(`/api/recipes/${recipe.id}/log`, { servings: 1, meal_slot: inferMealSlot() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nutritionToday'] }),
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: colors.background, borderRadius: 14, padding: SPACING.sm }}>
      <Text style={{ fontSize: 22 }}>{recipe.icon_emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text variant="microLabel" tone="tertiary">
          RECOMMENDED
        </Text>
        <Text variant="bodyStrong" numberOfLines={1}>
          {recipe.name}
        </Text>
        <Text variant="caption" tone="tertiary">
          {Math.round(recipe.calories)} kcal · {Math.round(recipe.protein_g)}P {Math.round(recipe.carbs_g)}C {Math.round(recipe.fat_g)}F
        </Text>
      </View>
      <Button label="Add to Log" size="compact" fullWidth={false} loading={logRecipe.isPending} onPress={() => logRecipe.mutate()} />
    </View>
  );
}
