import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING } from '@/theme/tokens';

interface OptionCardProps {
  label: string;
  detail?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  selected?: boolean;
  onPress?: () => void;
  compact?: boolean; // tighter card for grid-style options (days, session length)
}

// The one interaction worth borrowing wholesale from the Deepstash reference:
// tap an option and it visually commits immediately -- accent fill, border,
// checkmark, a light haptic -- rather than waiting for a separate "Continue"
// tap to confirm the choice happened.
export function OptionCard({ label, detail, icon, selected, onPress, compact }: OptionCardProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: SPACING.base,
          paddingVertical: compact ? SPACING.base : SPACING.lg,
          paddingHorizontal: SPACING.lg,
          borderRadius: RADIUS.card,
          borderWidth: 1.5,
          backgroundColor: selected ? colors.accentWash : colors.card,
          borderColor: selected ? colors.accentBorder : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {icon && (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: selected ? colors.accent : colors.backgroundSecondary,
          }}
        >
          <Ionicons name={icon} size={20} color={selected ? colors.onAccent : colors.textSecondary} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" style={selected ? { color: colors.accentInk } : undefined}>
          {label}
        </Text>
        {detail && (
          <Text variant="caption" tone={selected ? 'accent' : 'tertiary'} style={selected ? { opacity: 0.85 } : undefined}>
            {detail}
          </Text>
        )}
      </View>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1.5,
          borderColor: selected ? colors.accent : colors.border,
          backgroundColor: selected ? colors.accent : 'transparent',
        }}
      >
        {selected && <Ionicons name="checkmark" size={15} color={colors.onAccent} />}
      </View>
    </Pressable>
  );
}
