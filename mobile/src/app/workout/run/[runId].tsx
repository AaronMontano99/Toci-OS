import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';

import { useDeleteRun, useRun, useSettings, useUpdateRun } from '@/api/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Skeleton } from '@/components/ui/Skeleton';
import { Stepper } from '@/components/ui/Stepper';
import { Text } from '@/components/ui/Text';
import { SPACING } from '@/theme/tokens';

const KM_PER_MI = 1.609344;

export default function RunDetailScreen() {
  const { runId } = useLocalSearchParams<{ runId: string }>();
  const id = Number(runId);
  const { data: run, isLoading } = useRun(id);
  const { data: settings } = useSettings();
  const isImperial = (settings?.units ?? 'imperial') === 'imperial';
  const updateRun = useUpdateRun(id);
  const deleteRun = useDeleteRun();

  const [minutes, setMinutes] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  if (isLoading || !run) {
    return (
      <ScreenContainer>
        <Skeleton height={200} radius={20} />
      </ScreenContainer>
    );
  }

  const defaultMinutes = run.duration_min;
  const defaultDistance = isImperial ? (run.distance_km ?? 0) / KM_PER_MI : (run.distance_km ?? 0);
  const displayMinutes = minutes ?? defaultMinutes;
  const displayDistance = distance ?? defaultDistance;

  const onSave = async () => {
    const distanceMeters = isImperial ? displayDistance * 1609.344 : displayDistance * 1000;
    await updateRun.mutateAsync({ duration_seconds: Math.round(displayMinutes * 60), distance_meters: Math.round(distanceMeters) });
    router.back();
  };

  const onDelete = () => {
    Alert.alert('Delete this run?', 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteRun.mutateAsync(id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScreenContainer contentContainerStyle={{ gap: SPACING.base }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
          <IconButton name="chevron-back" onPress={() => router.back()} />
          <View>
            <Text variant="cardTitle">Run</Text>
            <Text variant="caption" tone="tertiary">
              {run.date}
            </Text>
          </View>
        </View>
        <IconButton name="trash-outline" onPress={onDelete} />
      </View>

      <Card style={{ gap: SPACING.lg, alignItems: 'center' }}>
        <Stepper label="DURATION (MIN)" value={displayMinutes} step={5} min={5} max={300} onChange={setMinutes} large />
        <Stepper
          label={`DISTANCE (${isImperial ? 'MI' : 'KM'})`}
          value={displayDistance}
          step={0.1}
          min={0}
          max={100}
          formatValue={(v) => v.toFixed(1)}
          onChange={setDistance}
          large
        />
      </Card>

      {run.pace_per_km && (
        <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="body" tone="secondary">
            Pace
          </Text>
          <Text variant="bodyStrong">{run.pace_per_km} /km</Text>
        </Card>
      )}

      <Button label="Save" onPress={onSave} loading={updateRun.isPending} />
    </ScreenContainer>
  );
}
