import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { OptionCard } from '@/components/ui/OptionCard';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { useOnboarding } from '@/context/OnboardingContext';
import { OnboardingHeader } from '@/features/onboarding/OnboardingHeader';
import { EQUIPMENT_OPTIONS, TOTAL_QUESTION_STEPS } from '@/features/onboarding/catalog';
import { SPACING } from '@/theme/tokens';

export default function EquipmentScreen() {
  const { answers, update } = useOnboarding();

  return (
    <ScreenContainer>
      <OnboardingHeader step={6} total={TOTAL_QUESTION_STEPS} onBack={() => router.back()} />

      <View style={{ gap: SPACING.xs }}>
        <Text variant="screenTitle">Where do you usually train?</Text>
        <Text variant="body" tone="secondary">
          This determines which exercises Toci picks for you.
        </Text>
      </View>

      <View style={{ gap: SPACING.sm }}>
        {EQUIPMENT_OPTIONS.map((option) => (
          <OptionCard
            key={option.key}
            label={option.label}
            detail={option.detail}
            icon={option.icon as any}
            selected={answers.equipment === option.key}
            onPress={() => update({ equipment: option.key })}
          />
        ))}
      </View>

      <Button
        label="Continue"
        disabled={!answers.equipment}
        onPress={() => router.push('/onboarding/preferences')}
      />
    </ScreenContainer>
  );
}
