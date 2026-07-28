import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

import { WeekDay } from '@/api/types';
import { Text } from '@/components/ui/Text';
import { weekdayLabel } from '@/lib/format';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

export function WeekStrip({ week }: { week: WeekDay[] }) {
  const { colors } = useTheme();

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {week.map((day) => {
        const circleBg = day.is_completed ? colors.accent : 'transparent';
        const circleBorder = day.is_completed ? colors.accent : day.is_today ? colors.accent : colors.border;

        return (
          <View key={day.date} style={{ alignItems: 'center', gap: SPACING.xs }}>
            <Text variant="microLabel" tone={day.is_today ? 'accent' : 'tertiary'}>
              {weekdayLabel(day.weekday)}
            </Text>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: circleBg,
                borderWidth: day.is_today && !day.is_completed ? 2 : day.is_completed ? 0 : 1,
                borderColor: circleBorder,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {day.is_completed ? (
                <Ionicons name="checkmark" size={16} color={colors.onAccent} />
              ) : day.is_today ? (
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
