import React, { useState } from 'react';
import { View } from 'react-native';

import { useRecipes } from '@/api/hooks';
import { RecipeSummary } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Text } from '@/components/ui/Text';
import { api } from '@/api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SPACING } from '@/theme/tokens';

function inferMealSlot(): string {
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  const qc = useQueryClient();
  const logRecipe = useMutation({
    mutationFn: () => api.post(`/api/recipes/${recipe.id}/log`, { servings: 1, meal_slot: inferMealSlot() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nutritionToday'] }),
  });
  const [logged, setLogged] = useState(false);

  return (
    <Card style={{ gap: SPACING.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <Text style={{ fontSize: 26 }}>{recipe.icon_emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text variant="cardTitle">{recipe.name}</Text>
          <Text variant="caption" tone="tertiary">
            {Math.round(recipe.calories)} kcal · {Math.round(recipe.protein_g)}g protein · {recipe.prep_minutes + recipe.cook_minutes} min
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {recipe.diet_tags.slice(0, 3).map((tag) => (
          <Text key={tag} variant="microLabel" tone="tertiary">
            #{tag}
          </Text>
        ))}
      </View>
      <Button
        label={logged ? 'Logged ✓' : 'Log this recipe'}
        variant="secondary"
        size="compact"
        loading={logRecipe.isPending}
        onPress={async () => {
          await logRecipe.mutateAsync();
          setLogged(true);
          setTimeout(() => setLogged(false), 1500);
        }}
      />
    </Card>
  );
}

export function RecipesPanel() {
  const { data } = useRecipes();

  if (!data?.recipes.length) {
    return <EmptyState title="No recipes available" detail="Recipes personalized to your diet will show up here." />;
  }

  return (
    <View style={{ gap: SPACING.sm }}>
      {data.recipes.map((r) => (
        <RecipeCard key={r.id} recipe={r} />
      ))}
    </View>
  );
}
