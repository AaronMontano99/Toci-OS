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
import { TOTAL_QUESTION_STEPS, TRAINING_DAYS } from '@/features/onboarding/catalog';
import { afterExperience } from '@/features/onboarding/reactions';
import { SPACING } from '@/theme/tokens';

export default function ScheduleScreen() {
  const { answers, update } = useOnboarding();

  return (
    <ScreenContainer>
      <OnboardingHeader step={4} total={TOTAL_QUESTION_STEPS} onBack={() => router.back()} />

      <CoachReaction text={afterExperience(answers)} />

      <View style={{ gap: SPACING.xs }}>
        <Text variant="screenTitle">How often do you realistically want to train?</Text>
        <Text variant="body" tone="secondary">
          Pick what you&rsquo;ll actually stick to, not your best week ever.
        </Text>
      </View>

      <View style={{ gap: SPACING.sm }}>
        {TRAINING_DAYS.map((day) => (
          <OptionCard
            key={day.key}
            label={day.label}
            compact
            selected={answers.daysPerWeek === Number(day.key)}
            onPress={() => update({ daysPerWeek: Number(day.key) })}
          />
        ))}
      </View>

      <Button
        label="Continue"
        disabled={!answers.daysPerWeek}
        onPress={() => router.push('/onboarding/session-length')}
      />
    </ScreenContainer>
  );
}
