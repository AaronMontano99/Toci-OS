import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

import { WeekDay } from '@/api/types';
import { Text } from '@/components/ui/Text';
import { weekdayLabel } from '@/lib/format';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING } from '@/theme/tokens';

const DAY_TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  lift: 'barbell',
  run: 'walk',
  recover: 'leaf',
  rest: 'moon',
};

export function WeekStrip({ week }: { week: WeekDay[] }) {
  const { colors } = useTheme();

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {week.map((day) => {
        const isRest = day.day_type === 'rest';
        const bg = day.is_today ? colors.accentWash : 'transparent';
        const iconColor = day.is_completed
          ? colors.sage
          : day.is_today
            ? colors.accentInk
            : isRest
              ? colors.textDisabled
              : colors.textSecondary;

        return (
          <View key={day.date} style={{ alignItems: 'center', gap: SPACING.xs, flex: 1 }}>
            <Text variant="microLabel" tone={day.is_today ? 'accent' : 'tertiary'}>
              {weekdayLabel(day.weekday)}
            </Text>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: RADIUS.small,
                backgroundColor: bg,
                borderWidth: day.is_today ? 1.5 : 0,
                borderColor: colors.accentBorder,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name={day.is_completed ? 'checkmark' : DAY_TYPE_ICON[day.day_type] ?? 'ellipse'}
                size={16}
                color={iconColor}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}
