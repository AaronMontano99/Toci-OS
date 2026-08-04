import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { useLogRun, useSettings } from '@/api/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Stepper } from '@/components/ui/Stepper';
import { Text } from '@/components/ui/Text';
import { SPACING } from '@/theme/tokens';

const EFFORT_OPTIONS = [
  { value: 3, label: 'Easy' },
  { value: 5, label: 'Moderate' },
  { value: 7, label: 'Hard' },
  { value: 9, label: 'All out' },
];

export default function LogRunScreen() {
  const { data: settings } = useSettings();
  const isImperial = (settings?.units ?? 'imperial') === 'imperial';
  const logRun = useLogRun();

  const [mode, setMode] = useState<'treadmill' | 'outdoor'>('outdoor');

  // Treadmill state
  const [speed, setSpeed] = useState(isImperial ? 6 : 10); // mph or km/h
  const [incline, setIncline] = useState(1);
  const [minutes, setMinutes] = useState(30);
  const [effort, setEffort] = useState<number | null>(5);

  const treadmillDistanceMeters = () => {
    const speedKmh = isImperial ? speed * 1.60934 : speed;
    return speedKmh * (minutes / 60) * 1000;
  };

  const onSubmitTreadmill = async () => {
    await logRun.mutateAsync({
      duration_seconds: minutes * 60,
      distance_meters: Math.round(treadmillDistanceMeters()),
      perceived_effort: effort ?? undefined,
      run_type: 'treadmill',
      incline_percent: incline,
      treadmill_speed_kmh: isImperial ? Number((speed * 1.60934).toFixed(2)) : speed,
    });
    router.back();
  };

  return (
    <ScreenContainer>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <IconButton name="close" onPress={() => router.back()} />
        <Text variant="screenTitle">Log a run</Text>
      </View>

      <SegmentedControl
        segments={[
          { key: 'outdoor', label: 'Outdoor' },
          { key: 'treadmill', label: 'Treadmill' },
        ]}
        selected={mode}
        onChange={(key) => setMode(key as 'treadmill' | 'outdoor')}
      />

      {mode === 'outdoor' ? (
        <Card style={{ gap: SPACING.sm, alignItems: 'center', paddingVertical: SPACING.xl }}>
          <Text variant="cardTitle">Track live with GPS</Text>
          <Text variant="body" tone="secondary" style={{ textAlign: 'center' }}>
            Toci will map your route and track distance, pace, and time as you run.
          </Text>
          <Button label="Start Run" onPress={() => router.push('/workout/run/track')} style={{ marginTop: SPACING.sm }} />
        </Card>
      ) : (
        <>
          <Card style={{ gap: SPACING.lg, alignItems: 'center' }}>
            <Stepper
              label={`SPEED (${isImperial ? 'MPH' : 'KM/H'})`}
              value={speed}
              step={0.1}
              min={1}
              max={isImperial ? 15 : 25}
              formatValue={(v) => v.toFixed(1)}
              onChange={setSpeed}
              large
            />
            <Stepper label="INCLINE (%)" value={incline} step={0.5} min={0} max={15} formatValue={(v) => v.toFixed(1)} onChange={setIncline} large />
            <Stepper label="DURATION (MIN)" value={minutes} step={5} min={5} max={180} onChange={setMinutes} large />
            <Text variant="caption" tone="tertiary">
              ≈ {isImperial ? (treadmillDistanceMeters() / 1609.344).toFixed(2) + ' mi' : (treadmillDistanceMeters() / 1000).toFixed(2) + ' km'}
            </Text>
          </Card>

          <Card style={{ gap: SPACING.sm }}>
            <Text variant="cardTitle">Perceived effort</Text>
            <View style={{ flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' }}>
              {EFFORT_OPTIONS.map((opt) => (
                <Chip key={opt.value} label={opt.label} selected={effort === opt.value} onPress={() => setEffort(opt.value)} />
              ))}
            </View>
          </Card>

          <Button label="Save Run" onPress={onSubmitTreadmill} loading={logRun.isPending} />
        </>
      )}
    </ScreenContainer>
  );
}
