import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import {
  useCompleteWorkout,
  useDeleteSet,
  useExerciseMemory,
  useLiftDayPrescription,
  useLogSet,
  useSetExerciseSubstitution,
  useSettings,
  useToday,
  useUpdateSet,
  useWorkoutSession,
} from '@/api/hooks';
import { Exercise, LiftPrescription, LoggedSet, PrescriptionExercise } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useWorkoutContext } from '@/context/WorkoutContext';
import { ActiveExerciseCard } from '@/features/workout/ActiveExerciseCard';
import { ExerciseOutlineRow } from '@/features/workout/ExerciseOutlineRow';
import { RestTimerBar } from '@/features/workout/RestTimerBar';
import { SwapExerciseSheet } from '@/features/workout/SwapExerciseSheet';
import { describeSetReaction } from '@/lib/coachVoice';
import { SPACING } from '@/theme/tokens';

const DEFAULT_REST_SECONDS = 90;

export default function ActiveWorkoutScreen() {
  const params = useLocalSearchParams<{ sessionId: string; weekday?: string }>();
  const sessionId = Number(params.sessionId);
  const weekday = params.weekday != null ? Number(params.weekday) : null;

  const { data: session, isLoading: sessionLoading } = useWorkoutSession(sessionId);
  const { data: today } = useToday();
  const { data: weekdayPrescription } = useLiftDayPrescription(weekday);
  const { data: settings } = useSettings();
  const logSet = useLogSet(sessionId);
  const updateSet = useUpdateSet(sessionId);
  const deleteSet = useDeleteSet(sessionId);
  const completeWorkout = useCompleteWorkout();
  const setExerciseSubstitution = useSetExerciseSubstitution();
  const { startRest } = useWorkoutContext();

  const units = settings?.units ?? 'imperial';

  const prescriptionExercises: PrescriptionExercise[] | undefined = useMemo(() => {
    if (weekday != null) return weekdayPrescription?.exercises;
    if (today?.recommendation.session_type === 'lift') {
      return (today.recommendation.prescription as LiftPrescription).exercises;
    }
    return undefined;
  }, [weekday, weekdayPrescription, today]);

  // Freeform fallback (no prescription resolvable): derived straight from
  // whatever's already logged in this session, generous per-exercise set cap
  // since there's no real target.
  const freeformExercises = useMemo<PrescriptionExercise[] | undefined>(() => {
    if (!session || prescriptionExercises?.length) return undefined;
    return session.exercises_with_sets.map((ex) => {
      const last = ex.logged_sets[ex.logged_sets.length - 1];
      return {
        exercise_id: ex.exercise_id,
        name: ex.name,
        sets: 20,
        reps: last?.reps ?? 8,
        load_kg: last?.weight_kg ?? 20,
        target_rir: 2,
      };
    });
  }, [session, prescriptionExercises]);

  const baseExercises = useMemo(
    () => (prescriptionExercises?.length ? prescriptionExercises : freeformExercises ?? []),
    [prescriptionExercises, freeformExercises],
  );

  // Client-side, this-workout-only substitutions (equipment unavailable,
  // movement swap, etc.) -- keyed by position in the plan so the swap sticks
  // to "this slot" regardless of which exercise currently occupies it. Sets
  // logged before a swap stay attached to the original exercise, exactly as
  // they were actually performed.
  const [substitutions, setSubstitutions] = useState<Record<number, Exercise>>({});

  const exercisesList = useMemo(
    () =>
      baseExercises.map((ex, i) => {
        const sub = substitutions[i];
        // Drop the original exercise's coach rationale/progression options on
        // swap -- they were computed for that movement, not this one, and
        // showing them here would be a fabricated recommendation.
        return sub ? { ...ex, exercise_id: sub.id, name: sub.name, why: undefined, progression_options: undefined, recommended_type: undefined } : ex;
      }),
    [baseExercises, substitutions],
  );

  const loggedSetsByExercise = useMemo(() => {
    const map = new Map<number, LoggedSet[]>();
    session?.exercises_with_sets.forEach((ex) => map.set(ex.exercise_id, ex.logged_sets));
    return map;
  }, [session]);

  // The active exercise defaults to the first one not yet fully logged (so
  // resuming a session lands you back where you left off), but a manual tap
  // (outline row / skip button) overrides that default until it's cleared.
  const derivedIndex = useMemo(() => {
    const firstIncomplete = exercisesList.findIndex(
      (ex) => (loggedSetsByExercise.get(ex.exercise_id)?.length ?? 0) < ex.sets,
    );
    return firstIncomplete === -1 ? exercisesList.length : firstIncomplete;
  }, [exercisesList, loggedSetsByExercise]);

  const [manualIndex, setManualIndex] = useState<number | null>(null);
  const currentIndex = manualIndex ?? derivedIndex;
  const currentExercise = exercisesList[currentIndex];

  const { data: memory } = useExerciseMemory(currentExercise?.exercise_id ?? null);
  const [reaction, setReaction] = useState<{ exerciseId: number; text: string } | null>(null);
  const [swapSheetOpen, setSwapSheetOpen] = useState(false);

  if (sessionLoading || !session) {
    return (
      <ScreenContainer>
        <Skeleton height={200} radius={20} />
      </ScreenContainer>
    );
  }

  const completedCount = exercisesList.filter((ex) => (loggedSetsByExercise.get(ex.exercise_id)?.length ?? 0) >= ex.sets).length;
  const allDone = exercisesList.length > 0 && currentIndex >= exercisesList.length;

  const onFinishWorkout = () => {
    const remaining = exercisesList.length - completedCount;
    const go = async () => {
      await completeWorkout.mutateAsync(sessionId);
      router.replace(`/workout/${sessionId}/complete`);
    };
    if (remaining > 0 && !allDone) {
      Alert.alert('Finish workout?', `${remaining} exercise${remaining === 1 ? '' : 's'} not fully logged yet.`, [
        { text: 'Keep training', style: 'cancel' },
        { text: 'Finish anyway', style: 'destructive', onPress: go },
      ]);
    } else {
      go();
    }
  };

  return (
    <ScreenContainer
      scroll
      contentContainerStyle={{ gap: SPACING.base }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
          <IconButton name="chevron-back" onPress={() => router.back()} />
          <View>
            <Text variant="cardTitle">{session.label ?? 'Workout'}</Text>
            <Text variant="caption" tone="tertiary">
              {exercisesList.length ? `Exercise ${Math.min(currentIndex + 1, exercisesList.length)} of ${exercisesList.length}` : 'Freeform session'}
            </Text>
          </View>
        </View>
        <Button label="End" variant="tertiary" size="compact" fullWidth={false} onPress={onFinishWorkout} />
      </View>

      <RestTimerBar />

      {exercisesList.length === 0 && (
        <EmptyState title="No plan for this session" detail="Add exercises from the library to log a freeform session." />
      )}

      {currentExercise && (
        <ActiveExerciseCard
          key={`${currentExercise.exercise_id}-${loggedSetsByExercise.get(currentExercise.exercise_id)?.length ?? 0}`}
          exercise={currentExercise}
          loggedSets={loggedSetsByExercise.get(currentExercise.exercise_id) ?? []}
          units={units}
          memory={memory}
          reactionText={reaction?.exerciseId === currentExercise.exercise_id ? reaction.text : null}
          onRequestSwap={() => setSwapSheetOpen(true)}
          onUpdateSet={(setId, input) => updateSet.mutate({ setId, ...input })}
          onDeleteSet={(setId) => deleteSet.mutate(setId)}
          logging={logSet.isPending}
          onLogSet={async (input) => {
            const exerciseId = currentExercise.exercise_id;
            const priorSets = loggedSetsByExercise.get(exerciseId) ?? [];
            const previousSet = priorSets[priorSets.length - 1];
            const previous = previousSet?.weight_kg != null && previousSet.reps != null
              ? { weight_kg: previousSet.weight_kg, reps: previousSet.reps }
              : memory?.last_session
                ? { weight_kg: memory.last_session.weight_kg, reps: memory.last_session.reps }
                : null;

            await logSet.mutateAsync({ exercise_id: exerciseId, ...input });
            setReaction({
              exerciseId,
              text: describeSetReaction(
                { weight_kg: input.actual_load_kg, reps: input.actual_reps, feel: input.feel },
                previous,
                units,
              ),
            });
            startRest(DEFAULT_REST_SECONDS);
          }}
        />
      )}

      {allDone && (
        <View style={{ alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.lg }}>
          <Text style={{ fontSize: 32 }}>🎉</Text>
          <Text variant="cardTitle">All exercises logged</Text>
          <Button label="Finish Workout" onPress={onFinishWorkout} loading={completeWorkout.isPending} />
        </View>
      )}

      {currentExercise && !allDone && (
        <Button
          label="Skip to next exercise"
          variant="tertiary"
          size="compact"
          onPress={() => setManualIndex(Math.min(currentIndex + 1, exercisesList.length))}
        />
      )}

      {exercisesList.length > 0 && (
        <View style={{ gap: 2 }}>
          <Text variant="sectionTitle" style={{ marginBottom: SPACING.sm }}>
            Workout outline
          </Text>
          {exercisesList.map((ex, i) => {
            const logged = loggedSetsByExercise.get(ex.exercise_id)?.length ?? 0;
            const state = logged >= ex.sets ? 'done' : i === currentIndex ? 'active' : 'upcoming';
            return (
              <ExerciseOutlineRow
                key={ex.exercise_id}
                name={ex.name}
                detail={`${logged}/${ex.sets} sets · ${ex.reps} reps target`}
                state={state}
                onPress={i <= completedCount || i === currentIndex ? () => setManualIndex(i) : undefined}
              />
            );
          })}
        </View>
      )}

      <SwapExerciseSheet
        visible={swapSheetOpen}
        currentExerciseId={currentExercise?.exercise_id}
        currentExerciseName={currentExercise?.name}
        onClose={() => setSwapSheetOpen(false)}
        onSelect={(chosen) => {
          setSubstitutions((prev) => ({ ...prev, [currentIndex]: chosen }));
          setSwapSheetOpen(false);
          // Persist against the true original exercise for this slot -- not
          // whatever it currently shows, in case it was already swapped once
          // this session -- so the preference carries into future workouts.
          const originalExerciseId = baseExercises[currentIndex]?.exercise_id;
          if (originalExerciseId != null) {
            setExerciseSubstitution.mutate({ exerciseId: originalExerciseId, substituteExerciseId: chosen.id });
          }
        }}
      />
    </ScreenContainer>
  );
}
