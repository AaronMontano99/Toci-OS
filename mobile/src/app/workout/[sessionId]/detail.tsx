import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, View } from 'react-native';

import { useDeleteSet, useDeleteWorkoutSession, useSettings, useUpdateSet, useWorkoutSession } from '@/api/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { LoggedSetsList } from '@/features/workout/LoggedSetsList';
import { formatDuration } from '@/lib/format';
import { formatWeight } from '@/lib/units';
import { SPACING } from '@/theme/tokens';

// Read + edit view for a workout that's already been logged (past or
// today's completed session) -- reached by tapping a Recent Session card.
// No "log a new set" input, no rest timer, no Finish button: this is about
// correcting what already happened, not continuing a workout.
export default function WorkoutDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const id = Number(sessionId);
  const { data: session, isLoading } = useWorkoutSession(id);
  const { data: settings } = useSettings();
  const units = settings?.units ?? 'imperial';
  const updateSet = useUpdateSet(id);
  const deleteSet = useDeleteSet(id);
  const deleteSession = useDeleteWorkoutSession();

  const onDeleteSession = () => {
    Alert.alert('Delete this workout?', 'This removes the whole logged session and every set in it. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteSession.mutateAsync(id);
          router.back();
        },
      },
    ]);
  };

  if (isLoading || !session) {
    return (
      <ScreenContainer>
        <Skeleton height={200} radius={20} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll contentContainerStyle={{ gap: SPACING.base }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
          <IconButton name="chevron-back" onPress={() => router.back()} />
          <View>
            <Text variant="cardTitle">{session.label ?? 'Workout'}</Text>
            <Text variant="caption" tone="tertiary">
              {session.date}
            </Text>
          </View>
        </View>
        <IconButton name="trash-outline" onPress={onDeleteSession} />
      </View>

      <Card style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        <Stat label="TIME" value={formatDuration(session.duration_min)} />
        <Stat label="EXERCISES" value={`${session.exercise_count}`} />
        <Stat label="VOLUME" value={formatWeight(session.volume_kg, units)} />
      </Card>

      {session.exercises_with_sets.length === 0 ? (
        <EmptyState title="Nothing logged" detail="No sets were recorded in this session." />
      ) : (
        session.exercises_with_sets.map((ex) => (
          <Card key={ex.exercise_id} style={{ gap: SPACING.sm }}>
            <Text variant="cardTitle">{ex.name}</Text>
            <LoggedSetsList
              sets={ex.logged_sets}
              units={units}
              onUpdate={(setId, input) => updateSet.mutate({ setId, ...input })}
              onDelete={(setId) => deleteSet.mutate(setId)}
            />
          </Card>
        ))
      )}

      <Button label="Done" variant="tertiary" onPress={() => router.back()} />
    </ScreenContainer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text variant="bodyStrong">{value}</Text>
      <Text variant="microLabel" tone="tertiary">
        {label}
      </Text>
    </View>
  );
}
