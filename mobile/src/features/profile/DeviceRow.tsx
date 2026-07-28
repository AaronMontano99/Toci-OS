import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

interface DeviceRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  name: string;
  detail: string;
  connected: boolean;
}

export function DeviceRow({ icon, name, detail, connected }: DeviceRowProps) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xs }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={16} color={colors.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {connected && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.sage }} />}
          <Text variant="caption" tone="tertiary">
            {detail}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textDisabled} />
    </View>
  );
}
