import React from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING } from '@/theme/tokens';

type Semantic = 'sage' | 'recoveryBlue' | 'warmAmber' | 'mutedTerracotta' | 'plumGray' | 'accent';

interface InsightCardProps {
  tone: Semantic;
  icon: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

// Coach observation card — semantic wash + concise statement, design-system.md §9.
export function InsightCard({ tone, icon, text, actionLabel, onAction }: InsightCardProps) {
  const { colors } = useTheme();
  const wash = {
    sage: 'rgba(141, 170, 145, 0.14)',
    recoveryBlue: 'rgba(169, 197, 216, 0.16)',
    warmAmber: 'rgba(221, 179, 108, 0.16)',
    mutedTerracotta: 'rgba(201, 123, 99, 0.14)',
    plumGray: 'rgba(142, 132, 150, 0.14)',
    accent: colors.accentWash,
  }[tone];
  const ink = tone === 'accent' ? colors.accentInk : colors[tone];
  // `accentWash` is a solid pastel fill (not a translucent tint like the
  // other semantic washes), so it needs the accent's own ink color rather
  // than the theme's default light-mode-agnostic primary text.
  const textColor = tone === 'accent' ? colors.accentInk : colors.textPrimary;

  return (
    <Card variant="flat" style={{ backgroundColor: wash, borderColor: 'transparent', gap: SPACING.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: RADIUS.small,
            backgroundColor: colors.card,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 14 }}>{icon}</Text>
        </View>
        <Text variant="body" style={{ flex: 1, color: textColor }}>
          {text}
        </Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={{ alignSelf: 'flex-start', marginLeft: 36 }}>
          <Text variant="caption" style={{ fontWeight: '700', color: ink }}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}
