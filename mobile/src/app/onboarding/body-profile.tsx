import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { OptionCard } from '@/components/ui/OptionCard';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useOnboarding } from '@/context/OnboardingContext';
import { OnboardingHeader } from '@/features/onboarding/OnboardingHeader';
import { ACTIVITY_LEVELS, TOTAL_QUESTION_STEPS, paceOptionsFor } from '@/features/onboarding/catalog';
import { SPACING } from '@/theme/tokens';

export default function BodyProfileScreen() {
  const { answers, update } = useOnboarding();
  const paceOptions = paceOptionsFor(answers.primaryGoal);

  const canContinue =
    !!answers.sex &&
    !!answers.age &&
    !!answers.heightFeet &&
    !!answers.currentWeightLb &&
    !!answers.activityLevel &&
    (!paceOptions || (!!answers.goalWeightLb && !!answers.goalPaceKey));

  return (
    <ScreenContainer>
      <OnboardingHeader step={8} total={TOTAL_QUESTION_STEPS} onBack={() => router.back()} />

      <View style={{ gap: SPACING.xs }}>
        <Text variant="screenTitle">A little more about you.</Text>
        <Text variant="body" tone="secondary">
          Just what Toci actually needs to build your numbers.
        </Text>
      </View>

      <View style={{ gap: SPACING.sm }}>
        <OptionCard label="Male" compact selected={answers.sex === 'male'} onPress={() => update({ sex: 'male' })} />
        <OptionCard
          label="Female"
          compact
          selected={answers.sex === 'female'}
          onPress={() => update({ sex: 'female' })}
        />
      </View>

      <TextField
        label="Age"
        placeholder="e.g. 28"
        keyboardType="number-pad"
        value={answers.age}
        onChangeText={(v) => update({ age: v.replace(/[^0-9]/g, '') })}
      />

      <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
        <TextField
          label="Height (ft)"
          placeholder="5"
          keyboardType="number-pad"
          value={answers.heightFeet}
          onChangeText={(v) => update({ heightFeet: v.replace(/[^0-9]/g, '') })}
          style={{ flex: 1 }}
        />
        <TextField
          label="Height (in)"
          placeholder="10"
          keyboardType="number-pad"
          value={answers.heightInches}
          onChangeText={(v) => update({ heightInches: v.replace(/[^0-9]/g, '') })}
          style={{ flex: 1 }}
        />
      </View>

      <TextField
        label="Current weight (lb)"
        placeholder="e.g. 175"
        keyboardType="decimal-pad"
        value={answers.currentWeightLb}
        onChangeText={(v) => update({ currentWeightLb: v.replace(/[^0-9.]/g, '') })}
      />

      <View style={{ gap: SPACING.xs }}>
        <Text variant="cardTitle">Besides training, how active is your day?</Text>
      </View>
      <View style={{ gap: SPACING.sm }}>
        {ACTIVITY_LEVELS.map((option) => (
          <OptionCard
            key={option.key}
            label={option.label}
            detail={option.detail}
            compact
            selected={answers.activityLevel === option.key}
            onPress={() => update({ activityLevel: option.key })}
          />
        ))}
      </View>

      {paceOptions && (
        <View style={{ gap: SPACING.sm }}>
          <TextField
            label="Goal weight (lb)"
            placeholder="e.g. 165"
            keyboardType="decimal-pad"
            value={answers.goalWeightLb}
            onChangeText={(v) => update({ goalWeightLb: v.replace(/[^0-9.]/g, '') })}
          />
          <Text variant="cardTitle">How fast?</Text>
          {paceOptions.map((option) => (
            <OptionCard
              key={option.key}
              label={option.label}
              detail={option.detail}
              compact
              selected={answers.goalPaceKey === option.key}
              onPress={() => update({ goalPaceKey: option.key })}
            />
          ))}
        </View>
      )}

      <Button label="Continue" disabled={!canContinue} onPress={() => router.push('/onboarding/recovery')} />
    </ScreenContainer>
  );
}
