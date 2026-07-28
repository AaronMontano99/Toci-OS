import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { useLogRun, useSettings } from '@/api/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
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

  const [minutes, setMinutes] = useState(30);
  const [distance, setDistance] = useState(isImperial ? 3 : 5); // miles or km
  const [effort, setEffort] = useState<number | null>(5);

  const onSubmit = async () => {
    const distanceMeters = isImperial ? distance * 1609.344 : distance * 1000;
    await logRun.mutateAsync({
      duration_seconds: minutes * 60,
      distance_meters: Math.round(distanceMeters),
      perceived_effort: effort ?? undefined,
    });
    router.back();
  };

  return (
    <ScreenContainer>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <IconButton name="close" onPress={() => router.back()} />
        <Text variant="screenTitle">Log a run</Text>
      </View>

      <Card style={{ gap: SPACING.lg, alignItems: 'center' }}>
        <Stepper label="DURATION (MIN)" value={minutes} step={5} min={5} max={180} onChange={setMinutes} large />
        <Stepper
          label={`DISTANCE (${isImperial ? 'MI' : 'KM'})`}
          value={distance}
          step={0.1}
          min={0}
          max={50}
          formatValue={(v) => v.toFixed(1)}
          onChange={setDistance}
          large
        />
      </Card>

      <Card style={{ gap: SPACING.sm }}>
        <Text variant="cardTitle">Perceived effort</Text>
        <View style={{ flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' }}>
          {EFFORT_OPTIONS.map((opt) => (
            <Chip key={opt.value} label={opt.label} selected={effort === opt.value} onPress={() => setEffort(opt.value)} />
          ))}
        </View>
      </Card>

      <Button label="Save Run" onPress={onSubmit} loading={logRun.isPending} />
    </ScreenContainer>
  );
}
