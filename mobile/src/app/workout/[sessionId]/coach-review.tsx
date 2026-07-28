import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { useExerciseDecisions, useExerciseMemories, useProgram, useSettings, useWorkoutSession } from '@/api/hooks';
import { LoggedSet } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { InsightCard } from '@/components/ui/InsightCard';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { evaluateExercisePerformance, summarizeWorkoutHeadline } from '@/lib/coachVoice';
import { formatWeight } from '@/lib/units';
import { SPACING } from '@/theme/tokens';

const OPTION_VERBS: Record<string, string> = { repeat: 'Repeat', increase: 'Increase to', technique_focus: 'Technique focus at' };

function topSetOf(loggedSets: LoggedSet[]) {
  return loggedSets.reduce((top, s) => ((s.weight_kg ?? 0) > (top.weight_kg ?? 0) ? s : top), loggedSets[0]);
}

export default function CoachReviewScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const id = Number(sessionId);
  const { data: session, isLoading } = useWorkoutSession(id);
  const { data: program } = useProgram();
  const { data: settings } = useSettings();
  const units = settings?.units ?? 'imperial';

  const exerciseIds = session?.exercises_with_sets.map((ex) => ex.exercise_id) ?? [];
  const decisions = useExerciseDecisions(exerciseIds);
  const memories = useExerciseMemories(exerciseIds, id);

  const headline = useMemo(() => {
    if (!session) return '';
    const results = session.exercises_with_sets.map((ex, i) => {
      if (ex.logged_sets.length === 0) return null;
      const topSet = topSetOf(ex.logged_sets);
      if (topSet.weight_kg == null || topSet.reps == null) return null;
      const { outcome } = evaluateExercisePerformance({ weight_kg: topSet.weight_kg, reps: topSet.reps }, memories[i]?.data, units);
      return { name: ex.name, outcome };
    });
    return summarizeWorkoutHeadline(results.filter((r): r is { name: string; outcome: NonNullable<typeof r>['outcome'] } => r != null));
  }, [session, memories, units]);

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
        {headline}
      </Text>
      <Text variant="caption" tone="tertiary">
        {session.exercise_count} exercise{session.exercise_count === 1 ? '' : 's'}, {totalSets} sets, {formatWeight(session.volume_kg, units)} of
        total volume.
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
          const topSet = ex.logged_sets.length > 0 ? topSetOf(ex.logged_sets) : null;
          const performance =
            topSet?.weight_kg != null && topSet.reps != null
              ? evaluateExercisePerformance({ weight_kg: topSet.weight_kg, reps: topSet.reps }, memories[i]?.data, units)
              : null;
          return (
            <Card key={ex.exercise_id} style={{ gap: SPACING.sm }}>
              <Text variant="cardTitle">{ex.name}</Text>
              {performance && (
                <Text variant="body" tone="secondary">
                  {performance.sentence}
                </Text>
              )}
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
