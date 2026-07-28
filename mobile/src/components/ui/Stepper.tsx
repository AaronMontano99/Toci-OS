import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING, TYPE } from '@/theme/tokens';

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  step: number;
  min?: number;
  max?: number;
  label?: string;
  formatValue?: (value: number) => string;
  large?: boolean;
}

export function Stepper({ value, onChange, step, min = 0, max = 9999, label, formatValue, large }: StepperProps) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft != null;

  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const nudge = (delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    onChange(Number(clamp(value + delta).toFixed(2)));
  };

  const commitDraft = () => {
    const parsed = Number(draft);
    if (draft && draft.trim() !== '' && !Number.isNaN(parsed)) {
      onChange(Number(clamp(parsed).toFixed(2)));
    }
    setDraft(null);
  };

  return (
    <View style={{ alignItems: 'center', gap: SPACING.xs }}>
      {label && (
        <Text variant="microLabel" tone="tertiary">
          {label}
        </Text>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.base }}>
        <StepButton icon="remove" onPress={() => nudge(-step)} label="Decrease" testID="stepper-decrement" />
        {editing ? (
          <TextInput
            autoFocus
            testID="stepper-input"
            value={draft}
            onChangeText={setDraft}
            onBlur={commitDraft}
            onSubmitEditing={commitDraft}
            keyboardType="decimal-pad"
            selectTextOnFocus
            style={[
              TYPE[large ? 'heroMetric' : 'sectionTitle'],
              {
                width: 88,
                minWidth: 88,
                maxWidth: 88,
                flexGrow: 0,
                flexShrink: 0,
                textAlign: 'center',
                color: colors.textPrimary,
                padding: 0,
              },
            ]}
          />
        ) : (
          <Pressable
            testID="stepper-value"
            accessibilityLabel={label ? `Edit ${label}` : 'Edit value'}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setDraft(String(value));
            }}
            hitSlop={8}
          >
            <Text variant={large ? 'heroMetric' : 'sectionTitle'} style={{ minWidth: 88, textAlign: 'center' }}>
              {formatValue ? formatValue(value) : value}
            </Text>
          </Pressable>
        )}
        <StepButton icon="add" onPress={() => nudge(step)} label="Increase" testID="stepper-increment" />
      </View>
    </View>
  );
}

function StepButton({
  icon,
  onPress,
  label,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: RADIUS.input,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.backgroundSecondary,
        opacity: pressed ? 0.7 : 1,
      })}
      hitSlop={6}
    >
      <Ionicons name={icon} size={20} color={colors.textPrimary} />
    </Pressable>
  );
}
