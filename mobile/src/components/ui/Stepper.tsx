import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING } from '@/theme/tokens';

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
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const nudge = (delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    onChange(Number(clamp(value + delta).toFixed(2)));
  };

  return (
    <View style={{ alignItems: 'center', gap: SPACING.xs }}>
      {label && (
        <Text variant="microLabel" tone="tertiary">
          {label}
        </Text>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.base }}>
        <StepButton icon="remove" onPress={() => nudge(-step)} />
        <Text variant={large ? 'heroMetric' : 'sectionTitle'} style={{ minWidth: 88, textAlign: 'center' }}>
          {formatValue ? formatValue(value) : value}
        </Text>
        <StepButton icon="add" onPress={() => nudge(step)} />
      </View>
    </View>
  );
}

function StepButton({ icon, onPress }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
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
