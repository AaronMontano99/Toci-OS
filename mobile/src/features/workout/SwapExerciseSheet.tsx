import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { useExercises } from '@/api/hooks';
import { Exercise } from '@/api/types';
import { ListRow } from '@/components/ui/ListRow';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING } from '@/theme/tokens';

interface SwapExerciseSheetProps {
  visible: boolean;
  currentExerciseId: number | undefined;
  currentExerciseName: string | undefined;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
}

// On-the-fly movement swap: the machine's taken, the equipment isn't there --
// same slot in the plan, different exercise. Same muscle group surfaces
// first since that's the honest substitute; everything else is one search
// away rather than hidden.
export function SwapExerciseSheet({ visible, currentExerciseId, currentExerciseName, onClose, onSelect }: SwapExerciseSheetProps) {
  const { colors } = useTheme();
  const { data: exercises } = useExercises();
  const [query, setQuery] = useState('');

  const currentMuscleGroup = useMemo(
    () => exercises?.find((e) => e.id === currentExerciseId)?.primary_muscle_group,
    [exercises, currentExerciseId],
  );

  const { sameGroup, rest } = useMemo(() => {
    const pool = (exercises ?? []).filter((e) => e.id !== currentExerciseId);
    const q = query.trim().toLowerCase();
    const filtered = q ? pool.filter((e) => e.name.toLowerCase().includes(q)) : pool;
    if (!currentMuscleGroup) return { sameGroup: [] as Exercise[], rest: filtered };
    return {
      sameGroup: filtered.filter((e) => e.primary_muscle_group === currentMuscleGroup),
      rest: filtered.filter((e) => e.primary_muscle_group !== currentMuscleGroup),
    };
  }, [exercises, currentExerciseId, currentMuscleGroup, query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} />
      <View
        style={{
          backgroundColor: colors.card,
          borderTopLeftRadius: RADIUS.sheet,
          borderTopRightRadius: RADIUS.sheet,
          maxHeight: '75%',
          paddingHorizontal: SPACING.lg,
          paddingTop: SPACING.md,
          paddingBottom: SPACING.xl,
          gap: SPACING.md,
        }}
      >
        <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
        <View>
          <Text variant="cardTitle">Swap movement</Text>
          <Text variant="caption" tone="tertiary">
            {currentExerciseName ? `Replacing ${currentExerciseName} for this workout only` : 'Pick a replacement for this workout only'}
          </Text>
        </View>
        <TextField placeholder="Search exercises" value={query} onChangeText={setQuery} autoCorrect={false} />
        <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 420 }}>
          {sameGroup.length > 0 && (
            <View style={{ marginBottom: SPACING.sm }}>
              <Text variant="caption" tone="tertiary" style={{ marginBottom: 2 }}>
                SAME MUSCLE GROUP
              </Text>
              {sameGroup.map((ex) => (
                <ListRow key={ex.id} label={ex.name} detail={ex.primary_muscle_group} showChevron={false} onPress={() => onSelect(ex)} />
              ))}
            </View>
          )}
          {rest.length > 0 && (
            <View>
              <Text variant="caption" tone="tertiary" style={{ marginBottom: 2 }}>
                OTHER EXERCISES
              </Text>
              {rest.map((ex) => (
                <ListRow key={ex.id} label={ex.name} detail={ex.primary_muscle_group} showChevron={false} onPress={() => onSelect(ex)} />
              ))}
            </View>
          )}
          {sameGroup.length === 0 && rest.length === 0 && (
            <Text variant="body" tone="tertiary" style={{ paddingVertical: SPACING.lg }} center>
              No matching exercises.
            </Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
