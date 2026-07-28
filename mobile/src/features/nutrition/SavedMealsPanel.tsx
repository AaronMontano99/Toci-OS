import React, { useState } from 'react';
import { View } from 'react-native';

import { useDeleteSavedMeal, useLogSavedMeal, useSavedMeals } from '@/api/hooks';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { SPACING } from '@/theme/tokens';

export function SavedMealsPanel() {
  const { data } = useSavedMeals();
  const logMeal = useLogSavedMeal();
  const deleteMeal = useDeleteSavedMeal();
  const [loggedId, setLoggedId] = useState<number | null>(null);

  if (!data?.meals.length) {
    return <EmptyState title="No saved meals yet" detail="Save a frequently-eaten meal to log it again in one tap." />;
  }

  return (
    <View style={{ gap: SPACING.sm }}>
      {data.meals.map((meal) => (
        <Card key={meal.id} style={{ gap: SPACING.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text variant="cardTitle">{meal.name}</Text>
              <Text variant="caption" tone="tertiary">
                {Math.round(meal.total_calories)} kcal · {meal.items.length} item{meal.items.length === 1 ? '' : 's'}
              </Text>
            </View>
            <IconButton name="trash-outline" size={16} onPress={() => deleteMeal.mutate(meal.id)} />
          </View>
          <Button
            label={loggedId === meal.id ? 'Logged ✓' : 'Log this meal'}
            variant="secondary"
            size="compact"
            loading={logMeal.isPending}
            onPress={async () => {
              await logMeal.mutateAsync({ id: meal.id });
              setLoggedId(meal.id);
              setTimeout(() => setLoggedId(null), 1500);
            }}
          />
        </Card>
      ))}
    </View>
  );
}
