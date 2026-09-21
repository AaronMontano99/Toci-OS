import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { useCompleteOnboarding, useCreateGoal, useUpdateSettings } from '@/api/hooks';
import { Button } from '@/components/ui/Button';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { useOnboarding } from '@/context/OnboardingContext';
import { goalLabel } from '@/features/onboarding/catalog';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

const BUILD_STEPS = ['Training split', 'Exercise selection', 'Volume', 'Progression', 'Recovery'];
const STEP_INTERVAL_MS = 550;

function feetInchesToCm(feet: string, inches: string): number {
  const totalInches = (Number(feet) || 0) * 12 + (Number(inches) || 0);
  return totalInches * 2.54;
}

function lbToKg(lb: string): number {
  return (Number(lb) || 0) * 0.45359237;
}

export default function BuildingScreen() {
  const { colors } = useTheme();
  const { answers } = useOnboarding();
  const updateSettings = useUpdateSettings();
  const createGoal = useCreateGoal();
  const completeOnboarding = useCompleteOnboarding();

  const [tickedCount, setTickedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const submitted = useRef(false);

  const submit = async () => {
    setError(null);
    try {
      const heightCm = feetInchesToCm(answers.heightFeet, answers.heightInches);
      const currentWeightKg = lbToKg(answers.currentWeightLb);
      const goalWeightKg = answers.goalWeightLb ? lbToKg(answers.goalWeightLb) : currentWeightKg;

      await updateSettings.mutateAsync({
        goal: answers.primaryGoal ?? undefined,
        experience_level: answers.experienceLevel ?? undefined,
        equipment: answers.equipment ?? undefined,
        age: answers.age ? Number(answers.age) : undefined,
        height_cm: heightCm || undefined,
        training_days_per_week: answers.daysPerWeek ?? undefined,
        session_length_min: answers.sessionLengthMin ?? undefined,
        training_split_preference: answers.splitPreference ?? undefined,
        training_notes: answers.trainingNotes || undefined,
        recovery_check_in_method: answers.recoveryMethod ?? undefined,
      });

      if (answers.secondaryGoal) {
        await createGoal.mutateAsync({ title: goalLabel(answers.secondaryGoal), kind: 'custom', is_secondary: true });
      }

      await completeOnboarding.mutateAsync({
        current_weight_kg: currentWeightKg,
        goal_weight_kg: goalWeightKg,
        goal_pace_key: answers.goalPaceKey ?? 'maintain',
        activity_level: answers.activityLevel ?? 'lightly_active',
        sex: answers.sex ?? 'male',
      });

      router.replace('/onboarding/reveal');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't build your plan — check your connection and try again.");
      submitted.current = false;
    }
  };

  useEffect(() => {
    if (tickedCount >= BUILD_STEPS.length) {
      if (!submitted.current) {
        submitted.current = true;
        submit();
      }
      return;
    }
    const timer = setTimeout(() => setTickedCount((c) => c + 1), STEP_INTERVAL_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickedCount]);

  return (
    <ScreenContainer contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <View style={{ gap: SPACING.xl }}>
        <View style={{ alignItems: 'center', gap: SPACING.sm }}>
          <Text variant="screenTitle" center>
            Building your starting plan…
          </Text>
          <Text variant="body" tone="secondary" center>
            This takes a few seconds.
          </Text>
        </View>

        <View style={{ gap: SPACING.base }}>
          {BUILD_STEPS.map((label, i) => {
            const done = i < tickedCount;
            const active = i === tickedCount;
            return (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.base }}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: done ? colors.accent : colors.backgroundSecondary,
                  }}
                >
                  {done ? (
                    <Ionicons name="checkmark" size={16} color={colors.onAccent} />
                  ) : (
                    <Text variant="caption" tone={active ? 'accent' : 'tertiary'} style={{ fontWeight: '700' }}>
                      {i + 1}
                    </Text>
                  )}
                </View>
                <Text variant="bodyStrong" tone={done || active ? 'primary' : 'tertiary'}>
                  {label}
                </Text>
              </View>
            );
          })}
        </View>

        {error && (
          <View style={{ gap: SPACING.sm }}>
            <Text variant="body" style={{ color: colors.mutedTerracotta }} center>
              {error}
            </Text>
            <Button
              label="Try again"
              onPress={() => {
                submitted.current = true;
                submit();
              }}
            />
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
