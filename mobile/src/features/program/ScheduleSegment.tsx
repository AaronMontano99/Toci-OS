import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useSwapScheduleDays } from '@/api/hooks';
import { WeekDetailDay } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { weekdayFull } from '@/lib/format';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

const DAY_TYPE_LABEL: Record<string, string> = { lift: 'Lift', run: 'Run', recover: 'Recovery', rest: 'Rest' };

// Full drag-and-drop reordering was floated in the design doc but never
// built. Tap-to-select-two-days swaps the same information (what's
// scheduled on which weekday) without the added complexity -- and it's a
// permanent template change, not a one-off for this week only.
export function ScheduleSegment({ week }: { week: WeekDetailDay[] }) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [swapFrom, setSwapFrom] = useState<number | null>(null);
  const swapDays = useSwapScheduleDays();

  const onTapSwap = (weekday: number) => {
    if (swapFrom == null) {
      setSwapFrom(weekday);
    } else if (swapFrom === weekday) {
      setSwapFrom(null);
    } else {
      swapDays.mutate({ weekday_a: swapFrom, weekday_b: weekday });
      setSwapFrom(null);
    }
  };

  return (
    <View style={{ gap: SPACING.sm }}>
      {swapFrom != null && (
        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.accentWash, borderColor: colors.accentBorder }}>
          <Text variant="caption" style={{ color: colors.accentInk }}>
            Choose a day to swap with {weekdayFull(swapFrom)}
          </Text>
          <Pressable onPress={() => setSwapFrom(null)}>
            <Text variant="caption" style={{ color: colors.accentInk, fontWeight: '700' }}>
              Cancel
            </Text>
          </Pressable>
        </Card>
      )}

      {week.map((day) => {
        const isOpen = expanded === day.date;
        const isRest = day.day_type === 'rest';
        return (
          <Card
            key={day.date}
            style={{
              gap: SPACING.sm,
              borderColor: swapFrom === day.weekday ? colors.accentBorder : day.is_today ? colors.accentBorder : colors.border,
              borderWidth: swapFrom === day.weekday || day.is_today ? 1.5 : 1,
            }}
          >
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
                <Text variant="caption" style={{ fontWeight: '700', color: colors.sage, marginRight: SPACING.sm }}>
                  Done
                </Text>
              )}
              <IconButton
                name="swap-horizontal-outline"
                size={16}
                background={false}
                color={swapFrom === day.weekday ? colors.accentInk : colors.textTertiary}
                accessibilityLabel={`Swap ${weekdayFull(day.weekday)}`}
                onPress={() => onTapSwap(day.weekday)}
              />
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
