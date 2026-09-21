import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { OptionCard } from '@/components/ui/OptionCard';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useOnboarding } from '@/context/OnboardingContext';
import { CoachReaction } from '@/features/onboarding/CoachReaction';
import { OnboardingHeader } from '@/features/onboarding/OnboardingHeader';
import { SPLIT_PREFERENCES, TOTAL_QUESTION_STEPS } from '@/features/onboarding/catalog';
import { afterEquipment } from '@/features/onboarding/reactions';
import { SPACING } from '@/theme/tokens';

export default function PreferencesScreen() {
  const { answers, update } = useOnboarding();

  return (
    <ScreenContainer>
      <OnboardingHeader step={7} total={TOTAL_QUESTION_STEPS} onBack={() => router.back()} />

      <CoachReaction text={afterEquipment(answers)} />

      <View style={{ gap: SPACING.xs }}>
        <Text variant="screenTitle">How do you like to train?</Text>
        <Text variant="body" tone="secondary">
          Pick a split, and tell us anything that helps us tailor it.
        </Text>
      </View>

      <View style={{ gap: SPACING.sm }}>
        {SPLIT_PREFERENCES.map((option) => (
          <OptionCard
            key={option.key}
            label={option.label}
            detail={option.detail}
            compact
            selected={answers.splitPreference === option.key}
            onPress={() => update({ splitPreference: option.key })}
          />
        ))}
      </View>

      <TextField
        label="Anything else? (dislikes, cardio preferences, etc. — optional)"
        placeholder="e.g. no burpees, I like to finish with 10 min of biking"
        value={answers.trainingNotes}
        onChangeText={(v) => update({ trainingNotes: v })}
        multiline
      />

      <Button
        label="Continue"
        disabled={!answers.splitPreference}
        onPress={() => router.push('/onboarding/body-profile')}
      />
    </ScreenContainer>
  );
}
