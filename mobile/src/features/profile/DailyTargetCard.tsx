import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { useHydrationToday, useNutritionToday, useSettings } from '@/api/hooks';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

export function DailyTargetCard({ onEdit }: { onEdit: () => void }) {
  const { colors } = useTheme();
  const { data: settings } = useSettings();
  const { data: nutrition } = useNutritionToday();
  const { data: hydration } = useHydrationToday();

  const calorieGoal = settings?.daily_calorie_goal_kcal ?? null;
  const proteinGoal = calorieGoal ? (calorieGoal * 0.3) / 4 : null;

  const rows = [
    {
      icon: 'flame-outline' as const,
      label: 'Calories',
      value: calorieGoal ? `${Math.round(calorieGoal)} kcal` : '—',
      progress: calorieGoal && nutrition ? nutrition.totals.calories / calorieGoal : 0,
    },
    {
      icon: 'fish-outline' as const,
      label: 'Protein',
      value: proteinGoal ? `${Math.round(proteinGoal)}g` : '—',
      progress: proteinGoal && nutrition ? nutrition.totals.protein_g / proteinGoal : 0,
    },
    {
      icon: 'water-outline' as const,
      label: 'Water',
      value: hydration ? `${Math.round(hydration.goal_oz)} oz` : '—',
      progress: hydration ? hydration.ounces / hydration.goal_oz : 0,
    },
  ];

  return (
    <Card style={{ gap: SPACING.sm, flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="microLabel" tone="accent">
          DAILY TARGET
        </Text>
        <Pressable onPress={onEdit}>
          <Text variant="caption" style={{ color: colors.accentInk, fontWeight: '700' }}>
            Edit
          </Text>
        </Pressable>
      </View>
      {rows.map((row) => (
        <View key={row.label} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name={row.icon} size={12} color={colors.textTertiary} />
              <Text variant="caption" tone="secondary">
                {row.label}
              </Text>
            </View>
            <Text variant="caption" tone="tertiary">
              {row.value}
            </Text>
          </View>
          <ProgressBar progress={row.progress} height={4} />
        </View>
      ))}
    </Card>
  );
}
