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
  const orderedWeek = week.length === 7 ? [week[6], ...week.slice(0, 6)] : week;

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.xs }}>
      {orderedWeek.map((day) => {
        const circleBg = day.is_completed ? colors.accent : 'transparent';
        const circleBorder = day.is_completed ? colors.accent : day.is_today ? colors.accent : colors.border;

        return (
          <View key={day.date} style={{ alignItems: 'center', gap: SPACING.xs }}>
            <Text variant="microLabel" tone={day.is_today ? 'accent' : 'tertiary'}>
              {weekdayLabel(day.weekday).charAt(0)}
            </Text>
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: circleBg,
                borderWidth: day.is_today && !day.is_completed ? 2 : day.is_completed ? 0 : 1,
                borderColor: circleBorder,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {day.is_completed ? (
                <Ionicons name="checkmark" size={10} color={colors.onAccent} />
              ) : day.is_today ? (
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.accent }} />
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
