import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useLiftDayPrescription, useStartWorkout } from '@/api/hooks';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

// Bridges "start this saved day's workout" (Workout tab) into the same active
// workout screen the Today flow uses -- one implementation of workout logging.
export default function StartFromDayScreen() {
  const { colors } = useTheme();
  const { weekday } = useLocalSearchParams<{ weekday: string }>();
  const weekdayNum = Number(weekday);
  const { data: prescription, isError } = useLiftDayPrescription(weekdayNum);
  const startWorkout = useStartWorkout();
  const started = useRef(false);

  useEffect(() => {
    if (!prescription || started.current) return;
    started.current = true;
    startWorkout.mutateAsync(prescription.label).then((result) => {
      router.replace(`/workout/${result.id}?weekday=${weekdayNum}`);
    });
    // `started` guards this to a single run per mount; startWorkout/weekdayNum
    // are stable for the lifetime of that single run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prescription]);

  if (isError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm }}>
        <Text variant="cardTitle">Couldn&rsquo;t start that workout</Text>
        <Text variant="body" tone="secondary" center>
          No lift day is scheduled for this weekday.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm }}>
      <ActivityIndicator color={colors.accent} />
      <Text variant="body" tone="secondary">
        Preparing your workout…
      </Text>
    </View>
  );
}
