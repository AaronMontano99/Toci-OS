import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { useStartWorkout } from '@/api/hooks';
import { LiftPrescription, RunPrescription, SessionType, WorkoutStatus } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { GradientHeroCard } from '@/components/ui/GradientHeroCard';
import { Text } from '@/components/ui/Text';
import { formatDuration } from '@/lib/format';
import { SPACING } from '@/theme/tokens';

interface HeroWorkoutCardProps {
  sessionType: SessionType;
  prescription: LiftPrescription | RunPrescription | Record<string, unknown>;
  workoutStatus: WorkoutStatus;
  reasoning: string[];
}

const SESSION_ICON: Record<SessionType, keyof typeof Ionicons.glyphMap> = {
  lift: 'barbell',
  run: 'walk',
  recover: 'leaf',
  rest: 'moon',
};

const SESSION_CAPTION: Record<SessionType, string> = {
  lift: 'Warm-up · Mobility · Let’s go',
  run: 'Stretch · Pace yourself · Let’s go',
  recover: 'Easy pace · Mobility work',
  rest: 'No training required today',
};

export function HeroWorkoutCard({ sessionType, prescription, workoutStatus, reasoning }: HeroWorkoutCardProps) {
  const startWorkout = useStartWorkout();
  const heroReason = reasoning[1] ?? reasoning[0];

  const isLift = sessionType === 'lift';
  const lift = prescription as LiftPrescription;
  const run = prescription as RunPrescription;
  const isRestDay = sessionType === 'rest';

  const firstExercise = isLift ? lift.exercises?.[0] : undefined;
  const title = firstExercise?.name ?? (sessionType === 'run' ? 'Run' : sessionType === 'recover' ? 'Active Recovery' : 'Rest Day');
  const subtitle = isLift ? lift.label : sessionType === 'run' ? run.run_type ?? 'Easy pace' : sessionType === 'recover' ? 'Active recovery' : 'Rest day';
  const exerciseCount = isLift ? lift.exercises?.length ?? 0 : 0;
  const estDuration = isLift ? exerciseCount * 8 + 10 : sessionType === 'run' ? run.duration_min ?? 30 : sessionType === 'recover' ? 20 : null;
  const durationLabel = estDuration != null ? `${formatDuration(estDuration)}–${formatDuration(estDuration + 15)}` : null;

  const onPrimaryPress = async () => {
    if (sessionType === 'rest') return;
    if (workoutStatus.state === 'active' && workoutStatus.session_id) {
      router.push(`/workout/${workoutStatus.session_id}`);
      return;
    }
    if (workoutStatus.state === 'completed' && workoutStatus.session_id) {
      router.push(`/workout/${workoutStatus.session_id}/complete`);
      return;
    }
    if (sessionType === 'run') {
      router.push('/workout/log-run');
      return;
    }
    const result = await startWorkout.mutateAsync(lift.label);
    router.push(`/workout/${result.id}`);
  };

  const primaryLabel =
    workoutStatus.state === 'active'
      ? 'Resume Workout'
      : workoutStatus.state === 'completed'
        ? 'View Summary'
        : sessionType === 'run'
          ? 'Log Run'
          : sessionType === 'recover'
            ? 'Start Recovery'
            : 'Start Workout';

  return (
    <GradientHeroCard watermarkIcon={SESSION_ICON[sessionType]} badgeIcon={isRestDay ? undefined : SESSION_ICON[sessionType]}>
      <Text variant="microLabel" tone="accent">
        TODAY&rsquo;S WORKOUT
      </Text>
      <Text variant="displayLarge">{title}</Text>
      <Text variant="body" tone="secondary">
        {subtitle}
      </Text>

      {!isRestDay && (
        <View style={{ flexDirection: 'row', gap: SPACING.lg, marginTop: 2 }}>
          {durationLabel && <MetaItem icon="time-outline" label={durationLabel} />}
          <MetaItem icon="stats-chart-outline" label={isLift ? 'Strength' : sessionType === 'run' ? 'Cardio' : 'Recovery'} />
          {isLift && <MetaItem icon="list-outline" label={`${exerciseCount} exercises`} />}
        </View>
      )}

      {heroReason && (
        <Text variant="caption" tone="tertiary" style={{ marginTop: 2 }}>
          {heroReason}
        </Text>
      )}

      {!isRestDay && (
        <>
          <Button label={primaryLabel} onPress={onPrimaryPress} loading={startWorkout.isPending} style={{ marginTop: SPACING.sm }} />
          <Text variant="caption" tone="tertiary" center>
            {SESSION_CAPTION[sessionType]}
          </Text>
        </>
      )}
    </GradientHeroCard>
  );
}

function MetaItem({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Ionicons name={icon} size={14} color="#B8B5B0" />
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </View>
  );
}
