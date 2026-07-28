import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useDeleteFoodLogEntry, useHydrationToday, useNutritionRecommendation, useNutritionToday, useUpdateFoodLogEntry } from '@/api/hooks';
import { FoodLogEntryOut } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { Stepper } from '@/components/ui/Stepper';
import { Text } from '@/components/ui/Text';
import { titleCase } from '@/lib/format';
import { DailyRingsRow } from '@/features/nutrition/DailyRingsRow';
import { LogFoodCard } from '@/features/nutrition/LogFoodCard';
import { MacroCardGrid } from '@/features/nutrition/MacroCardGrid';
import { RecentMealsRow } from '@/features/nutrition/RecentMealsRow';
import { SmartPlanCard } from '@/features/nutrition/SmartPlanCard';
import { StreakBanner } from '@/features/nutrition/StreakBanner';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING } from '@/theme/tokens';

function macroTargets(kcal: number | null) {
  if (!kcal) return null;
  return {
    calories: kcal,
    protein_g: (kcal * 0.3) / 4,
    carbs_g: (kcal * 0.4) / 4,
    fat_g: (kcal * 0.3) / 9,
  };
}

export function TodayPanel({ dailyCalorieGoal, onAddFood }: { dailyCalorieGoal: number | null; onAddFood: () => void }) {
  const { data: nutrition, isLoading } = useNutritionToday();
  const { data: recommendation } = useNutritionRecommendation();
  const { data: hydration } = useHydrationToday();
  const deleteEntry = useDeleteFoodLogEntry();
  const updateEntry = useUpdateFoodLogEntry();
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);

  if (isLoading || !nutrition) return <Skeleton height={220} radius={20} />;

  const targets = macroTargets(dailyCalorieGoal);

  return (
    <View style={{ gap: SPACING.base }}>
      <MacroCardGrid
        items={[
          {
            icon: '🔥',
            label: 'Calories',
            value: `${Math.round(nutrition.totals.calories)}`,
            target: targets ? `${Math.round(targets.calories)} kcal` : undefined,
            progress: targets ? nutrition.totals.calories / targets.calories : undefined,
          },
          {
            icon: '💪',
            label: 'Protein',
            value: `${Math.round(nutrition.totals.protein_g)}g`,
            target: targets ? `${Math.round(targets.protein_g)}g` : undefined,
            progress: targets ? nutrition.totals.protein_g / targets.protein_g : undefined,
          },
          {
            icon: '🌾',
            label: 'Carbs',
            value: `${Math.round(nutrition.totals.carbs_g)}g`,
            target: targets ? `${Math.round(targets.carbs_g)}g` : undefined,
            progress: targets ? nutrition.totals.carbs_g / targets.carbs_g : undefined,
          },
          {
            icon: '💧',
            label: 'Fat',
            value: `${Math.round(nutrition.totals.fat_g)}g`,
            target: targets ? `${Math.round(targets.fat_g)}g` : undefined,
            progress: targets ? nutrition.totals.fat_g / targets.fat_g : undefined,
          },
        ]}
      />

      <LogFoodCard totals={nutrition.totals} onAddFood={onAddFood} />

      {nutrition.entries.length === 0 ? (
        <EmptyState title="Nothing logged yet" detail="Log a meal to start today's nutrition coaching." />
      ) : (
        <>
          <RecentMealsRow entries={nutrition.entries} />
          <View style={{ gap: SPACING.sm }}>
            <Text variant="sectionTitle">Today&rsquo;s log</Text>
            {nutrition.entries.map((entry) =>
              editingEntryId === entry.id ? (
                <EditingFoodRow
                  key={entry.id}
                  entry={entry}
                  onSave={(servings) => {
                    updateEntry.mutate({ entryId: entry.id, servings });
                    setEditingEntryId(null);
                  }}
                  onCancel={() => setEditingEntryId(null)}
                />
              ) : (
                <FoodLogRow
                  key={entry.id}
                  entry={entry}
                  onEdit={() => setEditingEntryId(entry.id)}
                  onDelete={() => deleteEntry.mutate(entry.id)}
                />
              ),
            )}
          </View>
        </>
      )}

      {recommendation && <SmartPlanCard recommendation={recommendation} />}

      <DailyRingsRow
        calorieProgress={targets ? nutrition.totals.calories / targets.calories : null}
        hydrationOz={hydration?.ounces ?? null}
        hydrationGoalOz={hydration?.goal_oz ?? null}
      />

      <StreakBanner days={nutrition.logging_streak} />

      {nutrition.coaching?.length > 0 && (
        <View style={{ gap: SPACING.sm }}>
          {nutrition.coaching.map((msg, i) => (
            <Text key={i} variant="caption" tone="tertiary">
              {msg}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

// Tap a logged entry to fix its serving size instead of the only prior
// recourse -- delete and re-log, which loses its spot in the day's log.
function FoodLogRow({ entry, onEdit, onDelete }: { entry: FoodLogEntryOut; onEdit: () => void; onDelete: () => void }) {
  const { colors } = useTheme();
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Pressable onPress={onEdit} style={{ flex: 1 }}>
        <Text variant="bodyStrong">{entry.name}</Text>
        <Text variant="caption" tone="tertiary">
          {titleCase(entry.meal_slot)} · {Math.round(entry.calories)} kcal · {entry.servings} × {entry.serving_qty}
          {entry.serving_unit}
        </Text>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <Ionicons name="pencil-outline" size={14} color={colors.textTertiary} />
        <IconButton name="trash-outline" size={18} onPress={onDelete} />
      </View>
    </Card>
  );
}

function EditingFoodRow({ entry, onSave, onCancel }: { entry: FoodLogEntryOut; onSave: (servings: number) => void; onCancel: () => void }) {
  const { colors } = useTheme();
  const [servings, setServings] = useState(entry.servings);

  return (
    <Card style={{ gap: SPACING.sm, backgroundColor: colors.backgroundSecondary }}>
      <Text variant="caption" tone="tertiary">
        Editing {entry.name}
      </Text>
      <Stepper
        label={`SERVINGS (${entry.serving_qty}${entry.serving_unit} each)`}
        value={servings}
        step={0.5}
        min={0.5}
        formatValue={(v) => v.toFixed(1)}
        onChange={setServings}
      />
      <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
        <Pressable
          onPress={() => onSave(servings)}
          style={{ flex: 1, alignItems: 'center', paddingVertical: SPACING.sm, borderRadius: RADIUS.input, backgroundColor: colors.accent }}
        >
          <Text variant="bodyStrong" style={{ color: colors.onAccent }}>
            Save
          </Text>
        </Pressable>
        <Pressable onPress={onCancel} style={{ flex: 1, alignItems: 'center', paddingVertical: SPACING.sm }}>
          <Text variant="bodyStrong" style={{ color: colors.textSecondary }}>
            Cancel
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}
