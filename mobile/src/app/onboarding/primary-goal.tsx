import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { OptionCard } from '@/components/ui/OptionCard';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { useOnboarding } from '@/context/OnboardingContext';
import { OnboardingHeader } from '@/features/onboarding/OnboardingHeader';
import { PRIMARY_GOALS, TOTAL_QUESTION_STEPS } from '@/features/onboarding/catalog';
import { SPACING } from '@/theme/tokens';

export default function PrimaryGoalScreen() {
  const { answers, update } = useOnboarding();

  return (
    <ScreenContainer>
      <OnboardingHeader step={1} total={TOTAL_QUESTION_STEPS} onBack={() => router.back()} />

      <View style={{ gap: SPACING.xs }}>
        <Text variant="screenTitle">What are you training for?</Text>
        <Text variant="body" tone="secondary">
          Pick the one that matters most right now.
        </Text>
      </View>

      <View style={{ gap: SPACING.sm }}>
        {PRIMARY_GOALS.map((goal) => (
          <OptionCard
            key={goal.key}
            label={goal.label}
            detail={goal.detail}
            icon={goal.icon as any}
            selected={answers.primaryGoal === goal.key}
            onPress={() => update({ primaryGoal: goal.key })}
          />
        ))}
      </View>

      <Button
        label="Continue"
        disabled={!answers.primaryGoal}
        onPress={() => router.push('/onboarding/secondary-goal')}
      />
    </ScreenContainer>
  );
}
