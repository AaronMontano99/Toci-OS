import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { useClearNutritionDay, useCopyNutritionDay, useSettings } from '@/api/hooks';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Text } from '@/components/ui/Text';
import { CartPanel } from '@/features/nutrition/CartPanel';
import { RecipesPanel } from '@/features/nutrition/RecipesPanel';
import { SavedMealsPanel } from '@/features/nutrition/SavedMealsPanel';
import { TodayPanel } from '@/features/nutrition/TodayPanel';
import { formatTodayHeading } from '@/lib/format';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

const SEGMENTS = [
  { key: 'food', label: 'Food' },
  { key: 'saved', label: 'Saved Meals' },
  { key: 'recipes', label: 'Recipes' },
  { key: 'cart', label: 'Smart Cart' },
];

function isoDateWithOffset(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function NutritionScreen() {
  const { colors } = useTheme();
  const [segment, setSegment] = useState('food');
  const [dayOffset, setDayOffset] = useState(0);
  const { data: settings } = useSettings();
  const copyDay = useCopyNutritionDay();
  const clearDay = useClearNutritionDay();

  const date = isoDateWithOffset(dayOffset);
  const isToday = dayOffset === 0;

  const onMenu = () => {
    Alert.alert('Nutrition Log', isToday ? 'Today' : formatTodayHeading(date), [
      {
        text: "Copy Previous Day's Log Here",
        onPress: async () => {
          await copyDay.mutateAsync({ from_date: isoDateWithOffset(dayOffset - 1), to_date: date });
        },
      },
      {
        text: 'Clear This Day’s Log',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Clear this day’s log?', 'Every food entry logged on this day will be removed. This can’t be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: () => clearDay.mutate(date) },
          ]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <ScreenContainer>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton name="chevron-back" onPress={() => setDayOffset((o) => o - 1)} accessibilityLabel="Previous day" />
        <Pressable onPress={() => setDayOffset(0)}>
          <View style={{ alignItems: 'center' }}>
            <Text variant="caption" tone="tertiary">
              {isToday ? 'Today' : formatTodayHeading(date)}
            </Text>
            <Text variant="screenTitle">Nutrition</Text>
          </View>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs }}>
          <IconButton
            name="chevron-forward"
            onPress={isToday ? undefined : () => setDayOffset((o) => o + 1)}
            accessibilityLabel="Next day"
            color={isToday ? colors.textDisabled : undefined}
          />
          <IconButton name="ellipsis-horizontal" onPress={onMenu} />
        </View>
      </View>

      <SegmentedControl segments={SEGMENTS} selected={segment} onChange={setSegment} />
      {segment === 'food' && (
        <TodayPanel
          dailyCalorieGoal={settings?.daily_calorie_goal_kcal ?? null}
          onAddFood={() => router.push(`/nutrition/add-food?date=${date}`)}
          date={date}
        />
      )}
      {segment === 'saved' && <SavedMealsPanel />}
      {segment === 'recipes' && <RecipesPanel />}
      {segment === 'cart' && <CartPanel />}
    </ScreenContainer>
  );
}
