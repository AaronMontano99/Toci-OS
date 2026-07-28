import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { useSettings, useWorkoutSession } from '@/api/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { formatDuration } from '@/lib/format';
import { formatWeight } from '@/lib/units';
import { SPACING } from '@/theme/tokens';

export default function WorkoutCompleteScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const id = Number(sessionId);
  const { data: session, isLoading } = useWorkoutSession(id);
  const { data: settings } = useSettings();
  const units = settings?.units ?? 'imperial';

  if (isLoading || !session) {
    return (
      <ScreenContainer>
        <Skeleton height={200} radius={20} />
      </ScreenContainer>
    );
  }

  const totalSets = session.exercises_with_sets.reduce((sum, ex) => sum + ex.logged_sets.length, 0);
  const firstName = settings?.name?.split(' ')[0];

  return (
    <ScreenContainer contentContainerStyle={{ justifyContent: 'center', flexGrow: 1 }}>
      <View style={{ alignItems: 'center', gap: SPACING.sm }}>
        <Text style={{ fontSize: 44 }}>💪</Text>
        <Text variant="displayLarge" center>
          Great work{firstName ? `, ${firstName}` : ''}.
        </Text>
        <Text variant="body" tone="secondary" center>
          {session.label ?? 'Workout'} is in the books.
        </Text>
      </View>

      <Card style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: SPACING.xl }}>
        <Metric label="TIME" value={formatDuration(session.duration_min)} />
        <Metric label="EXERCISES" value={`${session.exercise_count}`} />
        <Metric label="SETS" value={`${totalSets}`} />
      </Card>

      <Card style={{ marginTop: SPACING.base }}>
        <Metric label="TOTAL VOLUME" value={formatWeight(session.volume_kg, units)} wide />
      </Card>

      <Button
        label="View Coach Review"
        style={{ marginTop: SPACING.xl }}
        onPress={() => router.replace(`/workout/${id}/coach-review`)}
      />
    </ScreenContainer>
  );
}

function Metric({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={{ alignItems: wide ? 'flex-start' : 'center' }}>
      <Text variant="heroMetricSmall">{value}</Text>
      <Text variant="microLabel" tone="tertiary">
        {label}
      </Text>
    </View>
  );
}
