import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { useSubmitCheckin, useToday } from '@/api/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Stepper } from '@/components/ui/Stepper';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

const SORENESS_LABELS = ['Very sore', 'Sore', 'Some soreness', 'Mostly fresh', 'Fresh'];
const MOOD_LABELS = ['Rough', 'Low', 'Okay', 'Good', 'Great'];

export default function CheckinScreen() {
  const { colors } = useTheme();
  const { data: today } = useToday();
  const submitCheckin = useSubmitCheckin();

  // Defaults track the server's simulated reading as it loads; once the user
  // nudges a stepper, their override takes over (same pattern as body weight
  // logging) rather than freezing on whatever loaded first.
  const defaultHrv = Math.round(today?.recovery.hrv_ms ?? 60);
  const defaultRhr = Math.round(today?.recovery.resting_hr_bpm ?? 55);
  const defaultSleepHours = Number(((today?.recovery.sleep_duration_min ?? 450) / 60).toFixed(2));

  const [hrvOverride, setHrvOverride] = useState<number | null>(null);
  const [rhrOverride, setRhrOverride] = useState<number | null>(null);
  const [sleepOverride, setSleepOverride] = useState<number | null>(null);
  const hrv = hrvOverride ?? defaultHrv;
  const rhr = rhrOverride ?? defaultRhr;
  const sleepHours = sleepOverride ?? defaultSleepHours;
  const [soreness, setSoreness] = useState(3);
  const [mood, setMood] = useState(4);

  const onSubmit = async () => {
    await submitCheckin.mutateAsync({
      hrv_ms: hrv,
      resting_hr_bpm: rhr,
      sleep_hours: sleepHours,
      soreness_1_5: soreness,
      stress_mood_1_5: mood,
    });
    router.back();
  };

  return (
    <ScreenContainer>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <IconButton name="close" onPress={() => router.back()} />
        <Text variant="screenTitle">Daily check-in</Text>
      </View>
      <Text variant="body" tone="secondary">
        Ten seconds — this tunes today&rsquo;s readiness and what Toci recommends.
      </Text>

      <Card style={{ gap: SPACING.lg }}>
        <RatingRow
          title="Soreness"
          labels={SORENESS_LABELS}
          value={soreness}
          onChange={setSoreness}
          colors={colors}
        />
        <RatingRow title="Mood / stress" labels={MOOD_LABELS} value={mood} onChange={setMood} colors={colors} />
      </Card>

      <Card style={{ gap: SPACING.lg }}>
        <Text variant="cardTitle">Recovery readings</Text>
        <Text variant="caption" tone="tertiary">
          Prefilled from your simulated baseline — adjust if you have real numbers.
        </Text>
        <View style={{ gap: SPACING.base }}>
          <Stepper label="HRV (ms)" value={hrv} step={1} min={20} max={150} onChange={setHrvOverride} />
          <Stepper label="Resting HR" value={rhr} step={1} min={35} max={100} onChange={setRhrOverride} />
        </View>
        <Stepper
          label="Sleep (hours)"
          value={sleepHours}
          step={0.25}
          min={2}
          max={12}
          formatValue={(v) => v.toFixed(2)}
          onChange={setSleepOverride}
        />
      </Card>

      <Button label="Save check-in" onPress={onSubmit} loading={submitCheckin.isPending} />
    </ScreenContainer>
  );
}

function RatingRow({
  title,
  labels,
  value,
  onChange,
  colors,
}: {
  title: string;
  labels: string[];
  value: number;
  onChange: (v: number) => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={{ gap: SPACING.sm }}>
      <Text variant="cardTitle">{title}</Text>
      <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
        {labels.map((label, i) => {
          const rating = i + 1;
          const active = rating === value;
          return (
            <Button
              key={label}
              label={String(rating)}
              size="compact"
              fullWidth={false}
              variant={active ? 'primary' : 'secondary'}
              style={{ flex: 1, paddingHorizontal: 0 }}
              onPress={() => onChange(rating)}
              haptics={false}
            />
          );
        })}
      </View>
      <Text variant="caption" tone="tertiary" center>
        {labels[value - 1]}
      </Text>
    </View>
  );
}
