import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { useSettings } from '@/api/hooks';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Text } from '@/components/ui/Text';
import { CartPanel } from '@/features/nutrition/CartPanel';
import { RecipesPanel } from '@/features/nutrition/RecipesPanel';
import { SavedMealsPanel } from '@/features/nutrition/SavedMealsPanel';
import { TodayPanel } from '@/features/nutrition/TodayPanel';

const SEGMENTS = [
  { key: 'food', label: 'Food' },
  { key: 'saved', label: 'Saved Meals' },
  { key: 'recipes', label: 'Recipes' },
  { key: 'cart', label: 'Smart Cart' },
];

export default function NutritionScreen() {
  const [segment, setSegment] = useState('food');
  const { data: settings } = useSettings();

  return (
    <ScreenContainer>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton name="calendar-outline" onPress={() => {}} />
        <View style={{ alignItems: 'center' }}>
          <Text variant="caption" tone="tertiary">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </Text>
          <Text variant="screenTitle">Nutrition</Text>
        </View>
        <IconButton name="ellipsis-horizontal" onPress={() => {}} />
      </View>

      <SegmentedControl segments={SEGMENTS} selected={segment} onChange={setSegment} />
      {segment === 'food' && (
        <TodayPanel dailyCalorieGoal={settings?.daily_calorie_goal_kcal ?? null} onAddFood={() => router.push('/nutrition/add-food')} />
      )}
      {segment === 'saved' && <SavedMealsPanel />}
      {segment === 'recipes' && <RecipesPanel />}
      {segment === 'cart' && <CartPanel />}
    </ScreenContainer>
  );
}
