import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { OnboardingHeader } from '@/features/onboarding/OnboardingHeader';
import { TOTAL_QUESTION_STEPS } from '@/features/onboarding/catalog';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

export default function WelcomeScreen() {
  const { colors } = useTheme();

  return (
    <ScreenContainer contentContainerStyle={{ flexGrow: 1 }}>
      <OnboardingHeader step={0} total={TOTAL_QUESTION_STEPS} />

      <View style={{ flex: 1, justifyContent: 'center', gap: SPACING.xl }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 24,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.accentWash,
          }}
        >
          <Ionicons name="flame" size={36} color={colors.accentInk} />
        </View>

        <View style={{ gap: SPACING.md }}>
          <Text variant="displayLarge">Training shouldn&rsquo;t feel random.</Text>
          <Text variant="body" tone="secondary">
            Toci learns how you train, what you&rsquo;re working toward, and helps you know exactly what to do
            next. A few quick questions, then we&rsquo;ll build your starting plan together.
          </Text>
        </View>
      </View>

      <Button label="Get started" onPress={() => router.push('/onboarding/primary-goal')} />
    </ScreenContainer>
  );
}
