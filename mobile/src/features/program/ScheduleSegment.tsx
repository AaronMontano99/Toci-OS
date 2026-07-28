import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { WeekDetailDay } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { weekdayFull } from '@/lib/format';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

const DAY_TYPE_LABEL: Record<string, string> = { lift: 'Lift', run: 'Run', recover: 'Recovery', rest: 'Rest' };

export function ScheduleSegment({ week }: { week: WeekDetailDay[] }) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <View style={{ gap: SPACING.sm }}>
      {week.map((day) => {
        const isOpen = expanded === day.date;
        const isRest = day.day_type === 'rest';
        return (
          <Card key={day.date} style={{ gap: SPACING.sm, borderColor: day.is_today ? colors.accentBorder : colors.border, borderWidth: day.is_today ? 1.5 : 1 }}>
            <Pressable onPress={() => setExpanded(isOpen ? null : day.date)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text variant="cardTitle" tone={isRest ? 'tertiary' : 'primary'}>
                  {weekdayFull(day.weekday)} {day.is_today ? '· Today' : ''}
                </Text>
                <Text variant="caption" tone="tertiary">
                  {DAY_TYPE_LABEL[day.day_type]} · {day.label}
                </Text>
              </View>
              {day.is_completed && (
                <Text variant="caption" style={{ fontWeight: '700', color: colors.sage }}>
                  Done
                </Text>
              )}
            </Pressable>

            {isOpen && (
              <View style={{ gap: SPACING.xs, paddingTop: SPACING.xs, borderTopWidth: 1, borderTopColor: colors.divider }}>
                {day.exercises.map((ex) => (
                  <Text key={ex.exercise_id} variant="body" tone="secondary">
                    {ex.name} — {ex.sets} × {ex.reps}
                  </Text>
                ))}
                {day.run && (
                  <Text variant="body" tone="secondary">
                    {day.run.run_type} · {day.run.duration_min} min · Zone {day.run.zone}
                  </Text>
                )}
                {day.conditioning_items.map((item, i) => (
                  <Text key={`c${i}`} variant="caption" tone="tertiary">
                    + {item}
                  </Text>
                ))}
                {day.mobility_items.map((item, i) => (
                  <Text key={`m${i}`} variant="caption" tone="tertiary">
                    • {item}
                  </Text>
                ))}
                {day.note && (
                  <Text variant="caption" tone="tertiary">
                    {day.note}
                  </Text>
                )}
                {day.is_today && day.day_type === 'lift' && !day.is_completed && (
                  <Pressable onPress={() => router.push(`/workout/from-day/${day.weekday}`)}>
                    <Text variant="caption" style={{ fontWeight: '700', color: colors.accentInk, marginTop: 4 }}>
                      Start this workout →
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </Card>
        );
      })}
    </View>
  );
}
