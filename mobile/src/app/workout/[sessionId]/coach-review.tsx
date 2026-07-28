import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { useExerciseDecisions, useProgram, useSettings, useWorkoutSession } from '@/api/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { InsightCard } from '@/components/ui/InsightCard';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { formatWeight } from '@/lib/units';
import { SPACING } from '@/theme/tokens';

const OPTION_VERBS: Record<string, string> = { repeat: 'Repeat', increase: 'Increase to', technique_focus: 'Technique focus at' };

export default function CoachReviewScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const id = Number(sessionId);
  const { data: session, isLoading } = useWorkoutSession(id);
  const { data: program } = useProgram();
  const { data: settings } = useSettings();
  const units = settings?.units ?? 'imperial';

  const exerciseIds = session?.exercises_with_sets.map((ex) => ex.exercise_id) ?? [];
  const decisions = useExerciseDecisions(exerciseIds);

  if (isLoading || !session) {
    return (
      <ScreenContainer>
        <Skeleton height={200} radius={20} />
      </ScreenContainer>
    );
  }

  const totalSets = session.exercises_with_sets.reduce((sum, ex) => sum + ex.logged_sets.length, 0);
  const observations = program?.coach_observations ?? [];

  return (
    <ScreenContainer>
      <Text variant="microLabel" tone="tertiary">
        COACH REVIEW
      </Text>
      <Text variant="screenTitle">What this workout meant</Text>
      <Text variant="body" tone="secondary">
        {session.exercise_count} exercise{session.exercise_count === 1 ? '' : 's'}, {totalSets} sets, and{' '}
        {formatWeight(session.volume_kg, units)} of total volume logged today.
      </Text>

      {observations.length > 0 && (
        <View style={{ gap: SPACING.sm }}>
          <Text variant="sectionTitle">Observations</Text>
          {observations.map((line, i) => (
            <InsightCard key={i} tone="accent" icon="💡" text={line} />
          ))}
        </View>
      )}

      <View style={{ gap: SPACING.sm }}>
        <Text variant="sectionTitle">Next session</Text>
        {session.exercises_with_sets.map((ex, i) => {
          const decision = decisions[i];
          if (!decision?.data) return null;
          const recommended = decision.data.options.find((o) => o.type === decision.data.recommended_type);
          const alternatives = decision.data.options.filter((o) => o.type !== decision.data.recommended_type);
          return (
            <Card key={ex.exercise_id} style={{ gap: SPACING.sm }}>
              <Text variant="cardTitle">{ex.name}</Text>
              <Text variant="caption" tone="tertiary">
                {decision.data.why}
              </Text>
              {recommended && (
                <Text variant="bodyStrong" tone="accent">
                  Recommended: {OPTION_VERBS[recommended.type]} {formatWeight(recommended.load_kg, units, 1)}
                </Text>
              )}
              {alternatives.map((alt) => (
                <Text key={alt.type} variant="caption" tone="secondary">
                  Alternative: {OPTION_VERBS[alt.type]} {formatWeight(alt.load_kg, units, 1)}
                </Text>
              ))}
            </Card>
          );
        })}
      </View>

      <Button
        label="See Next Workout"
        style={{ marginTop: SPACING.base }}
        onPress={() => router.replace('/(tabs)')}
      />
    </ScreenContainer>
  );
}
