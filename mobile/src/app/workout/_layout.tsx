import { Stack } from 'expo-router';
import React from 'react';

import { useTheme } from '@/theme/ThemeContext';

export default function WorkoutLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_bottom',
      }}
    />
  );
}
