import { Stack } from 'expo-router';
import React from 'react';

import { OnboardingProvider } from '@/context/OnboardingContext';
import { useTheme } from '@/theme/ThemeContext';

export default function OnboardingLayout() {
  const { colors } = useTheme();

  return (
    <OnboardingProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
          gestureEnabled: false, // this flow drives its own back buttons -- no accidental swipe-out mid-interview
        }}
      />
    </OnboardingProvider>
  );
}
