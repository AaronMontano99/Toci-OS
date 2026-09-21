import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { useOnboarding } from '@/context/OnboardingContext';
import { CoachReaction } from '@/features/onboarding/CoachReaction';
import { OnboardingHeader } from '@/features/onboarding/OnboardingHeader';
import { EQUIPMENT_OPTIONS, SPLIT_PREFERENCES, TOTAL_QUESTION_STEPS, goalLabel } from '@/features/onboarding/catalog';
import { afterRecovery } from '@/features/onboarding/reactions';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

function labelFor(list: { key: string; label: string }[], key: string | null): string {
  return list.find((o) => o.key === key)?.label ?? '—';
}

export default function ConfirmationScreen() {
  const { answers } = useOnboarding();
  const { colors } = useTheme();

  const lines = [
    goalLabel(answers.primaryGoal),
    answers.secondaryGoal ? `+ ${goalLabel(answers.secondaryGoal)}` : null,
    `Train ${answers.daysPerWeek}x/week`,
    `~${answers.sessionLengthMin} min/session`,
    labelFor(EQUIPMENT_OPTIONS, answers.equipment),
    labelFor(SPLIT_PREFERENCES, answers.splitPreference),
  ].filter(Boolean) as string[];

  return (
    <ScreenContainer>
      <OnboardingHeader step={10} total={TOTAL_QUESTION_STEPS} onBack={() => router.back()} />

      <CoachReaction text={afterRecovery(answers)} />

      <View style={{ gap: SPACING.xs }}>
        <Text variant="screenTitle">Here&rsquo;s what I heard.</Text>
        <Text variant="body" tone="secondary">
          Take a look — you can always change this later in Profile.
        </Text>
      </View>

      <Card style={{ gap: SPACING.sm }}>
        {lines.map((line, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
            <Text variant="bodyStrong">{line}</Text>
          </View>
        ))}
      </Card>

      <Button label="Build my plan" onPress={() => router.push('/onboarding/building')} />
    </ScreenContainer>
  );
}
