import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { OptionCard } from '@/components/ui/OptionCard';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { useOnboarding } from '@/context/OnboardingContext';
import { OnboardingHeader } from '@/features/onboarding/OnboardingHeader';
import { EXPERIENCE_LEVELS, TOTAL_QUESTION_STEPS } from '@/features/onboarding/catalog';
import { SPACING } from '@/theme/tokens';

export default function ExperienceScreen() {
  const { answers, update } = useOnboarding();

  return (
    <ScreenContainer>
      <OnboardingHeader step={3} total={TOTAL_QUESTION_STEPS} onBack={() => router.back()} />

      <View style={{ gap: SPACING.xs }}>
        <Text variant="screenTitle">Where are you starting from?</Text>
        <Text variant="body" tone="secondary">
          This changes how we program your first few weeks.
        </Text>
      </View>

      <View style={{ gap: SPACING.sm }}>
        {EXPERIENCE_LEVELS.map((level) => (
          <OptionCard
            key={level.key}
            label={level.label}
            detail={level.detail}
            selected={answers.experienceLevel === level.key}
            onPress={() => update({ experienceLevel: level.key })}
          />
        ))}
      </View>

      <Button
        label="Continue"
        disabled={!answers.experienceLevel}
        onPress={() => router.push('/onboarding/schedule')}
      />
    </ScreenContainer>
  );
}
