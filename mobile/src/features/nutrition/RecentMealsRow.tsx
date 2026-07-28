import React from 'react';
import { ScrollView, View } from 'react-native';

import { FoodLogEntryOut } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { titleCase } from '@/lib/format';
import { SPACING } from '@/theme/tokens';

const MEAL_ICON: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };
const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];

export function RecentMealsRow({ entries }: { entries: FoodLogEntryOut[] }) {
  const byMeal = MEAL_ORDER.map((slot) => ({ slot, entry: entries.find((e) => e.meal_slot === slot) })).filter((m) => m.entry);

  if (byMeal.length === 0) return null;

  return (
    <View style={{ gap: SPACING.sm }}>
      <Text variant="sectionTitle">Recent Meals</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm }}>
        {byMeal.map(({ slot, entry }) => (
          <Card key={slot} style={{ width: 150, gap: 4 }}>
            <Text style={{ fontSize: 20 }}>{MEAL_ICON[slot]}</Text>
            <Text variant="microLabel" tone="accent">
              {titleCase(slot)}
            </Text>
            <Text variant="bodyStrong" numberOfLines={1}>
              {entry!.name}
            </Text>
            <Text variant="caption" tone="tertiary">
              {Math.round(entry!.calories)} kcal · {Math.round(entry!.protein_g)}P {Math.round(entry!.carbs_g)}C {Math.round(entry!.fat_g)}F
            </Text>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
