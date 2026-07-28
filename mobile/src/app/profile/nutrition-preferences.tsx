import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { useRecalculateCalories, useSettings, useUpdateSettings } from '@/api/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Skeleton } from '@/components/ui/Skeleton';
import { Stepper } from '@/components/ui/Stepper';
import { Text } from '@/components/ui/Text';
import { SPACING } from '@/theme/tokens';

const DIETARY = ['high_protein', 'mediterranean', 'vegetarian', 'vegan', 'low_carb', 'keto'];
const RESTRICTIONS = ['shellfish', 'peanuts', 'tree_nuts', 'dairy', 'gluten', 'soy'];

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function NutritionPreferencesScreen() {
  const { data: settings, isLoading } = useSettings();
  const update = useUpdateSettings();
  const recalc = useRecalculateCalories();

  if (isLoading || !settings) {
    return (
      <ScreenContainer>
        <Skeleton height={240} radius={20} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <IconButton name="chevron-back" onPress={() => router.back()} />
        <Text variant="screenTitle">Nutrition Preferences</Text>
      </View>

      <Card style={{ gap: SPACING.sm }}>
        <Text variant="cardTitle">Daily calorie goal</Text>
        <Text variant="heroMetricSmall">{settings.daily_calorie_goal_kcal ? Math.round(settings.daily_calorie_goal_kcal) : '—'} kcal</Text>
        <Button label="Recalculate from profile" variant="secondary" size="compact" loading={recalc.isPending} onPress={() => recalc.mutate()} />
      </Card>

      <View style={{ gap: SPACING.sm }}>
        <Text variant="sectionTitle">Dietary style</Text>
        <Card style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }}>
          {DIETARY.map((tag) => (
            <Chip
              key={tag}
              label={tag.replace('_', ' ')}
              selected={settings.dietary_preferences.includes(tag)}
              onPress={() => update.mutate({ dietary_preferences: toggle(settings.dietary_preferences, tag) })}
            />
          ))}
        </Card>
      </View>

      <View style={{ gap: SPACING.sm }}>
        <Text variant="sectionTitle">Food restrictions</Text>
        <Card style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }}>
          {RESTRICTIONS.map((tag) => (
            <Chip
              key={tag}
              label={tag.replace('_', ' ')}
              selected={settings.food_restrictions.includes(tag)}
              onPress={() => update.mutate({ food_restrictions: toggle(settings.food_restrictions, tag) })}
            />
          ))}
        </Card>
      </View>

      <Card style={{ gap: SPACING.base, alignItems: 'center' }}>
        <Text variant="cardTitle">Smart Cart settings</Text>
        <Stepper
          label="HOUSEHOLD SIZE"
          value={settings.household_size}
          step={1}
          min={1}
          max={10}
          onChange={(v) => update.mutate({ household_size: v })}
        />
        <Stepper
          label="WEEKLY BUDGET ($)"
          value={settings.shopping_weekly_budget ?? 100}
          step={10}
          min={0}
          max={1000}
          onChange={(v) => update.mutate({ shopping_weekly_budget: v })}
        />
      </Card>
    </ScreenContainer>
  );
}
