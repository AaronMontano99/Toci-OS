import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { CustomScheduleDay, useCustomSchedule, useUpdateCustomSchedule } from '@/api/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { weekdayFull } from '@/lib/format';
import { SPACING } from '@/theme/tokens';

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

function emptyDay(weekday: number): CustomScheduleDay {
  return { weekday, split: '', movements: '', notes: '' };
}

export default function CustomScheduleScreen() {
  const { data, isLoading } = useCustomSchedule();
  const updateSchedule = useUpdateCustomSchedule();

  const [days, setDays] = useState<CustomScheduleDay[]>(WEEKDAYS.map(emptyDay));
  const [syncedFrom, setSyncedFrom] = useState<CustomScheduleDay[] | undefined>(undefined);

  if (data && data.days !== syncedFrom) {
    setSyncedFrom(data.days);
    const byWeekday = new Map(data.days.map((d) => [d.weekday, d]));
    setDays(WEEKDAYS.map((w) => byWeekday.get(w) ?? emptyDay(w)));
  }

  const updateField = (weekday: number, field: 'split' | 'movements' | 'notes', value: string) => {
    setDays((prev) => prev.map((d) => (d.weekday === weekday ? { ...d, [field]: value } : d)));
  };

  const onSave = async () => {
    const nonEmpty = days.filter((d) => d.split.trim() || d.movements.trim() || d.notes.trim());
    await updateSchedule.mutateAsync(nonEmpty);
    router.back();
  };

  if (isLoading) return null;

  return (
    <ScreenContainer>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <IconButton name="close" onPress={() => router.back()} />
        <Text variant="screenTitle">Your Own Program</Text>
      </View>

      <Text variant="body" tone="secondary">
        Write in your own split, movements, and notes for each day. Leave a day blank to skip it.
      </Text>

      {days.map((day) => (
        <Card key={day.weekday} style={{ gap: SPACING.sm }}>
          <Text variant="cardTitle">{weekdayFull(day.weekday)}</Text>
          <TextField
            placeholder="Split, e.g. Push Day"
            value={day.split}
            onChangeText={(v) => updateField(day.weekday, 'split', v)}
          />
          <TextField
            placeholder="Movements, e.g. Bench, OHP, Dips"
            value={day.movements}
            onChangeText={(v) => updateField(day.weekday, 'movements', v)}
            multiline
          />
          <TextField
            placeholder="Notes"
            value={day.notes}
            onChangeText={(v) => updateField(day.weekday, 'notes', v)}
            multiline
          />
        </Card>
      ))}

      <Button label="Save Schedule" onPress={onSave} loading={updateSchedule.isPending} />
    </ScreenContainer>
  );
}
