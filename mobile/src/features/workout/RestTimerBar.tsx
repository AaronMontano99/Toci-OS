import React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useWorkoutContext } from '@/context/WorkoutContext';
import { formatClock } from '@/lib/format';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING, shadow } from '@/theme/tokens';

// Compact, non-blocking rest timer -- design-system.md §12: "should not block
// logging or navigation," offers +30 sec and Skip.
export function RestTimerBar() {
  const { colors, colorScheme } = useTheme();
  const { restSecondsLeft, restTotal, addRestSeconds, skipRest } = useWorkoutContext();

  if (restSecondsLeft == null || restTotal == null) return null;
  const progress = 1 - restSecondsLeft / restTotal;

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: SPACING.md,
          backgroundColor: colors.card,
          borderRadius: RADIUS.button,
          borderWidth: 1,
          borderColor: colors.border,
          padding: SPACING.sm,
          paddingLeft: SPACING.base,
        },
        shadow('elevated', colorScheme),
      ]}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentWash }}>
        <Text variant="caption" style={{ fontWeight: '700', color: colors.accentInk }}>
          {formatClock(restSecondsLeft)}
        </Text>
      </View>
      <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
        Rest — {Math.round(progress * 100)}%
      </Text>
      <Pressable onPress={() => addRestSeconds(30)} hitSlop={6} style={{ paddingHorizontal: SPACING.sm, paddingVertical: 6 }}>
        <Text variant="caption" style={{ fontWeight: '700', color: colors.accentInk }}>
          +30s
        </Text>
      </Pressable>
      <Pressable onPress={skipRest} hitSlop={6} style={{ paddingHorizontal: SPACING.sm, paddingVertical: 6 }}>
        <Text variant="caption" tone="tertiary" style={{ fontWeight: '700' }}>
          Skip
        </Text>
      </Pressable>
    </View>
  );
}
