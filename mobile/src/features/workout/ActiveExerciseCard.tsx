import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ExerciseMemory, Feel, LoggedSet, PrescriptionExercise } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Stepper } from '@/components/ui/Stepper';
import { Text } from '@/components/ui/Text';
import { describeCoachNote, describeExerciseSummary } from '@/lib/coachVoice';
import { formatWeight, kgToDisplay, weightStep, Units } from '@/lib/units';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING } from '@/theme/tokens';

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
  memory?: ExerciseMemory;
  reactionText?: string | null;
  onRequestSwap?: () => void;
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

export function ActiveExerciseCard({ exercise, loggedSets, units, memory, reactionText, onRequestSwap, onLogSet, logging }: ActiveExerciseCardProps) {
  const { colors } = useTheme();
  const setNumber = loggedSets.length + 1;
  const isComplete = loggedSets.length >= exercise.sets;
  const lastSet = loggedSets[loggedSets.length - 1];

  // The suggestion carries forward from what you just did this session --
  // repeating your own last set by default -- and falls back to real history
  // before the static prescription, so a swapped-in exercise you've done
  // before prefills from its own memory instead of the old movement's number.
  const suggestedWeightKg = lastSet?.weight_kg ?? memory?.last_session?.weight_kg ?? exercise.load_kg;
  const suggestedReps = lastSet?.reps ?? memory?.last_session?.reps ?? exercise.reps;

  const [weightKg, setWeightKg] = useState(suggestedWeightKg);
  const [reps, setReps] = useState(suggestedReps);
  const [feel, setFeel] = useState<Feel | null>(null);
  const [rir, setRir] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<'yes' | 'maybe' | 'no' | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Round display-unit conversions to 1 decimal -- kg<->lb round-tripping
  // otherwise surfaces float noise (e.g. 184.9678379731123) in the stepper.
  const displayWeight = Math.round(kgToDisplay(weightKg, units) * 10) / 10;
  const step = weightStep(units);
  const isFirstSet = loggedSets.length === 0;
  // The backend's reasoning (when the day's own recommendation engine computed
  // one) already factors in RIR and confidence, not just feel, and is the same
  // sentence Coach Review shows later -- prefer it, and only fall back to the
  // memory-only note for sessions it doesn't cover (weekday picks, freeform).
  const coachNote = isFirstSet ? exercise.why ?? describeCoachNote(memory, { reps: suggestedReps, load_kg: suggestedWeightKg }, units) : null;

  if (isComplete) {
    const topSet = loggedSets.reduce((top, s) => ((s.weight_kg ?? 0) > (top.weight_kg ?? 0) ? s : top), loggedSets[0]);
    const summary =
      topSet?.weight_kg != null && topSet.reps != null
        ? describeExerciseSummary({ weight_kg: topSet.weight_kg, reps: topSet.reps }, memory, units)
        : `${exercise.sets} of ${exercise.sets} sets logged.`;
    return (
      <Card style={{ gap: SPACING.sm, alignItems: 'center', paddingVertical: SPACING.xl }}>
        <Text style={{ fontSize: 28 }}>✅</Text>
        <Text variant="cardTitle" center>
          {exercise.name}
        </Text>
        <Text variant="body" tone="secondary" center>
          {summary}
        </Text>
      </Card>
    );
  }

  return (
    <Card style={{ gap: SPACING.lg }}>
      {reactionText && (
        <View style={{ flexDirection: 'row', gap: SPACING.sm, backgroundColor: colors.accentWash, borderRadius: RADIUS.input, padding: SPACING.sm }}>
          <Text style={{ fontSize: 14 }}>💬</Text>
          <Text variant="caption" style={{ color: colors.accentInk, flex: 1 }}>
            {reactionText}
          </Text>
        </View>
      )}

      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="caption" tone="tertiary">
            Set {setNumber} of {exercise.sets}
          </Text>
          {onRequestSwap && loggedSets.length === 0 && (
            <Pressable onPress={onRequestSwap} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text variant="caption" style={{ fontWeight: '700', color: colors.accentInk }}>
                Swap movement
              </Text>
            </Pressable>
          )}
        </View>
        <Text variant="cardTitle">{exercise.name}</Text>
        {isFirstSet && memory?.has_history && memory.last_session && (
          <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: 4 }}>
            <Text variant="caption" tone="secondary">
              Last: {formatWeight(memory.last_session.weight_kg, units)} × {memory.last_session.reps}
            </Text>
            {memory.best_session && (
              <Text variant="caption" tone="secondary">
                Best: {formatWeight(memory.best_session.weight_kg, units)} × {memory.best_session.reps}
              </Text>
            )}
          </View>
        )}
        {isFirstSet && memory && !memory.has_history && (
          <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
            First time logging this one — whatever you do today becomes the baseline.
          </Text>
        )}
        {coachNote && (
          <Text variant="caption" style={{ color: colors.accentInk, marginTop: 4 }}>
            {coachNote}
          </Text>
        )}
      </View>

      <View style={{ gap: 4 }}>
        <Text variant="caption" tone="tertiary">
          {setNumber === 1 && !coachNote ? 'Coach suggests' : 'Suggested'}
        </Text>
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
      </View>

      <Pressable onPress={() => setFeedbackOpen((v) => !v)} hitSlop={8}>
        <Text variant="caption" style={{ fontWeight: '700', color: colors.accentInk }}>
          {feedbackOpen ? 'Hide optional feedback' : 'How did that feel? (optional)'}
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
        label="Log it"
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
