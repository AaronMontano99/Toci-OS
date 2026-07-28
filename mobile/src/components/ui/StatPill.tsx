import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

interface StatPillProps {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  detail?: string;
  detailTone?: 'sage' | 'tertiary';
  progress?: number;
  onPress?: () => void;
}

// Compact single-stat card -- Steps/Water/Body Fat on Today, Consistency/Best
// Lift/Trend on Progress. One shared shape for every "one number, one label"
// tile in the app.
export function StatPill({ icon, label, value, detail, detailTone = 'tertiary', progress, onPress }: StatPillProps) {
  const { colors } = useTheme();

  const content = (
    <Card style={{ flex: 1, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {icon && <Ionicons name={icon} size={13} color={colors.textTertiary} />}
        <Text variant="microLabel" tone="tertiary" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text variant="bodyStrong">{value}</Text>
      {progress != null && <ProgressBar progress={progress} height={4} />}
      {detail && (
        <Text variant="caption" style={{ color: detailTone === 'sage' ? colors.sage : colors.textTertiary }}>
          {detail}
        </Text>
      )}
    </Card>
  );

  if (!onPress) return content;
  return <Pressable onPress={onPress}>{content}</Pressable>;
}

export function StatPillRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: SPACING.sm }}>{children}</View>;
}
