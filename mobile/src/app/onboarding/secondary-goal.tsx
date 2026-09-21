import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { OptionCard } from '@/components/ui/OptionCard';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { useOnboarding } from '@/context/OnboardingContext';
import { CoachReaction } from '@/features/onboarding/CoachReaction';
import { OnboardingHeader } from '@/features/onboarding/OnboardingHeader';
import { PRIMARY_GOALS, TOTAL_QUESTION_STEPS } from '@/features/onboarding/catalog';
import { afterPrimaryGoal } from '@/features/onboarding/reactions';
import { SPACING } from '@/theme/tokens';

export default function SecondaryGoalScreen() {
  const { answers, update } = useOnboarding();
  const options = PRIMARY_GOALS.filter((g) => g.key !== answers.primaryGoal);

  const goNext = () => router.push('/onboarding/experience');

  return (
    <ScreenContainer>
      <OnboardingHeader
        step={2}
        total={TOTAL_QUESTION_STEPS}
        onBack={() => router.back()}
        onSkip={() => {
          update({ secondaryGoal: null });
          goNext();
        }}
      />

      <CoachReaction text={afterPrimaryGoal(answers)} />

      <View style={{ gap: SPACING.xs }}>
        <Text variant="screenTitle">Anything else you want Toci to optimize for?</Text>
        <Text variant="body" tone="secondary">
          Optional — pick a second priority, or skip it.
        </Text>
      </View>

      <View style={{ gap: SPACING.sm }}>
        {options.map((goal) => (
          <OptionCard
            key={goal.key}
            label={goal.label}
            detail={goal.detail}
            icon={goal.icon as any}
            selected={answers.secondaryGoal === goal.key}
            onPress={() => update({ secondaryGoal: goal.key })}
          />
        ))}
      </View>

      <Button label="Continue" onPress={goNext} />
    </ScreenContainer>
  );
}
