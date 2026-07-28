import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

interface ListRowProps {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  detail?: string;
  onPress?: () => void;
  showChevron?: boolean;
}

export function ListRow({ icon, label, detail, onPress, showChevron = true }: ListRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
        paddingVertical: SPACING.md,
        opacity: pressed ? 0.7 : 1,
        minHeight: 44,
      })}
    >
      {icon && (
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={17} color={colors.textSecondary} />
        </View>
      )}
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
      {detail && (
        <Text variant="caption" tone="tertiary">
          {detail}
        </Text>
      )}
      {onPress && showChevron && <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />}
    </Pressable>
  );
}
