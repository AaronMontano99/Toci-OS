import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { OptionCard } from '@/components/ui/OptionCard';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { useOnboarding } from '@/context/OnboardingContext';
import { OnboardingHeader } from '@/features/onboarding/OnboardingHeader';
import { RECOVERY_METHODS, TOTAL_QUESTION_STEPS } from '@/features/onboarding/catalog';
import { SPACING } from '@/theme/tokens';

export default function RecoveryScreen() {
  const { answers, update } = useOnboarding();

  return (
    <ScreenContainer>
      <OnboardingHeader step={9} total={TOTAL_QUESTION_STEPS} onBack={() => router.back()} />

      <View style={{ gap: SPACING.xs }}>
        <Text variant="screenTitle">Should Toci adjust training based on recovery?</Text>
        <Text variant="body" tone="secondary">
          Readiness — soreness, sleep, HRV — can shift what Toci recommends day to day.
        </Text>
      </View>

      <View style={{ gap: SPACING.sm }}>
        {RECOVERY_METHODS.map((option) => (
          <OptionCard
            key={option.key}
            label={option.label}
            detail={option.detail}
            icon={option.icon as any}
            selected={answers.recoveryMethod === option.key}
            onPress={() => update({ recoveryMethod: option.key })}
          />
        ))}
      </View>

      <Button
        label="Continue"
        disabled={!answers.recoveryMethod}
        onPress={() => router.push('/onboarding/confirmation')}
      />
    </ScreenContainer>
  );
}
