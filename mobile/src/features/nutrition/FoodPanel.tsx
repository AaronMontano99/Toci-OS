import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { useLogFood, useQuickAddFood, useSearchFoods } from '@/api/hooks';
import { FoodItem } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { SPACING } from '@/theme/tokens';

function inferMealSlot(): string {
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

export function FoodPanel({ date }: { date?: string } = {}) {
  const [query, setQuery] = useState('');
  const { data } = useSearchFoods(query);
  const logFood = useLogFood();
  const quickAdd = useQuickAddFood();
  const [loggedId, setLoggedId] = useState<number | null>(null);

  const onLog = async (food: FoodItem) => {
    await logFood.mutateAsync({ food_item_id: food.id, servings: 1, meal_slot: inferMealSlot(), date });
    setLoggedId(food.id);
    setTimeout(() => setLoggedId(null), 1500);
  };

  return (
    <View style={{ gap: SPACING.base }}>
      <View style={{ flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' }}>
        <TextField
          placeholder="Search foods…"
          value={query}
          onChangeText={setQuery}
          style={{ flex: 1 }}
        />
        <IconButton
          name="barcode-outline"
          onPress={() => router.push({ pathname: '/nutrition/scan', params: date ? { date } : undefined })}
        />
      </View>

      {!data?.foods.length ? (
        <View style={{ gap: SPACING.sm }}>
          <EmptyState
            title={query ? 'No matches' : 'Search or scan a food'}
            detail={query ? 'Try a different search term, or add it as a custom food.' : 'Your favorites and recent foods will appear here.'}
          />
          {query.trim().length > 0 && (
            <Button
              label="Add as Custom Food"
              variant="secondary"
              onPress={() => router.push({ pathname: '/nutrition/custom-food', params: date ? { date } : undefined })}
            />
          )}
        </View>
      ) : (
        <View style={{ gap: SPACING.sm }}>
          {data.foods.map((food) => (
            <Card key={food.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{food.name}</Text>
                <Text variant="caption" tone="tertiary">
                  {Math.round(food.calories)} kcal · {food.serving_qty}
                  {food.serving_unit}
                  {food.is_favorite ? ' · ★' : ''}
                </Text>
              </View>
              <Button
                label={loggedId === food.id ? 'Logged ✓' : 'Log'}
                size="compact"
                fullWidth={false}
                variant="secondary"
                onPress={() => onLog(food)}
                loading={logFood.isPending && logFood.variables?.food_item_id === food.id}
              />
            </Card>
          ))}
        </View>
      )}

      <Button
        label="Quick Add (calories only)"
        variant="tertiary"
        onPress={() =>
          quickAdd.mutate({ label: 'Quick Add', calories: 250, protein_g: 15, carbs_g: 20, fat_g: 10, meal_slot: inferMealSlot(), date })
        }
      />
    </View>
  );
}
