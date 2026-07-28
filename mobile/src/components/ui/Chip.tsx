import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING } from '@/theme/tokens';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'accent' | 'neutral';
}

export function Chip({ label, selected, onPress, tone = 'accent' }: ChipProps) {
  const { colors } = useTheme();
  const activeBg = tone === 'accent' ? colors.accentWash : colors.backgroundSecondary;
  const activeBorder = tone === 'accent' ? colors.accentBorder : colors.border;

  return (
    <Pressable
      onPress={() => {
        if (onPress) {
          Haptics.selectionAsync().catch(() => {});
          onPress();
        }
      }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? activeBg : colors.card,
          borderColor: selected ? activeBorder : colors.border,
        },
      ]}
    >
      <Text
        variant="caption"
        style={{ fontWeight: '600', color: selected ? colors.accentInk : colors.textSecondary }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 36,
    paddingHorizontal: SPACING.base,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
