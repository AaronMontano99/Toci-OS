import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { useOnboarding } from '@/context/OnboardingContext';
import { EQUIPMENT_OPTIONS, SPLIT_PREFERENCES, goalLabel } from '@/features/onboarding/catalog';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING, shadow } from '@/theme/tokens';

function labelFor(list: { key: string; label: string }[], key: string | null): string | null {
  return list.find((o) => o.key === key)?.label ?? null;
}

export default function RevealScreen() {
  const { colors, colorScheme } = useTheme();
  const { answers } = useOnboarding();

  const splitLabel = labelFor(SPLIT_PREFERENCES, answers.splitPreference);
  const equipmentLabel = labelFor(EQUIPMENT_OPTIONS, answers.equipment);
  const secondary = answers.secondaryGoal ? ` + ${goalLabel(answers.secondaryGoal)}` : '';

  return (
    <ScreenContainer contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <View style={{ gap: SPACING.xl }}>
        <View style={{ alignItems: 'center', gap: SPACING.sm }}>
          <Ionicons name="sparkles" size={32} color={colors.accentInk} />
          <Text variant="screenTitle" center>
            Your program is ready.
          </Text>
        </View>

        <LinearGradient
          colors={colors.accentGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[{ borderRadius: RADIUS.hero, padding: SPACING.xl, gap: SPACING.sm }, shadow('elevated', colorScheme)]}
        >
          <Text variant="microLabel" style={{ color: colors.onAccent, opacity: 0.8 }}>
            YOUR STARTING PLAN
          </Text>
          <Text variant="screenTitle" style={{ color: colors.onAccent }}>
            {goalLabel(answers.primaryGoal)}
            {secondary}
          </Text>
          <View style={{ gap: 4, marginTop: SPACING.sm }}>
            {splitLabel && (
              <Text variant="body" style={{ color: colors.onAccent }}>
                {splitLabel} · {answers.daysPerWeek} days/week
              </Text>
            )}
            <Text variant="body" style={{ color: colors.onAccent }}>
              ~{answers.sessionLengthMin} min/session
            </Text>
            {equipmentLabel && (
              <Text variant="body" style={{ color: colors.onAccent }}>
                {equipmentLabel}
              </Text>
            )}
          </View>
        </LinearGradient>

        <Text variant="body" tone="secondary" center>
          Toci will adjust your weights, volume, exercise selection, and recovery recommendations as it learns
          from your training.
        </Text>
      </View>

      <Button label="Start Day 1" onPress={() => router.replace('/(tabs)')} />
    </ScreenContainer>
  );
}
