import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING } from '@/theme/tokens';

interface ExerciseOutlineRowProps {
  name: string;
  detail: string;
  state: 'active' | 'upcoming' | 'done';
  onPress?: () => void;
}

export function ExerciseOutlineRow({ name, detail, state, onPress }: ExerciseOutlineRowProps) {
  const { colors } = useTheme();
  const isActive = state === 'active';
  const isDone = state === 'done';

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderRadius: RADIUS.input,
        backgroundColor: isActive ? colors.accentWash : 'transparent',
        opacity: state === 'upcoming' ? 0.7 : 1,
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDone ? colors.sage : isActive ? colors.accent : colors.backgroundSecondary,
        }}
      >
        {isDone && <Ionicons name="checkmark" size={13} color="#fff" />}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          variant="bodyStrong"
          style={{
            textDecorationLine: isDone ? 'line-through' : 'none',
            color: isDone ? colors.textTertiary : isActive ? colors.accentInk : colors.textPrimary,
          }}
        >
          {name}
        </Text>
        <Text variant="caption" style={isActive ? { color: colors.accentInk, opacity: 0.8 } : { color: colors.textTertiary }}>
          {detail}
        </Text>
      </View>
    </Pressable>
  );
}
