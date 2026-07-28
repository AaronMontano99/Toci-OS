import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { LoggedSet } from '@/api/types';
import { IconButton } from '@/components/ui/IconButton';
import { Stepper } from '@/components/ui/Stepper';
import { Text } from '@/components/ui/Text';
import { formatWeight, kgToDisplay, weightStep, Units } from '@/lib/units';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING } from '@/theme/tokens';

interface LoggedSetsListProps {
  sets: LoggedSet[];
  units: Units;
  onUpdate: (setId: number, input: { actual_reps: number; actual_load_kg: number }) => void;
  onDelete: (setId: number) => void;
}

// Tap a logged set to fix it (typo'd weight, wrong reps) instead of the only
// prior recourse -- delete and re-log, which loses the set's position in the
// exercise. Kept collapsed by default so a normal review of "what did I just
// do" doesn't turn into a wall of steppers.
export function LoggedSetsList({ sets, units, onUpdate, onDelete }: LoggedSetsListProps) {
  const [editingId, setEditingId] = useState<number | null>(null);

  if (sets.length === 0) return null;

  return (
    <View style={{ gap: 4 }}>
      {sets.map((set, i) =>
        editingId === set.id ? (
          <EditingRow
            key={set.id}
            set={set}
            index={i + 1}
            units={units}
            onSave={(input) => {
              onUpdate(set.id, input);
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <LoggedSetRow key={set.id} set={set} index={i + 1} units={units} onEdit={() => setEditingId(set.id)} onDelete={() => onDelete(set.id)} />
        ),
      )}
    </View>
  );
}

function LoggedSetRow({ set, index, units, onEdit, onDelete }: { set: LoggedSet; index: number; units: Units; onEdit: () => void; onDelete: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onEdit}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}
    >
      <Text variant="body" tone="secondary">
        Set {index}: {formatWeight(set.weight_kg, units)} × {set.reps ?? '—'}
        {set.feel ? ` · ${set.feel}` : ''}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <Ionicons name="pencil-outline" size={14} color={colors.textTertiary} />
        <IconButton name="trash-outline" size={14} background={false} onPress={onDelete} />
      </View>
    </Pressable>
  );
}

function EditingRow({
  set,
  index,
  units,
  onSave,
  onCancel,
}: {
  set: LoggedSet;
  index: number;
  units: Units;
  onSave: (input: { actual_reps: number; actual_load_kg: number }) => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const [weightKg, setWeightKg] = useState(set.weight_kg ?? 0);
  const [reps, setReps] = useState(set.reps ?? 0);
  const step = weightStep(units);
  const displayWeight = Math.round(kgToDisplay(weightKg, units) * 10) / 10;

  return (
    <View style={{ gap: SPACING.sm, backgroundColor: colors.backgroundSecondary, borderRadius: RADIUS.input, padding: SPACING.sm }}>
      <Text variant="caption" tone="tertiary">
        Editing set {index}
      </Text>
      <View style={{ gap: SPACING.sm }}>
        <Stepper
          label={`WEIGHT (${units === 'imperial' ? 'lb' : 'kg'})`}
          value={displayWeight}
          step={step}
          min={0}
          onChange={(v) => setWeightKg(units === 'imperial' ? v * 0.45359237 : v)}
        />
        <Stepper label="REPS" value={reps} step={1} min={0} onChange={setReps} />
      </View>
      <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
        <Pressable
          onPress={() => onSave({ actual_reps: reps, actual_load_kg: weightKg })}
          style={{ flex: 1, alignItems: 'center', paddingVertical: SPACING.sm, borderRadius: RADIUS.input, backgroundColor: colors.accent }}
        >
          <Text variant="bodyStrong" style={{ color: colors.onAccent }}>
            Save
          </Text>
        </Pressable>
        <Pressable onPress={onCancel} style={{ flex: 1, alignItems: 'center', paddingVertical: SPACING.sm }}>
          <Text variant="bodyStrong" style={{ color: colors.textSecondary }}>
            Cancel
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
