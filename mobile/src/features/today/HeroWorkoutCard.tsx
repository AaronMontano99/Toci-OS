import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { useStartWorkout } from '@/api/hooks';
import { LiftPrescription, RunPrescription, SessionType, WorkoutStatus } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { formatDuration } from '@/lib/format';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING, shadow } from '@/theme/tokens';

interface HeroWorkoutCardProps {
  sessionType: SessionType;
  prescription: LiftPrescription | RunPrescription | Record<string, unknown>;
  workoutStatus: WorkoutStatus;
  reasoning: string[];
}

export function HeroWorkoutCard({ sessionType, prescription, workoutStatus, reasoning }: HeroWorkoutCardProps) {
  const { colors, colorScheme } = useTheme();
  const startWorkout = useStartWorkout();
  // reasoning[0] is always the raw "Readiness X (band)" line, already shown on
  // the Readiness card above -- prefer the next, more specific factor here.
  const heroReason = reasoning[1] ?? reasoning[0];

  const isLift = sessionType === 'lift';
  const lift = prescription as LiftPrescription;
  const run = prescription as RunPrescription;

  const title = isLift ? lift.label || 'Lift Session' : sessionType === 'run' ? 'Run' : sessionType === 'recover' ? 'Active Recovery' : 'Rest Day';
  const exerciseCount = isLift ? lift.exercises?.length ?? 0 : 0;
  const estDuration = isLift ? exerciseCount * 8 + 10 : sessionType === 'run' ? run.duration_min ?? 30 : sessionType === 'recover' ? 20 : null;

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
    const result = await startWorkout.mutateAsync(title);
    router.push(`/workout/${result.id}`);
  };

  const primaryLabel =
    sessionType === 'rest'
      ? 'Enjoy your rest day'
      : workoutStatus.state === 'active'
        ? 'Resume Workout'
        : workoutStatus.state === 'completed'
          ? 'View Summary'
          : sessionType === 'run'
            ? 'Log Run'
            : sessionType === 'recover'
              ? 'Start Recovery'
              : 'Start Workout';

  const isRestDay = sessionType === 'rest';

  return (
    <LinearGradient
      colors={isRestDay ? [colors.card, colors.card] : colors.accentGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        { borderRadius: RADIUS.hero, padding: SPACING.xl, gap: SPACING.md },
        shadow('elevated', colorScheme),
        isRestDay && { borderWidth: 1, borderColor: colors.border },
      ]}
    >
      <Text variant="microLabel" tone={isRestDay ? 'tertiary' : 'onAccent'} style={isRestDay ? undefined : { opacity: 0.85 }}>
        TODAY&rsquo;S SESSION
      </Text>
      <Text variant="displayLarge" tone={isRestDay ? 'primary' : 'onAccent'}>
        {title}
      </Text>

      {!isRestDay && (
        <View style={{ flexDirection: 'row', gap: SPACING.lg }}>
          {isLift && (
            <Stat label="EXERCISES" value={`${exerciseCount}`} light={!isRestDay} />
          )}
          {estDuration != null && <Stat label="EST. TIME" value={formatDuration(estDuration)} light={!isRestDay} />}
        </View>
      )}

      {heroReason && (
        <Text variant="body" tone={isRestDay ? 'secondary' : 'onAccent'} style={isRestDay ? undefined : { opacity: 0.92 }}>
          {heroReason}
        </Text>
      )}

      {!isRestDay && (
        <Button
          label={primaryLabel}
          onPress={onPrimaryPress}
          loading={startWorkout.isPending}
          style={{ backgroundColor: colors.card, marginTop: SPACING.sm }}
          variant="secondary"
        />
      )}
    </LinearGradient>
  );
}

function Stat({ label, value, light }: { label: string; value: string; light: boolean }) {
  return (
    <View>
      <Text variant="heroMetricSmall" tone={light ? 'onAccent' : 'primary'}>
        {value}
      </Text>
      <Text variant="microLabel" tone={light ? 'onAccent' : 'tertiary'} style={light ? { opacity: 0.8 } : undefined}>
        {label}
      </Text>
    </View>
  );
}
