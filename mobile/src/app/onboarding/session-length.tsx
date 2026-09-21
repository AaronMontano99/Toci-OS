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
import { SESSION_LENGTHS, TOTAL_QUESTION_STEPS } from '@/features/onboarding/catalog';
import { afterSchedule } from '@/features/onboarding/reactions';
import { SPACING } from '@/theme/tokens';

export default function SessionLengthScreen() {
  const { answers, update } = useOnboarding();

  return (
    <ScreenContainer>
      <OnboardingHeader step={5} total={TOTAL_QUESTION_STEPS} onBack={() => router.back()} />

      <CoachReaction text={afterSchedule(answers)} />

      <View style={{ gap: SPACING.xs }}>
        <Text variant="screenTitle">How much time do you usually have?</Text>
        <Text variant="body" tone="secondary">
          Per session, door to door.
        </Text>
      </View>

      <View style={{ gap: SPACING.sm }}>
        {SESSION_LENGTHS.map((option) => (
          <OptionCard
            key={option.key}
            label={option.label}
            detail={option.detail}
            compact
            selected={answers.sessionLengthMin === Number(option.key)}
            onPress={() => update({ sessionLengthMin: Number(option.key) })}
          />
        ))}
      </View>

      <Button
        label="Continue"
        disabled={!answers.sessionLengthMin}
        onPress={() => router.push('/onboarding/equipment')}
      />
    </ScreenContainer>
  );
}
