import React from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

interface CoachNoteCardProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function CoachNoteCard({ title, message, actionLabel, onAction }: CoachNoteCardProps) {
  const { colors } = useTheme();

  return (
    <Card style={{ gap: SPACING.sm }}>
      <Text variant="microLabel" tone="tertiary">
        COACH NOTES
      </Text>
      <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.accentWash,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 16 }}>✨</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong">{title}</Text>
          <Text variant="caption" tone="secondary">
            {message}
          </Text>
        </View>
      </View>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} style={{ alignSelf: 'flex-start' }}>
          <Text variant="caption" style={{ fontWeight: '700', color: colors.accentInk }}>
            {actionLabel} · Coach Toci
          </Text>
        </Pressable>
      )}
    </Card>
  );
}
