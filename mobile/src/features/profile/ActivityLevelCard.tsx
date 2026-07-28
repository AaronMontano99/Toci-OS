import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { useToday } from '@/api/hooks';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { WeekStrip } from '@/features/today/WeekStrip';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

const ACTIVITY_COPY: Record<string, { label: string; detail: string }> = {
  sedentary: { label: 'Sedentary', detail: 'Little to no exercise' },
  lightly_active: { label: 'Lightly Active', detail: '1–2 workouts per week' },
  active: { label: 'Active', detail: '3–5 workouts per week' },
  very_active: { label: 'Very Active', detail: '6+ workouts per week' },
};

export function ActivityLevelCard({ activityLevel, onEdit }: { activityLevel: string | null; onEdit: () => void }) {
  const { colors } = useTheme();
  const { data: today } = useToday();
  const copy = activityLevel ? ACTIVITY_COPY[activityLevel] : undefined;

  const trainingDays = today?.week.filter((d) => d.day_type !== 'rest') ?? [];
  const activeDays = trainingDays.filter((d) => d.is_completed).length;
  const ratio = trainingDays.length ? activeDays / trainingDays.length : 0;

  return (
    <Card style={{ gap: SPACING.sm, flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="microLabel" tone="accent">
          ACTIVITY LEVEL
        </Text>
        <Pressable onPress={onEdit}>
          <Text variant="caption" style={{ color: colors.accentInk, fontWeight: '700' }}>
            Edit
          </Text>
        </Pressable>
      </View>

      {copy && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: colors.accentWash, borderRadius: 12, padding: SPACING.sm }}>
          <Ionicons name="pulse-outline" size={16} color={colors.accentInk} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" style={{ color: colors.accentInk }}>
              {copy.label}
            </Text>
            <Text variant="caption" style={{ color: colors.accentInk, opacity: 0.85 }}>
              {copy.detail}
            </Text>
          </View>
        </View>
      )}

      <Text variant="caption" tone="tertiary">
        This helps us personalize your plans and daily targets.
      </Text>

      {today && <WeekStrip week={today.week} />}

      <Text variant="bodyStrong">
        {activeDays} of {trainingDays.length} days active
      </Text>
      <ProgressBar progress={ratio} />
    </Card>
  );
}
