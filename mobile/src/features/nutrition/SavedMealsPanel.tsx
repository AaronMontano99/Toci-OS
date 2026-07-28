import React, { useState } from 'react';
import { View } from 'react-native';

import { useCreateSavedMeal, useDeleteSavedMeal, useLogSavedMeal, useNutritionToday, useSavedMeals } from '@/api/hooks';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { SPACING } from '@/theme/tokens';

export function SavedMealsPanel() {
  const { data } = useSavedMeals();
  const logMeal = useLogSavedMeal();
  const deleteMeal = useDeleteSavedMeal();
  const [loggedId, setLoggedId] = useState<number | null>(null);

  return (
    <View style={{ gap: SPACING.sm }}>
      {!data?.meals.length ? (
        <EmptyState title="No saved meals yet" detail="Save a frequently-eaten meal to log it again in one tap." />
      ) : (
        data.meals.map((meal) => (
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
        ))
      )}

      <SaveTodaysLogCard />
    </View>
  );
}

// Building a saved meal by picking foods from scratch would duplicate the
// Food search flow. Instead, save what's already logged today -- the
// realistic moment for "I eat this combo, save it for next time" is right
// after eating it.
function SaveTodaysLogCard() {
  const { data: today } = useNutritionToday();
  const createMeal = useCreateSavedMeal();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const entries = today?.entries ?? [];
  if (entries.length === 0) return null;

  const onSave = async () => {
    if (!name.trim()) return;
    await createMeal.mutateAsync({
      name: name.trim(),
      items: entries.map((e) => ({ food_item_id: e.food_item_id, servings: e.servings })),
    });
    setName('');
    setNaming(false);
  };

  return naming ? (
    <Card style={{ gap: SPACING.sm }}>
      <Text variant="caption" tone="tertiary">
        Save today&rsquo;s {entries.length} logged item{entries.length === 1 ? '' : 's'} as a meal
      </Text>
      <TextField placeholder="e.g. My usual breakfast" value={name} onChangeText={setName} />
      <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
        <Button label="Save" size="compact" fullWidth={false} style={{ flex: 1 }} loading={createMeal.isPending} onPress={onSave} />
        <Button label="Cancel" variant="tertiary" size="compact" fullWidth={false} style={{ flex: 1 }} onPress={() => setNaming(false)} />
      </View>
    </Card>
  ) : (
    <Button label="Save Today's Log as a Meal" variant="secondary" onPress={() => setNaming(true)} />
  );
}
