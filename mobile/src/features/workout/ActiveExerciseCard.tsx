import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Feel, LoggedSet, PrescriptionExercise } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Stepper } from '@/components/ui/Stepper';
import { Text } from '@/components/ui/Text';
import { formatWeight, kgToDisplay, weightStep, Units } from '@/lib/units';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

const FEEL_OPTIONS: { key: Feel; label: string }[] = [
  { key: 'clean', label: 'Clean' },
  { key: 'difficult', label: 'Difficult' },
  { key: 'sloppy', label: 'Form broke down' },
  { key: 'partial', label: 'Partial reps' },
  { key: 'assisted', label: 'Assisted' },
  { key: 'pain', label: 'Pain' },
];

const RIR_OPTIONS = [0, 1, 2, 3, 4];

interface ActiveExerciseCardProps {
  exercise: PrescriptionExercise;
  loggedSets: LoggedSet[];
  units: Units;
  onLogSet: (input: {
    set_index: number;
    actual_reps: number;
    actual_load_kg: number;
    prescribed_reps: number;
    prescribed_load_kg: number;
    rir?: number;
    feel?: Feel;
    confidence_next?: 'yes' | 'maybe' | 'no';
  }) => void;
  logging: boolean;
}

export function ActiveExerciseCard({ exercise, loggedSets, units, onLogSet, logging }: ActiveExerciseCardProps) {
  const { colors } = useTheme();
  const setNumber = loggedSets.length + 1;
  const isComplete = loggedSets.length >= exercise.sets;

  const [weightKg, setWeightKg] = useState(exercise.load_kg);
  const [reps, setReps] = useState(exercise.reps);
  const [feel, setFeel] = useState<Feel | null>(null);
  const [rir, setRir] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<'yes' | 'maybe' | 'no' | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Resets when the exercise or set number changes via the `key` the caller
  // passes (exercise_id + setNumber) -- remounting is simpler and avoids an
  // effect-driven state reset for what's really just fresh initial state.
  const displayWeight = kgToDisplay(weightKg, units);
  const step = weightStep(units);

  const lastSet = loggedSets[loggedSets.length - 1];

  if (isComplete) {
    return (
      <Card style={{ gap: SPACING.sm, alignItems: 'center', paddingVertical: SPACING.xl }}>
        <Text style={{ fontSize: 28 }}>✅</Text>
        <Text variant="cardTitle">{exercise.name} complete</Text>
        <Text variant="caption" tone="tertiary">
          {exercise.sets} of {exercise.sets} sets logged
        </Text>
      </Card>
    );
  }

  return (
    <Card style={{ gap: SPACING.lg }}>
      <View>
        <Text variant="microLabel" tone="tertiary">
          SET {setNumber} OF {exercise.sets}
        </Text>
        <Text variant="cardTitle">{exercise.name}</Text>
        {lastSet && (
          <Text variant="caption" tone="tertiary">
            Previous set: {formatWeight(lastSet.weight_kg, units)} × {lastSet.reps ?? '—'}
          </Text>
        )}
        {exercise.why && (
          <Text variant="caption" tone="secondary" style={{ marginTop: 4 }}>
            {exercise.why}
          </Text>
        )}
      </View>

      <View style={{ gap: SPACING.base }}>
        <Stepper
          label={`WEIGHT (${units === 'imperial' ? 'lb' : 'kg'})`}
          value={displayWeight}
          step={step}
          min={0}
          onChange={(v) => setWeightKg(units === 'imperial' ? v * 0.45359237 : v)}
          large
        />
        <Stepper label="REPS" value={reps} step={1} min={0} onChange={setReps} large />
      </View>

      <Pressable onPress={() => setFeedbackOpen((v) => !v)} hitSlop={8}>
        <Text variant="caption" style={{ fontWeight: '700', color: colors.accentInk }}>
          {feedbackOpen ? 'Hide optional feedback' : 'Add optional feedback'}
        </Text>
      </Pressable>

      {feedbackOpen && (
        <View style={{ gap: SPACING.md }}>
          <View style={{ gap: SPACING.sm }}>
            <Text variant="caption" tone="tertiary">
              HOW DID IT FEEL
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }}>
              {FEEL_OPTIONS.map((opt) => (
                <Chip
                  key={opt.key}
                  label={opt.label}
                  selected={feel === opt.key}
                  onPress={() => setFeel(feel === opt.key ? null : opt.key)}
                />
              ))}
            </View>
          </View>
          <View style={{ gap: SPACING.sm }}>
            <Text variant="caption" tone="tertiary">
              REPS IN RESERVE
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }}>
              {RIR_OPTIONS.map((n) => (
                <Chip key={n} label={n === 4 ? '4+' : String(n)} selected={rir === n} onPress={() => setRir(rir === n ? null : n)} />
              ))}
            </View>
          </View>
          <View style={{ gap: SPACING.sm }}>
            <Text variant="caption" tone="tertiary">
              CONFIDENT GOING HEAVIER NEXT TIME?
            </Text>
            <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
              {(['yes', 'maybe', 'no'] as const).map((c) => (
                <Chip key={c} label={c[0].toUpperCase() + c.slice(1)} selected={confidence === c} onPress={() => setConfidence(confidence === c ? null : c)} />
              ))}
            </View>
          </View>
        </View>
      )}

      <Button
        label="Complete Set"
        loading={logging}
        onPress={() =>
          onLogSet({
            set_index: setNumber,
            actual_reps: reps,
            actual_load_kg: weightKg,
            prescribed_reps: exercise.reps,
            prescribed_load_kg: exercise.load_kg,
            rir: rir ?? undefined,
            feel: feel ?? undefined,
            confidence_next: confidence ?? undefined,
          })
        }
      />
    </Card>
  );
}
