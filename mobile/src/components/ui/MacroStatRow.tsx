import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

export interface MacroStatItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  target?: string;
  progress?: number;
}

interface MacroStatRowProps {
  items: MacroStatItem[];
  onPress?: () => void;
}

// The 4-column Calories/Protein/Carbs/Fat row on Today and Nutrition -- one
// shared card so both screens read identically.
export function MacroStatRow({ items, onPress }: MacroStatRowProps) {
  const { colors } = useTheme();

  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
      {items.map((item, i) => (
        <View key={item.label} style={{ flex: 1, gap: 4, paddingLeft: i === 0 ? 0 : SPACING.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name={item.icon} size={13} color={colors.textTertiary} />
            <Text variant="microLabel" tone="tertiary">
              {item.label}
            </Text>
          </View>
          <Text variant="bodyStrong">
            {item.value}
            {item.target ? (
              <Text variant="caption" tone="tertiary">
                {' '}
                of {item.target}
              </Text>
            ) : null}
          </Text>
          {item.progress != null && <ProgressBar progress={item.progress} height={4} />}
        </View>
      ))}
      {onPress && <IconButton name="chevron-forward" size={16} onPress={onPress} background={false} />}
    </Card>
  );
}
